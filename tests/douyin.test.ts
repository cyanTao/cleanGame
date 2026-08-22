import { describe, expect, it } from 'vitest'
import { douyinStorage } from '../src/platform/douyin'

describe('douyin storage adapter', () => {
  it('tt.getStorageSync 语义：读写 JSON', () => {
    const map = new Map<string, string>()
    const store = douyinStorage({
      getStorageSync: (k: string) => map.get(k) ?? '',
      setStorageSync: (k: string, v: string) => { map.set(k, v) }
    })
    store.set('save', { bestScore: 9 })
    expect(store.get<{ bestScore: number }>('save')).toEqual({ bestScore: 9 })
  })
})