import { describe, expect, it } from 'vitest'

/** 内存 Storage 实现，用于测试 platform 逻辑（不依赖 DOM） */
export function createMemoryStorage(): import('../src/platform/types').Storage {
  const map = new Map<string, string>()
  return {
    get<T>(key: string): T | null {
      const raw = map.get(key)
      return raw === undefined ? null : (JSON.parse(raw) as T)
    },
    set(key: string, value: unknown) {
      map.set(key, JSON.stringify(value))
    }
  }
}

describe('storage', () => {
  it('roundtrips JSON 值', () => {
    const s = createMemoryStorage()
    s.set('save', { bestScore: 120, bestiary: [1, 2, 3] })
    expect(s.get<{ bestScore: number; bestiary: number[] }>('save')).toEqual({
      bestScore: 120, bestiary: [1, 2, 3]
    })
  })

  it('缺失 key 返回 null', () => {
    expect(createMemoryStorage().get('nope')).toBeNull()
  })
})