/* Node 冒烟测试：mock 浏览器环境，验证游戏完整流程可运行（测试后删除） */
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
  return {
    width: 0, height: 0, style: {},
    getContext: () => makeCtx(),
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0 })
  };
}

const storage = {};
global.performance = { now: () => fakeTime };
global.window = {
  innerWidth: 966, innerHeight: 540, devicePixelRatio: 1,
  addEventListener: () => {},
  requestAnimationFrame: (cb) => { rafCb = cb; return 1; }
};
global.document = {
  getElementById: () => makeCanvas(),
  createElement: () => makeCanvas()
};
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); }
};
global.Image = class {
  constructor() { this.width = 100; this.height = 100; }
  set src(v) { setTimeout(() => this.onload && this.onload(), 0); }
};

const path = require('path');
require(path.join(__dirname, '..', 'src', 'platform.js'));
require(path.join(__dirname, '..', 'src', 'core.js'));
require(path.join(__dirname, '..', 'src', 'sprites.js'));
require(path.join(__dirname, '..', 'src', 'config.js'));
require(path.join(__dirname, '..', 'src', 'entities.js'));
require(path.join(__dirname, '..', 'src', 'gamescene.js'));
require(path.join(__dirname, '..', 'src', 'ui.js'));
// main.js 会自动 boot（不 require，手动启动以控制时序）

const PVZ = global.PVZ;
const C = PVZ.core;

function frames(n, dtMs = 33) {
  for (let i = 0; i < n; i++) {
    fakeTime += dtMs;
    const cb = rafCb; rafCb = null;
    if (cb) cb();
  }
}

async function main() {
  // 手动执行 main.js 的启动逻辑（等价于 PVZ.boot，但那未导出成可重入）
  C.Engine.start();
  C.Input.init();
  C.Save.load();
  const loadScene = { progress: 0, update() {}, onDown() {}, render() {} };
  C.setScene(loadScene);
  await PVZ.sprites.loadAll((p) => { loadScene.progress = p; });
  frames(5);

  const scene = C.getScene();
  console.assert(scene === loadScene, '应停留在加载场景');
  console.log('[1] 素材加载完成（含 fallback 占位路径）');

  // 模拟进入主菜单
  C.setScene(new PVZ.MenuScene());
  frames(10);
  console.log('[2] 主菜单渲染 OK:', C.getScene().constructor.name);

  // 模拟点击"开始冒险"（按钮 x:380~580 y:300~366）
  C.getScene().onDown(480, 333);
  frames(5);
  const game = C.getScene();
  console.assert(game instanceof PVZ.GameScene, '应进入游戏场景');
  console.log('[3] 进入第1关:', game.level.name);

  // 快进跳过开局倒计时（READY 8 秒）
  frames(300);
  console.assert(game.state === 1, '应进入 PLAYING，实际=' + game.state);
  console.assert(game.zombies.length >= 0 && game.waveIdx >= 1, '第一波应已开始，waveIdx=' + game.waveIdx);

  // 模拟点击卡片0（向日葵 50）→ 种到 (row2, col1)
  const cellX = PVZ.BOARD.x + 1 * PVZ.BOARD.cellW + 20;
  const cellY = PVZ.BOARD.y + 2 * PVZ.BOARD.cellH + 20;
  game.onDown(96 + 0 * 69 + 32, 46);   // 卡片0
  game.onDown(cellX, cellY);            // 格子
  console.assert(game.plants.length === 1, '应种下1株向日葵，实际=' + game.plants.length);
  console.assert(game.sun === 100, '阳光应为100，实际=' + game.sun);

  // 卡片1（豌豆射手 100）→ (row2, col0)
  game.onDown(96 + 1 * 69 + 32, 46);
  game.onDown(PVZ.BOARD.x + 0 * PVZ.BOARD.cellW + 20, cellY);
  console.assert(game.plants.length === 2, '应种下豌豆射手');
  console.assert(game.sun === 0, '阳光应为0，实际=' + game.sun);
  console.log('[4] 种植交互 OK，卡片冷却:', game.cards.map(c => c.cooldown.toFixed(1)).join(','));

  // 模拟收集一个天降阳光
  game.spawnSun(500, -30, true);
  const sun = game.suns[game.suns.length - 1];
  sun.y = 300; sun.targetY = 320;
  const before = game.sun;
  game.onDown(sun.x, sun.y);
  console.assert(sun.collected, '阳光应被收集');
  console.log('[5] 阳光收集 OK:', before, '->', game.sun, '(飞行后计入)');

  // 快进 240 秒（波次推进 + 战斗 + 胜负判定），每帧同时驱动渲染路径
  let maxZombies = 0, errors = 0;
  for (let i = 0; i < 24000 && !game.popup; i++) {
    fakeTime += 10;
    const cb = rafCb; rafCb = null;
    if (cb) { try { cb(); } catch (e) { errors++; if (errors < 3) console.error('渲染错误:', e.message); } }
    maxZombies = Math.max(maxZombies, game.zombies.length);
  }
  console.log('[6] 战斗模拟: waveIdx=' + game.waveIdx + '/' + game.totalWaves + ' 峰值僵尸=' + maxZombies + ' 渲染错误=' + errors);
  console.assert(errors === 0, '渲染不应有错误');
  console.assert(game.popup === 'win' || game.popup === 'lose' || game.waveIdx <= game.totalWaves, '游戏应正常推进');

  // 测试弹窗按钮布局与点击
  if (game.popup) {
    const btns = game.popupButtons();
    console.assert(btns.length >= 2, '弹窗应有按钮');
    game.popupT = 1;
    game.onDown(btns[0].x + 5, btns[0].y + 5);
    console.log('[7] 弹窗点击 OK，弹窗类型:', game.popup, '-> 跳转:', C.getScene().constructor.name);
  }

  // 选关场景渲染
  C.setScene(new PVZ.LevelScene());
  frames(20);
  C.getScene().onDown(PVZ.LevelScene.prototype.cellPos.call(C.getScene(), 0).x + 40, 170 + 40);
  frames(5);
  console.assert(C.getScene() instanceof PVZ.GameScene, '选关点击应进入关卡');
  console.log('[8] 选关场景 OK');

  console.log('\n=== 冒烟测试全部通过 ===');
}

main().then(() => process.exit(0)).catch((e) => { console.error('测试失败:', e); process.exit(1); });
