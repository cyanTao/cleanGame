import type { GameSnapshot } from '../engine/game'
import { levelRadius } from '../engine/monster'

export interface UiContext {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  safeArea: { top: number; bottom: number }
}

export function hitRect(p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

const COLORS = ['#8a6d3b', '#a85a32', '#b0702f', '#6e8a5b', '#5b7a8a', '#8a5b7a', '#7a8a5b', '#8a5b5b', '#5b8a7a', '#5b3a8a']

export function levelColor(level: number): string {
  return COLORS[Math.max(0, Math.min(9, level - 1))]
}

export function drawHud(ctxC: UiContext, snapshot: GameSnapshot): void {
  const { ctx, width, safeArea } = ctxC
  ctx.save()
  ctx.clearRect(0, 0, width, ctxC.height)
  // 得分
  ctx.fillStyle = '#f5efe6'
  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(snapshot.score), width / 2, safeArea.top + 34)
  // 下一只预览
  const r = levelRadius(snapshot.nextLevel) * 60 // 预览放大
  ctx.fillStyle = levelColor(snapshot.nextLevel)
  ctx.beginPath()
  ctx.arc(width / 2, safeArea.top + 74, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#333'
  ctx.font = '14px sans-serif'
  ctx.fillText(`下一只 Lv.${snapshot.nextLevel}`, width / 2, safeArea.top + 118)
  // 拖拽预览
  if (snapshot.state === 'dragging' && snapshot.dragX !== null) {
    ctx.globalAlpha = 0.5
    ctx.fillStyle = levelColor(snapshot.nextLevel)
    ctx.beginPath()
    ctx.arc(snapshot.dragX, safeArea.top + 74, r * 0.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}