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
  // 替换元素在 inset:0 下不拉伸（用固有尺寸），必须显式百分比尺寸才能铺满容器
  uiCanvas.style.width = '100%'
  uiCanvas.style.height = '100%'
  uiCanvas.style.pointerEvents = 'none'
  if (holder) holder.appendChild(uiCanvas)
  const ui2d = uiCanvas.getContext('2d')!
  const uiCtx: UiContext = { ctx: ui2d, width: 0, height: 0, safeArea: { top: 0, bottom: 0 } }

  // 屏幕尺寸变化（地址栏收放/旋转）时重适配：相机 + UI 层 + 按钮位置
  const bestiaryBtn = { x: 0, y: 0, w: 72, h: 48 }
  const layoutUi = () => {
    const s = platform.size()
    uiCanvas.width = s.width * s.dpr
    uiCanvas.height = s.height * s.dpr
    ui2d.setTransform(1, 0, 0, 1, 0, 0)
    ui2d.scale(s.dpr, s.dpr)
    uiCtx.width = s.width
    uiCtx.height = s.height
    uiCtx.safeArea = platform.safeArea()
    // 图鉴按钮避开底部安全区（Home 指示条）
    bestiaryBtn.x = s.width - 88
    bestiaryBtn.y = s.height - 68 - uiCtx.safeArea.bottom
  }
  layoutUi()
  platform.onResize?.(() => {
    scene.resize()
    layoutUi()
  })

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
    makeMonsterGroup: (level, fseed) => {
      const group = buildMonsterMesh(generateMonsterParams(level, fseed), fseed)
      group.userData.level = level
      return group
    },
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

  // 输入分流：图鉴按钮 / 重开按钮 / 拖拽投放（按钮用屏幕坐标命中，投放转世界坐标）
  const handleDown = (sx: number, sy: number) => {
    const snap = game.snapshot()
    if (showBestiary) { showBestiary = false; return }
    if (snap.state === 'over') {
      if (lastRestartRect && hitRect({ x: sx, y: sy }, lastRestartRect)) {
        clearAll()
        game.restart()
        lastRestartRect = null
      }
      return
    }
    if (hitRect({ x: sx, y: sy }, bestiaryBtn)) { showBestiary = true; return }
    const w = scene.screenToWorld(sx, sy)
    game.pointerDown(w.x, w.y)
  }
  platform.onInput((e) => {
    if (e.type === 'down') handleDown(e.pointer.x, e.pointer.y)
    if (e.type === 'move' && game.snapshot().state === 'dragging') {
      const w = scene.screenToWorld(e.pointer.x, e.pointer.y)
      game.pointerMove(w.x, w.y)
    }
    if (e.type === 'up' && game.snapshot().state === 'dragging') {
      const w = scene.screenToWorld(e.pointer.x, e.pointer.y)
      game.pointerUp(w.x)
    }
  })

  // 主循环：物理+渲染+特效，UI 层绘制
  const loop = () => {
    scene.render()
    fuse.update()
    game.update(scene.world())

    const snap = game.snapshot()
    if (snap.state === 'over') {
      lastRestartRect = drawOverlay(uiCtx, snap).restartRect
    } else if (showBestiary) {
      drawBestiary(uiCtx, snap.bestiary, levelColor)
    } else {
      // 拖拽预览的 dragX 是世界坐标，绘制前转屏幕坐标
      const uiSnap = snap.state === 'dragging' && snap.dragX !== null
        ? { ...snap, dragX: scene.worldToScreenX(snap.dragX) }
        : snap
      drawHud(uiCtx, uiSnap)
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