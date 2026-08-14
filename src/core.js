/* 核心引擎：逻辑分辨率/视图适配、游戏循环、场景管理、输入、音效合成、存档 */
(function (root) {
  'use strict';
  const PVZ = root.PVZ = root.PVZ || {};
  const P = PVZ.platform;

  /* ================= 视图适配 ================= */
  // 逻辑分辨率固定 960x540（横屏），所有游戏代码使用逻辑坐标
  const VIEW_W = 960, VIEW_H = 540;
  const view = { scale: 1, offX: 0, offY: 0, screenW: 0, screenH: 0, portrait: false };

  function setupCanvas() {
    const canvas = P.getMainCanvas();
    const info = P.getSystemInfo();
    const dpr = info.dpr;
    canvas.width = Math.floor(info.width * dpr);
    canvas.height = Math.floor(info.height * dpr);
    view.screenW = info.width;
    view.screenH = info.height;
    // 关键：CSS 显示尺寸必须等于视口尺寸，否则画布会按属性尺寸(dpr放大)显示导致错位
    if (canvas.style) {
      canvas.style.width = info.width + 'px';
      canvas.style.height = info.height + 'px';
    }
    updateViewScale();
    return canvas;
  }

  function updateViewScale() {
    const sw = view.screenW, sh = view.screenH;
    view.portrait = sh > sw;
    const scale = Math.min(sw / VIEW_W, sh / VIEW_H);
    view.scale = scale;
    // 居中（保持完整画面可见，letterbox）
    view.offX = (sw - VIEW_W * scale) / 2;
    view.offY = (sh - VIEW_H * scale) / 2;
  }

  // 屏幕坐标 → 逻辑坐标
  function toLogical(px, py) {
    return {
      x: (px - view.offX) / view.scale,
      y: (py - view.offY) / view.scale
    };
  }

  /* ================= 场景管理 ================= */
  let currentScene = null;
  function setScene(scene) {
    currentScene = scene;
    if (scene && scene.enter) scene.enter();
  }

  /* ================= 输入 ================= */
  const Input = {
    init: function () {
      P.onInput({
        down: function (ts) {
          P.resumeAudio();
          if (!ts.length) return;
          const t = toLogical(ts[0].x, ts[0].y);
          if (currentScene && currentScene.onDown) currentScene.onDown(t.x, t.y);
        },
        move: function (ts) {
          if (!ts.length) return;
          const t = toLogical(ts[0].x, ts[0].y);
          if (currentScene && currentScene.onMove) currentScene.onMove(t.x, t.y);
        },
        up: function (ts) {
          if (!ts.length) return;
          const t = toLogical(ts[0].x, ts[0].y);
          if (currentScene && currentScene.onUp) currentScene.onUp(t.x, t.y);
        }
      });
    }
  };

  /* ================= 音效合成（WebAudio，无音频文件） ================= */
  const Sfx = (function () {
    let ctxRef = null;
    let muted = false;
    let lastPlay = {}; // 同类音效节流

    function ac() {
      if (!ctxRef) ctxRef = P.getAudioContext();
      return ctxRef;
    }

    // 基础音：振荡器
    function tone(freq, dur, type, vol, slideTo, delay) {
      const ctx = ac();
      if (!ctx || muted) return;
      try {
        const t0 = ctx.currentTime + (delay || 0);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + dur);
        gain.gain.setValueAtTime(vol || 0.15, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch (e) { /* ignore */ }
    }

    // 噪声（爆炸/啃食）
    function noise(dur, vol, filterFreq, delay) {
      const ctx = ac();
      if (!ctx || muted) return;
      try {
        const t0 = ctx.currentTime + (delay || 0);
        const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol || 0.2, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        if (filterFreq) {
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(filterFreq, t0);
          src.connect(filter);
          filter.connect(gain);
        } else {
          src.connect(gain);
        }
        gain.connect(ctx.destination);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
      } catch (e) { /* ignore */ }
    }

    const defs = {
      plant: function () { noise(0.12, 0.25, 900); tone(180, 0.1, 'sine', 0.12, 90); },
      shovel: function () { noise(0.15, 0.3, 1400); tone(320, 0.12, 'square', 0.08, 160); },
      shoot: function () { tone(880, 0.08, 'square', 0.06, 440); },
      shootIce: function () { tone(1200, 0.1, 'triangle', 0.08, 500); },
      hit: function () { tone(200, 0.05, 'square', 0.05, 120); },
      sun: function () { tone(660, 0.09, 'sine', 0.12); tone(880, 0.09, 'sine', 0.12, null, 0.07); tone(1320, 0.12, 'sine', 0.1, null, 0.14); },
      eat: function () { noise(0.09, 0.18, 500); tone(90, 0.09, 'sawtooth', 0.08, 60); },
      explode: function () { noise(0.5, 0.5, 400); tone(80, 0.4, 'sine', 0.3, 30); },
      mower: function () { tone(110, 0.7, 'sawtooth', 0.18, 190); noise(0.7, 0.2, 700); },
      zombieDie: function () { tone(160, 0.3, 'sawtooth', 0.1, 60); noise(0.2, 0.15, 600); },
      wave: function () { tone(220, 0.5, 'sawtooth', 0.12, 110); tone(110, 0.7, 'sawtooth', 0.1, 80, 0.1); },
      win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.16, null, i * 0.16); }); },
      lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.3, 'sawtooth', 0.13, null, i * 0.2); }); },
      click: function () { tone(700, 0.06, 'square', 0.07, 900); },
      coin: function () { tone(988, 0.08, 'square', 0.08); tone(1319, 0.15, 'square', 0.08, null, 0.08); }
    };

    return {
      play: function (name) {
        const fn = defs[name];
        if (!fn) return;
        // 节流：同类音效 60ms 内只播一次
        const now = Date.now();
        if (lastPlay[name] && now - lastPlay[name] < 60) return;
        lastPlay[name] = now;
        fn();
      },
      setMuted: function (m) { muted = m; },
      isMuted: function () { return muted; }
    };
  })();

  /* ================= 存档 ================= */
  const SAVE_KEY = 'pvz_save_v1';
  const Save = {
    data: null,
    load: function () {
      let d = P.storageGet(SAVE_KEY, null);
      if (!d || typeof d !== 'object') d = {};
      if (typeof d.unlocked !== 'number') d.unlocked = 1;    // 已解锁最大关卡
      if (typeof d.cleared !== 'object') d.cleared = {};      // {levelIndex: true}
      if (typeof d.coins !== 'number') d.coins = 0;
      if (typeof d.muted !== 'boolean') d.muted = false;
      this.data = d;
      Sfx.setMuted(d.muted);
      return d;
    },
    save: function () {
      if (this.data) P.storageSet(SAVE_KEY, this.data);
    },
    clearLevel: function (idx, coins) {
      this.data.cleared[idx] = true;
      this.data.unlocked = Math.max(this.data.unlocked, Math.min(idx + 2, PVZ.LEVELS.length));
      this.data.coins += coins || 0;
      this.save();
    }
  };

  /* ================= 引擎主循环 ================= */
  const Engine = {
    canvas: null,
    ctx: null,
    running: false,
    lastTime: 0,
    paused: false,

    start: function () {
      this.canvas = setupCanvas();
      this.ctx = P.ctx2d(this.canvas);
      this.ctx.imageSmoothingEnabled = true;

      // 尺寸变化监听（H5 旋转/缩放/移动端地址栏收起展开）
      if (!P.isWx) {
        window.addEventListener('resize', function () { setupCanvas(); });
        window.addEventListener('orientationchange', function () { setTimeout(setupCanvas, 150); });
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', function () { setupCanvas(); });
        }
      }

      P.onFrame(this._frame.bind(this));
      this.running = true;
    },

    _frame: function () {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      let dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (dt > 0.1) dt = 0.1; // 后台切回防跳帧
      if (dt < 0) dt = 0;

      // 微信端旋转可能改变窗口尺寸，刷新适配
      if (P.isWx) {
        const info = P.getSystemInfo();
        if (info.width !== view.screenW || info.height !== view.screenH) {
          view.screenW = info.width; view.screenH = info.height;
          const dpr = info.dpr;
          this.canvas.width = Math.floor(info.width * dpr);
          this.canvas.height = Math.floor(info.height * dpr);
          updateViewScale();
        }
      }

      const ctx = this.ctx;
      const info = { w: this.canvas.width, h: this.canvas.height };
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // letterbox 背景（深绿）
      ctx.fillStyle = '#0e1a0e';
      ctx.fillRect(0, 0, info.w, info.h);

      if (view.portrait) {
        this._renderRotateHint(ctx, info);
        return;
      }

      // 设置逻辑坐标变换（含 dpr）
      const totalScale = view.scale * (info.w / view.screenW);
      ctx.setTransform(totalScale, 0, 0, totalScale, view.offX * (info.w / view.screenW), view.offY * (info.h / view.screenH));

      if (currentScene) {
        if (!this.paused && currentScene.update) currentScene.update(dt);
        if (currentScene.render) currentScene.render(ctx);
      }
    },

    _renderRotateHint: function (ctx, info) {
      const cx = info.w / 2, cy = info.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 2);
      const s = Math.min(info.w, info.h) / 400;
      ctx.scale(s, s);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('请旋转手机至横屏游玩', 0, 0);
      ctx.font = '20px sans-serif';
      ctx.fillText('🌲 🧟 🌻', 0, 44);
      ctx.restore();
    }
  };

  PVZ.core = {
    VIEW_W: VIEW_W,
    VIEW_H: VIEW_H,
    view: view,
    setupCanvas: setupCanvas,
    updateViewScale: updateViewScale,
    toLogical: toLogical,
    setScene: setScene,
    getScene: function () { return currentScene; },
    Input: Input,
    Sfx: Sfx,
    Save: Save,
    Engine: Engine
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
