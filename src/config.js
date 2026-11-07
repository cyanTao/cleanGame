// ===== 全局配置：视口 / 玩家 / 敌机 / 难度 =====

export const VIEW = { width: 540, height: 960 };

export const SCENE = {
  BOOT: 'Boot',
  TITLE: 'Title',
  BATTLE: 'Battle',
  GAMEOVER: 'GameOver'
};

export const STORAGE_KEYS = {
  best: 'skyStrike.best',
  mute: 'skyStrike.mute'
};

export const PLAYER = {
  speed: 430,          // 键盘移动速度 px/s
  pointerSpeed: 720,   // 指针跟随速度 px/s
  fireInterval: 132,   // 基础射击间隔 ms（随武器等级缩短）
  bulletSpeed: 980,
  startLives: 3,
  maxLives: 5,
  startBombs: 2,
  maxBombs: 5,
  invulnMs: 2000,      // 复活无敌
  hitRadius: 10,       // 判定圈（比机身小，手感友好）
  respawnDelay: 900,
  startWeapon: 1,
  maxWeapon: 5,
  shieldMs: 6000
};

export const ENEMY = {
  scout:   { texture: 'enemy_scout',   hp: 1,  speed: 200, score: 100, fire: 0,    radius: 15, drop: 0.06 },
  striker: { texture: 'enemy_striker', hp: 4,  speed: 130, score: 250, fire: 1600, radius: 18, drop: 0.22 },
  tank:    { texture: 'enemy_tank',    hp: 12, speed: 72,  score: 500, fire: 2100, radius: 25, drop: 0.55 },
  boss:    { texture: 'boss',          hp: 320, speed: 80, score: 6000, fire: 900, radius: 72, drop: 1 }
};

export const DIFFICULTY = {
  spawnBase: 1150,       // 初始刷怪间隔 ms
  spawnMin: 300,         // 最短刷怪间隔
  spawnRampPerSec: 20,   // 每秒缩短的间隔
  speedRampPerSec: 0.006,
  speedCap: 1.8,
  waveSeconds: 20,
  bossEvery: 60,         // 每 60 秒出现 Boss
  bossHpBase: 320,
  bossHpStep: 180,
  maxEnemies: 34
};

export const POWERUP = {
  dropChanceBonus: 0,
  bombDamage: 999,       // 清屏炸弹对普通敌机
  bombBossDamage: 120,
  shieldMs: PLAYER.shieldMs
};

// 像素霓虹调色（用于程序化绘制与 UI）
export const COLORS = {
  bgTop: '#04050d',
  bgBottom: '#0b1230',
  cyan: 0x63f2ff,
  blue: 0x3d7bff,
  ice: 0xd9fbff,
  red: 0xff5a5a,
  orange: 0xffb03a,
  green: 0x9dff6b,
  purple: 0xc084ff,
  gold: 0xffd75e,
  ink: 0x070a16,
  hud: '#dfe9ff',
  dim: '#7f8db4'
};

export const FONT = "'Courier New', 'Microsoft YaHei', 'PingFang SC', monospace";
