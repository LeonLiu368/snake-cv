import { describe, it, expect } from 'vitest'
import {
  NOSE_THRESHOLD,
  getRawNoseDirection,
  getMirroredHeadDirection,
  noseOffsetFromNormalized,
  median,
  medianPoint,
} from './headTrackingConfig'

describe('getRawNoseDirection', () => {
  it('returns null when nose is at center', () => {
    expect(getRawNoseDirection({ x: 0.5, y: 0.5 })).toBe(null)
  })

  it('returns null when within threshold', () => {
    expect(getRawNoseDirection({ x: 0.5 + NOSE_THRESHOLD / 2, y: 0.5 })).toBe(
      null,
    )
  })

  it('returns RIGHT when nose is right of center', () => {
    expect(getRawNoseDirection({ x: 0.7, y: 0.5 })).toBe('RIGHT')
  })

  it('returns LEFT when nose is left of center', () => {
    expect(getRawNoseDirection({ x: 0.3, y: 0.5 })).toBe('LEFT')
  })

  it('returns UP when nose is above center', () => {
    expect(getRawNoseDirection({ x: 0.5, y: 0.2 })).toBe('UP')
  })

  it('returns DOWN when nose is below center', () => {
    expect(getRawNoseDirection({ x: 0.5, y: 0.8 })).toBe('DOWN')
  })

  it('prefers horizontal when both dx and dy exceed threshold', () => {
    expect(getRawNoseDirection({ x: 0.8, y: 0.7 })).toBe('RIGHT')
  })

  it('uses custom threshold when provided', () => {
    expect(
      getRawNoseDirection({ x: 0.52, y: 0.5 }, 0.05),
    ).toBe(null)
    expect(getRawNoseDirection({ x: 0.6, y: 0.5 }, 0.05)).toBe('RIGHT')
  })
})

describe('getMirroredHeadDirection', () => {
  it('returns null when raw is null', () => {
    expect(getMirroredHeadDirection({ x: 0.5, y: 0.5 })).toBe(null)
  })

  it('mirrors LEFT to RIGHT', () => {
    expect(getMirroredHeadDirection({ x: 0.2, y: 0.5 })).toBe('RIGHT')
  })

  it('mirrors RIGHT to LEFT', () => {
    expect(getMirroredHeadDirection({ x: 0.8, y: 0.5 })).toBe('LEFT')
  })

  it('keeps UP and DOWN unchanged', () => {
    expect(getMirroredHeadDirection({ x: 0.5, y: 0.2 })).toBe('UP')
    expect(getMirroredHeadDirection({ x: 0.5, y: 0.8 })).toBe('DOWN')
  })
})

describe('noseOffsetFromNormalized', () => {
  it('returns zero at center', () => {
    const off = noseOffsetFromNormalized({ x: 0.5, y: 0.5 })
    expect(Math.abs(off.x)).toBe(0)
    expect(Math.abs(off.y)).toBe(0)
  })

  it('clamps at NOSE_OFFSET_CLAMP', () => {
    const farRight = noseOffsetFromNormalized({ x: 1, y: 0.5 })
    expect(farRight.x).toBeLessThanOrEqual(16)
    expect(farRight.x).toBeGreaterThanOrEqual(-16)
    const farUp = noseOffsetFromNormalized({ x: 0.5, y: 0 })
    expect(farUp.y).toBeLessThanOrEqual(16)
    expect(farUp.y).toBeGreaterThanOrEqual(-16)
  })

  it('returns positive x when nose is left of center (mirrored for display)', () => {
    const off = noseOffsetFromNormalized({ x: 0.4, y: 0.5 })
    expect(off.x).toBeGreaterThan(0)
  })

  it('returns positive y when nose is below center', () => {
    const off = noseOffsetFromNormalized({ x: 0.5, y: 0.6 })
    expect(off.y).toBeGreaterThan(0)
  })
})

describe('median', () => {
  it('returns 0 for empty array', () => {
    expect(median([])).toBe(0)
  })

  it('returns the value for single element', () => {
    expect(median([3])).toBe(3)
  })

  it('returns middle value for odd length', () => {
    expect(median([1, 3, 2])).toBe(2)
    expect(median([5, 1, 4, 2, 3])).toBe(3)
  })

  it('returns average of two middle values for even length', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('does not mutate the input array', () => {
    const arr = [3, 1, 2]
    median(arr)
    expect(arr).toEqual([3, 1, 2])
  })
})

describe('medianPoint', () => {
  it('returns center-like point for empty array', () => {
    expect(medianPoint([])).toEqual({ x: 0.5, y: 0.5 })
  })

  it('returns the point for single element', () => {
    expect(medianPoint([{ x: 0.3, y: 0.7 }])).toEqual({ x: 0.3, y: 0.7 })
  })

  it('returns median x and y for multiple points', () => {
    const points = [
      { x: 0.2, y: 0.5 },
      { x: 0.5, y: 0.3 },
      { x: 0.4, y: 0.7 },
    ]
    expect(medianPoint(points)).toEqual({ x: 0.4, y: 0.5 })
  })
})
