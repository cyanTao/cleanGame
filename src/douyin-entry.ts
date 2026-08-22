import { createDouyinPlatform } from './platform/douyin'
import { startGame } from './main'

// 抖音小游戏无 DOM 全局：注入 main.ts 所需的最小全局（tt.* 等价注入）。
declare const tt: { createCanvas(): HTMLCanvasElement }
const g = globalThis as unknown as Record<string, any>
if (typeof g.document === 'undefined') {
  g.document = {
    getElementById: () => null,
    createElement: () => tt.createCanvas(),
    createElementNS: () => tt.createCanvas()
  }
}
if (typeof g.performance === 'undefined') {
  const start = Date.now()
  g.performance = { now: () => Date.now() - start }
}
if (typeof g.requestAnimationFrame === 'undefined') {
  g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 16)
  g.cancelAnimationFrame = (id: number) => clearTimeout(id)
}

startGame(createDouyinPlatform()).catch((err) => {
  if (typeof console !== 'undefined') console.error(err)
})