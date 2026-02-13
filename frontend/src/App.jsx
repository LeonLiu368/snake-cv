import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHeadTracking } from './useHeadTracking'
import { getNextSnakeState, randomFood } from './gameLogic'
import './App.css'

const GRID_SIZE = 18
const START_SPEED = 140
const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
}

function App() {
  const [snake, setSnake] = useState([
    { x: 6, y: 9 },
    { x: 5, y: 9 },
    { x: 4, y: 9 },
  ])
  const [food, setFood] = useState(() =>
    randomFood([{ x: 6, y: 9 }], GRID_SIZE),
  )
  const [direction, setDirection] = useState({ x: 1, y: 0 })
  const [running, setRunning] = useState(false)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [status, setStatus] = useState('Press Start')
  const [restartPulse, setRestartPulse] = useState(false)
  const [scorePop, setScorePop] = useState(false)
  const [faceEnabled, setFaceEnabled] = useState(true)
  const queuedDirection = useRef(direction)

  const handleDirectionChange = useCallback((vec) => {
    const cur = queuedDirection.current
    if (cur.x + vec.x === 0 && cur.y + vec.y === 0) return
    queuedDirection.current = vec
  }, [])

  const {
    videoRef,
    canvasRef,
    cameraStatus,
    headDirection,
    noseOffset,
    fps,
    trackingStatus,
    isCalibrating,
    calibrationProgress,
    recalibrate: headRecalibrate,
    retry: headRetry,
  } = useHeadTracking({ faceEnabled, onDirectionChange: handleDirectionChange })

  const boardCells = useMemo(
    () => Array.from({ length: GRID_SIZE * GRID_SIZE }),
    [],
  )

  const reset = useCallback(() => {
    const freshSnake = [
      { x: 6, y: 9 },
      { x: 5, y: 9 },
      { x: 4, y: 9 },
    ]
    setSnake(freshSnake)
    setFood(randomFood(freshSnake, GRID_SIZE))
    setDirection({ x: 1, y: 0 })
    queuedDirection.current = { x: 1, y: 0 }
    setScore(0)
    setStatus('Ready')
  }, [])

  useEffect(() => {
    const handleKey = (event) => {
      const next = DIRECTIONS[event.key]
      if (!next) return
      if (direction.x + next.x === 0 && direction.y + next.y === 0) return
      queuedDirection.current = next
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [direction])

  useEffect(() => {
    if (!running) return undefined
    const interval = setInterval(() => {
      setSnake((prev) => {
        const nextDirection = queuedDirection.current
        setDirection(nextDirection)
        const { nextSnake, ateFood, gameOver } = getNextSnakeState(
          prev,
          nextDirection,
          food,
          GRID_SIZE,
        )
        if (gameOver) {
          setRunning(false)
          setStatus('Game Over')
          setBest((current) => Math.max(current, score))
          return prev
        }
        if (ateFood) {
          const nextScore = score + 10
          setScore(nextScore)
          setScorePop(true)
          setFood(randomFood(nextSnake, GRID_SIZE))
          return nextSnake
        }
        return nextSnake
      })
    }, START_SPEED)
    return () => clearInterval(interval)
  }, [food, running, score])

  const handleStart = () => {
    if (!running) {
      if (status === 'Game Over') {
        reset()
      }
      headRecalibrate()
      setRunning(true)
      setStatus('Running')
      setRestartPulse(true)
    }
  }

  const handlePause = () => {
    setRunning(false)
    setStatus('Paused')
  }

  const handleRecalibrate = () => {
    headRecalibrate()
  }

  const noseVector = noseOffset

  useEffect(() => {
    if (!restartPulse) return undefined
    const timer = setTimeout(() => setRestartPulse(false), 320)
    return () => clearTimeout(timer)
  }, [restartPulse])

  useEffect(() => {
    if (!scorePop) return undefined
    const timer = setTimeout(() => setScorePop(false), 520)
    return () => clearTimeout(timer)
  }, [scorePop])

  return (
    <div className="app">
      <header className="hud">
        <div className="title">
          <p className="eyebrow">SnakeCV</p>
          <h1>{status}</h1>
        </div>
        <div className="stats">
          <div>
            <p className="label">Score</p>
            <div className="score-value">
              <p className="value">{score}</p>
              <span className={`score-pop ${scorePop ? 'show' : ''}`}>+1</span>
            </div>
          </div>
          <div>
            <p className="label">Best</p>
            <p className="value">{best}</p>
          </div>
        </div>
        <div className="actions">
          <button className="primary" onClick={handleStart}>
            Start
          </button>
          <button className="ghost" onClick={handlePause}>
            Pause
          </button>
          <button className="ghost" onClick={handleRecalibrate}>
            Recalibrate
          </button>
          <label className="toggle">
            <input
              type="checkbox"
              checked={faceEnabled}
              onChange={(event) => setFaceEnabled(event.target.checked)}
            />
            <span className="toggle-track" />
            <span className="toggle-knob" />
            <span className="toggle-label">Face</span>
          </label>
        </div>
      </header>

      <main className="arena">
        <div className="board playable">
          <div className="grid" />
          <div
            className={[
              'board-cells',
              status === 'Game Over' ? 'snake-out' : '',
              restartPulse ? 'snake-in' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {boardCells.map((_, idx) => {
              const x = idx % GRID_SIZE
              const y = Math.floor(idx / GRID_SIZE)
              const isSnake = snake.some((seg) => seg.x === x && seg.y === y)
              const isHead = snake[0].x === x && snake[0].y === y
              const isFood = food.x === x && food.y === y
              const className = [
                'cell',
                isSnake ? 'snake' : '',
                isHead ? 'head' : '',
                isFood ? 'food' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return <span key={idx} className={className} />
            })}
          </div>
          {status === 'Game Over' ? (
            <div
              className="board-overlay game-over"
              role="dialog"
              aria-label="Game Over"
            >
              <div className="board-overlay-content">
                <h2 className="board-overlay-title">Game Over</h2>
                <p className="board-overlay-sub">Best: {best}</p>
                <button
                  type="button"
                  className="primary board-overlay-cta"
                  onClick={handleStart}
                >
                  Play again
                </button>
              </div>
            </div>
          ) : null}
          {status === 'Paused' ? (
            <div
              className="board-overlay paused"
              role="dialog"
              aria-label="Paused"
            >
              <div className="board-overlay-content">
                <h2 className="board-overlay-title">Paused</h2>
                <p className="board-overlay-sub">Press Start to resume</p>
                <button
                  type="button"
                  className="primary board-overlay-cta"
                  onClick={handleStart}
                >
                  Resume
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="camera-panel">
          <div className="camera-frame">
            <video ref={videoRef} muted playsInline />
            <canvas ref={canvasRef} />
            {trackingStatus === 'error' ? (
              <div className="camera-error-overlay">
                <p className="camera-error-text">Camera access failed</p>
                <button type="button" className="primary" onClick={headRetry}>
                  Retry
                </button>
              </div>
            ) : null}
            {isCalibrating ? (
              <div
                className="camera-calibration-overlay"
                role="status"
                aria-live="polite"
                aria-label="Calibrating head tracking"
              >
                <p className="camera-calibration-text">
                  Look at the camera, hold still…
                </p>
                <div className="camera-calibration-bar" aria-hidden="true">
                  <div
                    className="camera-calibration-fill"
                    style={{ width: `${calibrationProgress * 100}%` }}
                  />
                </div>
              </div>
            ) : null}
            <div className="camera-badges">
              <p className="fps-badge">{fps} fps</p>
              {headDirection ? (
                <p className="camera-direction">{headDirection}</p>
              ) : null}
            </div>
            <p className="camera-status">{cameraStatus}</p>
            <div className="nose-compass" aria-hidden="true">
              <span
                className="nose-dot"
                style={{
                  transform: `translate(${noseVector.x}px, ${noseVector.y}px)`,
                }}
              />
              <span className="nose-ring" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
