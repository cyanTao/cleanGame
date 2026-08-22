import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createEffectManager } from '../src/engine/effects'

// 用最小 renderer 桩替代真实 WebGL（effects 的预算/序列逻辑不依赖真实渲染）
function stubRenderer() {
  return {} as unknown as THREE.WebGLRenderer
}

// 融合序列会访问 group 的 position/scale，这里提供真实 Vector3 + 缩放桩
function stubGroup(): THREE.Group {
  const g = { position: new THREE.Vector3(), scale: { setScalar: () => {} } }
  return g as unknown as THREE.Group
}

describe('effect manager', () => {
  it('开始序列后 activeCount 增加，完成后归零并回调', () => {
    const em = createEffectManager(stubRenderer())
    let done = false
    em.playFuse(stubGroup(), stubGroup(), () => { done = true })
    expect(em.activeCount()).toBe(1)
    for (let i = 0; i < 100; i++) em.tick(1 / 60)
    expect(em.activeCount()).toBe(0)
    expect(done).toBe(true)
  })

  it('降级强度 0.5 时粒子预算减半', () => {
    const em = createEffectManager(stubRenderer())
    em.setStrength(0.5)
    expect(em.particleBudget()).toBe(100)
  })
})