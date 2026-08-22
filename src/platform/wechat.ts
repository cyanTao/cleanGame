import type { Platform, InputEvent, Storage } from './types'
import { loadWechatAsset } from './wechat-load'

declare const wx: {
  createCanvas(): HTMLCanvasElement
  getSystemInfoSync(): { windowWidth: number; windowHeight: number; pixelRatio: number; safeArea?: { top: number; bottom: number } }
  getStorageSync(key: string): string
  setStorageSync(key: string, value: string): void
  onTouchStart(cb: (e: { touches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
  onTouchMove(cb: (e: { touches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
  onTouchEnd(cb: (e: { changedTouches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
}

/** 微信 storage 适配（可注入测试） */
export function wechatStorage(api: {
  getStorageSync(key: string): string
  setStorageSync(key: string, value: string): void
}): Storage {
  return {
    get<T>(key: string): T | null {
      const raw = api.getStorageSync(key)
      return raw === '' || raw === undefined ? null : (JSON.parse(raw) as T)
    },
    set(key: string, value: unknown) {
      api.setStorageSync(key, JSON.stringify(value))
    }
  }
}

export function createWechatPlatform(): Platform {
  const canvas = wx.createCanvas()
  const info = wx.getSystemInfoSync()
  const size = () => ({ width: info.windowWidth, height: info.windowHeight, dpr: info.pixelRatio })
  const safeArea = () => ({
    top: info.safeArea?.top ?? 0,
    bottom: info.windowHeight - (info.safeArea?.bottom ?? info.windowHeight)
  })
  const listeners = new Set<(e: InputEvent) => void>()
  const emit = (type: InputEvent['type'], t: { clientX: number; clientY: number; identifier: number }) => {
    for (const cb of listeners) cb({ type, pointer: { x: t.clientX, y: t.clientY }, id: t.identifier })
  }
  wx.onTouchStart((e) => { for (const t of e.touches) emit('down', t) })
  wx.onTouchMove((e) => { for (const t of e.touches) emit('move', t) })
  wx.onTouchEnd((e) => { for (const t of e.changedTouches) emit('up', t) })

  return {
    createCanvas: () => canvas,
    size,
    safeArea,
    onInput(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    async loadAsset(url) {
      // 微信小游戏资源走网络下载；本地内置资源走 pack（YAGNI：先网络）
      return loadWechatAsset(url)
    },
    storage: wechatStorage({ getStorageSync: wx.getStorageSync.bind(wx), setStorageSync: wx.setStorageSync.bind(wx) })
  }
}