import { describe, expect, it } from 'vitest'
import { createFuseSystem } from '../src/engine/fuse'

interface StubBall { id: number; userData: { level: number }; sleeping: boolean; removed: boolean; x(): number; y(): number }

function makeStubWorld(balls: StubBall[]) {
  let cb: ((a: never, b: never) => void) | null = null
  const sleeping = new Set<number>()
  const removed = new Set<number>()
  return {
    balls,
    sleeping,
    removed,
    onSameLevelContact(fn: (a: never, b: never) => void) { cb = fn; return () => { cb = null } },
    fire(a: StubBall, b: StubBall) { cb?.(a as never, b as never) },
    setSleeping(b: StubBall, s: boolean) { if (s) sleeping.add(b.id); else sleeping.delete(b.id) },
    removeBall(b: StubBall) { removed.add(b.id) },
    bodies: () => balls.filter((b) => !removed.has(b.id))
  }
}

describe('fuse system', () => {
  it('接触后两球置 sleeping，完成回调 onFuse 并移除', () => {
    const a: StubBall = { id: 1, userData: { level: 2 }, sleeping: false, removed: false, x: () => 0, y: () => 1 }
    const b: StubBall = { id: 2, userData: { level: 2 }, sleeping: false, removed: false, x: () => 0.1, y: () => 1 }
    const w = makeStubWorld([a, b])
    let fusedLevel = 0
    let done = false
    const sys = createFuseSystem({
      onFuse: (l) => { fusedLevel = l },
      makeMonsterGroup: () => ({}) as never,
      removeBody: (ball) => { (ball as StubBall).removed = true },
      addGroup: () => {},
      seed: 1
    })
    sys.init(w as never, {
      playFuse: (_x: never, _y: never, onDone: () => void) => { onDone() },
      tick: () => {}, activeCount: () => 0, dispose: () => {},
      particleBudget: () => 0, setStrength: () => {}
    } as never)
    w.fire(a, b)
    expect(w.sleeping.has(a.id)).toBe(true)
    expect(w.sleeping.has(b.id)).toBe(true)
    done = true
    expect(fusedLevel).toBe(3)
    expect(a.removed).toBe(true)
    expect(b.removed).toBe(true)
    expect(done).toBe(true)
  })
})