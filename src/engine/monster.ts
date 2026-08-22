import * as THREE from 'three'

export const LEVEL_COUNT = 10
export const BASE_RADIUS = 0.32
const RADIUS_STEP = 0.11

export function levelRadius(level: number): number {
  return BASE_RADIUS + RADIUS_STEP * (level - 1)
}

export interface MonsterParams {
  level: number
  radius: number
  hue: number        // 黏土色系色相（0-360）
  eyeCount: number   // 1-4
  hornCount: number  // 0-4
  tentacleCount: number // 0-3
  mouthOpen: number  // 0-1 嘴张开的程度
}

/** 确定性 LCG 伪随机（同 seed 同序列，用于测试可复现） */
export function createRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export function generateMonsterParams(level: number, seed: number): MonsterParams {
  const rng = createRng(seed * 31 + level * 7)
  const featureBudget = Math.floor(level / 2) + 2 // 1 级 2 个特征，10 级 7 个
  const eyeCount = 1 + Math.floor(rng() * Math.min(4, featureBudget))
  let remaining = Math.max(0, featureBudget - eyeCount)
  const hornCount = remaining > 0 ? Math.min(4, 1 + Math.floor(rng() * remaining)) : 0
  remaining = Math.max(0, remaining - hornCount)
  const tentacleCount = remaining > 0 ? Math.min(3, 1 + Math.floor(rng() * remaining)) : 0
  const clayHues = [28, 42, 14, 210, 340] // 土黄/陶红/赭石/青灰/粉褐
  return {
    level,
    radius: levelRadius(level),
    hue: clayHues[Math.floor(rng() * clayHues.length)],
    eyeCount,
    hornCount,
    tentacleCount,
    mouthOpen: rng()
  }
}

/** 顶点噪声：按 (纬度, 经度, seed) 确定性扰动，模拟手捏痕迹 */
function vertexNoise(lat: number, lon: number, seed: number): number {
  const x = Math.sin(lat * 7 + seed) + Math.sin(lon * 5 + seed * 2)
  return (Math.sin(x * 13.7 + seed * 3) + 1) / 2 // 0-1
}

/** 把球体顶点按参数变形：整体扰动 + 眼窝凹陷 */
function morphSphere(geo: THREE.SphereGeometry, params: MonsterParams, seed: number): void {
  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    const lat = Math.acos(n.y), lon = Math.atan2(n.z, n.x)
    let d = vertexNoise(lat, lon, seed) * 0.08 * Math.min(1, params.level / 6)
    // 眼窝：前半球固定两个主眼位置向内凹陷
    for (let e = 0; e < params.eyeCount && e < 2; e++) {
      const eyeDir = new THREE.Vector3(Math.cos(e * Math.PI), 0.25, Math.sin(e * Math.PI)).normalize()
      const dot = n.dot(eyeDir)
      if (dot > 0.82) d -= 0.12 * (dot - 0.82) * 8
    }
    const scale = (params.radius + d) / v.length()
    v.multiplyScalar(scale)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
}

export function buildMonsterMesh(params: MonsterParams, seed: number): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.SphereGeometry(params.radius, 32, 24)
  morphSphere(geo, params, seed)
  const color = new THREE.Color().setHSL(params.hue / 360, 0.45, 0.5)
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.02
  })
  const body = new THREE.Mesh(geo, mat)
  group.add(body)

  const dark = new THREE.Color(0x222222)
  // 眼睛：眼白小球 + 黑眼珠
  for (let e = 0; e < params.eyeCount; e++) {
    const spread = e === 0 ? 0 : (e % 2 === 1 ? 1 : -1)
    const dir = new THREE.Vector3(Math.cos(e * Math.PI + (spread === 1 ? 0.3 : -0.3)), 0.25, spread * 0.6).normalize()
    const eyePos = dir.clone().multiplyScalar(params.radius * 0.82).add(new THREE.Vector3(0, 0.1 * params.radius, 0))
    const white = new THREE.Mesh(new THREE.SphereGeometry(params.radius * 0.16, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf5efe6, roughness: 0.4 }))
    white.position.copy(eyePos)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(params.radius * 0.07, 12, 8), new THREE.MeshStandardMaterial({ color: dark }))
    pupil.position.copy(eyePos).add(dir.multiplyScalar(params.radius * 0.14))
    group.add(white, pupil)
  }
  // 嘴：前下方一个压扁椭球切口（用半透明暗色球模拟张开的嘴）
  if (params.mouthOpen > 0.2) {
    const mouth = new THREE.Mesh(
      new THREE.SphereGeometry(params.radius * (0.22 + 0.08 * params.mouthOpen), 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 1 })
    )
    mouth.scale.set(1, 0.5, 1)
    mouth.position.set(0, -params.radius * 0.55, params.radius * 0.75)
    group.add(mouth)
  }
  // 角：圆锥
  for (let h = 0; h < params.hornCount; h++) {
    const angle = (h / Math.max(1, params.hornCount)) * Math.PI * 2 + seed
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(params.radius * 0.09, params.radius * 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8c9a3, roughness: 0.8 })
    )
    horn.position.set(Math.cos(angle) * params.radius * 0.5, params.radius * 0.55, Math.sin(angle) * params.radius * 0.5)
    horn.rotation.z = angle
    horn.rotation.x = -0.4
    group.add(horn)
  }
  // 触须：细圆柱
  for (let t = 0; t < params.tentacleCount; t++) {
    const angle = (t + 0.5) / Math.max(1, params.tentacleCount) * Math.PI * 2 + seed * 0.7
    const tent = new THREE.Mesh(
      new THREE.CylinderGeometry(params.radius * 0.04, params.radius * 0.09, params.radius * 0.7, 6),
      mat
    )
    tent.position.set(Math.cos(angle) * params.radius * 0.75, 0, Math.sin(angle) * params.radius * 0.75)
    tent.rotation.z = Math.cos(angle)
    tent.rotation.x = Math.sin(angle)
    group.add(tent)
  }
  return group
}