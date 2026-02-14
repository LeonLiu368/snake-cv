import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHeadTracking } from './useHeadTracking'
import { getNextSnakeState, randomFood } from './gameLogic'
import './App.css'

const GRID_SIZE = 18
const START_SPEED = 140
const SPEED_MIN = 80
const BEST_STORAGE_KEY = 'snakecv_best'
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

function loadBest() {
  try {
    const v = parseInt(localStorage.getItem(BEST_STORAGE_KEY) ?? '0', 10)
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
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
  const [best, setBest] = useState(loadBest)
  const [status, setStatus] = useState('Press Start')
  const [restartPulse, setRestartPulse] = useState(false)
  const [scorePop, setScorePop] = useState(false)
  const [faceEnabled, setFaceEnabled] = useState(true)
  const [sensitivity, setSensitivity] = useState(1)
  const queuedDirection = useRef(direction)
  const gameOverButtonRef = useRef(null)
  const pausedButtonRef = useRef(null)

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
    calibrationMessage,
    recalibrate: headRecalibrate,
    retry: headRetry,
  } = useHeadTracking({
    faceEnabled,
    onDirectionChange: handleDirectionChange,
    sensitivity,
  })

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

  const handleStart = useCallback(() => {
    if (!running) {
      if (status === 'Game Over') {
        reset()
      }
      headRecalibrate()
      setRunning(true)
      setStatus('Running')
      setRestartPulse(true)
    }
  }, [running, status, reset, headRecalibrate])

  useEffect(() => {
    if (best > 0) {
      try {
        localStorage.setItem(BEST_STORAGE_KEY, String(best))
      } catch {
        /* ignore */
      }
    }
  }, [best])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === ' ') {
        event.preventDefault()
        if (running) {
          setRunning(false)
          setStatus('Paused')
        } else if (status === 'Paused') {
          setRunning(true)
          setStatus('Running')
        }
        return
      }
      if (event.key === 'Enter') {
        if (
          !running &&
          ['Press Start', 'Ready', 'Game Over', 'Paused'].includes(status)
        ) {
          handleStart()
        }
        return
      }
      const next = DIRECTIONS[event.key]
      if (!next) return
      if (direction.x + next.x === 0 && direction.y + next.y === 0) return
      queuedDirection.current = next
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [direction, running, status, handleStart])

  useEffect(() => {
    if (!running) return undefined
    const delay = Math.max(SPEED_MIN, START_SPEED - score * 2)
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
    }, delay)
    return () => clearInterval(interval)
  }, [food, running, score])

  const handlePause = () => {
    setRunning(false)
    setStatus('Paused')
  }

  const handleRecalibrate = () => {
    headRecalibrate()
  }

  const noseVector = noseOffset

  useEffect(() => {
    if (status === 'Game Over') {
      gameOverButtonRef.current?.focus()
    }
  }, [status])
  useEffect(() => {
    if (status === 'Paused') {
      pausedButtonRef.current?.focus()
    }
  }, [status])

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
          <label className="sensitivity-label">
            <span className="sensitivity-text">Sensitivity</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.25"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value, 10))}
              aria-label="Head tracking sensitivity"
            />
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
                  ref={gameOverButtonRef}
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
                  ref={pausedButtonRef}
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
                  {calibrationMessage}
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
