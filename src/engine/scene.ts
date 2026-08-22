import * as THREE from 'three'
import type { Platform } from '../platform/types'
import { createPhysicsWorld, type PhysicsWorld } from './physics'

export const CONTAINER_ASPECT = 3 / 4
/** 容器设计宽度（世界单位）：与怪物半径曲线（0.32~1.31）匹配，保证各级怪物屏幕占比合理 */
export const CONTAINER_WIDTH = 6
/** 竖屏时容器宽高比下限（更细长会影响玩法与手感） */
const MIN_ASPECT = 0.52
/** 容器占屏高度比例（其余留给 HUD 与地面留白） */
const FILL_H = 0.77
/** 容器占屏宽度比例上限 */
const FILL_W = 0.92
/** 容器顶部距屏幕顶部比例（HUD 预留区） */
const TOP_GAP = 0.18

export interface GameScene {
  init(): void
  resize(): void
  addMonsterMesh(g: THREE.Group, x: number, y: number): void
  removeMesh(obj: THREE.Object3D): void
  setBackground(color: string): void
  render(): void
  containerTopY(): number
  containerWidth(): number
  world(): PhysicsWorld
  three(): THREE.Scene
  /** 屏幕像素坐标 → 世界坐标 */
  screenToWorld(px: number, py: number): { x: number; y: number }
  /** 世界 x → 屏幕像素 x */
  worldToScreenX(wx: number): number
}

export function createGameScene(platform: Platform, opts: { seed: number }): GameScene {
  const canvas = platform.createCanvas()
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.shadowMap.enabled = false // 性能预算：关闭阴影

  // 容器尺寸（世界单位）：基准 3:4；竖屏时高度随屏幕拉高以占满屏幕
  const W = CONTAINER_WIDTH
  const s0 = platform.size()
  const aspect0 = s0.width / s0.height
  const H = aspect0 < CONTAINER_ASPECT
    ? Math.min(W / MIN_ASPECT, (W / aspect0) * 0.92)
    : W / CONTAINER_ASPECT

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x2b2b33)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
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

  // 视口适配状态
  let camW = W
  let camTop = H
  let camH = H
  let screenW = s0.width
  let screenH = s0.height

  /** 适配屏幕：容器按 FILL_H 屏高 / FILL_W 屏宽取小者缩放，顶部预留 TOP_GAP；视口宽高比贴合屏幕避免拉伸 */
  const fit = () => {
    const s = platform.size()
    screenW = s.width
    screenH = s.height
    renderer.setPixelRatio(Math.min(s.dpr, 2))
    renderer.setSize(s.width, s.height, false)
    const scale = Math.min((FILL_H * s.height) / H, (FILL_W * s.width) / W)
    camW = s.width / scale
    camH = s.height / scale
    camTop = H + TOP_GAP * camH
    camera.left = -camW / 2
    camera.right = camW / 2
    camera.top = camTop
    camera.bottom = camTop - camH
    camera.updateProjectionMatrix()
  }

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
      fit()
    },
    resize() {
      fit()
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
    world: () => world,
    three: () => scene,
    screenToWorld(px, py) {
      return {
        x: -camW / 2 + (px / screenW) * camW,
        y: camTop - (py / screenH) * camH
      }
    },
    worldToScreenX(wx) {
      return ((wx + camW / 2) / camW) * screenW
    }
  }
}
