/**
 * Canvas overlay for face tracking: nose dot, direction arrow, face contours.
 * Nose dot uses raw landmark position so it sits on the nose; arrow uses calibrated
 * direction and scales with head-turn distance.
 */

import { NOSE_INDEX, NOSE_THRESHOLD } from './headTrackingConfig'
import { FACE_LANDMARKS_CONTOURS } from './faceLandmarkConnections'

const NOSE_DOT_RADIUS = 6
const ARROW_LENGTH_MIN = 28
const ARROW_LENGTH_MAX = 130
const ARROW_HEAD_LEN = 16
const NOSE_FILL = 'rgba(126, 240, 193, 0.95)'
const NOSE_STROKE = 'rgba(255, 255, 255, 0.5)'
const ARROW_STROKE = 'rgba(255, 211, 106, 0.95)'
const ARROW_FILL = 'rgba(255, 220, 130, 0.92)'
const FACE_CONTOUR_STROKE = 'rgba(255, 255, 255, 0.35)'
const NOSE_CENTER = 0.5
const DISTANCE_FOR_MAX_ARROW = 0.18

/**
 * Arrow length from normalized distance from center (0.5, 0.5).
 * @param {number} distance - hypot(dx, dy) in 0–1 space
 * @returns {number} pixel length
 */
export function getArrowLength(distance) {
  const t = Math.min(
    1,
    Math.max(
      0,
      (distance - NOSE_THRESHOLD) / (DISTANCE_FOR_MAX_ARROW - NOSE_THRESHOLD),
    ),
  )
  return ARROW_LENGTH_MIN + t * (ARROW_LENGTH_MAX - ARROW_LENGTH_MIN)
}

/**
 * Nose position in screen pixels from raw landmark (normalized 0–1).
 * @param {{ x: number, y: number }} noseRaw
 * @param {number} width
 * @param {number} height
 * @param {boolean} mirror
 * @returns {{ x: number, y: number }}
 */
export function getNoseScreenPosition(noseRaw, width, height, mirror) {
  return {
    x: (mirror ? 1 - noseRaw.x : noseRaw.x) * width,
    y: noseRaw.y * height,
  }
}

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
    drawFaceContours(ctx, width, height, faceLandmarks, mirror)
  }

  const noseRaw =
    faceLandmarks && faceLandmarks[NOSE_INDEX]
      ? faceLandmarks[NOSE_INDEX]
      : nose
  const { x: cx, y: cy } = getNoseScreenPosition(noseRaw, width, height, mirror)

  ctx.fillStyle = NOSE_FILL
  ctx.strokeStyle = NOSE_STROKE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, NOSE_DOT_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  if (direction) {
    const distance = Math.hypot(nose.x - NOSE_CENTER, nose.y - NOSE_CENTER)
    const arrowLength = getArrowLength(distance)

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
function drawFaceContours(ctx, width, height, landmarks, mirror) {
  if (!landmarks || !landmarks.length) return
  ctx.strokeStyle = FACE_CONTOUR_STROKE
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  for (const [i, j] of FACE_LANDMARKS_CONTOURS) {
    if (i >= landmarks.length || j >= landmarks.length) continue
    const a = landmarks[i]
    const b = landmarks[j]
    const x1 = (mirror ? 1 - a.x : a.x) * width
    const y1 = a.y * height
    const x2 = (mirror ? 1 - b.x : b.x) * width
    const y2 = b.y * height
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
  }
  ctx.stroke()
}
