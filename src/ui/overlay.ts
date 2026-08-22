import type { GameSnapshot } from '../engine/game'
import type { UiContext } from './hud'

export function drawOverlay(ctxC: UiContext, snapshot: GameSnapshot): { restartRect: { x: number; y: number; w: number; h: number } } {
  const { ctx, width, height } = ctxC
  const bw = Math.min(260, width * 0.7)
  const bh = 180
  const bx = (width - bw) / 2
  const by = (height - bh) / 2
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#2b2b33'
  ctx.fillRect(bx, by, bw, bh)
  ctx.strokeStyle = '#777780'
  ctx.strokeRect(bx, by, bw, bh)
  ctx.fillStyle = '#f5efe6'
  ctx.font = 'bold 24px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(snapshot.win ? '🎉 合成出终极怪物！' : '容器满了…', width / 2, by + 46)
  ctx.font = '16px sans-serif'
  ctx.fillText(`得分 ${snapshot.score}`, width / 2, by + 84)
  const btn = { x: bx + bw * 0.25, y: by + 108, w: bw * 0.5, h: 44 }
  ctx.fillStyle = '#a85a32'
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h)
  ctx.fillStyle = '#f5efe6'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText('再来一局', width / 2, btn.y + 30)
  ctx.restore()
  return { restartRect: btn }
}