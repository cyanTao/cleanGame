import { describe, expect, it } from 'vitest'
import { generateMonsterParams, levelRadius, LEVEL_COUNT } from '../src/engine/monster'

describe('generateMonsterParams', () => {
  it('同 seed 同等级结果确定', () => {
    expect(generateMonsterParams(3, 42)).toEqual(generateMonsterParams(3, 42))
  })

  it('不同 seed 产生差异', () => {
    expect(generateMonsterParams(3, 42)).not.toEqual(generateMonsterParams(3, 43))
  })

  it('等级越高特征越多', () => {
    const low = generateMonsterParams(1, 7)
    const high = generateMonsterParams(10, 7)
    expect(high.eyeCount + high.hornCount + high.tentacleCount)
      .toBeGreaterThan(low.eyeCount + low.hornCount + low.tentacleCount)
  })

  it('半径随等级递增且固定', () => {
    expect(levelRadius(1)).toBeCloseTo(0.32)
    expect(levelRadius(10)).toBeCloseTo(1.31)
    for (let i = 2; i <= LEVEL_COUNT; i++) {
      expect(levelRadius(i)).toBeGreaterThan(levelRadius(i - 1))
    }
  })
})