/**
 * Pure game logic for Snake: next state, collisions, food placement.
 */

/**
 * Compute next snake state after one step.
 * @param {{ x: number, y: number }[]} snake - current snake (head first)
 * @param {{ x: number, y: number }} direction - unit vector
 * @param {{ x: number, y: number }} food - food cell
 * @param {number} gridSize - board size (e.g. 18)
 * @returns {{ nextSnake: { x: number, y: number }[], ateFood: boolean, gameOver: boolean }}
 */
export function getNextSnakeState(snake, direction, food, gridSize) {
  const head = snake[0]
  const nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  }
  const hitWall =
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= gridSize ||
    nextHead.y >= gridSize
  const hitSelf = snake.some(
    (seg) => seg.x === nextHead.x && seg.y === nextHead.y,
  )
  if (hitWall || hitSelf) {
    return { nextSnake: snake, ateFood: false, gameOver: true }
  }
  const nextSnake = [nextHead, ...snake]
  const ateFood = nextHead.x === food.x && nextHead.y === food.y
  if (!ateFood) {
    nextSnake.pop()
  }
  return { nextSnake, ateFood, gameOver: false }
}

/**
 * Pick a random cell that is not occupied by the snake.
 * @param {{ x: number, y: number }[]} snake
 * @param {number} gridSize
 * @returns {{ x: number, y: number }}
 */
export function randomFood(snake, gridSize) {
  const occupied = new Set(snake.map((seg) => `${seg.x},${seg.y}`))
  let spot = null
  while (!spot || occupied.has(`${spot.x},${spot.y}`)) {
    spot = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    }
  }
  return spot
}
