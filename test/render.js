/* 真实渲染验证：node-canvas 完整执行 素材加载→蓝幕抠像→场景渲染→输出 PNG */
'use strict';
const { createCanvas, Image: CanvasImage } = require('/tmp/rendercheck/node_modules/canvas');
const fs = require('fs');
const path = require('path');

let fakeTime = 0;
let rafCb = null;
const realCreateCanvas = createCanvas;

const storage = {};
global.performance = { now: () => fakeTime };
global.window = {
  innerWidth: 960, innerHeight: 540, devicePixelRatio: 1,
  addEventListener: () => {},
  requestAnimationFrame: (cb) => { rafCb = cb; return 1; }
};
const mainCanvas = createCanvas(960, 540);
mainCanvas.addEventListener = () => {};
mainCanvas.getBoundingClientRect = () => ({ left: 0, top: 0 });
global.document = {
  getElementById: () => mainCanvas,
  createElement: (tag) => (tag === 'canvas' ? createCanvas(1, 1) : {})
};
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); }
};
global.Image = class extends CanvasImage {};

process.chdir('/workspace');
['platform', 'core', 'sprites', 'config', 'entities', 'gamescene', 'ui'].forEach(m => require(path.join(__dirname, '..', 'src', m + '.js')));
const PVZ = global.PVZ;
const C = PVZ.core;

function frames(n, dtMs = 33) {
  for (let i = 0; i < n; i++) { fakeTime += dtMs; const cb = rafCb; rafCb = null; if (cb) cb(); }
}

function shot(name) {
  fs.writeFileSync(path.join(__dirname, 'shots', name), mainCanvas.toBuffer('image/png'));
  console.log('已输出', name);
}

async function main() {
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  C.Engine.start(); C.Input.init(); C.Save.load();
  const loadScene = { progress: 0, update() {}, onDown() {}, render() {} };
  C.setScene(loadScene);
  frames(3);
  await PVZ.sprites.loadAll((p) => { loadScene.progress = p; });
  frames(3);

  // 抠像结果检查：透明率
  let allOk = true;
  for (const item of PVZ.sprites.MANIFEST) {
    if (!item.chroma) continue;
    const s = PVZ.sprites.get(item.name);
    if (!s.ready) { console.log('MISSING', item.name); allOk = false; continue; }
    const ctx = s.canvas.getContext('2d');
    const d = ctx.getImageData(0, 0, s.canvas.width, s.canvas.height).data;
    let opaque = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) opaque++;
    const ratio = opaque / (s.canvas.width * s.canvas.height);
    console.log(`${item.name.padEnd(14)} 裁剪后 ${s.canvas.width}x${s.canvas.height} 不透明率 ${(ratio * 100).toFixed(1)}%`);
    if (ratio < 0.25 || ratio > 0.95) { console.log('  !! 主体占比异常'); allOk = false; }
  }
  console.log(allOk ? '抠像检查通过' : '抠像存在问题');

  // 主菜单
  C.setScene(new PVZ.MenuScene());
  frames(30);
  shot('menu.png');

  // 游戏：种植+僵尸+阳光
  C.setScene(new PVZ.GameScene(8));
  const g = C.getScene();
  g.readyT = 0.05;
  frames(20);
  g.sun = 9000;
  const B = PVZ.BOARD;
  for (let r = 0; r < B.rows; r++) {
    g.plants.push(new PVZ.Plant(r % 2 === 0 ? 'peashooter' : 'snowpea', r, 0));
    g.plants.push(new PVZ.Plant('sunflower', r, 1));
    g.plants.push(new PVZ.Plant('wallnut', r, 3));
  }
  g.plants.push(new PVZ.Plant('cherrybomb', 2, 6));
  g.zombies.push(new PVZ.Zombie('normal', 0, 1, 1));
  g.zombies.push(new PVZ.Zombie('conehead', 1, 1, 1));
  g.zombies.push(new PVZ.Zombie('buckethead', 2, 1, 1));
  g.zombies.push(new PVZ.Zombie('polevault', 3, 1, 1));
  g.zombies.push(new PVZ.Zombie('runner', 4, 1, 1));
  g.spawnSun(600, 260, true);
  g.suns[g.suns.length - 1].y = 300; g.suns[g.suns.length - 1].targetY = 310;
  g.bullets.push(new PVZ.Bullet(0, 400, 180, 'pea', 20, 0));
  g.selected = 0;
  frames(40);
  shot('game.png');

  // 暂停弹窗
  g.popup = 'pause'; g.popupT = 1;
  frames(2);
  shot('pause.png');

  // 胜利弹窗
  g.popup = 'win'; g.popupT = 1; g.coinsEarned = 84;
  frames(2);
  shot('win.png');

  // 选关
  C.Save.data.unlocked = 10;
  C.setScene(new PVZ.LevelScene());
  frames(10);
  shot('levels.png');

  console.log('真实渲染验证完成');
}

main().then(() => process.exit(0)).catch((e) => { console.error('失败:', e); process.exit(1); });
