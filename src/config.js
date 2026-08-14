/* 游戏数据配置：植物 / 僵尸 / 关卡（数据驱动，便于后续扩展黑夜、泳池场景） */
(function (root) {
  'use strict';
  const PVZ = root.PVZ = root.PVZ || {};

  /* ================= 植物 ================= */
  const PLANTS = {
    sunflower: {
      name: '向日葵', cost: 50, hp: 300, cooldown: 6,
      desc: '定期产出25阳光',
      sunInterval: 14,    // 秒
      sunValue: 25,
      sprite: 'sunflower', sway: true
    },
    peashooter: {
      name: '豌豆射手', cost: 100, hp: 300, cooldown: 6,
      desc: '发射豌豆攻击',
      fireInterval: 1.4, damage: 20, range: 'row',
      bullet: 'pea',
      sprite: 'peashooter', sway: true
    },
    wallnut: {
      name: '坚果墙', cost: 50, hp: 4000, cooldown: 18,
      desc: '高血量肉盾',
      sprite: 'wallnut', sway: false
    },
    snowpea: {
      name: '寒冰射手', cost: 175, hp: 300, cooldown: 6,
      desc: '冰豌豆减速僵尸',
      fireInterval: 1.4, damage: 20,
      bullet: 'ice', slowDuration: 4, slowFactor: 0.5,
      sprite: 'snowpea', sway: true
    },
    repeater: {
      name: '双发射手', cost: 200, hp: 300, cooldown: 6,
      desc: '一次发射两颗豌豆',
      fireInterval: 1.4, damage: 20, double: true,
      bullet: 'pea',
      sprite: 'repeater', sway: true
    },
    cherrybomb: {
      name: '樱桃炸弹', cost: 150, hp: 9999, cooldown: 25,
      desc: '爆炸消灭3×3范围僵尸',
      bombDelay: 1.1, bombDamage: 1800, bombRadius: 1.6, // 半径（格）
      sprite: 'cherrybomb', sway: false
    }
  };

  /* ================= 僵尸 ================= */
  const ZOMBIES = {
    normal: {
      name: '普通僵尸', hp: 200, speed: 13, dps: 100,
      sprite: 'z_normal'
    },
    conehead: {
      name: '路障僵尸', hp: 560, speed: 13, dps: 100,
      sprite: 'z_conehead'
    },
    buckethead: {
      name: '铁桶僵尸', hp: 1370, speed: 11, dps: 100,
      sprite: 'z_buckethead'
    },
    polevault: {
      name: '撑杆僵尸', hp: 500, speed: 24, dps: 100,
      canJump: true, afterJumpSpeed: 13,
      sprite: 'z_polevault'
    },
    runner: {
      name: '疾跑僵尸', hp: 270, speed: 22, dps: 100,
      sprite: 'z_runner'
    }
  };

  /* ================= 关卡（白天草坪 · 第一期10关） ================= */
  // pool: [type, weight]；avail: 可用植物；最终波数量 = waveCount 数量 × finalMul
  const LEVELS = [
    { // 1：教学关
      name: '1-1 初来乍到', waves: 3, sunStart: 150, sunRate: 7,
      hpMul: 1.0, spdMul: 1.0, gapMul: 1.4,
      pool: { normal: 10 },
      avail: ['sunflower', 'peashooter']
    },
    { // 2：解锁坚果
      name: '1-2 筑起防线', waves: 4, sunStart: 100, sunRate: 8,
      hpMul: 1.0, spdMul: 1.0, gapMul: 1.3,
      pool: { normal: 10 },
      avail: ['sunflower', 'peashooter', 'wallnut']
    },
    { // 3：路障登场
      name: '1-3 路障来袭', waves: 4, sunStart: 100, sunRate: 8,
      hpMul: 1.0, spdMul: 1.0, gapMul: 1.25,
      pool: { normal: 8, conehead: 3 },
      avail: ['sunflower', 'peashooter', 'wallnut']
    },
    { // 4：解锁樱桃
      name: '1-4 危机时刻', waves: 5, sunStart: 100, sunRate: 8,
      hpMul: 1.05, spdMul: 1.0, gapMul: 1.2,
      pool: { normal: 7, conehead: 4 },
      avail: ['sunflower', 'peashooter', 'wallnut', 'cherrybomb']
    },
    { // 5：疾跑登场
      name: '1-5 疾走如飞', waves: 5, sunStart: 100, sunRate: 9,
      hpMul: 1.05, spdMul: 1.05, gapMul: 1.15,
      pool: { normal: 6, conehead: 4, runner: 3 },
      avail: ['sunflower', 'peashooter', 'wallnut', 'cherrybomb']
    },
    { // 6：解锁寒冰
      name: '1-6 冰冻之力', waves: 6, sunStart: 125, sunRate: 9,
      hpMul: 1.1, spdMul: 1.05, gapMul: 1.1,
      pool: { normal: 6, conehead: 4, runner: 3 },
      avail: ['sunflower', 'peashooter', 'wallnut', 'cherrybomb', 'snowpea']
    },
    { // 7：撑杆登场
      name: '1-7 飞跃防线', waves: 6, sunStart: 125, sunRate: 9,
      hpMul: 1.1, spdMul: 1.05, gapMul: 1.1,
      pool: { normal: 5, conehead: 4, runner: 3, polevault: 2 },
      avail: ['sunflower', 'peashooter', 'wallnut', 'cherrybomb', 'snowpea']
    },
    { // 8：铁桶登场
      name: '1-8 重装上阵', waves: 7, sunStart: 150, sunRate: 9,
      hpMul: 1.15, spdMul: 1.08, gapMul: 1.05,
      pool: { normal: 5, conehead: 4, runner: 3, polevault: 2, buckethead: 2 },
      avail: ['sunflower', 'peashooter', 'wallnut', 'cherrybomb', 'snowpea']
    },
    { // 9：解锁双发
      name: '1-9 双管齐下', waves: 7, sunStart: 150, sunRate: 10,
      hpMul: 1.2, spdMul: 1.08, gapMul: 1.0,
      pool: { normal: 4, conehead: 4, runner: 4, polevault: 3, buckethead: 3 },
      avail: ['sunflower', 'peashooter', 'wallnut', 'cherrybomb', 'snowpea', 'repeater']
    },
    { // 10：Boss 关
      name: '1-10 尸潮如海', waves: 8, sunStart: 150, sunRate: 10,
      hpMul: 1.25, spdMul: 1.1, gapMul: 0.95,
      pool: { normal: 4, conehead: 4, runner: 4, polevault: 3, buckethead: 4 },
      avail: ['sunflower', 'peashooter', 'wallnut', 'cherrybomb', 'snowpea', 'repeater']
    }
  ];

  /* ================= 棋盘布局 ================= */
  const BOARD = {
    rows: 5, cols: 9,
    x: 55, y: 100,           // 棋盘左上角（逻辑坐标）
    cellW: 100, cellH: 86,   // 格子尺寸
    get width() { return this.cols * this.cellW; },
    get height() { return this.rows * this.cellH; }
  };

  PVZ.PLANTS = PLANTS;
  PVZ.ZOMBIES = ZOMBIES;
  PVZ.LEVELS = LEVELS;
  PVZ.BOARD = BOARD;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
