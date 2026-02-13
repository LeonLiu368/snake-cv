/**
 * Canvas overlay for face tracking: nose dot, direction arrow, optional face grid.
 * Nose dot uses raw landmark position so it sits on the nose; arrow uses calibrated
 * direction and scales with head-turn distance.
 */

import { NOSE_INDEX, NOSE_THRESHOLD } from './headTrackingConfig'

const NOSE_DOT_RADIUS = 6
const ARROW_LENGTH_MIN = 28
const ARROW_LENGTH_MAX = 130
const ARROW_HEAD_LEN = 16
const ARROW_HEAD_ANGLE = Math.PI / 6
const NOSE_FILL = 'rgba(126, 240, 193, 0.95)'
const NOSE_STROKE = 'rgba(255, 255, 255, 0.5)'
const ARROW_STROKE = 'rgba(255, 211, 106, 0.95)'
const ARROW_FILL = 'rgba(255, 220, 130, 0.92)'
const FACE_GRID_FILL = 'rgba(31, 42, 68, 0.06)'
const FACE_GRID_STROKE = 'rgba(31, 42, 68, 0.18)'
const FACE_GRID_RINGS = 'rgba(31, 42, 68, 0.2)'
const NOSE_CENTER = 0.5
const DISTANCE_FOR_MAX_ARROW = 0.18

/**
 * Draw the full tracking overlay (clears canvas first).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width - canvas width
 * @param {number} height - canvas height
 * @param {{ nose: { x: number, y: number }, direction: string | null, faceLandmarks: Array<{x,y,z}> | null, mirror: boolean }} options
 *   nose = calibrated normalized (0–1, center 0.5) for arrow direction/scale; dot uses raw landmark.
 */
export function drawTrackingOverlay(ctx, width, height, options) {
  const { nose, direction, faceLandmarks, mirror } = options
  ctx.clearRect(0, 0, width, height)

  if (faceLandmarks && faceLandmarks.length) {
    drawFaceGrid(ctx, width, height, faceLandmarks, mirror)
  }

  const noseRaw =
    faceLandmarks && faceLandmarks[NOSE_INDEX]
      ? faceLandmarks[NOSE_INDEX]
      : nose
  const cx = (mirror ? 1 - noseRaw.x : noseRaw.x) * width
  const cy = noseRaw.y * height

  ctx.fillStyle = NOSE_FILL
  ctx.strokeStyle = NOSE_STROKE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, NOSE_DOT_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  if (direction) {
    const distance = Math.hypot(nose.x - NOSE_CENTER, nose.y - NOSE_CENTER)
    const t = Math.min(
      1,
      Math.max(0, (distance - NOSE_THRESHOLD) / (DISTANCE_FOR_MAX_ARROW - NOSE_THRESHOLD)),
    )
    const arrowLength =
      ARROW_LENGTH_MIN + t * (ARROW_LENGTH_MAX - ARROW_LENGTH_MIN)

    let ex = cx
    let ey = cy
    if (direction === 'RIGHT') ex += arrowLength
    if (direction === 'LEFT') ex -= arrowLength
    if (direction === 'UP') ey -= arrowLength
    if (direction === 'DOWN') ey += arrowLength

    const angle =
      direction === 'RIGHT'
        ? 0
        : direction === 'LEFT'
          ? Math.PI
          : direction === 'UP'
            ? -Math.PI / 2
            : Math.PI / 2

    ctx.strokeStyle = ARROW_STROKE
    ctx.fillStyle = ARROW_FILL
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    const hx = ex - ARROW_HEAD_LEN * Math.cos(angle)
    const hy = ey - ARROW_HEAD_LEN * Math.sin(angle)
    const lx = hx + ARROW_HEAD_LEN * 0.45 * Math.cos(angle + Math.PI / 2)
    const ly = hy + ARROW_HEAD_LEN * 0.45 * Math.sin(angle + Math.PI / 2)
    const rx = hx + ARROW_HEAD_LEN * 0.45 * Math.cos(angle - Math.PI / 2)
    const ry = hy + ARROW_HEAD_LEN * 0.45 * Math.sin(angle - Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(lx, ly)
    ctx.lineTo(rx, ry)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {Array<{ x: number, y: number }>} landmarks
 * @param {boolean} mirror
 */
function drawFaceGrid(ctx, width, height, landmarks, mirror) {
  if (!landmarks || !landmarks.length) return
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const point of landmarks) {
    const x = mirror ? 1 - point.x : point.x
    minX = Math.min(minX, x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, point.y)
  }
  const pad = 0.05
  const left = Math.max(0, (minX - pad) * width)
  const right = Math.min(width, (maxX + pad) * width)
  const top = Math.max(0, (minY - pad) * height)
  const bottom = Math.min(height, (maxY + pad) * height)
  const step = Math.max(14, Math.floor((right - left) / 10))
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const rx = (right - left) / 2
  const ry = (bottom - top) / 2
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = FACE_GRID_FILL
  ctx.fillRect(left, top, right - left, bottom - top)
  ctx.strokeStyle = FACE_GRID_STROKE
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = left; x <= right; x += step) {
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
  }
  for (let y = top; y <= bottom; y += step) {
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
  }
  ctx.stroke()
  ctx.strokeStyle = FACE_GRID_RINGS
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i < 3; i += 1) {
    ctx.ellipse(
      cx,
      cy,
      rx * (0.35 + i * 0.2),
      ry * (0.35 + i * 0.2),
      0,
      0,
      Math.PI * 2,
    )
  }
  ctx.stroke()
  ctx.restore()
}
