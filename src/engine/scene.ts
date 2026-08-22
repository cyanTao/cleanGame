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
  three(): THREE.Scene
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
    world: () => world,
    three: () => scene
  }
}