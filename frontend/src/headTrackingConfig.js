/**
 * Head tracking constants and pure helpers.
 * Used by useHeadTracking and overlay drawing.
 */

export const NOSE_INDEX = 1
export const NOSE_THRESHOLD = 0.06
export const NOSE_SMOOTHING = 0.5
export const NOSE_CENTER = 0.5
export const NOSE_OFFSET_SCALE = 70
export const NOSE_OFFSET_CLAMP = 16
export const DIRECTION_COOLDOWN_MS = 120
export const UI_THROTTLE_MS = 120
/** Number of nose samples to collect for hold-still calibration (~1–1.5 s at 60 fps) */
export const CALIBRATION_SAMPLES_TARGET = 45

export const HEAD_DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
}

/**
 * Returns raw direction from normalized nose (0–1) relative to center.
 * @param {{ x: number, y: number }} normalizedNose - nose position, center = 0.5
 * @param {number} [threshold=NOSE_THRESHOLD] - dead zone
 * @returns {'UP'|'DOWN'|'LEFT'|'RIGHT'|null}
 */
export function getRawNoseDirection(
  normalizedNose,
  threshold = NOSE_THRESHOLD,
) {
  const dx = normalizedNose.x - NOSE_CENTER
  const dy = normalizedNose.y - NOSE_CENTER
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
    return null
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'RIGHT' : 'LEFT'
  }
  return dy > 0 ? 'DOWN' : 'UP'
}

/**
 * Returns mirrored head direction for display/input (camera is mirrored).
 * @param {{ x: number, y: number }} normalizedNose
 * @param {number} [threshold=NOSE_THRESHOLD]
 * @returns {'UP'|'DOWN'|'LEFT'|'RIGHT'|null}
 */
export function getMirroredHeadDirection(
  normalizedNose,
  threshold = NOSE_THRESHOLD,
) {
  const raw = getRawNoseDirection(normalizedNose, threshold)
  if (!raw) return null
  if (raw === 'LEFT') return 'RIGHT'
  if (raw === 'RIGHT') return 'LEFT'
  return raw
}

/**
 * Median of an array of numbers (sorts a copy; empty array returns 0).
 * @param {number[]} values
 * @returns {number}
 */
export function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Median point from an array of { x, y }.
 * @param {{ x: number, y: number }[]} points
 * @returns {{ x: number, y: number }}
 */
export function medianPoint(points) {
  if (!points.length) return { x: 0.5, y: 0.5 }
  return {
    x: median(points.map((p) => p.x)),
    y: median(points.map((p) => p.y)),
  }
}

/**
 * Compute nose offset for compass UI from normalized nose (clamped).
 */
export function noseOffsetFromNormalized(normalizedNose) {
  const x = Math.max(
    -NOSE_OFFSET_CLAMP,
    Math.min(
      NOSE_OFFSET_CLAMP,
      -(normalizedNose.x - NOSE_CENTER) * NOSE_OFFSET_SCALE,
    ),
  )
  const y = Math.max(
    -NOSE_OFFSET_CLAMP,
    Math.min(
      NOSE_OFFSET_CLAMP,
      (normalizedNose.y - NOSE_CENTER) * NOSE_OFFSET_SCALE,
    ),
  )
  return { x, y }
}
