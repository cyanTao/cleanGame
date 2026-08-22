import type { Platform, InputEvent, SafeArea } from './types'

export function createWebPlatform(): Platform {
  const canvas = document.createElement('canvas')
  // CSS 尺寸铺满宿主容器（#app 为 100%×100%），渲染缓冲由 renderer.setSize 管理（含 dpr）
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  const size = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2)
  })
  // 刘海屏/灵动岛安全区（env() 无法直接在 JS 读取，用隐形探针元素量取，结果缓存）
  let cachedSafeArea: SafeArea | null = null
  const toPointer = (e: PointerEvent | Touch): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  return {
    createCanvas: () => canvas,
    size,
    safeArea: (): SafeArea => {
      if (cachedSafeArea) return cachedSafeArea
      const probe = document.createElement('div')
      probe.style.cssText = 'position:fixed;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);left:0;right:0;visibility:hidden;pointer-events:none'
      document.body.appendChild(probe)
      const rect = probe.getBoundingClientRect()
      probe.remove()
      cachedSafeArea = {
        top: Math.max(0, rect.top),
        bottom: Math.max(0, window.innerHeight - rect.bottom)
      }
      return cachedSafeArea
    },
    onResize(cb) {
      window.addEventListener('resize', cb)
      window.addEventListener('orientationchange', cb)
      return () => {
        window.removeEventListener('resize', cb)
        window.removeEventListener('orientationchange', cb)
      }
    },
    onInput(cb) {
      const emit = (type: InputEvent['type'], e: PointerEvent | Touch, id: number) =>
        cb({ type, pointer: toPointer(e), id })
      const down = (e: PointerEvent) => { e.preventDefault(); emit('down', e, e.pointerId) }
      const move = (e: PointerEvent) => { emit('move', e, e.pointerId) }
      const up = (e: PointerEvent) => { emit('up', e, e.pointerId) }
      canvas.addEventListener('pointerdown', down)
      canvas.addEventListener('pointermove', move)
      canvas.addEventListener('pointerup', up)
      canvas.addEventListener('pointercancel', up)
      return () => {
        canvas.removeEventListener('pointerdown', down)
        canvas.removeEventListener('pointermove', move)
        canvas.removeEventListener('pointerup', up)
        canvas.removeEventListener('pointercancel', up)
      }
    },
    async loadAsset(url) {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`loadAsset failed: ${url}`)
      return res.arrayBuffer()
    },
    storage: {
      get<T>(key: string): T | null {
        const raw = localStorage.getItem(key)
        return raw === null ? null : (JSON.parse(raw) as T)
      },
      set(key: string, value: unknown) {
        localStorage.setItem(key, JSON.stringify(value))
      }
    }
  }
}