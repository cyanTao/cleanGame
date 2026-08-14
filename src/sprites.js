/* 素材管理：加载 AI 生成图片 + 蓝幕抠像去背 + 统一绘制 */
(function (root) {
  'use strict';
  const PVZ = root.PVZ = root.PVZ || {};
  const P = PVZ.platform;

  const sprites = {};   // name -> { canvas, w, h, ready }
  let loading = false;

  /* 蓝幕抠像：亮蓝色主导像素 → 透明；再做开运算去噪 + 收缩裁剪到主体 */
  function isBlue(r, g, b) {
    return b >= 190 && b > r * 2.2 && b > g * 1.5;
  }

  // 3x3 开运算（先腐蚀后膨胀），清除孤立噪点；src 为 alpha 数组
  function openFilter(alpha, w, h) {
    const eroded = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!alpha[i]) { eroded[i] = 0; continue; }
        let keep = 1;
        for (let dy = -1; dy <= 1 && keep; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) { keep = 0; break; }
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w || !alpha[yy * w + xx]) { keep = 0; break; }
          }
        }
        eroded[i] = keep;
      }
    }
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (eroded[i]) { out[i] = 1; continue; }
        let hit = 0;
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < w && eroded[yy * w + xx]) { hit = 1; break; }
          }
        }
        out[i] = hit;
      }
    }
    return out;
  }

  // 行列直方图收缩：忽略每行/列少于 thr 个不透明像素的稀疏噪点，返回主体 bbox
  function subjectBBox(alpha, w, h, thr) {
    let top = h, bot = -1, left = w, right = -1;
    for (let y = 0; y < h; y++) {
      let cnt = 0;
      for (let x = 0; x < w; x++) if (alpha[y * w + x]) cnt++;
      if (cnt > thr) { if (y < top) top = y; bot = y; }
    }
    for (let x = 0; x < w; x++) {
      let cnt = 0;
      for (let y = 0; y < h; y++) if (alpha[y * w + x]) cnt++;
      if (cnt > thr) { if (x < left) left = x; right = x; }
    }
    if (bot < 0) return null;
    return { left: left, top: top, right: right, bot: bot };
  }

  function chromaKey(img) {
    const w = img.width, h = img.height;
    const c = P.createCanvas();
    c.width = w; c.height = h;
    const ctx = P.ctx2d(c);
    ctx.drawImage(img, 0, 0);
    let data;
    try {
      data = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      return c; // 取不到像素（极端环境）则直接返回原图
    }
    const px = data.data;
    // 1) 蓝幕 → 透明
    const alpha = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < px.length; i += 4, p++) {
      if (isBlue(px[i], px[i + 1], px[i + 2])) {
        px[i + 3] = 0;
      } else {
        alpha[p] = px[i + 3] > 40 ? 1 : 0;
      }
    }
    // 2) 开运算去噪
    const filtered = openFilter(alpha, w, h);
    for (let p = 0; p < alpha.length; p++) {
      if (!filtered[p]) px[p * 4 + 3] = 0;
    }
    ctx.putImageData(data, 0, 0);
    // 3) 收缩裁剪到主体（留 padding）
    const box = subjectBBox(filtered, w, h, 4);
    if (!box) return c;
    const pad = 4;
    const sx = Math.max(0, box.left - pad), sy = Math.max(0, box.top - pad);
    const sw = Math.min(w, box.right + pad + 1) - sx;
    const sh = Math.min(h, box.bot + pad + 1) - sy;
    if (sw >= w * 0.95 && sh >= h * 0.95) return c; // 主体几乎满图则不裁
    const cropped = P.createCanvas();
    cropped.width = sw; cropped.height = sh;
    P.ctx2d(cropped).drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
    return cropped;
  }

  /* 缩放到目标尺寸（减小内存与包体渲染开销） */
  function scaleTo(srcCanvas, size) {
    if (srcCanvas.width <= size && srcCanvas.height <= size) return srcCanvas;
    const ratio = Math.min(size / srcCanvas.width, size / srcCanvas.height);
    const w = Math.round(srcCanvas.width * ratio);
    const h = Math.round(srcCanvas.height * ratio);
    const c = P.createCanvas();
    c.width = w; c.height = h;
    const ctx = P.ctx2d(c);
    ctx.drawImage(srcCanvas, 0, 0, w, h);
    return c;
  }

  const MANIFEST = [
    // 角色（蓝幕抠像 + 缩放）
    { name: 'sunflower',   src: 'assets/plants/sunflower.jpg',   chroma: true, size: 360 },
    { name: 'peashooter',  src: 'assets/plants/peashooter.jpg',  chroma: true, size: 360 },
    { name: 'wallnut',     src: 'assets/plants/wallnut.jpg',     chroma: true, size: 360 },
    { name: 'snowpea',     src: 'assets/plants/snowpea.jpg',     chroma: true, size: 360 },
    { name: 'repeater',    src: 'assets/plants/repeater.jpg',    chroma: true, size: 360 },
    { name: 'cherrybomb',  src: 'assets/plants/cherrybomb.jpg',  chroma: true, size: 360 },
    { name: 'z_normal',    src: 'assets/zombies/normal.jpg',     chroma: true, size: 360 },
    { name: 'z_conehead',  src: 'assets/zombies/conehead.jpg',   chroma: true, size: 360 },
    { name: 'z_buckethead',src: 'assets/zombies/buckethead.jpg', chroma: true, size: 360 },
    { name: 'z_polevault', src: 'assets/zombies/polevault.jpg',  chroma: true, size: 360 },
    { name: 'z_runner',    src: 'assets/zombies/runner.jpg',     chroma: true, size: 360 },
    // 背景（直接使用）
    { name: 'bg_lawn',     src: 'assets/bg/lawn.jpg',            chroma: false }
  ];

  function loadAll(onProgress) {
    if (loading) return Promise.resolve();
    loading = true;
    let done = 0;
    const tasks = MANIFEST.map(function (item) {
      return P.loadImage(item.src).then(function (img) {
        let c = item.chroma ? chromaKey(img, item) : img;
        if (item.size) c = scaleTo(c, item.size);
        sprites[item.name] = { canvas: c, w: c.width, h: c.height, ready: true };
        done++;
        if (onProgress) onProgress(done / MANIFEST.length);
      }).catch(function () {
        // 素材缺失时记录空占位，游戏仍可运行（绘制时用圆形占位）
        sprites[item.name] = { canvas: null, w: 0, h: 0, ready: false };
        done++;
        if (onProgress) onProgress(done / MANIFEST.length);
      });
    });
    return Promise.all(tasks);
  }

  function get(name) {
    return sprites[name] || null;
  }

  /* 按中心点 + 目标尺寸绘制（keepAspect 保持比例） */
  function draw(ctx, name, cx, cy, w, h, rot) {
    const s = get(name);
    if (!s || !s.ready || !s.canvas) {
      // 占位绘制
      ctx.save();
      ctx.fillStyle = 'rgba(80,120,60,0.8)';
      ctx.strokeStyle = 'rgba(30,60,30,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(s.canvas, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawFlip(ctx, name, cx, cy, w, h) {
    const s = get(name);
    if (!s || !s.ready || !s.canvas) { draw(ctx, name, cx, cy, w, h); return; }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(-1, 1); // 水平翻转（僵尸素材默认面向左则不用，此处供统一处理）
    ctx.drawImage(s.canvas, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  PVZ.sprites = {
    MANIFEST: MANIFEST,
    loadAll: loadAll,
    get: get,
    draw: draw,
    drawFlip: drawFlip
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
