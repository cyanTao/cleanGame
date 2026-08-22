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
  /** @internal 测试与 fuse 编排的内部契约，不对外文档化 */
  _fuseLevel?(level: number): void
  _forceOver?(): void
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