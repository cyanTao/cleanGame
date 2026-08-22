import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/game'
import { createFuseSystem } from '../src/engine/fuse'
import { createEffectManager } from '../src/engine/effects'
import { createMemoryStorage } from './smoke.test'

/** 可手动触发的桩物理世界 */
function makeStubWorld() {
  let cb: ((a: never, b: never) => void) | null = null
  const sleeping = new Set<number>()
  const removed = new Set<number>()
  return {
    sleeping, removed,
    onSameLevelContact(fn: (a: never, b: never) => void) { cb = fn; return () => { cb = null } },
    fire(a: { id: number }, b: { id: number }) { cb?.(a as never, b as never) },
    setSleeping(ball: { id: number }, s: boolean) { if (s) sleeping.add(ball.id); else sleeping.delete(ball.id) },
    removeBall(ball: { id: number }) { removed.add(ball.id) },
    bodies: () => []
  }
}

describe('integration: 投放→接触→融合→计分', () => {
  it('drop 事件后随机下一只；接触融合后计分=新等级×10', () => {
    const storage = createMemoryStorage()
    const game = createGame({
      storage, containerWidth: 2, containerTopY: 3,
      randomLevel: () => 2, seed: 1
    })
    const g = game as unknown as { _fuseLevel: (l: number) => void }
    const w = makeStubWorld()
    const fuse = createFuseSystem({
      onFuse: (l) => g._fuseLevel(l),
      makeMonsterGroup: () => ({}) as never,
      removeBody: (ball) => w.removeBall(ball as { id: number }),
      addGroup: () => {},
      seed: 1
    })
    const effects = createEffectManager({} as never)
    fuse.init(w as never, effects)

    const events: string[] = []
    game.onEvent((e) => events.push(e.type))

    // 投放 → 产出 drop 事件 + 下一只
    game.pointerDown(0.5, 3.5)
    game.pointerUp(0.5)
    expect(events).toContain('drop')
    expect(events).toContain('next')
    expect(game.snapshot().state).toBe('falling')

    // 两个 2 级球接触 → 融合 → 计分 30
    const a = { id: 1, x: () => -0.05, y: () => 1, userData: { level: 2 }, radius: 0.42 }
    const b = { id: 2, x: () => 0.05, y: () => 1, userData: { level: 2 }, radius: 0.42 }
    w.fire(a, b)
    expect(w.sleeping.has(1) && w.sleeping.has(2)).toBe(true)
    expect(game.snapshot().score).toBe(30)
    expect(game.snapshot().bestiary).toContain(3)
    expect(w.removed.has(1) && w.removed.has(2)).toBe(true)
  })
})