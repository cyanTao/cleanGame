import { describe, expect, it } from 'vitest'
import { createPhysicsWorld, PhysicsWorld } from '../src/engine/physics'

function stepMany(w: PhysicsWorld, n: number, dt = 1 / 60) {
  for (let i = 0; i < n; i++) w.step(dt)
}

describe('physics world', () => {
  it('球在重力下下落并静止于底部', () => {
    const w = createPhysicsWorld({ width: 2, height: 3, seed: 1 })
    w.addBall(0.3, 0, 2.5, { level: 1 })
    stepMany(w, 600)
    const b = w.bodies()[0]
    expect(b.y()).toBeLessThan(0.35) // 落到底部附近
    expect(b.isAtRest()).toBe(true)
  })

  it('同级球接触后上报接触事件', () => {
    const w = createPhysicsWorld({ width: 2, height: 3, seed: 1 })
    const contacts: Array<[number, number]> = []
    w.onSameLevelContact((a, b) => contacts.push([(a.userData as { level: number }).level, (b.userData as { level: number }).level]))
    w.addBall(0.3, -0.2, 1.0, { level: 2 })
    w.addBall(0.3, 0.2, 1.0, { level: 2 })
    stepMany(w, 300)
    expect(contacts.length).toBeGreaterThan(0)
    expect(contacts[0]).toEqual([2, 2])
  })

  it('不同级球接触不上报', () => {
    const w = createPhysicsWorld({ width: 2, height: 3, seed: 1 })
    let called = 0
    w.onSameLevelContact(() => { called++ })
    w.addBall(0.3, -0.2, 1.0, { level: 1 })
    w.addBall(0.3, 0.2, 1.0, { level: 3 })
    stepMany(w, 300)
    expect(called).toBe(0)
  })

  it('setSleeping 使球不再参与接触上报', () => {
    const w = createPhysicsWorld({ width: 2, height: 3, seed: 1 })
    let called = 0
    w.onSameLevelContact(() => { called++ })
    const a = w.addBall(0.3, -0.2, 1.0, { level: 2 })
    const b = w.addBall(0.3, 0.2, 1.0, { level: 2 })
    w.setSleeping(a, true)
    w.setSleeping(b, true)
    stepMany(w, 300)
    expect(called).toBe(0)
  })
})