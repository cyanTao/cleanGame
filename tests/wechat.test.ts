import { describe, expect, it } from 'vitest'
import { wechatStorage } from '../src/platform/wechat'

describe('wechat storage adapter', () => {
  it('wx.getStorageSync 语义：读写 JSON', () => {
    const map = new Map<string, string>()
    const store = wechatStorage({
      getStorageSync: (k: string) => map.get(k) ?? '',
      setStorageSync: (k: string, v: string) => { map.set(k, v) }
    })
    store.set('save', { bestScore: 5, bestiary: [1] })
    expect(store.get<{ bestScore: number; bestiary: number[] }>('save')).toEqual({ bestScore: 5, bestiary: [1] })
    expect(store.get('missing')).toBeNull()
  })
})