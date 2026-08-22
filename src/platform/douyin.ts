import type { Platform, InputEvent } from './types'
import { wechatStorage } from './wechat'

declare const tt: {
  createCanvas(): HTMLCanvasElement
  getSystemInfoSync(): { windowWidth: number; windowHeight: number; pixelRatio: number; safeArea?: { top: number; bottom: number } }
  getStorageSync(key: string): string
  setStorageSync(key: string, value: string): void
  onTouchStart(cb: (e: { touches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
  onTouchMove(cb: (e: { touches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
  onTouchEnd(cb: (e: { changedTouches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
  request(opts: { url: string; responseType: string; success: (r: { data: ArrayBuffer }) => void; fail: (e: unknown) => void }): void
}

/** tt 与 wx storage API 同构，直接复用 */
export const douyinStorage = wechatStorage

export function createDouyinPlatform(): Platform {
  const canvas = tt.createCanvas()
  const info = tt.getSystemInfoSync()
  const size = () => ({ width: info.windowWidth, height: info.windowHeight, dpr: info.pixelRatio })
  const safeArea = () => ({
    top: info.safeArea?.top ?? 0,
    bottom: info.windowHeight - (info.safeArea?.bottom ?? info.windowHeight)
  })
  const listeners = new Set<(e: InputEvent) => void>()
  const emit = (type: InputEvent['type'], t: { clientX: number; clientY: number; identifier: number }) => {
    for (const cb of listeners) cb({ type, pointer: { x: t.clientX, y: t.clientY }, id: t.identifier })
  }
  tt.onTouchStart((e) => { for (const t of e.touches) emit('down', t) })
  tt.onTouchMove((e) => { for (const t of e.touches) emit('move', t) })
  tt.onTouchEnd((e) => { for (const t of e.changedTouches) emit('up', t) })

  return {
    createCanvas: () => canvas,
    size,
    safeArea,
    onInput(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    async loadAsset(url) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        tt.request({
          url,
          responseType: 'arraybuffer',
          success: (r) => resolve(r.data),
          fail: (e) => reject(e)
        })
      })
    },
    storage: douyinStorage({ getStorageSync: tt.getStorageSync.bind(tt), setStorageSync: tt.setStorageSync.bind(tt) })
  }
}