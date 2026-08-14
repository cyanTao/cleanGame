// ===== 全局配置：战斗数值 / 键位 / 调色板 =====

export const VIEW = { width: 960, height: 540, groundY: 480 };

export const PHYSICS = { gravity: 1400, jumpVelocity: 620 };

export const MECHAS = {
  blu: {
    name: 'BLU-07「蓝影」',
    paletteKey: 'blu',
    stats: { hp: 100, speed: 200, damage: 8, specialDamage: 25 }
  },
  red: {
    name: 'RED-99「赤焰」',
    paletteKey: 'red',
    stats: { hp: 100, speed: 170, damage: 10, specialDamage: 25 }
  }
};

export const COMBAT = {
  energyMax: 100,
  energyOnHit: 15,      // 攻击命中获得能量
  energyOnHurt: 8,      // 被击中获得能量
  attackWindup: 120,    // 轻攻击前摇 ms
  attackActive: 100,    // 命中判定窗 ms
  attackRecover: 200,   // 后摇 ms
  specialWindup: 220,
  specialActive: 150,
  specialRecover: 300,
  blockReduce: 0.75,          // 防御减伤（普通攻击）
  specialBlockReduce: 0.5,    // 防御中受必杀减伤
  defendSpeedFactor: 0.3,     // 防御移速系数
  hitstun: 220,         // 受击硬直 ms
  knockback: 260,       // 击退速度
  specialKnockback: 420,
  roundTime: 60,        // 回合倒计时（秒）
  hitboxOffset: 40,     // 攻击判定框中心与自身距离
  hitboxSize: { w: 46, h: 60 },
  specialHitboxSize: { w: 70, h: 70 }
};

export const KEYS = {
  p1: { left: 'A', right: 'D', jump: 'W', attack: 'J', defend: 'K', special: 'L' },
  p2: { left: 'LEFT', right: 'RIGHT', jump: 'UP', attack: 'NUMPAD_ONE', defend: 'NUMPAD_TWO', special: 'NUMPAD_THREE' }
};

// 16-bit 调色板：字符 → 颜色
// O 轮廓 | D 深甲 | M 中甲 | L 亮甲 | E 眼/天线 | V 能量核 | J 关节 | S 盾
export const PALETTES = {
  blu: {
    O: '#10141f', D: '#2b3f66', M: '#4763a8', L: '#8fb0f0',
    E: '#4df0ff', V: '#ffd75e', J: '#1d2436', S: '#aebcd4'
  },
  red: {
    O: '#1c0f12', D: '#6e2734', M: '#a4434f', L: '#e08a74',
    E: '#ffb03a', V: '#7cf5d8', J: '#2a1519', S: '#cfd6de'
  }
};

// AI 性格
export const AI = {
  tick: 200,            // 决策间隔 ms
  attackRange: 95,      // 进入攻击意图的距离
  defendRange: 130,     // 触发防御反应的距离
  aggression: 0.55,     // 攻击欲
  jumpChance: 0.10,
  retreatChance: 0.12
};

export const SCENE = { BOOT: 'Boot', TITLE: 'Title', BATTLE: 'Battle', GAMEOVER: 'GameOver' };
