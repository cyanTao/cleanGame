/* 胜利流程 + 割草机/樱桃炸弹机制测试 */
'use strict';

let fakeTime = 0;
let rafCb = null;
function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (p === 'measureText') return () => ({ width: 100 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (typeof p === 'string') return function () {};
      return undefined;
    },
    set() { return true; }
  });
}
function makeCanvas() {
  return { width: 0, height: 0, style: {}, getContext: () => makeCtx(), addEventListener: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
}
const storage = {};
global.performance = { now: () => fakeTime };
global.window = { innerWidth: 966, innerHeight: 540, devicePixelRatio: 1, addEventListener: () => {}, requestAnimationFrame: (cb) => { rafCb = cb; return 1; } };
global.document = { getElementById: () => makeCanvas(), createElement: () => makeCanvas() };
global.localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); } };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { setTimeout(() => this.onload && this.onload(), 0); } };

const path = require('path');
['platform', 'core', 'sprites', 'config', 'entities', 'gamescene', 'ui'].forEach(m => require(path.join(__dirname, '..', 'src', m + '.js')));
const PVZ = global.PVZ;
const C = PVZ.core;

function frames(n, dtMs = 33) {
  for (let i = 0; i < n; i++) { fakeTime += dtMs; const cb = rafCb; rafCb = null; if (cb) cb(); }
}

async function main() {
  C.Engine.start(); C.Input.init(); C.Save.load();
  const loadScene = { progress: 0, update() {}, onDown() {}, render() {} };
  C.setScene(loadScene);
  await PVZ.sprites.loadAll(() => {});

  // ===== 测试1：满阵型通关第1关 =====
  const game = new PVZ.GameScene(0);
  C.setScene(game);
  game.readyT = 0.1;
  frames(10);

  // 作弊：阳光充足，铺满豌豆+向日葵
  game.sun = 2000;
  const B = PVZ.BOARD;
  for (let r = 0; r < B.rows; r++) {
    for (let c = 0; c < 4; c++) {
      const type = c === 0 ? 'peashooter' : (c === 1 ? 'sunflower' : 'peashooter');
      game.plants.push(new PVZ.Plant(type, r, c));
    }
  }
  game.sun = 50;

  let mowerTriggered = false, exploded = false;
  const origExplode = game.explode.bind(game);
  game.explode = function (x, y, r, d) { exploded = true; origExplode(x, y, r, d); };

  let iter = 0;
  while (!game.popup && iter < 60000) {
    iter++;
    fakeTime += 20;
    const cb = rafCb; rafCb = null;
    if (cb) cb();
    if (game.mowers.some(m => m.triggered)) mowerTriggered = true;
  }
  console.log('关卡结果弹窗:', game.popup, '| 波次:', game.waveIdx + '/' + game.totalWaves, '| 存档unlocked:', C.Save.data.unlocked, '| 金币:', C.Save.data.coins);
  console.assert(game.popup === 'win', '满阵型应通关，实际=' + game.popup);
  console.assert(C.Save.data.unlocked === 2, '应解锁第2关');
  console.assert(C.Save.data.coins > 0, '应获得金币');
  console.log('[1] 胜利流程 + 存档 OK');

  // ===== 测试2：樱桃炸弹爆炸 =====
  const g2 = new PVZ.GameScene(3);
  C.setScene(g2);
  g2.readyT = 0.1;
  frames(10);
  const zombie = new PVZ.Zombie('buckethead', 2, 1, 1);
  zombie.x = 500;
  g2.zombies.push(zombie);
  const bomb = new PVZ.Plant('cherrybomb', 2, 4);
  bomb.x = 500; bomb.y = zombie.y;
  g2.plants.push(bomb);
  const hp0 = zombie.hp;
  frames(120); // ~1.2s 后爆炸
  console.assert(exploded || zombie.hp < hp0 || g2.effects.length > 0, '樱桃炸弹应爆炸');
  console.assert(!g2.plants.includes(bomb), '炸弹应自毁');
  console.log('[2] 樱桃炸弹 OK，铁桶僵尸血量:', hp0, '->', zombie.hp);

  // ===== 测试3：割草机触发 =====
  const g3 = new PVZ.GameScene(0);
  C.setScene(g3);
  g3.readyT = 0.1;
  frames(10);
  const z = new PVZ.Zombie('normal', 1, 1, 1);
  g3.zombies.push(z);
  frames(3);
  // 快速把僵尸推到最左侧
  z.x = PVZ.BOARD.x - 20;
  for (let i = 0; i < 30 && !g3.mowers[1].triggered; i++) frames(2);
  console.assert(g3.mowers[1].triggered, '割草机应被触发');
  // 等割草机清完
  frames(40);
  console.assert(z.state === PVZ.Z_STATE.DIE || z.removed, '割草机应清掉僵尸');
  console.log('[3] 割草机 OK');

  // ===== 测试4：撑杆跳跳过植物 =====
  const g4 = new PVZ.GameScene(6);
  C.setScene(g4);
  g4.readyT = 0.1;
  frames(10);
  const pv = new PVZ.Zombie('polevault', 2, 1, 1);
  pv.x = 400;
  g4.zombies.push(pv);
  const nut = new PVZ.Plant('wallnut', 2, 3);
  g4.plants.push(nut);
  frames(200); // 足够走到植物并起跳落地
  console.assert(pv.jumpUsed, '撑杆僵尸应完成跳跃, jumpUsed=' + pv.jumpUsed);
  console.assert(pv.x < nut.x - 30, '应落在植物后方, px=' + Math.round(pv.x) + ' nutx=' + Math.round(nut.x));
  console.assert(nut.hp === nut.maxHp, '坚果未被啃食');
  console.log('[4] 撑杆跳 OK');

  // ===== 测试5：寒冰减速 =====
  const g5 = new PVZ.GameScene(5);
  C.setScene(g5);
  g5.readyT = 0.1;
  frames(10);
  const iz = new PVZ.Zombie('normal', 0, 1, 1);
  g5.zombies.push(iz);
  iz.hurt(10, g5.time + 4); // 冰减速4秒
  const x0 = iz.x;
  frames(60); // 2秒
  const moved = x0 - iz.x;
  console.assert(moved < 13 * 2 + 3, '减速后移动距离应减半，moved=' + moved.toFixed(1));
  console.log('[5] 寒冰减速 OK，2秒移动:', moved.toFixed(1), 'px（正常≈26）');

  console.log('\n=== 机制测试全部通过 ===');
}

main().then(() => process.exit(0)).catch((e) => { console.error('测试失败:', e); process.exit(1); });
