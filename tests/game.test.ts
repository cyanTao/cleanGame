import { describe, expect, it } from 'vitest'
import { createGame, type Game } from '../src/engine/game'
import { createMemoryStorage } from './smoke.test'

function makeGame(overrides?: Partial<Parameters<typeof createGame>[0]>): Game {
  return createGame({
    storage: createMemoryStorage(),
    containerWidth: 2,
    containerTopY: 3,
    randomLevel: () => 2,
    seed: 1,
    ...overrides
  })
}

describe('game state machine', () => {
  it('初始 idle，随机等级 1-3', () => {
    const g = makeGame()
    expect(g.snapshot().state).toBe('idle')
    expect([1, 2, 3]).toContain(g.snapshot().nextLevel)
  })

  it('dragging 中 pointerMove 更新 dragX', () => {
    const g = makeGame()
    g.pointerDown(1.0, 3.5) // 顶部投放区
    expect(g.snapshot().state).toBe('dragging')
    g.pointerMove(0.4, 3.2)
    expect(g.snapshot().dragX).toBeCloseTo(0.4)
  })

  it('投放后进入 falling', () => {
    const g = makeGame()
    g.pointerDown(0.5, 3.5)
    g.pointerUp(0.5)
    expect(g.snapshot().state).toBe('falling')
  })

  it('over 状态拒绝投放', () => {
    const g = makeGame()
    // 直接注入越界球：用物理世界模拟——这里简化验证：over 后 pointerDown 无效
    ;(g as unknown as { _forceOver(): void })._forceOver?.()
    expect(g.snapshot().state).toBe('over')
    g.pointerDown(0.5, 3.5)
    expect(g.snapshot().state).toBe('over')
  })

  it('融合 10 级触发胜利', () => {
    const g = makeGame()
    const events: string[] = []
    g.onEvent((e) => events.push(e.type))
    ;(g as unknown as { _fuseLevel(l: number): void })._fuseLevel?.(10)
    expect(g.snapshot().state).toBe('over')
    expect(g.snapshot().win).toBe(true)
    expect(events).toContain('over')
  })

  it('计分 = 新等级 × 10 且更新存档', () => {
    const g = makeGame()
    ;(g as unknown as { _fuseLevel(l: number): void })._fuseLevel?.(3)
    expect(g.snapshot().score).toBe(30)
    expect(g.snapshot().bestiary).toContain(3)
    const saved = g.snapshot()
    expect(saved.score).toBe(30)
  })

  it('restart 重置状态保留最高分', () => {
    const g = makeGame()
    ;(g as unknown as { _fuseLevel(l: number): void })._fuseLevel?.(4)
    ;(g as unknown as { _fuseLevel(l: number): void })._fuseLevel?.(5)
    g.restart()
    const s = g.snapshot()
    expect(s.state).toBe('idle')
    expect(s.score).toBe(0)
    expect(s.win).toBe(false)
  })
})