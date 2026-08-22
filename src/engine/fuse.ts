import * as THREE from 'three'
import type { PhysicsWorld } from './physics'
import type { EffectManager } from './effects'

interface FuseOpts {
  onFuse: (level: number) => void
  makeMonsterGroup: (level: number, seed: number) => THREE.Group
  removeBody: (ball: unknown) => void
  addGroup: (g: THREE.Group, x: number, y: number) => void
  seed: number
}

export interface FuseSystem {
  init(world: PhysicsWorld, effects: EffectManager): void
  update(): void
}

export function createFuseSystem(opts: FuseOpts): FuseSystem {
  const fusing = new Set<number>()
  let world: PhysicsWorld | null = null
  let effects: EffectManager | null = null
  let fuseCounter = 0

  const onSameLevel = (a: { id: number; x(): number; y(): number; userData: unknown; radius: number },
                       b: { id: number; x(): number; y(): number; userData: unknown; radius: number }) => {
    if (!world || !effects) return
    if (fusing.has(a.id) || fusing.has(b.id)) return
    fusing.add(a.id)
    fusing.add(b.id)
    world.setSleeping(a as never, true)
    world.setSleeping(b as never, true)
    const level = (a.userData as { level: number }).level
    const midX = (a.x() + b.x()) / 2
    const midY = (a.y() + b.y()) / 2
    // 网格引用：addBall 时经 userData.mesh 挂载（Task 8 整合约定）
    const meshA = (a.userData as { mesh?: THREE.Group }).mesh
    const meshB = (b.userData as { mesh?: THREE.Group }).mesh

    const finish = () => {
      if (!fusing.has(a.id) || !fusing.has(b.id)) return
      opts.removeBody(a)
      opts.removeBody(b)
      const newLevel = level + 1
      const group = opts.makeMonsterGroup(newLevel, opts.seed + (++fuseCounter))
      opts.addGroup(group, midX, midY)
      opts.onFuse(newLevel)
      fusing.delete(a.id)
      fusing.delete(b.id)
    }

    if (!meshA || !meshB) {
      finish() // 防御性路径：网格引用缺失时不播特效直接完成（不吞错，照常融合）
      return
    }
    const seqId = ++fuseCounter
    effects.playFuse(meshA, meshB, () => {
      if (seqId !== fuseCounter) return // 序列被新融合覆盖时丢弃过期回调
      finish()
    })
  }

  return {
    init(w, e) {
      world = w
      effects = e
      world.onSameLevelContact(onSameLevel as never)
    },
    update() {
      effects?.tick(1 / 60)
    }
  }
}