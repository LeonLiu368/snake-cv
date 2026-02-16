/**
 * Slither-style game logic: continuous movement, collision, pellets, death.
 * Multiplayer-ready: state shape and tick() can be driven by server later.
 */

export const SEGMENT_SPACING = 8
export const HEAD_RADIUS = 15
export const BODY_RADIUS = 15
export const PELLET_RADIUS = 30
/** Extra radius for pellet collection (magnet effect). */
export const MAGNET_RADIUS = 100
export const DEFAULT_SPEED = 600
/** Speed multiplier per segment over initial length (e.g. 0.006 = 0.6% per pellet). */
export const SPEED_GROWTH_PER_SEGMENT = 0.006
/** Max speed multiplier from growth (cap so long snakes don't go crazy). */
export const SPEED_GROWTH_CAP = 1.6
export const TURN_SPEED = 6
export const PELLET_VALUE = 2
export const DEATH_PELLET_FRACTION = 0.4
export const INITIAL_LENGTH = 30
export const PELLET_SPAWN_INTERVAL = 2
export const ARENA_PADDING = 40

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ id: string, segments: Point[], angle: number, speed: number, turnSpeed: number, color: string, isPlayer?: boolean }} Snake
 * @typedef {{ x: number, y: number, value: number }} Pellet
 * @typedef {{ width: number, height: number }} Bounds
 * @typedef {{ snakes: Snake[], pellets: Pellet[], bounds: Bounds, nextSnakeId: number, nextPelletSpawn: number }} GameState
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
 * Create initial game state.
 * @param {{ bounds?: Bounds, numBots?: number, numPellets?: number }} options
 * @returns {GameState}
 */
export function createInitialState(options = {}) {
  const bounds = options.bounds ?? { width: 6000, height: 6000 }
  const numBots = options.numBots ?? 8
  const numPellets = options.numPellets ?? 80
  const padding = ARENA_PADDING
  const minX = padding
  const maxX = bounds.width - padding
  const minY = padding
  const maxY = bounds.height - padding

  const colors = [
    '#33cc33',
    '#e74c3c',
    '#3498db',
    '#f1c40f',
    '#9b59b6',
    '#1abc9c',
    '#e67e22',
    '#2ecc71',
  ]

  const snakes = []
  const usedPositions = new Set()
  const playerColor = '#00ff88'

  for (let i = 0; i < numBots; i++) {
    let x, y, key
    do {
      x = minX + Math.random() * (maxX - minX)
      y = minY + Math.random() * (maxY - minY)
      key = `${Math.floor(x / 50)},${Math.floor(y / 50)}`
    } while (usedPositions.has(key))
    usedPositions.add(key)

    const angle = Math.random() * 2 * Math.PI - Math.PI
    const segments = []
    for (let s = 0; s < INITIAL_LENGTH; s++) {
      segments.push({
        x: x - Math.cos(angle) * s * SEGMENT_SPACING,
        y: y - Math.sin(angle) * s * SEGMENT_SPACING,
      })
    }

    const isPlayer = i === 0
    snakes.push({
      id: isPlayer ? 'player' : `snake-${i}`,
      segments,
      angle,
      speed: DEFAULT_SPEED,
      turnSpeed: TURN_SPEED,
      color: isPlayer ? playerColor : colors[i % colors.length],
      isPlayer,
    })
  }

  const pellets = []
  for (let p = 0; p < numPellets; p++) {
    pellets.push({
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
      value: PELLET_VALUE,
    })
  }

  return {
    snakes,
    pellets,
    bounds,
    nextSnakeId: numBots,
    nextPelletSpawn: PELLET_SPAWN_INTERVAL,
  }
}

/**
 * Wrap a point into [0, bounds.width) x [0, bounds.height).
 * @param {Point} p
 * @param {Bounds} bounds
 * @returns {Point}
 */
function wrapPoint(p, bounds) {
  const w = bounds.width
  const h = bounds.height
  return {
    x: ((p.x % w) + w) % w,
    y: ((p.y % h) + h) % h,
  }
}

/**
 * Shortest distance squared between two points on a toroidal arena.
 * @param {Point} a
 * @param {Point} b
 * @param {Bounds} bounds
 * @returns {number}
 */
export function toroidalDistSq(a, b, bounds) {
  let dx = b.x - a.x
  let dy = b.y - a.y
  dx = dx - bounds.width * Math.round(dx / bounds.width)
  dy = dy - bounds.height * Math.round(dy / bounds.height)
  return dx * dx + dy * dy
}

/**
 * Move snake head and update body segments (follow-the-leader).
 * Positions are wrapped into bounds for toroidal arena.
 * @param {Snake} snake
 * @param {number} dt in seconds
 * @param {number} targetAngle desired angle (interpolated by turnSpeed)
 * @param {Bounds} bounds
 * @returns {Snake}
 */
function moveSnake(snake, dt, targetAngle, bounds) {
  const head = snake.segments[0]
  let angle = snake.angle
  const diff = normalizeAngle(targetAngle - angle)
  angle += diff * Math.min(1, snake.turnSpeed * dt)
  angle = normalizeAngle(angle)

  const extraSegments = Math.max(0, snake.segments.length - INITIAL_LENGTH)
  const growthMul = Math.min(SPEED_GROWTH_CAP, 1 + extraSegments * SPEED_GROWTH_PER_SEGMENT)
  const effectiveSpeed = snake.speed * growthMul
  const dx = Math.cos(angle) * effectiveSpeed * dt
  const dy = Math.sin(angle) * effectiveSpeed * dt
  let newHead = wrapPoint({ x: head.x + dx, y: head.y + dy }, bounds)

  const w = bounds.width
  const h = bounds.height
  const segments = [newHead]
  let prev = newHead
  for (let i = 1; i < snake.segments.length; i++) {
    const curr = snake.segments[i]
    // Use toroidal (shortest) direction so segments follow the wrap and don't jump to the head's side.
    let tdx = curr.x - prev.x
    let tdy = curr.y - prev.y
    tdx = tdx - w * Math.round(tdx / w)
    tdy = tdy - h * Math.round(tdy / h)
    const d = Math.hypot(tdx, tdy)
    let next
    if (d <= 1e-6) {
      next = {
        x: prev.x - Math.cos(angle) * SEGMENT_SPACING,
        y: prev.y - Math.sin(angle) * SEGMENT_SPACING,
      }
    } else {
      next = {
        x: prev.x + (tdx / d) * SEGMENT_SPACING,
        y: prev.y + (tdy / d) * SEGMENT_SPACING,
      }
    }
    const wrappedNext = wrapPoint(next, bounds)
    segments.push(wrappedNext)
    prev = segments[segments.length - 1]
  }

  return {
    ...snake,
    segments,
    angle,
  }
}

/**
 * Check if head hits another snake's body (not own body). Uses toroidal distance.
 * @param {string} snakeId
 * @param {Point} head
 * @param {Snake[]} allSnakes
 * @param {Bounds} bounds
 * @returns {boolean}
 */
function headHitsBody(snakeId, head, allSnakes, bounds) {
  const r = HEAD_RADIUS + BODY_RADIUS
  const rSq = r * r
  for (const snake of allSnakes) {
    if (snake.id === snakeId) continue
    for (let i = 0; i < snake.segments.length; i++) {
      if (toroidalDistSq(head, snake.segments[i], bounds) < rSq) return true
    }
  }
  return false
}

/**
 * Apply target angles from bot AI and move all snakes.
 * @param {GameState} state
 * @param {number} dt
 * @param {Record<string, number>} targetAngles snakeId -> target angle in radians
 * @param {{ playerSpeedMultiplier?: number }} [options]
 * @returns {{ state: GameState, deadIds: string[] }}
 */
export function tick(state, dt, targetAngles = {}, options = {}) {
  const { bounds } = state
  let { snakes, pellets } = state
  const padding = ARENA_PADDING
  const minX = padding
  const maxX = bounds.width - padding
  const minY = padding
  const maxY = bounds.height - padding
  const playerSpeedMultiplier = options.playerSpeedMultiplier ?? 1

  snakes = snakes.map((s) => {
    const target = targetAngles[s.id] ?? s.angle
    const speedMul = s.isPlayer ? playerSpeedMultiplier : 1
    const snakeToMove = speedMul !== 1 ? { ...s, speed: s.speed * speedMul } : s
    const result = moveSnake(snakeToMove, dt, target, bounds)
    if (speedMul !== 1) return { ...result, speed: s.speed }
    return result
  })

  const pelletCollectRadiusSq = (HEAD_RADIUS + PELLET_RADIUS + MAGNET_RADIUS) ** 2
  snakes = snakes.map((snake) => {
    const head = snake.segments[0]
    let lengthGain = 0
    for (let i = pellets.length - 1; i >= 0; i--) {
      if (toroidalDistSq(head, pellets[i], bounds) < pelletCollectRadiusSq) {
        lengthGain += pellets[i].value
        pellets = pellets.slice(0, i).concat(pellets.slice(i + 1))
      }
    }
    if (lengthGain <= 0) return snake
    const tail = snake.segments[snake.segments.length - 1]
    const newSegments = [...snake.segments]
    for (let g = 0; g < lengthGain; g++) {
      newSegments.push({ ...tail })
    }
    return { ...snake, segments: newSegments }
  })

  const deadIds = new Set()
  for (const snake of snakes) {
    const head = snake.segments[0]
    if (headHitsBody(snake.id, head, snakes, bounds)) {
      deadIds.add(snake.id)
    }
  }

  snakes = snakes.filter((s) => !deadIds.has(s.id))

  for (const id of deadIds) {
    const dead = state.snakes.find((s) => s.id === id)
    if (!dead) continue
    const count = Math.max(1, Math.floor(dead.segments.length * DEATH_PELLET_FRACTION))
    const step = Math.max(1, Math.floor(dead.segments.length / count))
    for (let i = 0; i < count; i++) {
      const idx = Math.min(i * step, dead.segments.length - 1)
      const seg = dead.segments[idx]
      pellets.push({
        x: seg.x,
        y: seg.y,
        value: PELLET_VALUE,
      })
    }
  }

  let { nextPelletSpawn } = state
  nextPelletSpawn -= dt
  if (nextPelletSpawn <= 0) {
    nextPelletSpawn = PELLET_SPAWN_INTERVAL
    pellets.push({
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
      value: PELLET_VALUE,
    })
  }

  return {
    state: {
      ...state,
      snakes,
      pellets,
      nextPelletSpawn,
    },
    deadIds: [...deadIds],
  }
}

/**
 * Get snake length (segment count) for display.
 * @param {Snake} snake
 * @returns {number}
 */
export function getSnakeLength(snake) {
  return snake.segments.length
}
