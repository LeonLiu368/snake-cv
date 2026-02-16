/**
 * Bot AI for slither: seek nearest pellet, avoid walls and body segments.
 * Returns target angle per snake for slitherLogic to interpolate.
 */

import { HEAD_RADIUS, BODY_RADIUS } from './slitherLogic.js'

const DANGER_RADIUS = 80
const PELLET_SEEK_RADIUS = 600
const TURN_SMOOTH = 0.12

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ id: string, segments: Point[], angle: number }} Snake
 * @typedef {{ x: number, y: number, value: number }} Pellet
 * @typedef {{ width: number, height: number }} Bounds
 */

/**
 * Normalize angle to [-PI, PI].
 * @param {number} a
 * @returns {number}
 */
function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

/**
 * Distance squared.
 * @param {Point} a
 * @param {Point} b
 * @returns {number}
 */
function distSq(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return dx * dx + dy * dy
}

/**
 * Compute target angles for all bots (seek pellets + avoid obstacles).
 * @param {{ snakes: Snake[], pellets: Pellet[], bounds: Bounds }} state
 * @returns {Record<string, number>} snakeId -> target angle in radians
 */
export function computeTargetAngles(state) {
  const { snakes, pellets } = state
  const result = /** @type {Record<string, number>} */ ({})

  for (const snake of snakes) {
    if (snake.isPlayer) continue
    const head = snake.segments[0]
    let targetAngle = snake.angle

    const seekAngle = seekNearestPellet(head, pellets)
    const avoidAngle = avoidObstacles(head, snake, snakes)

    if (avoidAngle !== null) {
      targetAngle = avoidAngle
    } else if (seekAngle !== null) {
      targetAngle = seekAngle
    }

    const diff = normalizeAngle(targetAngle - snake.angle)
    targetAngle = normalizeAngle(snake.angle + diff * TURN_SMOOTH)
    result[snake.id] = targetAngle
  }

  return result
}

/**
 * @param {Point} head
 * @param {Pellet[]} pellets
 * @returns {number | null} angle toward nearest pellet, or null if none in range
 */
function seekNearestPellet(head, pellets) {
  let best = null
  let bestDistSq = PELLET_SEEK_RADIUS * PELLET_SEEK_RADIUS
  for (const p of pellets) {
    const d = distSq(head, p)
    if (d < bestDistSq) {
      bestDistSq = d
      best = p
    }
  }
  if (!best) return null
  return Math.atan2(best.y - head.y, best.x - head.x)
}

/**
 * Repulsion from nearest danger (body segments). Returns desired angle away from obstacles.
 * @param {Point} head
 * @param {Snake} self
 * @param {Snake[]} allSnakes
 * @returns {number | null} safe angle or null if no immediate danger
 */
function avoidObstacles(head, self, allSnakes) {
  const repulsion = { x: 0, y: 0 }

  const r = HEAD_RADIUS + BODY_RADIUS + DANGER_RADIUS
  const rSq = r * r
  for (const snake of allSnakes) {
    const start = snake.id === self.id ? 1 : 0
    for (let i = start; i < snake.segments.length; i++) {
      const seg = snake.segments[0]
      const d = distSq(head, seg)
      if (d < rSq && d > 1) {
        const dist = Math.sqrt(d)
        const strength = 1 - dist / Math.sqrt(rSq)
        repulsion.x -= ((head.x - seg.x) / dist) * strength
        repulsion.y -= ((head.y - seg.y) / dist) * strength
      }
    }
  }

  const mag = Math.hypot(repulsion.x, repulsion.y)
  if (mag < 100) return null
  return Math.atan2(repulsion.y, repulsion.x)
}
