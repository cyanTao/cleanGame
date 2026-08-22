import { describe, expect, it } from 'vitest'
import { hitRect, levelColor } from '../src/ui/hud'

describe('hit test', () => {
  it('点在矩形内', () => {
    expect(hitRect({ x: 10, y: 10 }, { x: 0, y: 0, w: 20, h: 20 })).toBe(true)
    expect(hitRect({ x: 21, y: 10 }, { x: 0, y: 0, w: 20, h: 20 })).toBe(false)
  })
})

describe('level color', () => {
  it('1-10 级颜色确定且互异', () => {
    const colors = new Set(Array.from({ length: 10 }, (_, i) => levelColor(i + 1)))
    expect(colors.size).toBe(10)
    expect(levelColor(1)).toBe('#8a6d3b')
    expect(levelColor(10)).toBe('#5b3a8a')
  })
})