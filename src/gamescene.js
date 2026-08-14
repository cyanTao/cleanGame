/* 游戏主场景：棋盘 + 波次 + HUD + 种植交互 + 胜负判定 */
(function (root) {
  'use strict';
  const PVZ = root.PVZ = root.PVZ || {};
  const S = PVZ.sprites;
  const C = PVZ.core;
  const BOARD = PVZ.BOARD;

  const STATE = { READY: 0, PLAYING: 1, WON: 2, LOST: 3 };

  function GameScene(levelIndex) {
    this.levelIndex = levelIndex;
    this.level = PVZ.LEVELS[levelIndex];
    this.restart();
  }

  GameScene.prototype.restart = function () {
    const lv = this.level;
    this.state = STATE.READY;
    this.time = 0;
    this.sun = lv.sunStart;
    this.sunTimer = 3;             // 首个天降阳光
    this.plants = [];              // Plant[]
    this.zombies = [];             // Zombie[]
    this.bullets = [];             // Bullet[]
    this.suns = [];                // Sun[]
    this.mowers = [];              // Mower[]
    this.effects = [];             // 特效
    this.coinsEarned = 0;
    for (let r = 0; r < BOARD.rows; r++) this.mowers.push(new PVZ.Mower(r));

    // 种子卡片
    this.cards = lv.avail.map(function (t) {
      return { type: t, cooldown: 0 };
    });
    this.selected = -1;            // 选中的卡片
    this.shovelMode = false;

    // 波次
    this.waveIdx = 0;
    this.waveQueue = [];           // 当前波待生成 [{type, delay}]
    this.waveStartT = 0;
    this.readyT = 8;               // 开局准备时间
    this.finalWaveShown = false;
    this.totalWaves = lv.waves;

    // UI 弹窗
    this.popup = null;             // 'win' | 'lose' | 'pause'
    this.popupT = 0;
    this.banner = null;            // 顶部横幅提示 {text, t}
    this.bannerT = 0;
  };

  /* ================= 波次 ================= */
  GameScene.prototype.buildWave = function (isFinal) {
    const lv = this.level;
    const keys = Object.keys(lv.pool);
    let totalWeight = 0;
    keys.forEach(function (k) { totalWeight += lv.pool[k]; });

    let count = Math.round(2 + this.waveIdx * 1.3 + Math.min(this.waveIdx, 4));
    if (isFinal) count = Math.round(count * 2.1);
    count = Math.max(2, count);

    const queue = [];
    let delay = 0.3;
    for (let i = 0; i < count; i++) {
      let roll = Math.random() * totalWeight;
      let type = keys[0];
      for (let k = 0; k < keys.length; k++) {
        roll -= lv.pool[keys[k]];
        if (roll <= 0) { type = keys[k]; break; }
      }
      queue.push({ type: type, delay: delay });
      delay += (0.9 + Math.random() * 1.4) * lv.gapMul * (isFinal ? 0.6 : 1);
    }
    return queue;
  };

  GameScene.prototype.startWave = function () {
    const isFinal = this.waveIdx === this.totalWaves - 1;
    this.waveQueue = this.buildWave(isFinal);
    this.waveStartT = this.time;
    if (isFinal) {
      this.showBanner('最后一波！！！');
      C.Sfx.play('wave');
    } else if (this.waveIdx > 0) {
      this.showBanner('一大波僵尸正在接近！');
      C.Sfx.play('wave');
    }
    this.waveIdx++;
  };

  /* ================= 工具方法（供实体调用） ================= */
  GameScene.prototype.zombieInRowAhead = function (row, fromX) {
    for (let i = 0; i < this.zombies.length; i++) {
      const z = this.zombies[i];
      if (z.row === row && z.state !== PVZ.Z_STATE.DIE && z.x > fromX && z.x < BOARD.x + BOARD.width + 60) return z;
    }
    return null;
  };

  GameScene.prototype.zombieHitAt = function (row, x) {
    let best = null;
    for (let i = 0; i < this.zombies.length; i++) {
      const z = this.zombies[i];
      if (z.row === row && z.state !== PVZ.Z_STATE.DIE && !z.removed) {
        if (Math.abs(z.x - x) < 34) {
          if (!best || z.x < best.x) best = z; // 打最前面的
        }
      }
    }
    return best;
  };

  GameScene.prototype.plantBlocking = function (row, x) {
    let best = null;
    for (let i = 0; i < this.plants.length; i++) {
      const p = this.plants[i];
      if (p.row === row && !p.dead && p.type !== 'cherrybomb') {
        const dx = x - p.x;
        if (dx > -8 && dx < 48) { // 僵尸嘴部接触植物
          if (!best || p.x > best.x) best = p;
        }
      }
    }
    return best;
  };

  GameScene.prototype.fireBullet = function (plant, count) {
    const def = plant.def;
    for (let i = 0; i < count; i++) {
      this.bullets.push(new PVZ.Bullet(
        plant.row,
        plant.x + 34 + i * 26,
        plant.y - 18,
        def.bullet,
        def.damage,
        def.slowDuration || 0
      ));
    }
    C.Sfx.play(def.bullet === 'ice' ? 'shootIce' : 'shoot');
  };

  GameScene.prototype.spawnSun = function (x, y, fromSky) {
    const targetRow = Math.floor(Math.random() * BOARD.rows);
    const targetY = BOARD.y + targetRow * BOARD.cellH + BOARD.cellH * (0.3 + Math.random() * 0.4);
    this.suns.push(new PVZ.Sun(x, y, fromSky, targetY));
  };

  GameScene.prototype.explode = function (x, y, radius, damage) {
    const px = radius * BOARD.cellW;
    for (let i = 0; i < this.zombies.length; i++) {
      const z = this.zombies[i];
      if (z.state === PVZ.Z_STATE.DIE || z.removed) continue;
      const dx = z.x - x, dy = z.y - y;
      if (Math.sqrt(dx * dx + dy * dy * 0.55) < px) z.hurt(damage);
    }
    this.effects.push({ type: 'boom', x: x, y: y, t: 0, dur: 0.6, r: px });
    C.Sfx.play('explode');
  };

  GameScene.prototype.showBanner = function (text) {
    this.banner = text;
    this.bannerT = 2.6;
  };

  /* ================= 主更新 ================= */
  GameScene.prototype.update = function (dt) {
    if (this.popup) { this.popupT += dt; return; }

    this.time += dt;
    const lv = this.level;

    /* --- 阶段推进 --- */
    if (this.state === STATE.READY) {
      this.readyT -= dt;
      if (this.readyT <= 0) {
        this.state = STATE.PLAYING;
        this.startWave();
      }
    } else if (this.state === STATE.PLAYING) {
      // 天降阳光
      this.sunTimer -= dt;
      if (this.sunTimer <= 0) {
        this.sunTimer = lv.sunRate * (0.8 + Math.random() * 0.4);
        this.spawnSun(BOARD.x + 30 + Math.random() * (BOARD.width - 60), -30, true);
      }

      // 波次推进
      if (this.waveQueue.length > 0) {
        const next = this.waveQueue[0];
        next.delay -= dt;
        if (next.delay <= 0) {
          this.waveQueue.shift();
          const row = Math.floor(Math.random() * BOARD.rows);
          this.zombies.push(new PVZ.Zombie(next.type, row, lv.hpMul, lv.spdMul));
        }
      } else {
        const allOut = this.waveIdx >= this.totalWaves;
        const zombiesLeft = this.zombies.some(function (z) { return !z.removed; });
        if (allOut) {
          if (!zombiesLeft) this.win();
        } else {
          // 本波出完：等场上僵尸少或超时进入下一波
          const alive = this.zombies.filter(function (z) { return z.state !== PVZ.Z_STATE.DIE && !z.removed; }).length;
          if (alive <= Math.min(2, this.waveIdx) || this.time - this.waveStartT > 32) {
            this.startWave();
          }
        }
      }
    }

    /* --- 实体更新 --- */
    for (let i = 0; i < this.plants.length; i++) this.plants[i].update(dt, this);
    for (let i = 0; i < this.zombies.length; i++) this.zombies[i].update(dt, this);
    for (let i = 0; i < this.bullets.length; i++) this.bullets[i].update(dt, this);
    for (let i = 0; i < this.suns.length; i++) this.suns[i].update(dt, this);
    for (let i = 0; i < this.mowers.length; i++) this.mowers[i].update(dt, this);

    // 清理
    this.plants = this.plants.filter(function (p) { return !p.dead; });
    this.zombies = this.zombies.filter(function (z) { return !z.removed; });
    this.bullets = this.bullets.filter(function (b) { return !b.dead; });
    this.suns = this.suns.filter(function (s) { return !s.dead; });

    // 特效
    for (let i = 0; i < this.effects.length; i++) this.effects[i].t += dt;
    this.effects = this.effects.filter(function (e) { return e.t < e.dur; });

    // 卡片冷却
    for (let i = 0; i < this.cards.length; i++) {
      if (this.cards[i].cooldown > 0) this.cards[i].cooldown = Math.max(0, this.cards[i].cooldown - dt);
    }

    // 割草机触发 & 失败判定
    if (this.state === STATE.PLAYING) {
      for (let i = 0; i < this.zombies.length; i++) {
        const z = this.zombies[i];
        if (z.state === PVZ.Z_STATE.DIE || z.removed) continue;
        if (z.x < BOARD.x - 10) {
          const mower = this.mowers[z.row];
          if (mower && !mower.triggered && !mower.done) {
            mower.triggered = true;
            C.Sfx.play('mower');
          } else if (!mower || mower.triggered || mower.done) {
            if (z.x < BOARD.x - 46) this.lose(); // 割草机已用完仍被突破
          }
        }
      }
    }

    if (this.bannerT > 0) this.bannerT -= dt;
  };

  GameScene.prototype.win = function () {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.WON;
    this.coinsEarned = 20 + this.levelIndex * 8;
    C.Save.clearLevel(this.levelIndex, this.coinsEarned);
    this.popup = 'win';
    this.popupT = 0;
    C.Sfx.play('win');
  };

  GameScene.prototype.lose = function () {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.LOST;
    this.popup = 'lose';
    this.popupT = 0;
    C.Sfx.play('lose');
  };

  /* ================= 输入 ================= */
  GameScene.prototype.cellAt = function (x, y) {
    const col = Math.floor((x - BOARD.x) / BOARD.cellW);
    const row = Math.floor((y - BOARD.y) / BOARD.cellH);
    if (col < 0 || col >= BOARD.cols || row < 0 || row >= BOARD.rows) return null;
    return { row: row, col: col };
  };

  GameScene.prototype.plantAt = function (row, col) {
    for (let i = 0; i < this.plants.length; i++) {
      if (this.plants[i].row === row && this.plants[i].col === col) return this.plants[i];
    }
    return null;
  };

  GameScene.prototype.onMove = function (x, y) {
    if (this.selected >= 0 || this.shovelMode) {
      const cell = this.cellAt(x, y);
      this.previewCell = cell;
      this.previewOk = cell ? !this.plantAt(cell.row, cell.col) : false;
    } else {
      this.previewCell = null;
    }
  };

  GameScene.prototype.onDown = function (x, y) {
    if (this.popup) { this.handlePopupTap(x, y); return; }

    // 1. 收集阳光
    for (let i = this.suns.length - 1; i >= 0; i--) {
      const s = this.suns[i];
      if (!s.collected) {
        const dx = x - s.x, dy = y - s.y;
        if (dx * dx + dy * dy < 40 * 40) {
          s.collect();
          this.sun += s.value;
          C.Sfx.play('sun');
          return;
        }
      }
    }

    // 2. 暂停按钮
    if (x > 912 && y < 44) { this.popup = 'pause'; this.popupT = 0; C.Sfx.play('click'); return; }

    // 3. 种子卡片
    if (y < 92) {
      const shovelX = 96 + this.cards.length * 69 + 8;
      if (this.shovelMode && x > shovelX && x < shovelX + 58) {
        this.shovelMode = false; C.Sfx.play('click'); return;
      }
      if (x > shovelX && x < shovelX + 58) {
        this.shovelMode = !this.shovelMode;
        this.selected = -1;
        C.Sfx.play('click');
        return;
      }
      if (x > 92) {
        const idx = Math.floor((x - 96) / 69);
        if (idx >= 0 && idx < this.cards.length) {
          const card = this.cards[idx];
          const def = PVZ.PLANTS[card.type];
          if (card.cooldown <= 0 && this.sun >= def.cost) {
            this.selected = (this.selected === idx) ? -1 : idx;
            this.shovelMode = false;
            C.Sfx.play('click');
          } else {
            this.showBanner(this.sun < def.cost ? '阳光不足！' : '冷却中…');
          }
          return;
        }
      }
      return;
    }

    // 4. 棋盘操作
    const cell = this.cellAt(x, y);
    if (!cell) { this.selected = -1; this.shovelMode = false; return; }

    if (this.shovelMode) {
      const p = this.plantAt(cell.row, cell.col);
      if (p) {
        p.dead = true;
        this.shovelMode = false;
        C.Sfx.play('shovel');
      }
      return;
    }

    if (this.selected >= 0) {
      const card = this.cards[this.selected];
      const def = PVZ.PLANTS[card.type];
      if (!this.plantAt(cell.row, cell.col) && this.sun >= def.cost && card.cooldown <= 0) {
        this.plants.push(new PVZ.Plant(card.type, cell.row, cell.col));
        this.sun -= def.cost;
        card.cooldown = def.cooldown;
        this.selected = -1;
        C.Sfx.play('plant');
      }
    }
  };

  GameScene.prototype.handlePopupTap = function (x, y) {
    if (this.popupT < 0.4) return; // 防误触
    const btns = this.popupButtons();
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
        C.Sfx.play('click');
        b.fn();
        return;
      }
    }
  };

  GameScene.prototype.popupButtons = function () {
    const cx = 480, bw = 190, bh = 62, gap = 26;
    let list;
    if (this.popup === 'win') {
      const hasNext = this.levelIndex + 1 < PVZ.LEVELS.length;
      list = hasNext
        ? [
            { text: '下一关', fn: () => { const g = new GameScene(this.levelIndex + 1); C.setScene(g); } },
            { text: '重新挑战', fn: () => { this.restart(); } },
            { text: '选关', fn: () => { C.setScene(new PVZ.LevelScene()); } }
          ]
        : [
            { text: '重新挑战', fn: () => { this.restart(); } },
            { text: '选关', fn: () => { C.setScene(new PVZ.LevelScene()); } }
          ];
    } else if (this.popup === 'lose') {
      list = [
        { text: '再来一次', fn: () => { this.restart(); } },
        { text: '选关', fn: () => { C.setScene(new PVZ.LevelScene()); } }
      ];
    } else { // pause
      list = [
        { text: '继续游戏', fn: () => { this.popup = null; } },
        { text: '重新开始', fn: () => { this.restart(); } },
        { text: '选关', fn: () => { C.setScene(new PVZ.LevelScene()); } },
        { text: C.Sfx.isMuted() ? '声音：关' : '声音：开', fn: () => { C.Sfx.setMuted(!C.Sfx.isMuted()); C.Save.data.muted = C.Sfx.isMuted(); C.Save.save(); } }
      ];
    }
    const totalW = list.length * bw + (list.length - 1) * gap;
    let bx = cx - totalW / 2;
    for (let i = 0; i < list.length; i++) {
      list[i].x = bx;
      list[i].y = 330;
      list[i].w = bw;
      list[i].h = bh;
      bx += bw + gap;
    }
    return list;
  };

  /* ================= 渲染 ================= */
  GameScene.prototype.render = function (ctx) {
    const now = this.time;
    this.renderBoard(ctx);
    this.renderMowers(ctx, now);
    // 按行渲染（保证上下遮挡正确）
    for (let r = 0; r < BOARD.rows; r++) {
      for (let i = 0; i < this.plants.length; i++) {
        if (this.plants[i].row === r) this.plants[i].render(ctx, now);
      }
      for (let i = 0; i < this.zombies.length; i++) {
        if (this.zombies[i].row === r) this.zombies[i].render(ctx, now);
      }
    }
    for (let i = 0; i < this.bullets.length; i++) this.bullets[i].render(ctx);
    this.renderEffects(ctx);
    for (let i = 0; i < this.suns.length; i++) this.suns[i].render(ctx, now);
    this.renderHUD(ctx);
    this.renderBanner(ctx);
    this.renderPopup(ctx);
  };

  GameScene.prototype.renderBoard = function (ctx) {
    const bg = S.get('bg_lawn');
    if (bg && bg.ready) {
      ctx.drawImage(bg.canvas, 0, 0, 960, 540);
    } else {
      ctx.fillStyle = '#5aa845';
      ctx.fillRect(0, 90, 960, 450);
    }

    // 格子明暗交替（棋盘感）
    for (let r = 0; r < BOARD.rows; r++) {
      for (let c = 0; c < BOARD.cols; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(BOARD.x + c * BOARD.cellW, BOARD.y + r * BOARD.cellH, BOARD.cellW, BOARD.cellH);
        }
      }
    }

    // 种植预览
    const hover = (this.selected >= 0 || this.shovelMode) ? this.previewCell : null;
    if (hover) {
      ctx.fillStyle = this.previewOk ? 'rgba(255,255,255,0.25)' : 'rgba(255,80,80,0.2)';
      ctx.fillRect(BOARD.x + hover.col * BOARD.cellW, BOARD.y + hover.row * BOARD.cellH, BOARD.cellW, BOARD.cellH);
    }
  };

  GameScene.prototype.renderMowers = function (ctx, now) {
    for (let i = 0; i < this.mowers.length; i++) this.mowers[i].render(ctx, now);
  };

  GameScene.prototype.renderEffects = function (ctx) {
    for (let i = 0; i < this.effects.length; i++) {
      const e = this.effects[i];
      const t = e.t / e.dur;
      if (e.type === 'boom') {
        ctx.save();
        ctx.globalAlpha = 1 - t;
        const r = e.r * (0.5 + t * 0.8);
        const grad = ctx.createRadialGradient(e.x, e.y, r * 0.2, e.x, e.y, r);
        grad.addColorStop(0, '#fff3e0');
        grad.addColorStop(0.5, '#ff9800');
        grad.addColorStop(1, 'rgba(230,81,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  GameScene.prototype.renderHUD = function (ctx) {
    // 顶部栏底
    ctx.fillStyle = 'rgba(46,32,22,0.95)';
    ctx.fillRect(0, 0, 960, 92);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 88, 960, 4);

    // 阳光计数
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(8, 8, 80, 76, 10) : ctx.rect(8, 8, 80, 76);
    ctx.fill();
    const grad = ctx.createRadialGradient(42, 34, 4, 42, 34, 18);
    grad.addColorStop(0, '#fff59d'); grad.addColorStop(1, '#ffb300');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(42, 34, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,0,0.8)'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(42 + Math.cos(a) * 19, 34 + Math.sin(a) * 19);
      ctx.lineTo(42 + Math.cos(a) * 25, 34 + Math.sin(a) * 25);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(this.sun), 46, 76);

    // 种子卡片
    for (let i = 0; i < this.cards.length; i++) {
      this.renderCard(ctx, i);
    }

    // 铲子
    const shovelX = 96 + this.cards.length * 69 + 8;
    ctx.fillStyle = this.shovelMode ? 'rgba(255,193,7,0.35)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(shovelX, 8, 58, 76, 10) : ctx.rect(shovelX, 8, 58, 76);
    ctx.fill();
    if (this.shovelMode) {
      ctx.strokeStyle = '#ffc107'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(shovelX, 8, 58, 76, 10) : ctx.rect(shovelX, 8, 58, 76);
      ctx.stroke();
    }
    this.drawShovel(ctx, shovelX + 29, 46);

    // 波次进度（旗帜条）
    const px = 640, pw = 230, py = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(px, py, pw, 16, 8) : ctx.rect(px, py, pw, 16);
    ctx.fill();
    const progress = Math.min(1, (this.waveIdx + (this.waveQueue.length ? 0.4 : 0)) / this.totalWaves);
    const pg = ctx.createLinearGradient(px, 0, px + pw, 0);
    pg.addColorStop(0, '#66bb6a'); pg.addColorStop(1, '#43a047');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(px + 2, py + 2, Math.max(0, (pw - 4) * progress), 12, 6) : ctx.rect(px + 2, py + 2, Math.max(0, (pw - 4) * progress), 12);
    ctx.fill();
    // 旗帜标记
    const flagX = px + pw * (this.totalWaves - 0.5) / this.totalWaves;
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(flagX, py - 12); ctx.lineTo(flagX + 14, py - 6); ctx.lineTo(flagX, py);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(flagX, py - 12); ctx.lineTo(flagX, py + 14); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('关卡进度 ' + Math.min(this.waveIdx, this.totalWaves) + '/' + this.totalWaves, px + pw / 2, py + 32);

    // 暂停按钮
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(912, 8, 44, 36, 8) : ctx.rect(912, 8, 44, 36);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(924, 16, 6, 20);
    ctx.fillRect(938, 16, 6, 20);
  };

  GameScene.prototype.renderCard = function (ctx, i) {
    const card = this.cards[i];
    const def = PVZ.PLANTS[card.type];
    const x = 96 + i * 69, y = 8, w = 64, h = 76;
    const selected = this.selected === i;
    const affordable = this.sun >= def.cost && card.cooldown <= 0;

    ctx.save();
    // 卡片底
    ctx.fillStyle = selected ? 'rgba(255,213,79,0.45)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, 10) : ctx.rect(x, y, w, h);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#ffc107'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, h, 10) : ctx.rect(x, y, w, h);
      ctx.stroke();
    }

    // 植物图
    S.draw(ctx, def.sprite, x + w / 2, y + 34, 46, 46);

    // 成本
    ctx.fillStyle = affordable ? '#ffe082' : '#ef9a9a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(def.cost), x + w / 2, y + h - 6);

    // 冷却遮罩
    if (card.cooldown > 0) {
      const ratio = card.cooldown / def.cooldown;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, h, 10) : ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y + h * (1 - ratio), w, h * ratio, 10) : ctx.rect(x, y + h * (1 - ratio), w, h * ratio);
      ctx.fill();
    } else if (!affordable) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, h, 10) : ctx.rect(x, y, w, h);
      ctx.fill();
    }
    ctx.restore();
  };

  GameScene.prototype.drawShovel = function (ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    // 杆
    ctx.strokeStyle = '#a1887f';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-8, -16); ctx.lineTo(8, 12); ctx.stroke();
    // 手柄
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(-11, -20, 6, Math.PI * 0.6, Math.PI * 1.6); ctx.stroke();
    // 铲头
    ctx.fillStyle = '#b0bec5';
    ctx.beginPath();
    ctx.moveTo(4, 8);
    ctx.lineTo(16, 18);
    ctx.lineTo(10, 28);
    ctx.lineTo(0, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  GameScene.prototype.renderBanner = function (ctx) {
    if (this.bannerT <= 0 || !this.banner) return;
    const a = Math.min(1, this.bannerT / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(this.banner).width + 60;
    ctx.fillRect(480 - w / 2, 200, w, 64);
    ctx.fillStyle = '#ffca28';
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 1.5;
    ctx.fillText(this.banner, 480, 244);
    ctx.restore();
  };

  GameScene.prototype.renderReadyCountdown = function (ctx) {
    if (this.state !== STATE.READY) return;
    const remain = Math.ceil(this.readyT);
    ctx.save();
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(480 - 230, 210, 460, 110);
    ctx.fillStyle = '#fff';
    ctx.fillText('僵尸即将来袭…', 480, 250);
    ctx.font = 'bold 44px sans-serif';
    ctx.fillStyle = '#ff7043';
    ctx.fillText(String(Math.max(1, remain)), 480, 300);
    ctx.restore();
  };

  GameScene.prototype.renderPopup = function (ctx) {
    if (!this.popup) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 960, 540);

    // 面板
    ctx.fillStyle = '#4e3c2c';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(190, 140, 580, 320, 18) : ctx.rect(190, 140, 580, 320);
    ctx.fill();
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(190, 140, 580, 320, 18) : ctx.rect(190, 140, 580, 320);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 46px sans-serif';
    if (this.popup === 'win') {
      ctx.fillStyle = '#ffd54f';
      ctx.fillText('关卡胜利！', 480, 218);
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('获得金币 +' + this.coinsEarned + '（总计 ' + C.Save.data.coins + '）', 480, 262);
    } else if (this.popup === 'lose') {
      ctx.fillStyle = '#ef5350';
      ctx.fillText('僵尸吃掉了你的脑子！', 480, 218);
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('再试一次，守住你的草坪', 480, 262);
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillText('游戏暂停', 480, 218);
    }

    const btns = this.popupButtons();
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      ctx.fillStyle = '#8bc34a';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 12) : ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill();
      ctx.strokeStyle = '#33691e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 12) : ctx.rect(b.x, b.y, b.w, b.h);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(b.text, b.x + b.w / 2, b.y + 40);
    }
    ctx.restore();
  };

  // 在 render 里补充倒计时（renderBoard 之后）
  const _origRender = GameScene.prototype.render;
  GameScene.prototype.render = function (ctx) {
    _origRender.call(this, ctx);
    this.renderReadyCountdown(ctx);
  };

  PVZ.GameScene = GameScene;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
