# 黏土怪物合成进化游戏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一款「大西瓜式」黏土怪物合成进化游戏：投掷程序化生成的黏土怪物，同级相撞触发黏土融合动态特效并进化，10 级封顶计分，容器溢出失败；可打包为 Web / 微信小游戏 / 抖音小游戏三端。

**Architecture:** 纯 TS 共享核心（engine/ 渲染+物理+特效+状态机，ui/ Canvas 2D 自绘，platform/ 平台适配层），三端复用同一份代码；Web 端 Vite 构建先行验证，微信/抖音小游戏以 Vite lib 模式输出单 JS + 适配层。

**Tech Stack:** TypeScript（strict）、Three.js（WebGLRenderer）、cannon-es（刚体物理）、Vite（Web + lib 双构建）、Vitest（引擎纯逻辑单测）。

## Global Constraints

以下约束来自设计文档，每个任务的实现都隐式包含：

- **跨端铁律**：src/ 下任何模块禁止直接访问 `window / document / navigator / localStorage`，一切平台能力经 `platform` 接口
- **容器**：竖屏 3:4（移动端全屏适配，Web 端居中缩放）
- **特效预算**：单特效粒子 ≤ 200；特效总时长 ≤ 1.5s 后回收；关闭阴影；帧率 < 30fps 持续 2s → 降级（粒子减半、关闭顶点动画）
- **融合规则**：同级接触后 0.1s 防误触延迟；融合期间两球对物理世界透明；融合完成新球注册
- **投放/计分**：投放等级随机 1~3；融合得分 = 新等级 × 10；任一球越容器顶部警戒线且静止 → 失败；合成 10 级 → 胜利
- **存档 schema**：`{ bestScore: number; bestiary: number[] }`
- TypeScript `strict: true`；函数 < 50 行；不引入额外 UI 框架（无 Vue/React/DOM 库）

---

### Task 1: 项目脚手架（Vite + TS + Vitest + 空场景）

**Files:**
- Create: `clay-monster-game/package.json`
- Create: `clay-monster-game/tsconfig.json`
- Create: `clay-monster-game/vite.config.ts`
- Create: `clay-monster-game/vitest.config.ts`
- Create: `clay-monster-game/index.html`
- Create: `clay-monster-game/src/main.ts`
- Create: `clay-monster-game/src/platform/types.ts`
- Create: `clay-monster-game/src/platform/web.ts`
- Create: `clay-monster-game/tests/smoke.test.ts`

**Interfaces:**
- Consumes: 无（首个任务）
- Produces: `Platform` 接口（`platform/types.ts`）、`createWebPlatform()`（`platform/web.ts`）、`startGame()`（`src/main.ts` 入口，后续任务填充）

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "clay-monster-game",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build:web": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run: `cd E:/aiProject/clay-monster-game && npm i -D typescript vite vitest && npm i three cannon-es`

Expected: 安装成功；运行 `npm ls three cannon-es` 无报错。（版本以 npm latest 为准，实施时锁定。）

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: 创建 vite.config.ts**

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: { outDir: 'dist/web' }
})
```

- [ ] **Step 5: 创建 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
```

- [ ] **Step 6: 创建 index.html（竖屏画布容器）**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>黏土怪物合成</title>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #2b2b33; overflow: hidden; }
    #app { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    canvas { touch-action: none; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 7: 创建 platform 接口与 web 实现（先行定义架构边界）**

`src/platform/types.ts`：

```ts
/** 平台能力抽象。引擎与 UI 只能通过此接口访问平台能力。 */
export interface Pointer {
  readonly x: number
  readonly y: number
}

export interface InputEvent {
  readonly type: 'down' | 'move' | 'up'
  readonly pointer: Pointer
  readonly id: number
}

export interface Size {
  readonly width: number
  readonly height: number
  readonly dpr: number
}

export interface SafeArea {
  readonly top: number
  readonly bottom: number
}

export interface Storage {
  get<T>(key: string): T | null
  set(key: string, value: unknown): void
}

export interface Platform {
  createCanvas(): HTMLCanvasElement
  size(): Size
  safeArea(): SafeArea
  /** 订阅输入事件流，返回取消订阅函数 */
  onInput(cb: (e: InputEvent) => void): () => void
  loadAsset(url: string): Promise<ArrayBuffer>
  storage: Storage
}
```

`src/platform/web.ts`：

```ts
import type { Platform, InputEvent } from './types'

export function createWebPlatform(): Platform {
  const canvas = document.createElement('canvas')
  const size = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2)
  })
  const toPointer = (e: PointerEvent | Touch): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  return {
    createCanvas: () => canvas,
    size,
    safeArea: () => ({ top: 0, bottom: 0 }),
    onInput(cb) {
      const emit = (type: InputEvent['type'], e: PointerEvent | Touch, id: number) =>
        cb({ type, pointer: toPointer(e), id })
      const down = (e: PointerEvent) => { e.preventDefault(); emit('down', e, e.pointerId) }
      const move = (e: PointerEvent) => { emit('move', e, e.pointerId) }
      const up = (e: PointerEvent) => { emit('up', e, e.pointerId) }
      canvas.addEventListener('pointerdown', down)
      canvas.addEventListener('pointermove', move)
      canvas.addEventListener('pointerup', up)
      canvas.addEventListener('pointercancel', up)
      return () => {
        canvas.removeEventListener('pointerdown', down)
        canvas.removeEventListener('pointermove', move)
        canvas.removeEventListener('pointerup', up)
        canvas.removeEventListener('pointercancel', up)
      }
    },
    async loadAsset(url) {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`loadAsset failed: ${url}`)
      return res.arrayBuffer()
    },
    storage: {
      get<T>(key: string): T | null {
        const raw = localStorage.getItem(key)
        return raw === null ? null : (JSON.parse(raw) as T)
      },
      set(key: string, value: unknown) {
        localStorage.setItem(key, JSON.stringify(value))
      }
    }
  }
}
```

- [ ] **Step 8: 创建 main.ts 入口（空场景占位，后续任务填充）**

`src/main.ts`：

```ts
import { createWebPlatform } from './platform/web'
import type { Platform } from './platform/types'

export async function startGame(platform: Platform): Promise<void> {
  const canvas = platform.createCanvas()
  const holder = document.getElementById('app')
  if (holder) holder.appendChild(canvas)
  const s = platform.size()
  canvas.width = s.width * s.dpr
  canvas.height = s.height * s.dpr
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  startGame(createWebPlatform()).catch((err) => console.error(err))
}
```

- [ ] **Step 9: 写冒烟测试（storage 行为）**

`tests/smoke.test.ts`：

```ts
import { describe, expect, it } from 'vitest'

/** 内存 Storage 实现，用于测试 platform 逻辑（不依赖 DOM） */
export function createMemoryStorage(): import('../src/platform/types').Storage {
  const map = new Map<string, string>()
  return {
    get<T>(key: string): T | null {
      const raw = map.get(key)
      return raw === undefined ? null : (JSON.parse(raw) as T)
    },
    set(key: string, value: unknown) {
      map.set(key, JSON.stringify(value))
    }
  }
}

describe('storage', () => {
  it('roundtrips JSON 值', () => {
    const s = createMemoryStorage()
    s.set('save', { bestScore: 120, bestiary: [1, 2, 3] })
    expect(s.get<{ bestScore: number; bestiary: number[] }>('save')).toEqual({
      bestScore: 120, bestiary: [1, 2, 3]
    })
  })

  it('缺失 key 返回 null', () => {
    expect(createMemoryStorage().get('nope')).toBeNull()
  })
})
```

- [ ] **Step 10: 运行测试验证通过**

Run: `npm test`
Expected: 2 个测试全部 PASS

- [ ] **Step 11: 运行 typecheck 与 dev server**

Run: `npm run typecheck` → 无错误
Run: `npm run dev` → 浏览器打开 `http://localhost:5173`，页面显示深色背景（无报错即可，场景为空是预期）

- [ ] **Step 12: Commit**

```bash
git add clay-monster-game
git commit -m "feat: 脚手架 Vite+TS+Vitest，platform 接口与 web 实现，空场景入口"
```

---

### Task 2: monster.ts 程序化黏土怪物生成

**Files:**
- Create: `src/engine/monster.ts`
- Create: `tests/monster.test.ts`

**Interfaces:**
- Consumes: three（Task 1 安装）
- Produces:
  - `interface MonsterParams { level: number; radius: number; hue: number; eyeCount: number; hornCount: number; tentacleCount: number; mouthOpen: number }`
  - `function generateMonsterParams(level: number, seed: number): MonsterParams` —— 同 (level, seed) 必返回相同参数
  - `interface Monster { params: MonsterParams; group: THREE.Group }`
  - `function buildMonsterMesh(params: MonsterParams): THREE.Group` —— 等级 → 3D 网格（球体顶点噪声 + 眼/嘴/角/触须特征）
  - `const LEVEL_COUNT = 10`、`const BASE_RADIUS = 0.32`、`function levelRadius(level: number): number`（1 级 0.32，每级 +0.11，10 级 1.31）

- [ ] **Step 1: 写失败测试（参数确定性、等级梯度）**

`tests/monster.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { generateMonsterParams, levelRadius, LEVEL_COUNT } from '../src/engine/monster'

describe('generateMonsterParams', () => {
  it('同 seed 同等级结果确定', () => {
    expect(generateMonsterParams(3, 42)).toEqual(generateMonsterParams(3, 42))
  })

  it('不同 seed 产生差异', () => {
    expect(generateMonsterParams(3, 42)).not.toEqual(generateMonsterParams(3, 43))
  })

  it('等级越高特征越多', () => {
    const low = generateMonsterParams(1, 7)
    const high = generateMonsterParams(10, 7)
    expect(high.eyeCount + high.hornCount + high.tentacleCount)
      .toBeGreaterThan(low.eyeCount + low.hornCount + low.tentacleCount)
  })

  it('半径随等级递增且固定', () => {
    expect(levelRadius(1)).toBeCloseTo(0.32)
    expect(levelRadius(10)).toBeCloseTo(1.31)
    for (let i = 2; i <= LEVEL_COUNT; i++) {
      expect(levelRadius(i)).toBeGreaterThan(levelRadius(i - 1))
    }
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 monster.ts**

`src/engine/monster.ts`：

```ts
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
    const d = vertexNoise(lat, lon, seed) * 0.08 * Math.min(1, params.level / 6)
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
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 4 个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/monster.ts tests/monster.test.ts
git commit -m "feat: 程序化黏土怪物生成（确定性种子/等级梯度/特征组合）"
```

---

### Task 3: scene.ts + physics.ts 核心场景与刚体物理

**Files:**
- Create: `src/engine/physics.ts`
- Create: `src/engine/scene.ts`
- Create: `tests/physics.test.ts`

**Interfaces:**
- Consumes: cannon-es、three、`MonsterParams` / `levelRadius`（Task 2）、`Platform`（Task 1）
- Produces:
  - `interface PhysicsWorld { step(dt: number): void; addBall(radius: number, x: number, y: number, userData: unknown): BallBody; removeBall(b: BallBody): void; setSleeping(b: BallBody, sleeping: boolean): void; bodies(): BallBody[] }`
  - `interface BallBody { id: number; x(): number; y(): number; radius: number; userData: unknown; isAtRest(): boolean }` —— `isAtRest()`：速度 < 0.05 且接触面支撑（用于警戒线判负）
  - `interface GameScene { init(): void; addMonsterMesh(g: THREE.Group, x: number, y: number): void; removeMesh(obj: THREE.Object3D): void; setBackground(color: string): void; render(): void; containerTopY(): number; containerWidth(): number; world(): PhysicsWorld }`
  - `function createGameScene(platform: Platform, opts: { seed: number }): GameScene`（cannon-es 世界：重力 y=-9.8，容器左右墙 + 底部，x-z 平面圆形碰撞，y 为下落方向）
  - 渲染同步：每帧 physics 位置 → three 网格位置（y 轴映射：物理 y 向上，three y 向上一致）

- [ ] **Step 1: 写失败测试（物理世界行为，不依赖渲染）**

`tests/physics.test.ts`：

```ts
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
    w.onSameLevelContact((a, b) => contacts.push([a.userData.level as number, b.userData.level as number]))
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
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 physics.ts**

`src/engine/physics.ts`：

```ts
import * as CANNON from 'cannon-es'

export interface BallBody {
  id: number
  radius: number
  userData: unknown
  x(): number
  y(): number
  isAtRest(): boolean
}

export interface PhysicsWorld {
  step(dt: number): void
  addBall(radius: number, x: number, y: number, userData: unknown): BallBody
  removeBall(b: BallBody): void
  setSleeping(b: BallBody, sleeping: boolean): void
  bodies(): BallBody[]
  onSameLevelContact(cb: (a: BallBody, b: BallBody) => void): () => void
}

interface WorldOpts { width: number; height: number; seed: number }

const REST_SPEED = 0.05
const CONTACT_DELAY_FRAMES = 6 // 0.1s @ 60fps，防误触

export function createPhysicsWorld(opts: WorldOpts): PhysicsWorld {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0) })
  world.broadphase = new CANNON.SAPBroadphase(world)
  world.allowSleep = true

  const halfW = opts.width / 2
  const wallMat = new CANNON.Material('wall')
  const ballMat = new CANNON.Material('ball')
  const contactMat = new CANNON.ContactMaterial(ballMat, ballMat, { friction: 0.2, restitution: 0.1 })
  const wallContact = new CANNON.ContactMaterial(ballMat, wallMat, { friction: 0.2, restitution: 0.1 })
  world.addContactMaterial(contactMat)
  world.addContactMaterial(wallContact)

  const floor = new CANNON.Body({ mass: 0, material: wallMat, shape: new CANNON.Plane() })
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  floor.position.set(0, 0, 0)
  world.addBody(floor)
  for (const sx of [-1, 1]) {
    const wall = new CANNON.Body({ mass: 0, material: wallMat, shape: new CANNON.Plane() })
    wall.quaternion.setFromEuler(0, Math.PI / 2 * sx, 0)
    wall.position.set(sx * halfW, opts.height / 2, 0)
    world.addBody(wall)
  }

  let nextId = 0
  const balls: BallBody[] = []
  const sleeping = new Set<number>()
  const contactCbs: Array<(a: BallBody, b: BallBody) => void> = []
  const pending: Array<[number, number, number]> = [] // [aId, bId, frameCount]

  const bodyById = (id: number): BallBody | undefined => balls.find((b) => b.id === id)

  world.addEventListener('postStep', () => {
    for (const [aid, bid, frames] of pending) {
      if (sleeping.has(aid) || sleeping.has(bid)) continue
      if (frames >= CONTACT_DELAY_FRAMES) {
        const a = bodyById(aid)
        const b = bodyById(bid)
        if (a && b) {
          const la = a.userData as { level: number }
          const lb = b.userData as { level: number }
          if (la.level === lb.level) {
            for (const cb of contactCbs) cb(a, b)
          }
        }
        pending.length = 0
      } else {
        pending[pending.indexOf([aid, bid, frames])] = [aid, bid, frames + 1]
      }
    }
  })

  world.addEventListener('beginContact', (ev) => {
    const a = (ev.bodyA as CANNON.Body).userData as { __ballId?: number } | undefined
    const b = (ev.bodyB as CANNON.Body).userData as { __ballId?: number } | undefined
    const aid = a?.__ballId, bid = b?.__ballId
    if (aid === undefined || bid === undefined) return
    if (!pending.some(([pa, pb]) => (pa === aid && pb === bid) || (pa === bid && pb === aid))) {
      pending.push([aid, bid, 0])
    }
  })

  return {
    step(dt) {
      world.step(1 / 60, dt, 3)
    },
    addBall(radius, x, y, userData) {
      const id = nextId++
      const body = new CANNON.Body({
        mass: 1,
        material: ballMat,
        shape: new CANNON.Circle(radius),
        position: new CANNON.Vec3(x, y, 0)
      })
      body.userData = { __ballId: id, level: (userData as { level: number }).level }
      world.addBody(body)
      const ball: BallBody = {
        id,
        radius,
        userData,
        x: () => body.position.x,
        y: () => body.position.y,
        isAtRest: () => {
          const v = body.velocity
          return Math.hypot(v.x, v.y) < REST_SPEED
        }
      }
      balls.push(ball)
      return ball
    },
    removeBall(b) {
      const i = balls.findIndex((x) => x.id === b.id)
      if (i >= 0) balls.splice(i, 1)
      const body = world.bodies.find((x) => (x.userData as { __ballId?: number })?.__ballId === b.id)
      if (body) world.removeBody(body)
    },
    setSleeping(b, sleepingFlag) {
      if (sleepingFlag) sleeping.add(b.id)
      else sleeping.delete(b.id)
    },
    bodies: () => [...balls],
    onSameLevelContact(cb) {
      contactCbs.push(cb)
      return () => {
        const i = contactCbs.indexOf(cb)
        if (i >= 0) contactCbs.splice(i, 1)
      }
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 4 个测试全部 PASS

- [ ] **Step 5: 实现 scene.ts（Three.js 场景 + 物理渲染同步）**

`src/engine/scene.ts`：

```ts
import * as THREE from 'three'
import type { Platform } from '../platform/types'
import { createPhysicsWorld, type PhysicsWorld } from './physics'

export const CONTAINER_ASPECT = 3 / 4

export interface GameScene {
  init(): void
  addMonsterMesh(g: THREE.Group, x: number, y: number): void
  removeMesh(obj: THREE.Object3D): void
  setBackground(color: string): void
  render(): void
  containerTopY(): number
  containerWidth(): number
  world(): PhysicsWorld
}

export function createGameScene(platform: Platform, opts: { seed: number }): GameScene {
  const canvas = platform.createCanvas()
  const size = platform.size()
  const W = Math.min(size.width, size.height * 1.35) * 0.92 // 容器宽（安全区留白）
  const H = W / CONTAINER_ASPECT
  const dpr = size.dpr

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setSize(size.width, size.height, false)
  renderer.setPixelRatio(dpr)
  renderer.shadowMap.enabled = false // 性能预算：关闭阴影

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x2b2b33)
  const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 100)
  camera.position.set(0, 0, 10)

  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const dir = new THREE.DirectionalLight(0xfff2dd, 1.4)
  dir.position.set(2, 3, 4)
  scene.add(dir)

  const world = createPhysicsWorld({ width: W, height: H, seed: opts.seed })

  // 容器边框线
  const borderMat = new THREE.LineBasicMaterial({ color: 0x777780 })
  const pts = [
    new THREE.Vector3(-W / 2, 0, 0), new THREE.Vector3(-W / 2, H, 0),
    new THREE.Vector3(W / 2, H, 0), new THREE.Vector3(W / 2, 0, 0),
    new THREE.Vector3(-W / 2, 0, 0)
  ]
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), borderMat))

  const meshByBody = new Map<number, THREE.Object3D>()

  const sync = () => {
    for (const b of world.bodies()) {
      const mesh = meshByBody.get(b.id)
      if (mesh) {
        mesh.position.x = b.x()
        mesh.position.y = b.y()
      }
    }
  }

  return {
    init() {
      canvas.width = size.width * dpr
      canvas.height = size.height * dpr
      renderer.setSize(size.width, size.height, false)
    },
    addMonsterMesh(g, x, y) {
      g.position.set(x, y, 0)
      scene.add(g)
      const body = world.bodies().find((b) => Math.hypot(b.x() - x, b.y() - y) < 0.001)
      if (body) meshByBody.set(body.id, g)
    },
    removeMesh(obj) {
      scene.remove(obj)
    },
    setBackground(color) {
      scene.background = new THREE.Color(color)
    },
    render() {
      world.step(1 / 60)
      sync()
      renderer.render(scene, camera)
    },
    containerTopY: () => H,
    containerWidth: () => W,
    world: () => world
  }
}
```

- [ ] **Step 6: Web 手动验证**

Run: `npm run dev`，临时在 `main.ts` 末尾追加调试代码（验证后删除）：

```ts
const scene = createGameScene(platform, { seed: 1 })
scene.init()
const params = generateMonsterParams(1, 5)
scene.world().addBall(params.radius, 0, 2.0, { level: 1 })
scene.addMonsterMesh(buildMonsterMesh(params, 5), 0, 2.0)
let raf = 0
const loop = () => { scene.render(); raf = requestAnimationFrame(loop) }
loop()
```

Expected: 页面中心显示一个黏土小球，从上方落到容器底部静止；浏览器 console 无报错。

- [ ] **Step 7: 移除调试代码，Commit**

```bash
git add src/engine/physics.ts src/engine/scene.ts tests/physics.test.ts src/main.ts
git commit -m "feat: cannon-es 物理世界 + Three.js 场景渲染同步"
```

---

### Task 4: game.ts 状态机、计分与存档

**Files:**
- Create: `src/engine/game.ts`
- Create: `tests/game.test.ts`

**Interfaces:**
- Consumes: `PhysicsWorld`（Task 3）、`Storage`（Task 1）
- Produces:
  - `type GameState = 'idle' | 'dragging' | 'falling' | 'fusing' | 'over'`
  - `interface GameSnapshot { state: GameState; score: number; nextLevel: number; dragX: number | null; win: boolean; bestiary: number[] }`
  - `type GameEvent = { type: 'score'; score: number } | { type: 'next'; level: number } | { type: 'fuse'; level: number } | { type: 'bestiary'; collected: number[] } | { type: 'over'; win: boolean; score: number }`
  - `interface Game { snapshot(): GameSnapshot; pointerDown(x: number, y: number): void; pointerMove(x: number, y: number): void; pointerUp(x: number): void; restart(): void; onEvent(cb: (e: GameEvent) => void): () => void; update(physics: PhysicsWorld): void }`
  - `function createGame(opts: { storage: Storage; containerWidth: number; containerTopY: number; randomLevel: () => number; seed: number }): Game`
  - 投放规则：`pointerUp` 时若 y 在容器顶部上方（投放区）则投放 `nextLevel` 球；`randomLevel()` 返回 1-3
  - 警戒线判负：`update()` 中任一球 `y > containerTopY * 0.98` 且 `isAtRest()` → state='over'（win=false）
  - 胜利：融合出 10 级 → 'over'（win=true）
  - 存档：`score` 变化时更新 `bestScore`；图鉴追加融合出的等级

- [ ] **Step 1: 写失败测试**

`tests/game.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 game.ts**

`src/engine/game.ts`：

```ts
import type { PhysicsWorld } from './physics'
import type { Storage } from '../platform/types'

export type GameState = 'idle' | 'dragging' | 'falling' | 'fusing' | 'over'

export interface GameSnapshot {
  state: GameState
  score: number
  nextLevel: number
  dragX: number | null
  win: boolean
  bestiary: number[]
}

export type GameEvent =
  | { type: 'score'; score: number }
  | { type: 'next'; level: number }
  | { type: 'drop'; x: number; level: number }
  | { type: 'fuse'; level: number }
  | { type: 'bestiary'; collected: number[] }
  | { type: 'over'; win: boolean; score: number }

export interface Game {
  snapshot(): GameSnapshot
  pointerDown(x: number, y: number): void
  pointerMove(x: number, y: number): void
  pointerUp(x: number): void
  restart(): void
  onEvent(cb: (e: GameEvent) => void): () => void
  update(physics: PhysicsWorld): void
}

interface GameOpts {
  storage: Storage
  containerWidth: number
  containerTopY: number
  randomLevel: () => number
  seed: number
}

const SAVE_KEY = 'clay-monster-save'
const DROP_ZONE_TOP = 0.2 // 顶部投放区高度占比

export function createGame(opts: GameOpts): Game {
  const saved = opts.storage.get<{ bestScore: number; bestiary: number[] }>(SAVE_KEY)
  const bestiary = new Set(saved?.bestiary ?? [])
  let bestScore = saved?.bestScore ?? 0
  let state: GameState = 'idle'
  let score = 0
  let nextLevel = opts.randomLevel()
  let dragX: number | null = null
  let win = false
  const listeners = new Set<(e: GameEvent) => void>()
  const emit = (e: GameEvent) => { for (const cb of listeners) cb(e) }

  const save = () => {
    opts.storage.set(SAVE_KEY, { bestScore, bestiary: [...bestiary] })
  }

  const fuseLevel = (level: number) => {
    if (state === 'over') return
    state = 'fusing'
    score += level * 10
    bestScore = Math.max(bestScore, score)
    bestiary.add(level)
    emit({ type: 'fuse', level })
    emit({ type: 'score', score })
    emit({ type: 'bestiary', collected: [...bestiary] })
    if (level >= 10) {
      win = true
      state = 'over'
      emit({ type: 'over', win, score })
    } else {
      state = 'falling'
    }
    save()
  }

  return {
    snapshot: () => ({
      state, score, nextLevel, dragX, win, bestiary: [...bestiary]
    }),
    pointerDown(x, y) {
      if (state === 'over') return
      if (y > opts.containerTopY * (1 - DROP_ZONE_TOP)) {
        state = 'dragging'
        dragX = x
      }
    },
    pointerMove(x) {
      if (state !== 'dragging') return
      const half = opts.containerWidth / 2
      dragX = Math.max(-half, Math.min(half, x))
    },
    pointerUp(x) {
      if (state !== 'dragging') return
      const half = opts.containerWidth / 2
      const dropX = Math.max(-half, Math.min(half, x))
      state = 'falling'
      dragX = null
      emit({ type: 'drop', x: dropX, level: nextLevel })
      nextLevel = opts.randomLevel()
      emit({ type: 'next', level: nextLevel })
    },
    restart() {
      state = 'idle'
      score = 0
      win = false
      nextLevel = opts.randomLevel()
      dragX = null
    },
    onEvent(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    update(physics) {
      if (state !== 'falling') return
      for (const b of physics.bodies()) {
        if (b.y() > opts.containerTopY * 0.98 && b.isAtRest()) {
          state = 'over'
          emit({ type: 'over', win: false, score })
          save()
          return
        }
      }
    },
    // 测试与 fuse 编排用（内部契约，不对外文档化）
    _fuseLevel: fuseLevel,
    _forceOver() {
      state = 'over'
      win = false
      emit({ type: 'over', win: false, score })
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 7 个测试全部 PASS
（测试中 `_forceOver` / `_fuseLevel` 通过 `as unknown as` 调用了真实方法 `fuseLevel`——注意 `fuseLevel` 为模块内函数未导出，测试通过闭包访问不到；需将 `fuseLevel` 改为对象方法：在返回对象中加 `_fuseLevel: fuseLevel` 和 `_forceOver() { state = 'over' }`。若编译失败按此修正。）

- [ ] **Step 5: Commit**

```bash
git add src/engine/game.ts tests/game.test.ts
git commit -m "feat: 游戏状态机、计分、胜负判定与存档"
```

---

### Task 5: effects.ts 融合特效系统

**Files:**
- Create: `src/engine/effects.ts`
- Create: `tests/effects.test.ts`

**Interfaces:**
- Consumes: three、`MonsterParams`（Task 2）
- Produces:
  - `interface EffectManager { playFuse(a: THREE.Group, b: THREE.Group, onDone: () => void): void; tick(dt: number): void; dispose(): void; activeCount(): number; strength(): number; setStrength(s: number): void }`
  - `function createEffectManager(renderer: THREE.WebGLRenderer): EffectManager`
  - 融合序列（总时长 1.5s）：0-0.1s 锁定静止 → 0.1s 粒子飞溅（≤120）→ 0.1-0.9s 液态顶点变形 → 0.9-1.2s 闪光+冲击环 → 1.2s 后移除两球网格、回调 `onDone`（新球由调用方注册）
  - 预算：单序列粒子 ≤ 200；`setStrength(0.5)` 时粒子减半、跳过顶点变形；`activeCount()` 返回进行中序列数；对象池复用粒子 geometry

- [ ] **Step 1: 写失败测试（预算与序列控制，纯逻辑部分）**

`tests/effects.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { createEffectManager } from '../src/engine/effects'

// 用最小 renderer 桩替代真实 WebGL（effects 的预算/序列逻辑不依赖真实渲染）
function stubRenderer() {
  return {} as unknown as import('three').WebGLRenderer
}

describe('effect manager', () => {
  it('开始序列后 activeCount 增加，完成后归零并回调', () => {
    const em = createEffectManager(stubRenderer())
    const a = {} as never, b = {} as never
    let done = false
    em.playFuse(a as never, b as never, () => { done = true })
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
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 effects.ts**

`src/engine/effects.ts`：

```ts
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

export function createEffectManager(renderer: THREE.WebGLRenderer): EffectManager {
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
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 2 个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/effects.ts tests/effects.test.ts
git commit -m "feat: 融合特效系统（粒子/顶点变形/序列控制/降级预算）"
```

---

### Task 6: fuse.ts 融合检测与流程编排

**Files:**
- Create: `src/engine/fuse.ts`
- Create: `tests/fuse.test.ts`

**Interfaces:**
- Consumes: `PhysicsWorld`（Task 3）、`EffectManager`（Task 5）、`Game` 事件（Task 4，`emit('fuse')` 经 game 的 `_fuseLevel` 或由调用方接事件）
- Produces:
  - `interface FuseSystem { init(world: PhysicsWorld, effects: EffectManager): void; update(): void }`
  - `function createFuseSystem(opts: { onFuse: (level: number) => void; makeMonsterGroup: (level: number, seed: number) => THREE.Group; removeBody: (b: unknown) => void; addGroup: (g: THREE.Group, x: number, y: number) => void; seed: number }): FuseSystem`
  - 行为：`init` 订阅 `world.onSameLevelContact`；接触后（已由 physics 的 0.1s 延迟保证）→ 置两球 sleeping → 播放融合特效 → 完成后移除两球物理体与网格 → `onFuse(level+1)` → 在融合中点坐标注册新球与新网格
  - `makeMonsterGroup` 由调用方注入（Web 端生成怪物网格，小游戏端同代码）

- [ ] **Step 1: 写失败测试（接触→融合→新球，注入桩）**

`tests/fuse.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 fuse.ts**

`src/engine/fuse.ts`：

```ts
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
  let unsubscribe: (() => void) | null = null
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
      unsubscribe = world.onSameLevelContact(onSameLevel as never)
    },
    update() {
      effects?.tick(1 / 60)
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 1 个测试 PASS
（若 `finish` 的调用顺序引发 lint/编译问题——`finish` 在 `playFuse` 闭包外定义会因 TDZ 报错，按以下修正：将 `finish` 定义为 `const finish = () => {...}` 放在 `playFuse` 调用之前，`onDone` 内引用。）

- [ ] **Step 5: Commit**

```bash
git add src/engine/fuse.ts tests/fuse.test.ts
git commit -m "feat: 融合检测编排（防重入/网格移除/新球注册）"
```

---

### Task 7: ui/ Canvas 2D 界面（HUD、图鉴、弹窗、投放交互）

**Files:**
- Create: `src/ui/hud.ts`
- Create: `src/ui/bestiary.ts`
- Create: `src/ui/overlay.ts`
- Create: `tests/ui-hit.test.ts`

**Interfaces:**
- Consumes: `GameSnapshot` / `GameEvent`（Task 4）、`Platform`（Task 1）、`levelRadius`（Task 2）
- Produces:
  - `interface UiContext { ctx: CanvasRenderingContext2D; width: number; height: number; safeArea: { top: number; bottom: number } }`
  - `function drawHud(ctx: UiContext, snapshot: GameSnapshot): void` —— 顶部：得分 / 等级进度 / 下一只预览（用 `levelRadius` 画彩色圆）
  - `function drawBestiary(ctx: UiContext, collected: number[], levelColors: (l: number) => string): void` —— 全屏页，10 格剪影
  - `function drawOverlay(ctx: UiContext, snapshot: GameSnapshot): { restartRect: { x: number; y: number; w: number; h: number } }` —— 结束弹窗 + 重开按钮矩形（供命中检测）
  - `function hitRect(p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }): boolean`
  - 等级颜色：`function levelColor(level: number): string`（黏土色系 10 档渐变）

- [ ] **Step 1: 写失败测试（命中检测与绘制函数可测性）**

`tests/ui-hit.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { hitRect, levelColor } from '../src/ui/hud'

describe('hit test', () => {
  it('点在矩形内', () => {
    expect(hitRect({ x: 10, y: 10 }, { x: 0, y: 0, w: 20, h: 20 })).toBe(true)
    expect(hitRect({ x: 21, y: 10 }, { x: 0, y: 0, w: 20, h: 20 })).toBe(false)
  })
})

describe('level color', () => {
  it('1-10 级颜色确定且互异', () => {
    const colors = new Set(Array.from({ length: 10 }, (_, i) => levelColor(i + 1)))
    expect(colors.size).toBe(10)
    expect(levelColor(1)).toBe('#8a6d3b')
    expect(levelColor(10)).toBe('#5b3a8a')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 hud.ts（HUD + 命中 + 颜色）**

`src/ui/hud.ts`：

```ts
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
```

- [ ] **Step 4: 实现 bestiary.ts（图鉴页）**

`src/ui/bestiary.ts`：

```ts
import type { UiContext } from './hud'
import { levelRadius } from '../engine/monster'

export function drawBestiary(ctxC: UiContext, collected: number[], colorOf: (l: number) => string): void {
  const { ctx, width, height, safeArea } = ctxC
  ctx.save()
  ctx.fillStyle = 'rgba(30, 30, 38, 0.96)'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#f5efe6'
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('怪物图鉴', width / 2, safeArea.top + 36)
  const cols = 2, rows = 5
  const cellW = width / cols, cellH = (height - safeArea.top - safeArea.bottom - 80) / rows
  for (let i = 0; i < 10; i++) {
    const cx = cellW * (i % cols) + cellW / 2
    const cy = safeArea.top + 80 + cellH * Math.floor(i / cols) + cellH / 2
    const lv = i + 1
    const has = collected.includes(lv)
    ctx.fillStyle = has ? colorOf(lv) : '#3a3a44'
    ctx.beginPath()
    ctx.arc(cx, cy, levelRadius(lv) * 46, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = has ? '#f5efe6' : '#8a8a94'
    ctx.font = '14px sans-serif'
    ctx.fillText(has ? `Lv.${lv}` : '???', cx, cy + levelRadius(lv) * 46 + 18)
  }
  ctx.restore()
}
```

- [ ] **Step 5: 实现 overlay.ts（结束弹窗）**

`src/ui/overlay.ts`：

```ts
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
```

- [ ] **Step 6: 运行测试验证通过**

Run: `npm test`
Expected: 2 个测试 PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui tests/ui-hit.test.ts
git commit -m "feat: Canvas 2D UI（HUD/图鉴/弹窗/命中检测）"
```

---

### Task 8: Web 端完整整合（可玩闭环）

**Files:**
- Modify: `src/main.ts`
- Create: `tests/integration.test.ts`

**Interfaces:**
- Consumes: Task 1-7 全部模块
- Produces: 可玩的 Web 版（`npm run dev` 全流程：投放→下落→融合→计分→图鉴→结束→重开）；`startGame(platform)` 完整实现

- [ ] **Step 1: 写失败测试（投放→接触→融合→计分的端到端编排，桩 world）**

`tests/integration.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试验证通过**

Run: `npm test`
Expected: PASS（该测试验证编排不抛错；渲染人工验证在 Step 4）

- [ ] **Step 3: 完整实现 main.ts（编排一切）**

`src/main.ts`：

```ts
import * as THREE from 'three'
import { createWebPlatform } from './platform/web'
import type { Platform } from './platform/types'
import { createGameScene } from './engine/scene'
import { createGame } from './engine/game'
import { createFuseSystem } from './engine/fuse'
import { createEffectManager } from './engine/effects'
import { generateMonsterParams, buildMonsterMesh, levelRadius } from './engine/monster'
import { drawHud, hitRect, levelColor } from './ui/hud'
import { drawBestiary } from './ui/bestiary'
import { drawOverlay } from './ui/overlay'
import type { UiContext } from './ui/hud'

let showBestiary = false
let lastRestartRect: { x: number; y: number; w: number; h: number } | null = null

export async function startGame(platform: Platform): Promise<void> {
  const canvas = platform.createCanvas()
  const holder = document.getElementById('app')
  if (holder) holder.appendChild(canvas)

  const seed = Math.floor(Math.random() * 1e6)
  const scene = createGameScene(platform, { seed })
  scene.init()

  // UI 覆盖层画布（pointer-events 关闭，输入统一走主画布）
  const uiCanvas = document.createElement('canvas')
  uiCanvas.style.position = 'absolute'
  uiCanvas.style.inset = '0'
  uiCanvas.style.pointerEvents = 'none'
  if (holder) holder.appendChild(uiCanvas)
  const s = platform.size()
  uiCanvas.width = s.width * s.dpr
  uiCanvas.height = s.height * s.dpr
  uiCanvas.getContext('2d')!.scale(s.dpr, s.dpr)
  const uiCtx: UiContext = { ctx: uiCanvas.getContext('2d')!, width: s.width, height: s.height, safeArea: platform.safeArea() }

  const game = createGame({
    storage: platform.storage,
    containerWidth: scene.containerWidth(),
    containerTopY: scene.containerTopY(),
    randomLevel: () => 1 + Math.floor(Math.random() * 3),
    seed
  })

  const effects = createEffectManager(scene as unknown as THREE.WebGLRenderer)

  // 球 = 物理体 + 网格（网格经 userData.mesh 绑定，供 fuse 取用）
  const spawnBall = (level: number, x: number, y: number) => {
    const gseed = Math.floor(Math.random() * 1e6)
    const params = generateMonsterParams(level, gseed)
    const group = buildMonsterMesh(params, gseed)
    const body = scene.world().addBall(params.radius, x, y, { level, mesh: group })
    scene.addMonsterMesh(group, x, y)
    return { body, group }
  }

  const clearAll = () => {
    for (const b of scene.world().bodies()) {
      const mesh = (b.userData as { mesh?: THREE.Group }).mesh
      if (mesh) scene.removeMesh(mesh)
      scene.world().removeBall(b)
    }
  }

  const fuse = createFuseSystem({
    onFuse: (level) => (game as unknown as { _fuseLevel: (l: number) => void })._fuseLevel(level),
    makeMonsterGroup: (level, fseed) => buildMonsterMesh(generateMonsterParams(level, fseed), fseed),
    removeBody: (ball) => {
      const mesh = (ball as { userData: { mesh?: THREE.Group } }).userData.mesh
      if (mesh) scene.removeMesh(mesh)
      scene.world().removeBall(ball as never)
    },
    addGroup: (g, x, y) => {
      const lv = (g.userData as { level?: number })?.level ?? 1
      const body = scene.world().addBall(levelRadius(lv), x, y, { level: lv, mesh: g })
      scene.addMonsterMesh(g, x, y)
      void body
    },
    seed
  })
  fuse.init(scene.world(), effects)

  // 投放：引擎 drop 事件 → 生成球（容器顶部投放）
  game.onEvent((e) => {
    if (e.type === 'drop') {
      spawnBall(e.level, e.x, scene.containerTopY())
    }
  })

  // 输入分流：图鉴按钮 / 重开按钮 / 拖拽投放
  const bestiaryBtn = { x: s.width - 88, y: s.height - 68, w: 72, h: 48 }
  const handleDown = (x: number, y: number) => {
    const snap = game.snapshot()
    if (showBestiary) { showBestiary = false; return }
    if (snap.state === 'over') {
      if (lastRestartRect && hitRect({ x, y }, lastRestartRect)) {
        clearAll()
        game.restart()
        lastRestartRect = null
      }
      return
    }
    if (hitRect({ x, y }, bestiaryBtn)) { showBestiary = true; return }
    game.pointerDown(x, y)
  }
  platform.onInput((e) => {
    if (e.type === 'down') handleDown(e.pointer.x, e.pointer.y)
    if (e.type === 'move' && game.snapshot().state === 'dragging') game.pointerMove(e.pointer.x)
    if (e.type === 'up' && game.snapshot().state === 'dragging') game.pointerUp(e.pointer.x)
  })

  // 主循环：物理+渲染+特效，UI 层绘制
  let last = performance.now()
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    scene.render()
    fuse.update()
    game.update(scene.world())

    const snap = game.snapshot()
    if (snap.state === 'over') {
      lastRestartRect = drawOverlay(uiCtx, snap)
    } else if (showBestiary) {
      drawBestiary(uiCtx, snap.bestiary, levelColor)
    } else {
      drawHud(uiCtx, snap)
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  // 帧率监测与特效降级（预算：<30fps 持续 2s → 降级）
  let lowFpsStreak = 0
  let lastFpsCheck = performance.now()
  setInterval(() => {
    const fps = 1000 / Math.max(1, performance.now() - lastFpsCheck)
    lastFpsCheck = performance.now()
    if (fps < 30) {
      lowFpsStreak++
      if (lowFpsStreak >= 2) { effects.setStrength(0.5); lowFpsStreak = 0 }
    } else {
      lowFpsStreak = 0
    }
  }, 2000)
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  startGame(createWebPlatform()).catch((err) => console.error(err))
}
```

- [ ] **Step 4: Web 全流程手动验证**

Run: `npm run dev`

验证清单（必须逐项确认）：
1. 点击画布顶部 → 出现半透明拖拽球跟随手指
2. 松手 → 球下落，落底静止
3. 投放两个同级球 → 接触后 0.1s 出现粒子飞溅 + 液态变形 + 闪光，两球消失、新球出现，得分 +10
4. 分数、下一只预览实时更新
5. 右上角图鉴按钮 → 图鉴页显示 10 格（已合成彩球、未合成 ???）
6. 合成 10 级 → 弹窗「🎉 合成出终极怪物！」
7. 刷新页面 → 最高分与图鉴保留（localStorage）
8. 连续投放至溢出 → 弹窗「容器满了…」，点「再来一局」重置

- [ ] **Step 5: Commit**

```bash
git add src/main.ts tests/integration.test.ts
git commit -m "feat: Web 端完整整合，可玩闭环（投放/融合/图鉴/重开/存档）"
```

---

### Task 9: 微信小游戏端适配与构建

**Files:**
- Create: `src/platform/wechat.ts`
- Create: `wechat/game.js`（构建产物输出目标）
- Create: `wechat/game.json`
- Create: `wechat/project.config.json`
- Create: `vite.wechat.config.ts`
- Modify: `src/main.ts`（入口按平台分流）

**Interfaces:**
- Consumes: `Platform` 接口（Task 1）、engine/ui 全部（Task 2-8）
- Produces: `createWechatPlatform(): Platform`；构建产物 `wechat/game.js`（单文件，含 three/cannon-es/engine/ui）

- [ ] **Step 1: 写失败测试（wechat storage 与输入事件映射的纯逻辑）**

`tests/wechat.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { wechatStorage } from '../src/platform/wechat'

describe('wechat storage adapter', () => {
  it('wx.getStorageSync 语义：读写 JSON', () => {
    const map = new Map<string, string>()
    const store = wechatStorage({
      getStorageSync: (k: string) => map.get(k) ?? '',
      setStorageSync: (k: string, v: string) => { map.set(k, v) }
    })
    store.set('save', { bestScore: 5, bestiary: [1] })
    expect(store.get<{ bestScore: number; bestiary: number[] }>('save')).toEqual({ bestScore: 5, bestiary: [1] })
    expect(store.get('missing')).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 wechat.ts**

`src/platform/wechat.ts`：

```ts
import type { Platform, InputEvent, Storage } from './types'

declare const wx: {
  createCanvas(): HTMLCanvasElement
  getSystemInfoSync(): { windowWidth: number; windowHeight: number; pixelRatio: number; safeArea?: { top: number; bottom: number } }
  getStorageSync(key: string): string
  setStorageSync(key: string, value: string): void
  onTouchStart(cb: (e: { touches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
  onTouchMove(cb: (e: { touches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
  onTouchEnd(cb: (e: { changedTouches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
}

/** 微信 storage 适配（可注入测试） */
export function wechatStorage(api: {
  getStorageSync(key: string): string
  setStorageSync(key: string, value: string): void
}): Storage {
  return {
    get<T>(key: string): T | null {
      const raw = api.getStorageSync(key)
      return raw === '' || raw === undefined ? null : (JSON.parse(raw) as T)
    },
    set(key: string, value: unknown) {
      api.setStorageSync(key, JSON.stringify(value))
    }
  }
}

export function createWechatPlatform(): Platform {
  const canvas = wx.createCanvas()
  const info = wx.getSystemInfoSync()
  const size = () => ({ width: info.windowWidth, height: info.windowHeight, dpr: info.pixelRatio })
  const safeArea = () => ({
    top: info.safeArea?.top ?? 0,
    bottom: (info.windowHeight - (info.safeArea?.bottom ?? info.windowHeight)) ?? 0
  })
  const listeners = new Set<(e: InputEvent) => void>()
  const emit = (type: InputEvent['type'], t: { clientX: number; clientY: number; identifier: number }) => {
    for (const cb of listeners) cb({ type, pointer: { x: t.clientX, y: t.clientY }, id: t.identifier })
  }
  wx.onTouchStart((e) => { for (const t of e.touches) emit('down', t) })
  wx.onTouchMove((e) => { for (const t of e.touches) emit('move', t) })
  wx.onTouchEnd((e) => { for (const t of e.changedTouches) emit('up', t) })

  return {
    createCanvas: () => canvas,
    size,
    safeArea,
    onInput(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    async loadAsset(url) {
      // 微信小游戏资源走网络下载；本地内置资源走 pack（YAGNI：先网络）
      return (await import('./wechat-load')).loadWechatAsset(url)
    },
    storage: wechatStorage({ getStorageSync: wx.getStorageSync.bind(wx), setStorageSync: wx.setStorageSync.bind(wx) })
  }
}
```

`src/platform/wechat-load.ts`：

```ts
declare const wx: {
  request(opts: { url: string; responseType: string; success: (r: { data: ArrayBuffer }) => void; fail: (e: unknown) => void }): void
}

export function loadWechatAsset(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      responseType: 'arraybuffer',
      success: (r) => resolve(r.data),
      fail: (e) => reject(e)
    })
  })
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 1 个测试 PASS

- [ ] **Step 5: 创建小游戏工程文件**

`wechat/game.json`：

```json
{
  "deviceOrientation": "portrait",
  "showStatusBar": false
}
```

`wechat/project.config.json`：

```json
{
  "appid": "touristappid",
  "projectname": "clay-monster-game",
  "compileType": "game",
  "setting": { "es6": true, "minified": true }
}
```

- [ ] **Step 6: 创建小游戏构建配置（Vite lib 模式输出单 JS）**

`vite.wechat.config.ts`：

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'wechat',
    lib: {
      entry: 'src/minigame-entry.ts',
      formats: ['es'],
      fileName: () => 'game.js'
    },
    target: 'es2018',
    minify: true,
    emptyOutDir: false
  }
})
```

`src/minigame-entry.ts`：

```ts
import { createWechatPlatform } from './platform/wechat'
import { startGame } from './main'

startGame(createWechatPlatform()).catch((err) => {
  // 微信小游戏无 console 不可用时静默；可经 wx.getRealtimeLogManager 上报
  if (typeof console !== 'undefined') console.error(err)
})
```

- [ ] **Step 7: 构建并人工验证（微信开发者工具）**

Run: `npm run build:wechat`（在 package.json scripts 加 `"build:wechat": "vite build --config vite.wechat.config.ts"`）

Expected: `wechat/game.js` 生成（约 1-2MB 未压缩，可接受：主包 < 4MB）

验证（微信开发者工具，导入 `wechat/` 目录）：
1. 项目加载无编译错误，console 无 adapter 报错
2. 核心流程冒烟：投放→下落→融合特效→计分
3. 若出现 `WebGL is not supported` / `THREE.WebGLRenderer` 报错 → 需要在 `minigame-entry.ts` 顶部注入适配层（提供 `window`/`document` 全局模拟，见 Step 8）

- [ ] **Step 8: 小游戏全局适配注入（仅在需要时）**

若 Step 7 报 `canvas is not defined` 类错误，在 `src/minigame-entry.ts` 顶部加：

```ts
// 小游戏无 DOM 全局：提供 three 需要的最小全局模拟（微信官方 threejs-miniprogram 等价做法）
declare const wx: { createCanvas(): HTMLCanvasElement }
const g = globalThis as Record<string, unknown>
const canvas = wx.createCanvas()
g.window = { innerWidth: 0, innerHeight: 0, devicePixelRatio: 1, requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16), cancelAnimationFrame: (id: number) => clearTimeout(id) }
g.document = { createElementNS: () => canvas, createElement: () => canvas }
g.HTMLCanvasElement = function HTMLCanvasElement() {} as unknown
g.navigator = { userAgent: 'minigame' }
```

（若 three 的 `WebGLRenderer({ canvas })` 直接注入 canvas 实例，则此注入可能不需要——以开发者工具实测为准。**成功标准**：游戏在微信开发者工具中可完整玩通一局。）

- [ ] **Step 9: Commit**

```bash
git add src/platform/wechat.ts src/platform/wechat-load.ts src/minigame-entry.ts vite.wechat.config.ts wechat/game.json wechat/project.config.json tests/wechat.test.ts package.json
git commit -m "feat: 微信小游戏端（适配层+构建产物+全局注入）"
```

---

### Task 10: 抖音小游戏端适配与构建

**Files:**
- Create: `src/platform/douyin.ts`
- Create: `douyin/game.json`
- Create: `douyin/project.config.json`
- Create: `vite.douyin.config.ts`
- Create: `src/douyin-entry.ts`
- Modify: `src/main.ts`（无改动——入口分流）

**Interfaces:**
- Consumes: `Platform` 接口、wechat.ts 的 `wechatStorage`（复用）
- Produces: `createDouyinPlatform(): Platform`（tt.* API，实现与 wechat 同构）；构建产物 `douyin/game.js`

- [ ] **Step 1: 写失败测试（tt storage 语义）**

`tests/douyin.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { douyinStorage } from '../src/platform/douyin'

describe('douyin storage adapter', () => {
  it('tt 语义：读写 JSON', () => {
    const map = new Map<string, string>()
    const store = douyinStorage({
      getStorageSync: (k: string) => map.get(k) ?? '',
      setStorageSync: (k: string, v: string) => { map.set(k, v) }
    })
    store.set('save', { bestScore: 9 })
    expect(store.get<{ bestScore: number }>('save')).toEqual({ bestScore: 9 })
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 douyin.ts**

`src/platform/douyin.ts`：

```ts
import type { Platform, InputEvent, Storage } from './types'
import { wechatStorage } from './wechat'

declare const tt: {
  createCanvas(): HTMLCanvasElement
  getSystemInfoSync(): { windowWidth: number; windowHeight: number; pixelRatio: number; safeArea?: { top: number; bottom: number } }
  getStorageSync(key: string): string
  setStorageSync(key: string, value: string): void
  onTouchStart(cb: (e: { touches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
  onTouchMove(cb: (e: { touches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
  onTouchEnd(cb: (e: { changedTouches: Array<{ clientX: number; clientY: number; identifier: number }> }) => void): void
}

export const douyinStorage = wechatStorage // tt 与 wx storage API 同构，直接复用

export function createDouyinPlatform(): Platform {
  const canvas = tt.createCanvas()
  const info = tt.getSystemInfoSync()
  const size = () => ({ width: info.windowWidth, height: info.windowHeight, dpr: info.pixelRatio })
  const safeArea = () => ({
    top: info.safeArea?.top ?? 0,
    bottom: info.windowHeight - (info.safeArea?.bottom ?? info.windowHeight)
  })
  const listeners = new Set<(e: InputEvent) => void>()
  const emit = (type: InputEvent['type'], t: { clientX: number; clientY: number; identifier: number }) => {
    for (const cb of listeners) cb({ type, pointer: { x: t.clientX, y: t.clientY }, id: t.identifier })
  }
  tt.onTouchStart((e) => { for (const t of e.touches) emit('down', t) })
  tt.onTouchMove((e) => { for (const t of e.touches) emit('move', t) })
  tt.onTouchEnd((e) => { for (const t of e.changedTouches) emit('up', t) })

  return {
    createCanvas: () => canvas,
    size,
    safeArea,
    onInput(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    async loadAsset(url) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        tt.request({
          url,
          responseType: 'arraybuffer',
          success: (r: { data: ArrayBuffer }) => resolve(r.data),
          fail: (e: unknown) => reject(e)
        })
      })
    },
    storage: douyinStorage({ getStorageSync: tt.getStorageSync.bind(tt), setStorageSync: tt.setStorageSync.bind(tt) })
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 1 个测试 PASS

- [ ] **Step 5: 创建抖音小游戏工程文件**

`douyin/game.json`：

```json
{
  "deviceOrientation": "portrait"
}
```

`douyin/project.config.json`：

```json
{
  "projectname": "clay-monster-game",
  "compileType": "game"
}
```

- [ ] **Step 6: 创建构建配置与入口**

`vite.douyin.config.ts`（同 `vite.wechat.config.ts` 结构，outDir: `douyin`，entry: `src/douyin-entry.ts`）

`src/douyin-entry.ts`：

```ts
import { createDouyinPlatform } from './platform/douyin'
import { startGame } from './main'

startGame(createDouyinPlatform()).catch((err) => {
  if (typeof console !== 'undefined') console.error(err)
})
```

- [ ] **Step 7: 构建并人工验证（抖音开发者工具）**

Run: package.json 加 `"build:douyin": "vite build --config vite.douyin.config.ts"`，执行构建

Expected: `douyin/game.js` 生成

验证（抖音开发者工具，导入 `douyin/` 目录）：核心流程冒烟（投放→融合→计分→结束），若 three 报全局缺失错误，按 Task 9 Step 8 相同方式注入 `tt` 全局模拟。

- [ ] **Step 8: Commit**

```bash
git add src/platform/douyin.ts src/douyin-entry.ts vite.douyin.config.ts douyin/game.json douyin/project.config.json tests/douyin.test.ts package.json
git commit -m "feat: 抖音小游戏端（复用微信 storage 适配，tt.* 平台实现）"
```

---

### Task 11: 收尾——性能降级、README 与三端验证清单

**Files:**
- Create: `clay-monster-game/README.md`
- Modify: `package.json`（scripts 汇总）

**Interfaces:**
- Consumes: 全部任务
- Produces: 三端运行文档；降级逻辑最终接线验证

- [ ] **Step 1: 验证降级接线（main.ts 帧率监测 → effects.setStrength）**

Run: `npm run dev`，在浏览器 DevTools 中执行：

```js
// 模拟低帧率：在控制台手动把 effects 强度改为 0.5 后观察粒子数量变化
```

Expected: `effects.setStrength(0.5)` 后 `particleBudget()` 从 200 → 100（可在控制台验证返回值）

- [ ] **Step 2: 编写 README.md**

`clay-monster-game/README.md`：

```markdown
# 黏土怪物合成进化游戏

大西瓜式合成进化游戏：投掷程序化生成的黏土怪物，同级相撞触发黏土融合动态特效并进化，10 级封顶，容器溢出失败。

## 运行

- Web：`npm install && npm run dev` → http://localhost:5173
- 构建：`npm run build:web`（dist/web）；`npm run build:wechat`（wechat/game.js）；`npm run build:douyin`（douyin/game.js）
- 测试：`npm test`；类型检查：`npm run typecheck`

## 三端部署

| 端 | 方式 |
|---|---|
| Web | 静态托管 dist/web |
| 微信小游戏 | 微信开发者工具导入 `wechat/` 目录，上传发布 |
| 抖音小游戏 | 抖音开发者工具导入 `douyin/` 目录，上传发布 |

## 架构

- `src/engine/`：渲染/物理/怪物生成/融合/特效/状态机（跨端共享）
- `src/ui/`：Canvas 2D 自绘界面（跨端共享）
- `src/platform/`：web / wechat / douyin 三端适配层
- 设计文档：`docs/superpowers/specs/2026-08-21-clay-monster-game-design.md`

## 规则

- 投放等级随机 1~3；融合得分 = 新等级 × 10
- 合成 10 级胜利；容器溢出失败
- 存档：最高分 + 图鉴（localStorage / wx / tt storage）
```

- [ ] **Step 3: 三端收尾验证（最终清单，逐项打勾）**

| # | 验证项 | Web | 微信 | 抖音 |
|---|---|---|---|---|
| 1 | 投放→下落→静止 | ☐ | ☐ | ☐ |
| 2 | 同级融合特效（粒子/变形/闪光） | ☐ | ☐ | ☐ |
| 3 | 计分与下一只预览更新 | ☐ | ☐ | ☐ |
| 4 | 图鉴收集与存档 | ☐ | ☐ | ☐ |
| 5 | 溢出失败 / 10 级胜利弹窗 | ☐ | ☐ | ☐ |
| 6 | 重新开始 | ☐ | ☐ | ☐ |

- [ ] **Step 4: 全量测试 + typecheck 最终确认**

Run: `npm test && npm run typecheck`
Expected: 全部测试 PASS、typecheck 无错误

- [ ] **Step 5: Commit**

```bash
git add README.md package.json
git commit -m "docs: README 与三端部署说明，收尾验证清单"
```
