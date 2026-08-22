import { createWechatPlatform } from './platform/wechat'
import { startGame } from './main'

// 小游戏无 DOM 全局：注入 main.ts 所需的最小全局。
// 注意：不注入 window，避免触发 main.ts 底部的 web 自动启动守卫。
declare const wx: { createCanvas(): HTMLCanvasElement }
const g = globalThis as unknown as Record<string, any>
if (typeof g.document === 'undefined') {
  g.document = {
    getElementById: () => null,
    createElement: () => wx.createCanvas(),
    createElementNS: () => wx.createCanvas()
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

startGame(createWechatPlatform()).catch((err) => {
  if (typeof console !== 'undefined') console.error(err)
})