import { describe, it, expect } from 'vitest'
import {
  getArrowLength,
  getNoseScreenPosition,
} from './drawTrackingOverlay'

describe('getArrowLength', () => {
  it('returns min length when distance at or below threshold', () => {
    expect(getArrowLength(0)).toBe(28)
    expect(getArrowLength(0.06)).toBe(28)
  })

  it('returns max length when distance at or above DISTANCE_FOR_MAX_ARROW', () => {
    expect(getArrowLength(0.18)).toBe(130)
    expect(getArrowLength(0.5)).toBe(130)
  })

  it('scales linearly between threshold and max distance', () => {
    const mid = (0.06 + 0.18) / 2
    const len = getArrowLength(mid)
    expect(len).toBeGreaterThan(28)
    expect(len).toBeLessThan(130)
    expect(len).toBeCloseTo((28 + 130) / 2, 0)
  })
})

describe('getNoseScreenPosition', () => {
  it('maps normalized 0–1 to pixel coords', () => {
    const pos = getNoseScreenPosition({ x: 0.5, y: 0.5 }, 640, 480, false)
    expect(pos.x).toBe(320)
    expect(pos.y).toBe(240)
  })

  it('mirrors x when mirror is true', () => {
    const pos = getNoseScreenPosition({ x: 0.25, y: 0.5 }, 640, 480, true)
    expect(pos.x).toBe((1 - 0.25) * 640)
    expect(pos.y).toBe(240)
  })

  it('leaves y unchanged by mirror', () => {
    const a = getNoseScreenPosition({ x: 0.5, y: 0.3 }, 100, 100, false)
    const b = getNoseScreenPosition({ x: 0.5, y: 0.3 }, 100, 100, true)
    expect(a.y).toBe(b.y)
  })
})
