// ===== 纯游戏逻辑：武器弹道 / 难度曲线 / 掉落 / 存档 =====
import { PLAYER, DIFFICULTY, ENEMY, STORAGE_KEYS } from '../config.js';

/** 武器等级钳制到 1..5 */
export function clampWeapon(level) {
  return Math.max(1, Math.min(PLAYER.maxWeapon, Math.floor(level) || 1));
}

/**
 * 武器弹道：dx 为相对机身的水平偏移，angle 为相对正上方的角度（度）
 * 等级越高弹道越多、覆盖越宽
 */
export function weaponSpread(level) {
  const sets = {
    1: [{ dx: 0, angle: 0 }],
    2: [{ dx: -8, angle: 0 }, { dx: 8, angle: 0 }],
    3: [{ dx: 0, angle: 0 }, { dx: -13, angle: -7 }, { dx: 13, angle: 7 }],
    4: [
      { dx: -8, angle: -4 }, { dx: 8, angle: 4 },
      { dx: -18, angle: -11 }, { dx: 18, angle: 11 }
    ],
    5: [
      { dx: 0, angle: 0 },
      { dx: -10, angle: -6 }, { dx: 10, angle: 6 },
      { dx: -20, angle: -13 }, { dx: 20, angle: 13 }
    ]
  };
  return sets[clampWeapon(level)].map((v) => ({ ...v }));
}

/** 射击间隔：等级越高越快，最低 80ms */
export function fireIntervalFor(level) {
  return Math.max(80, PLAYER.fireInterval - (clampWeapon(level) - 1) * 8);
}

/** 难度曲线：随生存秒数提升刷怪速度、敌机速度与波次 */
export function difficultyAt(seconds) {
  const t = Math.max(0, Number(seconds) || 0);
  return {
    spawnInterval: Math.max(
      DIFFICULTY.spawnMin,
      DIFFICULTY.spawnBase - t * DIFFICULTY.spawnRampPerSec
    ),
    speedMul: Math.min(DIFFICULTY.speedCap, 1 + t * DIFFICULTY.speedRampPerSec),
    wave: Math.floor(t / DIFFICULTY.waveSeconds) + 1,
    bossIndex: Math.floor(t / DIFFICULTY.bossEvery)
  };
}

/** Boss 血量随登场次数成长 */
export function bossHpFor(index) {
  return DIFFICULTY.bossHpBase + Math.max(0, Math.floor(index)) * DIFFICULTY.bossHpStep;
}

/** 按波次给出敌机权重（越后期越偏向强敌） */
export function spawnWeights(wave) {
  const w = Math.max(1, Math.floor(wave));
  return [
    { type: 'scout', weight: Math.max(2, 10 - w) },
    { type: 'striker', weight: Math.min(8, 2 + w) },
    { type: 'tank', weight: Math.max(0, w - 2) }
  ];
}

/** 按权重随机抽取敌机类型 */
export function pickWeighted(entries, random = Math.random) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return entries[0] ? entries[0].type : 'scout';
  let r = random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.type;
  }
  return entries[entries.length - 1].type;
}

/** 道具类型：力量 / 护盾 / 炸弹 */
export function pickPowerup(random = Math.random) {
  const r = random();
  if (r < 0.66) return 'power';
  if (r < 0.88) return 'shield';
  return 'bomb';
}

/** 击毁得分 */
export function scoreFor(type) {
  return ENEMY[type] ? ENEMY[type].score : 0;
}

/** 六位计分板格式 */
export function formatScore(value) {
  return String(Math.max(0, Math.floor(Number(value) || 0))).padStart(6, '0');
}

/** mm:ss */
export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 读取 / 写入最高分（storage 可注入，便于测试） */
export function loadBest(storage = safeStorage()) {
  try {
    return Math.max(0, parseInt(storage.getItem(STORAGE_KEYS.best), 10) || 0);
  } catch {
    return 0;
  }
}

export function saveBest(value, storage = safeStorage()) {
  try {
    storage.setItem(STORAGE_KEYS.best, String(Math.max(0, Math.floor(value))));
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

function safeStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}
