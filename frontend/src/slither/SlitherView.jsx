import { useEffect, useRef, useState } from 'react'
import { PELLET_RADIUS, HEAD_RADIUS, BODY_RADIUS, MAGNET_RADIUS, toroidalDistSq } from './slitherLogic.js'

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

const EPS = 1e-6
/** Allow crossings at segment endpoints (t === 0 or t === 1) so we split at the boundary until the last piece has crossed. */
const T_MIN = -1e-6
const T_MAX = 1 + 1e-6

/**
 * Return 1 or 2 line segments to draw a toroidal line from p1 to p2.
 * Draw as two segments when the segment crosses a boundary; as one only when both
 * endpoints are on the same side (i.e. the last piece has crossed the boundary).
 * Each segment is [x1, y1, x2, y2] in world coords within bounds.
 * @param {{ x: number, y: number }} p1
 * @param {{ x: number, y: number }} p2
 * @param {{ width: number, height: number }} bounds
 * @returns {Array<[number, number, number, number]>}
 */
function toroidalLineSegments(p1, p2, bounds) {
  const w = bounds.width
  const h = bounds.height
  const rawDx = p2.x - p1.x
  const rawDy = p2.y - p1.y
  let dx = rawDx - w * Math.round(rawDx / w)
  let dy = rawDy - h * Math.round(rawDy / h)
  const crosses = []
  if (Math.abs(dx) > EPS) {
    const t0 = (0 - p1.x) / dx
    if (t0 >= T_MIN && t0 <= T_MAX) crosses.push({ t: t0, x: 0, y: p1.y + t0 * dy, edge: 'x0' })
    const t1 = (w - p1.x) / dx
    if (t1 >= T_MIN && t1 <= T_MAX) crosses.push({ t: t1, x: w, y: p1.y + t1 * dy, edge: 'x1' })
  }
  if (Math.abs(dy) > EPS) {
    const t0 = (0 - p1.y) / dy
    if (t0 >= T_MIN && t0 <= T_MAX) crosses.push({ t: t0, x: p1.x + t0 * dx, y: 0, edge: 'y0' })
    const t1 = (h - p1.y) / dy
    if (t1 >= T_MIN && t1 <= T_MAX) crosses.push({ t: t1, x: p1.x + t1 * dx, y: h, edge: 'y1' })
  }
  // Segment straddles boundary but |dx| or |dy| is below EPS (both points very close to opposite edges).
  // Force split so we draw two segments until fully crossed.
  const straddleX = Math.abs(rawDx) > w / 2
  const straddleY = Math.abs(rawDy) > h / 2
  if (crosses.length === 0) {
    if (straddleX && !straddleY) {
      return [
        [p1.x, p1.y, w, p1.y],
        [0, p1.y, p2.x, p2.y],
      ]
    }
    if (straddleY && !straddleX) {
      return [
        [p1.x, p1.y, p1.x, h],
        [p1.x, 0, p2.x, p2.y],
      ]
    }
    if (straddleX && straddleY) {
      // Corner: split on both; use x first then y for consistent ordering.
      return [
        [p1.x, p1.y, w, p1.y],
        [0, p1.y, p2.x, p2.y],
      ]
    }
    return [[p1.x, p1.y, p2.x, p2.y]]
  }
  crosses.sort((a, b) => a.t - b.t)
  const texit = crosses[0]
  const tenter = crosses.length >= 2 ? crosses[crosses.length - 1] : null
  const exitX = texit.x
  const exitY = texit.y
  let reX = tenter ? tenter.x : exitX
  let reY = tenter ? tenter.y : exitY
  if (tenter) {
    if (tenter.edge === 'x0') reX = w
    else if (tenter.edge === 'x1') reX = 0
    else if (tenter.edge === 'y0') reY = h
    else if (tenter.edge === 'y1') reY = 0
  } else {
    if (texit.edge === 'x0') reX = w
    else if (texit.edge === 'x1') reX = 0
    else if (texit.edge === 'y0') reY = h
    else if (texit.edge === 'y1') reY = 0
  }
  return [
    [p1.x, p1.y, exitX, exitY],
    [reX, reY, p2.x, p2.y],
  ]
}

/** Draw a toroidal polyline (snake body) with ctx.moveTo/lineTo. */
function strokeToroidalPath(ctx, points, bounds) {
  if (points.length < 2) return
  for (let i = 1; i < points.length; i++) {
    const parts = toroidalLineSegments(points[i - 1], points[i], bounds)
    for (const s of parts) {
      ctx.moveTo(s[0], s[1])
      ctx.lineTo(s[2], s[3])
    }
  }
}

/** Margin from edge (world units) at which to also draw on the opposite side. */
const WRAP_DRAW_MARGIN = 120

/**
 * Yield (x, y) positions at which to draw a point so it appears on both sides when near an edge.
 * First yield is always (px, py); then wrapped positions for edges the point is near.
 */
function* toroidalDrawPositions(px, py, bounds) {
  yield [px, py]
  const w = bounds.width
  const h = bounds.height
  if (px < WRAP_DRAW_MARGIN) yield [px + w, py]
  if (px > w - WRAP_DRAW_MARGIN) yield [px - w, py]
  if (py < WRAP_DRAW_MARGIN) yield [px, py + h]
  if (py > h - WRAP_DRAW_MARGIN) yield [px, py - h]
}

/**
 * Canvas renderer for slither game state.
 * Camera follows the longest snake or the player snake; reports mouse position in world coords.
 * @param {{ state: { snakes: Array<{ segments: Array<{x,y}>, color: string, isPlayer?: boolean }>, pellets: Array<{x,y}>, bounds: { width, height } } }, onMouseMove?: (worldX: number, worldY: number) => void, playerDeadSnake?: { segments: Array<{x,y}>, color: string } | null, deathAnimationProgress?: number | null, speedBoostActive?: boolean, speedBoostProgress?: number }} props
 */
const MINIMAP_SIZE = 140
const MINIMAP_MARGIN = 4

/** Unwrap focus so camera moves continuously when head crosses boundary (no jump). */
function unwrapFocus(focus, prev, w, h) {
  if (prev == null || prev.x == null) return { x: focus.x, y: focus.y }
  let x = focus.x
  let y = focus.y
  const dx = focus.x - prev.x
  const dy = focus.y - prev.y
  if (dx > w / 2) x = focus.x - w
  else if (dx < -w / 2) x = focus.x + w
  if (dy > h / 2) y = focus.y - h
  else if (dy < -h / 2) y = focus.y + h
  return { x, y }
}

export function SlitherView({ state, onMouseMove, playerDeadSnake, deathAnimationProgress, speedBoostActive, speedBoostProgress }) {
  const canvasRef = useRef(null)
  const minimapRef = useRef(null)
  const wrapRef = useRef(null)
  const cameraRef = useRef({ scale: 1, camX: 0, camY: 0 })
  const cameraWorldRef = useRef(null)
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

    const w = bounds.width
    const h = bounds.height
    const cameraWorld = unwrapFocus(focus, cameraWorldRef.current, w, h)
    cameraWorldRef.current = cameraWorld

    let scale = Math.min(
      canvas.width / (bounds.width * 0.5),
      canvas.height / (bounds.height * 0.5),
      1.8,
    )
    if (speedBoostActive && speedBoostProgress != null) {
      scale = scale * (1 - 0.15 * Math.sin(speedBoostProgress * Math.PI))
    }
    const camX = canvas.width / 2 - cameraWorld.x * scale
    const camY = canvas.height / 2 - cameraWorld.y * scale
    cameraRef.current = { scale, camX, camY }

    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.translate(camX, camY)
    ctx.scale(scale, scale)

    const pelletPulse = 1 + 0.08 * Math.sin((performance.now() / 1000) * Math.PI)
    const toroidalOffsets = [
      { x: 0, y: 0 },
      { x: -w, y: 0 },
      { x: w, y: 0 },
      { x: 0, y: -h },
      { x: 0, y: h },
      { x: -w, y: -h },
      { x: -w, y: h },
      { x: w, y: -h },
      { x: w, y: h },
    ]

    for (const offset of toroidalOffsets) {
      ctx.save()
      ctx.translate(offset.x, offset.y)

      const collectRadius = HEAD_RADIUS + PELLET_RADIUS + MAGNET_RADIUS + 150 
      for (const pellet of pellets) {
        const distSq = toroidalDistSq(focus, pellet, bounds)
        const dist = Math.sqrt(distSq)
        const absorption = Math.max(0, 1 - dist / collectRadius)
        let pullX = 0
        let pullY = 0
        if (absorption > 0) {
          pullX = (focus.x - pellet.x) - w * Math.round((focus.x - pellet.x) / w)
          pullY = (focus.y - pellet.y) - h * Math.round((focus.y - pellet.y) / h)
          pullX *= absorption * 0.35
          pullY *= absorption * 0.35
        }
        const valueMult = 1 + (pellet.value - 1) * 0.2
        const positions =
          offset.x === 0 && offset.y === 0
            ? toroidalDrawPositions(pellet.x, pellet.y, bounds)
            : [[pellet.x, pellet.y]]
        for (const [px, py] of positions) {
          const usePull = offset.x === 0 && offset.y === 0
          const drawX = usePull ? px + pullX : px
          const drawY = usePull ? py + pullY : py
          const sizeMult = 1 - absorption * 0.55
          const r = PELLET_RADIUS * pelletPulse * sizeMult
          const highlightOffset = r * 0.35
          const cx = drawX - highlightOffset
          const cy = drawY - highlightOffset
          ctx.save()
          ctx.globalAlpha = 1 - absorption * 0.4
          ctx.shadowColor = 'rgba(255, 100, 0, 0.9)'
          ctx.shadowBlur = (12 * valueMult * sizeMult) / scale
          const orbGrad = ctx.createRadialGradient(cx, cy, 0, drawX, drawY, r)
          orbGrad.addColorStop(0, 'rgba(255, 255, 255, 1)')
          orbGrad.addColorStop(0.2, 'rgba(255, 255, 120, 1)')
          orbGrad.addColorStop(0.45, 'rgba(255, 220, 60, 1)')
          orbGrad.addColorStop(0.7, 'rgba(255, 160, 40, 1)')
          orbGrad.addColorStop(0.9, 'rgba(255, 100, 80, 1)')
          orbGrad.addColorStop(1, 'rgba(220, 60, 100, 1)')
          ctx.fillStyle = orbGrad
          ctx.beginPath()
          ctx.arc(drawX, drawY, r, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
          ctx.save()
          ctx.globalAlpha = 1 - absorption * 0.4
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
          ctx.beginPath()
          ctx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.28, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(255, 200, 120, 0.6)'
          ctx.lineWidth = 1 / scale
          ctx.beginPath()
          ctx.arc(drawX, drawY, r, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      for (const snake of snakes) {
      const segs = snake.segments
      if (segs.length < 2) continue
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const bodyWidth = (BODY_RADIUS * 2) / scale
      const head = segs[0]
      const tail = segs[segs.length - 1]
      ctx.save()
      ctx.shadowColor = snake.color
      ctx.shadowBlur = (snake.isPlayer ? 14 : 10) / scale
      ctx.strokeStyle = snake.color
      ctx.globalAlpha = snake.isPlayer ? 0.4 : 0.35
      ctx.lineWidth = bodyWidth + 4 / scale
      ctx.beginPath()
      strokeToroidalPath(ctx, segs, bounds)
      ctx.stroke()
      ctx.restore()
      ctx.beginPath()
      strokeToroidalPath(ctx, segs, bounds)
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
        strokeToroidalPath(ctx, segs, bounds)
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'
      ctx.lineWidth = bodyWidth + 6 / scale
      ctx.stroke()
      const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y)
      grad.addColorStop(0, brightenColor(snake.color, 0.35))
      grad.addColorStop(1, snake.color)
      ctx.strokeStyle = grad
      ctx.lineWidth = bodyWidth
      ctx.beginPath()
      strokeToroidalPath(ctx, segs, bounds)
      ctx.stroke()
      ctx.fillStyle = snake.color
      const headPositions =
        offset.x === 0 && offset.y === 0
          ? toroidalDrawPositions(head.x, head.y, bounds)
          : [[head.x, head.y]]
      for (const [hx, hy] of headPositions) {
        ctx.beginPath()
        ctx.arc(hx, hy, HEAD_RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'
        ctx.lineWidth = 1.2 / scale
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.beginPath()
        ctx.arc(hx - 2.5, hy - 2.5, HEAD_RADIUS * 0.35, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.beginPath()
        ctx.arc(hx + 2.5, hy + 2.5, HEAD_RADIUS * 0.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = snake.color
      }
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
        strokeToroidalPath(ctx, segs, bounds)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.lineWidth = bodyWidth + 6 / scale
        ctx.stroke()
        const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y)
        grad.addColorStop(0, brightenColor(snake.color, 0.35))
        grad.addColorStop(1, snake.color)
        ctx.strokeStyle = grad
        ctx.lineWidth = bodyWidth
        ctx.beginPath()
        strokeToroidalPath(ctx, segs, bounds)
        ctx.stroke()
        ctx.fillStyle = snake.color
        const deadHeadPositions =
          offset.x === 0 && offset.y === 0
            ? toroidalDrawPositions(head.x, head.y, bounds)
            : [[head.x, head.y]]
        for (const [hx, hy] of deadHeadPositions) {
          ctx.beginPath()
          ctx.arc(hx, hy, HEAD_RADIUS, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.45)'
          ctx.lineWidth = 1.2 / scale
          ctx.stroke()
          ctx.fillStyle = snake.color
        }
        ctx.restore()
      }
    }

      ctx.restore()
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
      mCtx.lineWidth = 10
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
