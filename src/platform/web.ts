import type { Platform, InputEvent } from './types'

export function createWebPlatform(): Platform {
  const canvas = document.createElement('canvas')
  const size = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2)
  })
  const toPointer = (e: PointerEvent | Touch): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  return {
    createCanvas: () => canvas,
    size,
    safeArea: () => ({ top: 0, bottom: 0 }),
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