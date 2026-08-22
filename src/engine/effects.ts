import * as THREE from 'three'

const FUSE_DURATION = 1.5
const PARTICLE_FULL = 200
const PARTICLE_LOW = 100

export interface EffectManager {
  playFuse(a: THREE.Group, b: THREE.Group, onDone: () => void): void
  tick(dt: number): void
  dispose(): void
  activeCount(): number
  particleBudget(): number
  setStrength(s: number): void
}

interface FuseJob {
  elapsed: number
  a: THREE.Group
  b: THREE.Group
  onDone: () => void
  vertDisplacement: (t: number) => number
}

export function createEffectManager(_renderer: THREE.WebGLRenderer): EffectManager {
  let strength = 1
  const jobs: FuseJob[] = []
  const scene = new THREE.Scene() // 特效专用层，主场景叠加渲染

  // 粒子系统（对象池：Points 单实例，粒子属性在 buffer 中复用）
  const particleGeo = new THREE.BufferGeometry()
  const MAX_PARTICLES = PARTICLE_FULL
  const positions = new Float32Array(MAX_PARTICLES * 3)
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
  const particleMat = new THREE.PointsMaterial({ color: 0xb07a4f, size: 0.06, transparent: true, opacity: 0.9 })
  const particles = new THREE.Points(particleGeo, particleMat)
  particles.visible = false
  scene.add(particles)

  const spawnBurst = (origin: THREE.Vector3, count: number, seed: number) => {
    particles.visible = true
    const pos = particleGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + seed
      const speed = 0.5 + Math.random() * 1.5
      pos.setXYZ(i,
        origin.x + Math.cos(angle) * speed * 0.3,
        origin.y + Math.sin(angle) * speed * 0.3,
        Math.random() * 0.2)
    }
    pos.needsUpdate = true
    particleGeo.setDrawRange(0, count)
  }

  const makeVertDisplacement = (t: number): number => {
    // 液态流动感：低频正弦 + 高频颤动，t=0 最大，t=1 归零
    return (0.5 + 0.5 * Math.cos(t * Math.PI)) * (0.06 + 0.03 * Math.sin(t * 40))
  }

  return {
    playFuse(a, b, onDone) {
      const mid = new THREE.Vector3().addVectors(a.position, b.position).multiplyScalar(0.5)
      spawnBurst(mid, strength >= 1 ? PARTICLE_FULL : PARTICLE_LOW, Math.random() * 100)
      jobs.push({ elapsed: 0, a, b, onDone, vertDisplacement: makeVertDisplacement })
    },
    tick(dt) {
      for (let i = jobs.length - 1; i >= 0; i--) {
        const j = jobs[i]
        j.elapsed += dt
        const t = Math.min(1, j.elapsed / FUSE_DURATION)
        if (strength >= 1 && j.vertDisplacement) {
          const d = j.vertDisplacement(t)
          for (const m of [j.a, j.b]) {
            m.scale.setScalar(1 + d)
            m.position.lerp(m.position.clone().lerp(new THREE.Vector3(0, 0, 0), 0.5), 0.01)
          }
        }
        // 尾声：闪光近似（材质发射强度）
        if (t > 0.85) {
          particles.material.opacity = Math.max(0, 1 - (t - 0.85) / 0.15)
        }
        if (t >= 1) {
          particles.visible = false
          jobs.splice(i, 1)
          j.onDone()
        }
      }
    },
    dispose() {
      particleGeo.dispose()
      particleMat.dispose()
    },
    activeCount: () => jobs.length,
    particleBudget: () => (strength >= 1 ? PARTICLE_FULL : PARTICLE_LOW),
    setStrength(s) {
      strength = s
    }
  }
}