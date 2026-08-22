import type { UiContext } from './hud'
import { levelRadius } from '../engine/monster'

export function drawBestiary(ctxC: UiContext, collected: number[], colorOf: (l: number) => string): void {
  const { ctx, width, height, safeArea } = ctxC
  ctx.save()
  ctx.fillStyle = 'rgba(30, 30, 38, 0.96)'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#f5efe6'
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('怪物图鉴', width / 2, safeArea.top + 36)
  const cols = 2, rows = 5
  const cellW = width / cols, cellH = (height - safeArea.top - safeArea.bottom - 80) / rows
  for (let i = 0; i < 10; i++) {
    const cx = cellW * (i % cols) + cellW / 2
    const cy = safeArea.top + 80 + cellH * Math.floor(i / cols) + cellH / 2
    const lv = i + 1
    const has = collected.includes(lv)
    ctx.fillStyle = has ? colorOf(lv) : '#3a3a44'
    ctx.beginPath()
    ctx.arc(cx, cy, levelRadius(lv) * 46, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = has ? '#f5efe6' : '#8a8a94'
    ctx.font = '14px sans-serif'
    ctx.fillText(has ? `Lv.${lv}` : '???', cx, cy + levelRadius(lv) * 46 + 18)
  }
  ctx.restore()
}