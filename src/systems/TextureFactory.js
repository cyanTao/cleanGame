// ===== 程序化美术：全部纹理在启动时用 Canvas 生成，无外部资源 =====
import { VIEW } from '../config.js';

/** 创建一张 Canvas 纹理 */
function addCanvas(scene, key, w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

/** 多边形路径 */
function poly(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function linGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([offset, color]) => g.addColorStop(offset, color));
  return g;
}

// ---------- 背景 ----------

function drawBackground(ctx) {
  const { width: w, height: h } = VIEW;
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, h, [
    [0, '#04050d'],
    [0.32, '#070b1e'],
    [0.66, '#0b1230'],
    [0.86, '#101237'],
    [1, '#05060f']
  ]);
  ctx.fillRect(0, 0, w, h);

  // 星云光斑
  const nebulas = [
    { x: 110, y: 220, r: 200, c: 'rgba(88, 70, 255, 0.16)' },
    { x: 460, y: 430, r: 230, c: 'rgba(24, 190, 255, 0.10)' },
    { x: 250, y: 780, r: 260, c: 'rgba(220, 70, 200, 0.10)' },
    { x: 60, y: 640, r: 150, c: 'rgba(70, 255, 210, 0.07)' }
  ];
  for (const n of nebulas) {
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    g.addColorStop(0, n.c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // 远处行星
  const px = 430;
  const py = 210;
  const pr = 58;
  const pg = ctx.createRadialGradient(px - 18, py - 22, 4, px, py, pr);
  pg.addColorStop(0, 'rgba(150, 185, 255, 0.22)');
  pg.addColorStop(0.55, 'rgba(70, 90, 180, 0.13)');
  pg.addColorStop(1, 'rgba(10, 14, 40, 0)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 160, 255, 0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(px, py, pr * 1.55, pr * 0.34, -0.32, 0, Math.PI * 2);
  ctx.stroke();
}

function drawStars(ctx, w, h, count, big) {
  let seed = big ? 9137 : 4211;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = 0.25 + rand() * 0.7;
    const r = big ? 0.9 + rand() * 1.4 : 0.5 + rand() * 0.7;
    ctx.fillStyle = rand() > 0.82
      ? `rgba(140, 235, 255, ${a})`
      : `rgba(220, 232, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (big && rand() > 0.9) {
      ctx.strokeStyle = `rgba(190, 240, 255, ${a * 0.8})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x, y + 4);
      ctx.stroke();
    }
  }
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.72, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ---------- 玩家战机 ----------

function drawPlayer(ctx) {
  const hull = [
    [32, 4], [38, 26], [52, 40], [47, 52], [37, 47], [36, 62], [45, 72], [38, 76],
    [26, 76], [19, 72], [28, 62], [27, 47], [17, 52], [12, 40], [26, 26]
  ];
  ctx.save();
  ctx.shadowColor = 'rgba(99, 242, 255, 0.9)';
  ctx.shadowBlur = 16;
  poly(ctx, hull);
  ctx.fillStyle = linGrad(ctx, 0, 4, 0, 76, [
    [0, '#b9fbff'],
    [0.22, '#5fd8ff'],
    [0.55, '#2f6bff'],
    [1, '#16245e']
  ]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#a5f6ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 内层装甲
  poly(ctx, [
    [32, 12], [36, 32], [41, 42], [36, 45], [34, 58],
    [30, 58], [28, 45], [23, 42], [28, 32]
  ]);
  ctx.fillStyle = linGrad(ctx, 0, 12, 0, 58, [
    [0, '#f2ffff'],
    [0.5, '#9fe4ff'],
    [1, '#4b7dff']
  ]);
  ctx.fill();

  // 座舱
  const cg = ctx.createRadialGradient(32, 27, 1, 32, 31, 11);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.45, '#8ff6ff');
  cg.addColorStop(1, 'rgba(30, 150, 255, 0.25)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(32, 31, 4.6, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // 机翼灯与描边
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.arc(18, 44, 2, 0, Math.PI * 2);
  ctx.arc(46, 44, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(220, 252, 255, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(26, 36);
  ctx.lineTo(16, 46);
  ctx.moveTo(38, 36);
  ctx.lineTo(48, 46);
  ctx.stroke();

  // 尾部引擎
  ctx.fillStyle = '#0b1430';
  ctx.fillRect(25, 60, 6, 14);
  ctx.fillRect(33, 60, 6, 14);
  ctx.fillStyle = 'rgba(120, 245, 255, 0.95)';
  ctx.fillRect(27, 62, 2, 10);
  ctx.fillRect(35, 62, 2, 10);
  ctx.restore();
}

function drawFlame(ctx, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(99, 242, 255, 0.95)';
  ctx.shadowBlur = 12;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(240, 255, 255, 1)');
  g.addColorStop(0.28, 'rgba(120, 245, 255, 0.9)');
  g.addColorStop(0.62, 'rgba(60, 130, 255, 0.45)');
  g.addColorStop(1, 'rgba(40, 70, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.bezierCurveTo(w * 0.92, h * 0.28, w * 0.72, h * 0.7, w / 2, h);
  ctx.bezierCurveTo(w * 0.28, h * 0.7, w * 0.08, h * 0.28, w / 2, 0);
  ctx.fill();
  ctx.restore();
}

function drawShield(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(99, 220, 255, 0.9)';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = 'rgba(150, 245, 255, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80, 140, 255, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 15, 0, Math.PI * 2);
  ctx.stroke();
  const g = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w / 2);
  g.addColorStop(0, 'rgba(80, 200, 255, 0)');
  g.addColorStop(0.78, 'rgba(80, 200, 255, 0.05)');
  g.addColorStop(1, 'rgba(140, 240, 255, 0.22)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- 敌机 ----------

function drawEnemyShip(ctx, w, h, colors, hull, inner, cockpitY, engineY) {
  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 12;
  poly(ctx, hull);
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, h, [
    [0, colors.light],
    [0.4, colors.mid],
    [1, colors.dark]
  ]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  poly(ctx, inner);
  ctx.fillStyle = linGrad(ctx, 0, h * 0.25, 0, h * 0.85, [
    [0, colors.innerLight],
    [1, 'rgba(10, 14, 26, 0.65)']
  ]);
  ctx.fill();

  // 座舱
  const cg = ctx.createRadialGradient(w / 2, cockpitY, 1, w / 2, cockpitY, 6);
  cg.addColorStop(0, '#fff6d8');
  cg.addColorStop(0.5, colors.cockpit);
  cg.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(w / 2, cockpitY, 3.4, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 引擎光
  const eg = ctx.createRadialGradient(w / 2, engineY, 0, w / 2, engineY, 9);
  eg.addColorStop(0, 'rgba(255, 245, 210, 0.95)');
  eg.addColorStop(0.45, colors.cockpit);
  eg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = eg;
  ctx.fillRect(w / 2 - 10, engineY - 8, 20, 18);
  ctx.restore();
}

function drawScout(ctx, w, h) {
  drawEnemyShip(ctx, w, h, {
    glow: 'rgba(150, 255, 90, 0.8)', light: '#d8ff9c', mid: '#57b93a',
    dark: '#123d1c', line: '#b6ff7a', innerLight: 'rgba(200, 255, 160, 0.9)',
    cockpit: '#ff8a3d'
  }, [
    [24, 48], [30, 30], [44, 26], [38, 8], [30, 12], [24, 4], [18, 12], [10, 8], [4, 26], [18, 30]
  ], [
    [24, 16], [28, 30], [24, 40], [20, 30]
  ], 24, 12);
}

function drawStriker(ctx, w, h) {
  drawEnemyShip(ctx, w, h, {
    glow: 'rgba(255, 140, 60, 0.85)', light: '#ffd9a0', mid: '#d9661f',
    dark: '#4a1408', line: '#ffbe7a', innerLight: 'rgba(255, 220, 170, 0.9)',
    cockpit: '#ff4d4d'
  }, [
    [28, 52], [36, 32], [52, 30], [48, 14], [38, 18], [32, 8], [24, 8],
    [18, 18], [8, 14], [4, 30], [20, 32]
  ], [
    [28, 18], [33, 34], [28, 44], [23, 34]
  ], 27, 14);
}

function drawTank(ctx, w, h) {
  ctx.save();
  // 侧翼炮舱
  ctx.fillStyle = '#2a1448';
  ctx.strokeStyle = '#c98bff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(6, 30, 14, 22, 4) : ctx.rect(6, 30, 14, 22);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(52, 30, 14, 22, 4) : ctx.rect(52, 30, 14, 22);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  drawEnemyShip(ctx, w, h, {
    glow: 'rgba(200, 120, 255, 0.85)', light: '#efd2ff', mid: '#8b45d6',
    dark: '#2a0f45', line: '#dcb0ff', innerLight: 'rgba(235, 210, 255, 0.9)',
    cockpit: '#ffd75e'
  }, [
    [36, 58], [45, 40], [64, 38], [60, 20], [46, 22], [42, 10],
    [30, 10], [26, 22], [12, 20], [8, 38], [27, 40]
  ], [
    [36, 18], [41, 36], [36, 50], [31, 36]
  ], 32, 16);

  // 双联炮管
  ctx.save();
  ctx.fillStyle = '#1b0c30';
  ctx.strokeStyle = 'rgba(220, 176, 255, 0.9)';
  ctx.lineWidth = 1.5;
  [[29, 46], [39, 46]].forEach(([x, y]) => {
    ctx.fillRect(x, y, 4, 16);
    ctx.strokeRect(x, y, 4, 16);
  });
  ctx.restore();
}

function drawBoss(ctx, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(255, 70, 90, 0.9)';
  ctx.shadowBlur = 22;

  // 主舰体
  poly(ctx, [
    [100, 150], [117, 112], [152, 104], [176, 88], [170, 56], [140, 50],
    [126, 26], [74, 26], [60, 50], [30, 56], [24, 88], [48, 104], [83, 112]
  ]);
  ctx.fillStyle = linGrad(ctx, 0, 26, 0, 150, [
    [0, '#5c1b33'],
    [0.35, '#a52b45'],
    [0.7, '#6e1730'],
    [1, '#2a0814']
  ]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffcc66';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 装甲板
  ctx.fillStyle = 'rgba(255, 214, 120, 0.16)';
  ctx.strokeStyle = 'rgba(255, 214, 120, 0.5)';
  ctx.lineWidth = 1;
  poly(ctx, [
    [100, 34], [124, 46], [134, 74], [100, 92], [66, 74], [76, 46]
  ]);
  ctx.fill();
  ctx.stroke();

  // 侧翼
  ctx.fillStyle = '#3b0d1f';
  ctx.strokeStyle = '#ff9c5e';
  ctx.lineWidth = 2;
  poly(ctx, [[52, 76], [26, 72], [18, 96], [46, 104], [60, 96]]);
  ctx.fill();
  ctx.stroke();
  poly(ctx, [[148, 76], [174, 72], [182, 96], [154, 104], [140, 96]]);
  ctx.fill();
  ctx.stroke();

  // 炮塔
  [[62, 86], [138, 86]].forEach(([x, y]) => {
    const tg = ctx.createRadialGradient(x, y, 2, x, y, 14);
    tg.addColorStop(0, '#ffe6a0');
    tg.addColorStop(0.5, '#ff8a3d');
    tg.addColorStop(1, '#4b0d1a');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 214, 120, 0.75)';
    ctx.stroke();
    ctx.fillStyle = '#20040c';
    ctx.fillRect(x - 3, y + 8, 6, 18);
  });

  // 核心
  const core = ctx.createRadialGradient(100, 88, 2, 100, 88, 22);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.25, '#ffd75e');
  core.addColorStop(0.6, '#ff5a5a');
  core.addColorStop(1, 'rgba(120, 0, 30, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(100, 88, 22, 0, Math.PI * 2);
  ctx.fill();

  // 金色纹路
  ctx.strokeStyle = 'rgba(255, 220, 140, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(84, 112);
  ctx.lineTo(100, 126);
  ctx.lineTo(116, 112);
  ctx.moveTo(64, 60);
  ctx.lineTo(100, 48);
  ctx.lineTo(136, 60);
  ctx.stroke();

  // 引擎
  [[78, 36], [100, 32], [122, 36]].forEach(([x, y]) => {
    const eg = ctx.createRadialGradient(x, y, 0, x, y, 10);
    eg.addColorStop(0, 'rgba(255, 240, 180, 0.95)');
    eg.addColorStop(1, 'rgba(255, 90, 60, 0)');
    ctx.fillStyle = eg;
    ctx.fillRect(x - 8, y - 8, 16, 16);
  });
  ctx.restore();
}

// ---------- 子弹 / 特效 / 道具 ----------

function drawPlayerBullet(ctx, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(99, 242, 255, 0.95)';
  ctx.shadowBlur = 12;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(240, 255, 255, 1)');
  g.addColorStop(0.35, 'rgba(140, 248, 255, 1)');
  g.addColorStop(1, 'rgba(50, 120, 255, 0.55)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(w * 0.25, 1, w * 0.5, h - 2, w * 0.25) : ctx.rect(w * 0.25, 1, w * 0.5, h - 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemyBullet(ctx, w, h, inner, mid, outer) {
  ctx.save();
  ctx.shadowColor = outer;
  ctx.shadowBlur = 12;
  const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.28, inner);
  g.addColorStop(0.62, mid);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawExplosion(ctx, w, h, progress) {
  const cx = w / 2;
  const cy = h / 2;
  const p = progress;
  ctx.save();
  ctx.globalAlpha = 1 - p * 0.85;

  const radius = 8 + p * 34;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, 'rgba(255, 255, 240, 1)');
  g.addColorStop(0.32, 'rgba(255, 224, 130, 0.95)');
  g.addColorStop(0.62, 'rgba(255, 128, 60, 0.75)');
  g.addColorStop(1, 'rgba(200, 40, 30, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 210, 120, ${0.8 - p * 0.7})`;
  ctx.lineWidth = 3 * (1 - p) + 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 10 + p * 42, 0, Math.PI * 2);
  ctx.stroke();

  // 碎片
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + p * 0.6;
    const d = 8 + p * (30 + (i % 4) * 8);
    const s = 4.6 * (1 - p) + 1.2;
    ctx.fillStyle = i % 3 === 0
      ? 'rgba(255, 255, 235, 0.95)'
      : i % 3 === 1
        ? 'rgba(255, 200, 90, 0.9)'
        : 'rgba(255, 115, 60, 0.85)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpark(ctx, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(120, 245, 255, 0.9)';
  ctx.shadowBlur = 8;
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(160, 245, 255, 0.9)');
  g.addColorStop(1, 'rgba(80, 140, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPowerup(ctx, w, h, color) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2 - 5;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(9, 14, 32, 0.92)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPowerupLetter(ctx, w, h, letter, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = 'bold 21px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillText(letter, w / 2, h / 2 + 1);
  ctx.restore();
}

function drawGlow(ctx, w, h, color) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.45, color.replace(/[\d.]+\)$/, '0.35)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawShockwave(ctx, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(160, 245, 255, 0.9)';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(220, 252, 255, 0.95)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80, 180, 255, 0.55)';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- 对外入口 ----------

export function createGameTextures(scene) {
  const { width: W, height: H } = VIEW;

  addCanvas(scene, 'bg_space', W, H, drawBackground);
  addCanvas(scene, 'stars_far', W, H, (ctx, w, h) => drawStars(ctx, w, h, 150, false));
  addCanvas(scene, 'stars_near', W, H, (ctx, w, h) => drawStars(ctx, w, h, 70, true));
  addCanvas(scene, 'vignette', W, H, drawVignette);

  addCanvas(scene, 'player', 64, 80, drawPlayer);
  addCanvas(scene, 'flame', 24, 40, drawFlame);
  addCanvas(scene, 'shield', 100, 100, drawShield);

  addCanvas(scene, 'enemy_scout', 48, 52, drawScout);
  addCanvas(scene, 'enemy_striker', 56, 56, drawStriker);
  addCanvas(scene, 'enemy_tank', 72, 64, drawTank);
  addCanvas(scene, 'boss', 200, 160, drawBoss);

  addCanvas(scene, 'bullet_player', 10, 30, drawPlayerBullet);
  addCanvas(scene, 'bullet_enemy', 16, 16, (ctx, w, h) =>
    drawEnemyBullet(ctx, w, h, '#ffd75e', '#ff8a3d', 'rgba(255, 70, 70, 0.9)'));
  addCanvas(scene, 'bullet_boss', 20, 20, (ctx, w, h) =>
    drawEnemyBullet(ctx, w, h, '#ffd7ff', '#c084ff', 'rgba(180, 90, 255, 0.9)'));

  for (let i = 0; i < 5; i++) {
    addCanvas(scene, `explosion_${i}`, 96, 96, (ctx, w, h) => drawExplosion(ctx, w, h, i / 4));
  }
  addCanvas(scene, 'spark', 28, 28, drawSpark);
  addCanvas(scene, 'glow', 96, 96, (ctx, w, h) => drawGlow(ctx, w, h, 'rgba(120, 245, 255, 0.9)'));
  addCanvas(scene, 'shockwave', 320, 320, drawShockwave);

  const powerColors = {
    power: '#63f2ff',
    shield: '#7ea8ff',
    bomb: '#ffd75e'
  };
  const powerLetters = { power: 'P', shield: 'S', bomb: 'B' };
  for (const type of Object.keys(powerColors)) {
    addCanvas(scene, `powerup_${type}`, 44, 44, (ctx, w, h) => {
      drawPowerup(ctx, w, h, powerColors[type]);
      drawPowerupLetter(ctx, w, h, powerLetters[type], powerColors[type]);
    });
  }

  addCanvas(scene, 'icon_life', 34, 42, (ctx, w, h) => {
    ctx.save();
    ctx.scale(w / 64, h / 80);
    drawPlayer(ctx);
    ctx.restore();
  });
  addCanvas(scene, 'icon_bomb', 34, 34, (ctx, w, h) => {
    drawPowerup(ctx, w, h, '#ffd75e');
    drawPowerupLetter(ctx, w, h, 'B', '#ffd75e');
  });

  // 触屏炸弹按钮底座
  addCanvas(scene, 'btn_bomb', 96, 96, (ctx, w, h) => {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 215, 94, 0.75)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(18, 25, 52, 0.72)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 94, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 215, 94, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}
