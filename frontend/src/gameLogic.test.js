import { describe, it, expect } from 'vitest'
import { getNextSnakeState, randomFood } from './gameLogic'

const GRID = 18

describe('getNextSnakeState', () => {
  it('moves head in direction without eating', () => {
    const snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }]
    const food = { x: 0, y: 0 }
    const { nextSnake, ateFood, gameOver } = getNextSnakeState(
      snake,
      { x: 1, y: 0 },
      food,
      GRID,
    )
    expect(nextSnake[0]).toEqual({ x: 6, y: 5 })
    expect(nextSnake).toHaveLength(3)
    expect(ateFood).toBe(false)
    expect(gameOver).toBe(false)
  })

  it('grows when eating food', () => {
    const snake = [{ x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }]
    const food = { x: 3, y: 3 }
    const { nextSnake, ateFood, gameOver } = getNextSnakeState(
      snake,
      { x: 1, y: 0 },
      food,
      GRID,
    )
    expect(nextSnake[0]).toEqual({ x: 3, y: 3 })
    expect(nextSnake).toHaveLength(4)
    expect(ateFood).toBe(true)
    expect(gameOver).toBe(false)
  })

  it('game over when hitting wall (left)', () => {
    const snake = [{ x: 0, y: 5 }, { x: 1, y: 5 }]
    const { nextSnake, gameOver } = getNextSnakeState(
      snake,
      { x: -1, y: 0 },
      { x: 10, y: 10 },
      GRID,
    )
    expect(nextSnake).toEqual(snake)
    expect(gameOver).toBe(true)
  })

  it('game over when hitting wall (top)', () => {
    const snake = [{ x: 5, y: 0 }, { x: 5, y: 1 }]
    const { gameOver } = getNextSnakeState(
      snake,
      { x: 0, y: -1 },
      { x: 10, y: 10 },
      GRID,
    )
    expect(gameOver).toBe(true)
  })

  it('game over when hitting wall (right)', () => {
    const snake = [{ x: GRID - 1, y: 5 }, { x: GRID - 2, y: 5 }]
    const { gameOver } = getNextSnakeState(
      snake,
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      GRID,
    )
    expect(gameOver).toBe(true)
  })

  it('game over when hitting self', () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 5 },
    ]
    const { nextSnake, gameOver } = getNextSnakeState(
      snake,
      { x: 0, y: -1 },
      { x: 0, y: 0 },
      GRID,
    )
    expect(nextSnake).toEqual(snake)
    expect(gameOver).toBe(true)
  })
})

describe('randomFood', () => {
  it('returns a point not on the snake', () => {
    const snake = [{ x: 1, y: 1 }, { x: 2, y: 1 }]
    for (let i = 0; i < 20; i++) {
      const food = randomFood(snake, GRID)
      expect(snake.some((s) => s.x === food.x && s.y === food.y)).toBe(false)
      expect(food.x).toBeGreaterThanOrEqual(0)
      expect(food.x).toBeLessThan(GRID)
      expect(food.y).toBeGreaterThanOrEqual(0)
      expect(food.y).toBeLessThan(GRID)
    }
  })
})
