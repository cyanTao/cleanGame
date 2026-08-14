/* 平台适配层：屏蔽 H5 与微信小游戏 API 差异 */
(function (root) {
  'use strict';
  const isWx = typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function';
  const PVZ = root.PVZ = root.PVZ || {};

  let mainCanvas = null;

  function getMainCanvas() {
    if (mainCanvas) return mainCanvas;
    if (isWx) {
      // 微信小游戏：首个 wx.createCanvas() 创建的是上屏画布
      mainCanvas = wx.createCanvas();
    } else {
      mainCanvas = document.getElementById('gameCanvas');
    }
    return mainCanvas;
  }

  function createCanvas() {
    if (isWx) return wx.createCanvas();
    return document.createElement('canvas');
  }

  function getSystemInfo() {
    if (isWx) {
      let info = null;
      try { info = wx.getSystemInfoSync(); } catch (e) { info = null; }
      if (!info) {
        try { info = wx.getWindowInfo ? wx.getWindowInfo() : null; } catch (e) { info = null; }
      }
      return {
        width: (info && (info.windowWidth || info.screenWidth)) || 375,
        height: (info && (info.windowHeight || info.screenHeight)) || 667,
        dpr: (info && info.pixelRatio) || 1
      };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    };
  }

  function createImage() {
    return isWx ? wx.createImage() : new Image();
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const img = createImage();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('图片加载失败: ' + src)); };
      img.src = src;
    });
  }

  /* ---------- 存储 ---------- */
  function storageGet(key, def) {
    try {
      if (isWx) {
        const v = wx.getStorageSync(key);
        return (v === '' || v === null || v === undefined) ? def : v;
      }
      const v = localStorage.getItem(key);
      return v == null ? def : JSON.parse(v);
    } catch (e) { return def; }
  }

  function storageSet(key, value) {
    try {
      if (isWx) { wx.setStorageSync(key, value); return; }
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* 存储失败静默 */ }
  }

  /* ---------- 音频上下文 ---------- */
  let audioCtx = null;
  let audioTried = false;
  function getAudioContext() {
    if (audioTried) return audioCtx;
    audioTried = true;
    try {
      if (isWx) {
        if (typeof wx.createWebAudioContext === 'function') audioCtx = wx.createWebAudioContext();
      } else if (typeof AudioContext !== 'undefined') {
        audioCtx = new AudioContext();
      } else if (typeof webkitAudioContext !== 'undefined') {
        audioCtx = new webkitAudioContext();
      }
    } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  // 微信小游戏需要用户交互后才能恢复音频（自动播放策略）
  function resumeAudio() {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended' && ctx.resume) {
      try { ctx.resume(); } catch (e) { /* ignore */ }
    }
  }

  /* ---------- 触摸/指针输入 → 统一回调 ---------- */
  function onInput(handlers) {
    if (isWx) {
      const pick = function (e) {
        if (!e || !e.touches) return [];
        const list = [];
        for (let i = 0; i < e.touches.length; i++) {
          list.push({ x: e.touches[i].x, y: e.touches[i].y, id: e.touches[i].identifier });
        }
        return list;
      };
      wx.onTouchStart(function (e) { handlers.down && handlers.down(pick(e)); });
      wx.onTouchMove(function (e) { handlers.move && handlers.move(pick(e)); });
      wx.onTouchEnd(function (e) { handlers.up && handlers.up(pick(e)); });
      wx.onTouchCancel(function (e) { handlers.up && handlers.up(pick(e)); });
    } else {
      const canvas = getMainCanvas();
      const pickMouse = function (e) { return [{ x: e.clientX, y: e.clientY, id: 1 }]; };
      canvas.addEventListener('mousedown', function (e) { resumeAudio(); handlers.down && handlers.down(pickMouse(e)); });
      window.addEventListener('mousemove', function (e) { handlers.move && handlers.move(pickMouse(e)); });
      window.addEventListener('mouseup', function (e) { handlers.up && handlers.up(pickMouse(e)); });
      canvas.addEventListener('touchstart', function (e) {
        e.preventDefault(); resumeAudio();
        const list = [];
        for (let i = 0; i < e.touches.length; i++) {
          const r = canvas.getBoundingClientRect();
          list.push({ x: e.touches[i].clientX - r.left, y: e.touches[i].clientY - r.top, id: e.touches[i].identifier });
        }
        handlers.down && handlers.down(list);
      }, { passive: false });
      canvas.addEventListener('touchmove', function (e) {
        e.preventDefault();
        const list = [];
        for (let i = 0; i < e.touches.length; i++) {
          const r = canvas.getBoundingClientRect();
          list.push({ x: e.touches[i].clientX - r.left, y: e.touches[i].clientY - r.top, id: e.touches[i].identifier });
        }
        handlers.move && handlers.move(list);
      }, { passive: false });
      canvas.addEventListener('touchend', function (e) {
        e.preventDefault();
        const list = [];
        const ts = e.changedTouches || [];
        for (let i = 0; i < ts.length; i++) {
          const r = canvas.getBoundingClientRect();
          list.push({ x: ts[i].clientX - r.left, y: ts[i].clientY - r.top, id: ts[i].identifier });
        }
        handlers.up && handlers.up(list);
      }, { passive: false });
    }
  }

  /* ---------- 帧循环 ---------- */
  function onFrame(cb) {
    if (isWx && typeof wx.requestAnimationFrame === 'function') {
      const loop = function () { cb(); wx.requestAnimationFrame(loop); };
      wx.requestAnimationFrame(loop);
      return;
    }
    const raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
    const loop = function () { cb(); raf(loop); };
    raf(loop);
  }

  /* ---------- 离屏画布的 2D 上下文（微信与 H5 均支持） ---------- */
  function ctx2d(canvas) {
    return canvas.getContext('2d');
  }

  PVZ.platform = {
    isWx: isWx,
    getMainCanvas: getMainCanvas,
    createCanvas: createCanvas,
    getSystemInfo: getSystemInfo,
    createImage: createImage,
    loadImage: loadImage,
    storageGet: storageGet,
    storageSet: storageSet,
    getAudioContext: getAudioContext,
    resumeAudio: resumeAudio,
    onInput: onInput,
    onFrame: onFrame,
    ctx2d: ctx2d
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
