/* UI 场景：主菜单 + 选关 */
(function (root) {
  'use strict';
  const PVZ = root.PVZ = root.PVZ || {};
  const S = PVZ.sprites;
  const C = PVZ.core;

  /* ============ 公共绘制 ============ */
  // 立体渐变按钮（主色调可选 green/orange/brown/gold）
  PVZ.drawButton = function (ctx, b, color) {
    const palette = {
      green: ['#8bc34a', '#558b2f', '#33691e'],
      orange: ['#ffb74d', '#f57c00', '#e65100'],
      brown: ['#a1887f', '#6d4c41', '#4e342e'],
      gold: ['#ffe082', '#ffb300', '#ff8f00']
    }[color || 'green'];
    ctx.save();
    // 投影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(b.x + 2, b.y + 5, b.w, b.h, 16) : ctx.rect(b.x + 2, b.y + 5, b.w, b.h);
    ctx.fill();
    // 主体渐变
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, palette[0]);
    g.addColorStop(1, palette[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 16) : ctx.rect(b.x, b.y, b.w, b.h);
    ctx.fill();
    ctx.strokeStyle = palette[2];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 16) : ctx.rect(b.x, b.y, b.w, b.h);
    ctx.stroke();
    // 顶部高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(b.x + 6, b.y + 4, b.w - 12, b.h * 0.32, 10) : ctx.rect(b.x + 6, b.y + 4, b.w - 12, b.h * 0.32);
    ctx.fill();
    // 文字
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (b.fontSize || 28) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 4;
    ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2 + (b.fontSize || 28) * 0.36);
    ctx.restore();
  };

  // 矢量锁图标
  function drawLock(ctx, cx, cy, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = s * 0.18;
    // 锁环
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.35, s * 0.42, Math.PI, 0);
    ctx.stroke();
    // 锁体
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx - s * 0.5, cy - s * 0.35, s, s * 0.95, s * 0.15) : ctx.rect(cx - s * 0.5, cy - s * 0.35, s, s * 0.95);
    ctx.fill();
    // 锁孔
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.02, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - s * 0.06, cy, s * 0.12, s * 0.28);
    ctx.restore();
  }

  /* ================= 主菜单 ================= */
  function MenuScene() {
    this.t = 0;
    this.btns = [];
    this.layout();
  }

  MenuScene.prototype.layout = function () {
    const save = C.Save.data;
    const hasProgress = save.unlocked > 1;
    this.btns = hasProgress
      ? [
          { text: '继续冒险', x: 480 - 215, y: 300, w: 205, h: 66, fn: function () { C.setScene(new PVZ.LevelScene()); } },
          { text: '重新开始', x: 480 + 10, y: 300, w: 205, h: 66, fn: function () { C.setScene(new PVZ.GameScene(0)); } }
        ]
      : [
          { text: '开始冒险', x: 480 - 105, y: 300, w: 210, h: 66, fn: function () { C.setScene(new PVZ.GameScene(0)); } }
        ];
  };

  MenuScene.prototype.enter = function () { this.layout(); };

  MenuScene.prototype.update = function (dt) { this.t += dt; };

  MenuScene.prototype.onDown = function (x, y) {
    for (let i = 0; i < this.btns.length; i++) {
      const b = this.btns[i];
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
        C.Sfx.play('click');
        b.fn();
        return;
      }
    }
  };

  MenuScene.prototype.render = function (ctx) {
    // 背景
    const bg = S.get('bg_lawn');
    if (bg && bg.ready) {
      ctx.drawImage(bg.canvas, 0, 0, 960, 540);
    } else {
      const g0 = ctx.createLinearGradient(0, 0, 0, 540);
      g0.addColorStop(0, '#7cb95e');
      g0.addColorStop(1, '#4e8c35');
      ctx.fillStyle = g0;
      ctx.fillRect(0, 0, 960, 540);
    }
    // 上下暗压，突出主体
    const dim = ctx.createLinearGradient(0, 0, 0, 540);
    dim.addColorStop(0, 'rgba(10,30,8,0.55)');
    dim.addColorStop(0.5, 'rgba(10,30,8,0.25)');
    dim.addColorStop(1, 'rgba(10,30,8,0.6)');
    ctx.fillStyle = dim;
    ctx.fillRect(0, 0, 960, 540);

    ctx.save();
    ctx.textAlign = 'center';
    const bounce = Math.sin(this.t * 2) * 6;
    // 标题（多层描边：外深绿 + 内白）
    ctx.font = 'bold 88px sans-serif';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowOffsetY = 6;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#1b3a10';
    ctx.strokeText('植物大战僵尸', 480, 150 + bounce);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#e8f5c8';
    ctx.strokeText('植物大战僵尸', 480, 150 + bounce);
    const grad = ctx.createLinearGradient(0, 100, 0, 180);
    grad.addColorStop(0, '#fff59d');
    grad.addColorStop(1, '#ff9800');
    ctx.fillStyle = grad;
    ctx.fillText('植物大战僵尸', 480, 150 + bounce);
    ctx.shadowColor = 'transparent';

    // 副标题（木牌）
    ctx.fillStyle = 'rgba(90,62,40,0.85)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(480 - 170, 172 + bounce * 0.5, 340, 44, 10) : ctx.rect(480 - 170, 172 + bounce * 0.5, 340, 44);
    ctx.fill();
    ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(480 - 170, 172 + bounce * 0.5, 340, 44, 10) : ctx.rect(480 - 170, 172 + bounce * 0.5, 340, 44);
    ctx.stroke();
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#ffe0b2';
    ctx.fillText('手机版 · 白天草坪篇', 480, 202 + bounce * 0.5);

    // 装饰角色
    S.draw(ctx, 'sunflower', 180, 430 + Math.sin(this.t * 2.2) * 8, 110, 110);
    S.draw(ctx, 'peashooter', 330, 445 + Math.sin(this.t * 2.4 + 1) * 8, 100, 100);
    S.draw(ctx, 'z_normal', 630, 445 + Math.sin(this.t * 2 + 2) * 8, 96, 116);
    S.draw(ctx, 'z_conehead', 790, 440 + Math.sin(this.t * 2.6 + 0.5) * 8, 100, 118);

    // 按钮
    for (let i = 0; i < this.btns.length; i++) {
      PVZ.drawButton(ctx, this.btns[i], i === this.btns.length - 1 && this.btns.length > 1 ? 'orange' : 'green');
    }

    // 金币（右上角胶囊）
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(796, 16, 148, 40, 20) : ctx.rect(796, 16, 148, 40);
    ctx.fill();
    const cg = ctx.createRadialGradient(820, 36, 2, 820, 36, 12);
    cg.addColorStop(0, '#fff59d'); cg.addColorStop(1, '#ffb300');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(820, 36, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(String(C.Save.data.coins), 840, 44);
    ctx.restore();
  };

  /* ================= 选关 ================= */
  function LevelScene() {
    this.t = 0;
    this.cellW = 160, this.cellH = 150;
    this.cols = 5;
    this.startX = (960 - this.cols * this.cellW) / 2 + 20;
    this.startY = 170;
    this.backBtn = { x: 20, y: 20, w: 120, h: 48, text: '← 返回', fontSize: 22 };
    this.unlockBtn = { x: 810, y: 20, w: 132, h: 48, text: '解锁全部', fontSize: 20 };
  }

  LevelScene.prototype.update = function (dt) { this.t += dt; };

  LevelScene.prototype.onDown = function (x, y) {
    const bk = this.backBtn;
    if (x > bk.x && x < bk.x + bk.w && y > bk.y && y < bk.y + bk.h) {
      C.Sfx.play('click');
      C.setScene(new MenuScene());
      return;
    }
    // 解锁全部关卡（绕过锁定）
    const ub = this.unlockBtn;
    if (x > ub.x && x < ub.x + ub.w && y > ub.y && y < ub.y + ub.h) {
      const save = C.Save.data;
      if (save.unlocked < PVZ.LEVELS.length) {
        save.unlocked = PVZ.LEVELS.length;
        C.Save.save();
        C.Sfx.play('sun');
      } else {
        C.Sfx.play('click');
      }
      return;
    }
    const save = C.Save.data;
    for (let i = 0; i < PVZ.LEVELS.length; i++) {
      const pos = this.cellPos(i);
      if (x > pos.x && x < pos.x + this.cellW - 20 && y > pos.y && y < pos.y + this.cellH - 20) {
        if (i < save.unlocked) {
          C.Sfx.play('click');
          C.setScene(new PVZ.GameScene(i));
        } else {
          C.Sfx.play('hit');
        }
        return;
      }
    }
  };

  LevelScene.prototype.cellPos = function (i) {
    const r = Math.floor(i / this.cols), c = i % this.cols;
    return { x: this.startX + c * this.cellW, y: this.startY + r * this.cellH };
  };

  LevelScene.prototype.render = function (ctx) {
    const bg = S.get('bg_lawn');
    if (bg && bg.ready) {
      ctx.drawImage(bg.canvas, 0, 0, 960, 540);
    } else {
      const g0 = ctx.createLinearGradient(0, 0, 0, 540);
      g0.addColorStop(0, '#7cb95e');
      g0.addColorStop(1, '#4e8c35');
      ctx.fillStyle = g0;
      ctx.fillRect(0, 0, 960, 540);
    }
    ctx.fillStyle = 'rgba(20,40,15,0.6)';
    ctx.fillRect(0, 0, 960, 540);

    ctx.textAlign = 'center';
    // 标题（木牌）
    ctx.fillStyle = 'rgba(90,62,40,0.9)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(480 - 150, 36, 300, 58, 14) : ctx.rect(480 - 150, 36, 300, 58);
    ctx.fill();
    ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(480 - 150, 36, 300, 58, 14) : ctx.rect(480 - 150, 36, 300, 58);
    ctx.stroke();
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#ffe0b2';
    ctx.fillText('选择关卡', 480, 80);

    const save = C.Save.data;
    for (let i = 0; i < PVZ.LEVELS.length; i++) {
      const lv = PVZ.LEVELS[i];
      const pos = this.cellPos(i);
      const unlocked = i < save.unlocked;
      const cleared = !!save.cleared[i];

      ctx.save();
      const cw = this.cellW - 20, ch = this.cellH - 20;
      // 投影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(pos.x + 3, pos.y + 5, cw, ch, 14) : ctx.rect(pos.x + 3, pos.y + 5, cw, ch);
      ctx.fill();
      // 卡面渐变
      const cg = ctx.createLinearGradient(0, pos.y, 0, pos.y + ch);
      if (unlocked) {
        cg.addColorStop(0, cleared ? 'rgba(255,248,215,0.97)' : 'rgba(255,241,180,0.95)');
        cg.addColorStop(1, cleared ? 'rgba(255,224,130,0.95)' : 'rgba(240,215,150,0.92)');
      } else {
        cg.addColorStop(0, 'rgba(120,118,110,0.7)');
        cg.addColorStop(1, 'rgba(85,84,80,0.7)');
      }
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(pos.x, pos.y, cw, ch, 14) : ctx.rect(pos.x, pos.y, cw, ch);
      ctx.fill();
      ctx.strokeStyle = unlocked ? (cleared ? '#f9a825' : '#8d6e63') : '#616161';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(pos.x, pos.y, cw, ch, 14) : ctx.rect(pos.x, pos.y, cw, ch);
      ctx.stroke();

      // 关卡序号徽章
      ctx.fillStyle = unlocked ? '#43a047' : '#757575';
      ctx.beginPath();
      ctx.arc(pos.x + 18, pos.y + 18, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x + 18, pos.y + 18, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(String(i + 1), pos.x + 18, pos.y + 23);

      if (unlocked) {
        const plants = lv.avail;
        const show = plants[Math.floor(this.t / 2 + i) % plants.length];
        S.draw(ctx, PVZ.PLANTS[show].sprite, pos.x + cw / 2, pos.y + 54, 62, 62);
      } else {
        drawLock(ctx, pos.x + cw / 2, pos.y + 52, 34, '#455a64');
      }

      ctx.fillStyle = unlocked ? '#4e342e' : '#9e9e9e';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(lv.name, pos.x + cw / 2, pos.y + 104);

      if (cleared) {
        ctx.fillStyle = '#fb8c00';
        ctx.font = 'bold 21px sans-serif';
        ctx.fillText('★ 已通关', pos.x + cw / 2, pos.y + 126);
      } else if (unlocked) {
        ctx.fillStyle = '#ef6c00';
        ctx.font = '18px sans-serif';
        ctx.fillText(lv.waves + ' 波僵尸', pos.x + cw / 2, pos.y + 126);
      }
      ctx.restore();
    }

    PVZ.drawButton(ctx, this.backBtn, 'brown');
    PVZ.drawButton(ctx, this.unlockBtn, 'gold');
  };

  PVZ.MenuScene = MenuScene;
  PVZ.LevelScene = LevelScene;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
