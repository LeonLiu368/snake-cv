import { useEffect, useRef, useState } from 'react'
import { PELLET_RADIUS, HEAD_RADIUS, BODY_RADIUS } from './slitherLogic.js'

/** Mix hex color with white; amount 0 = original, 1 = white. */
function brightenColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  const r2 = Math.round(r + (255 - r) * amount)
  const g2 = Math.round(g + (255 - g) * amount)
  const b2 = Math.round(b + (255 - b) * amount)
  return `rgb(${r2},${g2},${b2})`
}

/**
 * Canvas renderer for slither game state.
 * Camera follows the longest snake or the player snake; reports mouse position in world coords.
 * @param {{ state: { snakes: Array<{ segments: Array<{x,y}>, color: string, isPlayer?: boolean }>, pellets: Array<{x,y}>, bounds: { width, height } } }, onMouseMove?: (worldX: number, worldY: number) => void, playerDeadSnake?: { segments: Array<{x,y}>, color: string } | null, deathAnimationProgress?: number | null, speedBoostActive?: boolean, speedBoostProgress?: number }} props
 */
const MINIMAP_SIZE = 140
const MINIMAP_MARGIN = 4

export function SlitherView({ state, onMouseMove, playerDeadSnake, deathAnimationProgress, speedBoostActive, speedBoostProgress }) {
  const canvasRef = useRef(null)
  const minimapRef = useRef(null)
  const wrapRef = useRef(null)
  const cameraRef = useRef({ scale: 1, camX: 0, camY: 0 })
  const [resizeTick, setResizeTick] = useState(0)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const setSize = () => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        setResizeTick((t) => t + 1)
      }
    }
    setSize()
    const ResizeObserverCtor = typeof window !== 'undefined' ? window.ResizeObserver : null
    if (!ResizeObserverCtor) return
    const ro = new ResizeObserverCtor(setSize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !state) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { snakes, pellets, bounds } = state

    const player = snakes.find((s) => s.isPlayer)
    const longest = snakes.reduce(
      (best, s) => (s.segments.length > (best?.segments.length ?? 0) ? s : best),
      null,
    )
    const focus =
      (playerDeadSnake?.segments?.[0] ??
        (player ?? longest)?.segments?.[0]) ??
      { x: bounds.width / 2, y: bounds.height / 2 }

    let scale = Math.min(
      canvas.width / (bounds.width * 0.5),
      canvas.height / (bounds.height * 0.5),
      1.8,
    )
    if (speedBoostActive && speedBoostProgress != null) {
      scale = scale * (1 - 0.15 * Math.sin(speedBoostProgress * Math.PI))
    }
    const camX = canvas.width / 2 - focus.x * scale
    const camY = canvas.height / 2 - focus.y * scale
    cameraRef.current = { scale, camX, camY }

    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.translate(camX, camY)
    ctx.scale(scale, scale)

    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1 / scale
    ctx.strokeRect(0, 0, bounds.width, bounds.height)

    for (const pellet of pellets) {
      ctx.fillStyle = 'rgba(255, 200, 60, 1)'
      ctx.beginPath()
      ctx.arc(pellet.x, pellet.y, PELLET_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 230, 120, 0.8)'
      ctx.lineWidth = 1.5 / scale
      ctx.stroke()
    }

    for (const snake of snakes) {
      const segs = snake.segments
      if (segs.length < 2) continue
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const bodyWidth = (BODY_RADIUS * 2) / scale
      const head = segs[0]
      const tail = segs[segs.length - 1]
      ctx.beginPath()
      ctx.moveTo(segs[0].x, segs[0].y)
      for (let i = 1; i < segs.length; i++) {
        ctx.lineTo(segs[i].x, segs[i].y)
      }
      const isPlayerBoost = snake.isPlayer && speedBoostActive && speedBoostProgress != null
      if (isPlayerBoost) {
        const pulse = 0.5 + 0.5 * Math.sin(speedBoostProgress * Math.PI * 6)
        ctx.save()
        ctx.shadowColor = snake.color
        ctx.shadowBlur = (12 + pulse * 8) / scale
        ctx.strokeStyle = snake.color
        ctx.lineWidth = bodyWidth + 10 / scale
        ctx.globalAlpha = 0.25 + pulse * 0.15
        ctx.stroke()
        ctx.restore()
        ctx.beginPath()
        ctx.moveTo(segs[0].x, segs[0].y)
        for (let i = 1; i < segs.length; i++) {
          ctx.lineTo(segs[i].x, segs[i].y)
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'
      ctx.lineWidth = bodyWidth + 6 / scale
      ctx.stroke()
      const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y)
      grad.addColorStop(0, brightenColor(snake.color, 0.35))
      grad.addColorStop(1, snake.color)
      ctx.strokeStyle = grad
      ctx.lineWidth = bodyWidth
      ctx.stroke()
      ctx.fillStyle = snake.color
      ctx.beginPath()
      ctx.arc(head.x, head.y, HEAD_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'
      ctx.lineWidth = 1.2 / scale
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.arc(head.x - 2.5, head.y - 2.5, HEAD_RADIUS * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }

    if (playerDeadSnake && deathAnimationProgress != null && deathAnimationProgress < 1) {
      const snake = playerDeadSnake
      const segs = snake.segments
      if (segs.length >= 2) {
        const head = segs[0]
        const tail = segs[segs.length - 1]
        const progress = deathAnimationProgress
        const s = Math.max(0.01, 1 - 0.5 * progress)
        ctx.save()
        ctx.globalAlpha = 1 - progress
        ctx.translate(head.x, head.y)
        ctx.scale(s, s)
        ctx.translate(-head.x, -head.y)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const bodyWidth = (BODY_RADIUS * 2) / scale
        ctx.beginPath()
        ctx.moveTo(segs[0].x, segs[0].y)
        for (let i = 1; i < segs.length; i++) {
          ctx.lineTo(segs[i].x, segs[i].y)
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.lineWidth = bodyWidth + 6 / scale
        ctx.stroke()
        const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y)
        grad.addColorStop(0, brightenColor(snake.color, 0.35))
        grad.addColorStop(1, snake.color)
        ctx.strokeStyle = grad
        ctx.lineWidth = bodyWidth
        ctx.stroke()
        ctx.fillStyle = snake.color
        ctx.beginPath()
        ctx.arc(head.x, head.y, HEAD_RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'
        ctx.lineWidth = 1.2 / scale
        ctx.stroke()
        ctx.restore()
      }
    }

    ctx.restore()

    const minimapCanvas = minimapRef.current
    if (minimapCanvas && bounds) {
      const mW = MINIMAP_SIZE
      const mH = MINIMAP_SIZE
      if (minimapCanvas.width !== mW || minimapCanvas.height !== mH) {
        minimapCanvas.width = mW
        minimapCanvas.height = mH
      }
      const mCtx = minimapCanvas.getContext('2d')
      if (!mCtx) return
      const drawW = mW - MINIMAP_MARGIN * 2
      const drawH = mH - MINIMAP_MARGIN * 2
      const mScale = Math.min(drawW / bounds.width, drawH / bounds.height)
      const mOx = MINIMAP_MARGIN
      const mOy = MINIMAP_MARGIN
      mCtx.fillStyle = 'rgba(0,0,0,0.75)'
      mCtx.fillRect(0, 0, mW, mH)
      mCtx.strokeStyle = 'rgba(255,255,255,0.12)'
      mCtx.lineWidth = 1
      mCtx.strokeRect(mOx, mOy, bounds.width * mScale, bounds.height * mScale)
      for (const p of pellets) {
        mCtx.fillStyle = 'rgba(255, 200, 60, 0.9)'
        mCtx.beginPath()
        mCtx.arc(mOx + p.x * mScale, mOy + p.y * mScale, 1, 0, Math.PI * 2)
        mCtx.fill()
      }
      for (const snake of snakes) {
        const head = snake.segments[0]
        const mx = mOx + head.x * mScale
        const my = mOy + head.y * mScale
        const isPlayer = snake.isPlayer
        mCtx.fillStyle = snake.color
        mCtx.beginPath()
        mCtx.arc(mx, my, isPlayer ? 3 : 2, 0, Math.PI * 2)
        mCtx.fill()
        if (isPlayer) {
          mCtx.strokeStyle = 'rgba(255,255,255,0.9)'
          mCtx.lineWidth = 1
          mCtx.beginPath()
          mCtx.arc(mx, my, 4, 0, Math.PI * 2)
          mCtx.stroke()
        }
      }
      const { scale, camX, camY } = cameraRef.current
      const vw = canvas.width / scale
      const vh = canvas.height / scale
      const vx = mOx + (-camX / scale) * mScale
      const vy = mOy + (-camY / scale) * mScale
      mCtx.strokeStyle = 'rgba(255,255,255,0.35)'
      mCtx.lineWidth = 1
      mCtx.strokeRect(vx, vy, vw * mScale, vh * mScale)
    }
  }, [state, resizeTick, playerDeadSnake, deathAnimationProgress, speedBoostActive, speedBoostProgress])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !onMouseMove) return
    const handleMove = (e) => {
      const { scale, camX, camY } = cameraRef.current
      const worldX = (e.offsetX - camX) / scale
      const worldY = (e.offsetY - camY) / scale
      onMouseMove(worldX, worldY)
    }
    canvas.addEventListener('mousemove', handleMove)
    return () => canvas.removeEventListener('mousemove', handleMove)
  }, [onMouseMove])

  return (
    <div ref={wrapRef} className="slither-canvas-wrap">
      <canvas ref={canvasRef} className="slither-canvas" aria-label="Slither game view" />
      <div className="slither-minimap-wrap">
        <canvas
          ref={minimapRef}
          className="slither-minimap"
          aria-label="Minimap of game area"
        />
      </div>
    </div>
  )
}
