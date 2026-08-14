/* UI 场景：主菜单 + 选关 */
(function (root) {
  'use strict';
  const PVZ = root.PVZ = root.PVZ || {};
  const S = PVZ.sprites;
  const C = PVZ.core;

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
          { text: '继续冒险', x: 480 - 210, y: 300, w: 200, h: 66, fn: function () { C.setScene(new PVZ.LevelScene()); } },
          { text: '重新开始', x: 480 + 10, y: 300, w: 200, h: 66, fn: function () { C.setScene(new PVZ.GameScene(0)); } }
        ]
      : [
          { text: '开始冒险', x: 480 - 100, y: 300, w: 200, h: 66, fn: function () { C.setScene(new PVZ.GameScene(0)); } }
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
      ctx.fillStyle = '#5aa845';
      ctx.fillRect(0, 0, 960, 540);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, 960, 540);

    ctx.save();
    ctx.textAlign = 'center';
    const bounce = Math.sin(this.t * 2) * 6;
    ctx.font = 'bold 88px sans-serif';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#2e4a1e';
    ctx.strokeText('植物大战僵尸', 480, 150 + bounce);
    const grad = ctx.createLinearGradient(0, 100, 0, 180);
    grad.addColorStop(0, '#fff59d');
    grad.addColorStop(1, '#ff9800');
    ctx.fillStyle = grad;
    ctx.fillText('植物大战僵尸', 480, 150 + bounce);

    ctx.font = '26px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('手机版 · 白天草坪篇', 480, 196);

    // 装饰角色
    S.draw(ctx, 'sunflower', 180, 430 + Math.sin(this.t * 2.2) * 8, 110, 110);
    S.draw(ctx, 'peashooter', 330, 445 + Math.sin(this.t * 2.4 + 1) * 8, 100, 100);
    S.draw(ctx, 'z_normal', 630, 445 + Math.sin(this.t * 2 + 2) * 8, 96, 116);
    S.draw(ctx, 'z_conehead', 790, 440 + Math.sin(this.t * 2.6 + 0.5) * 8, 100, 118);

    // 按钮
    for (let i = 0; i < this.btns.length; i++) {
      const b = this.btns[i];
      ctx.fillStyle = '#7cb342';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 14) : ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill();
      ctx.strokeStyle = '#33691e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 14) : ctx.rect(b.x, b.y, b.w, b.h);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(b.text, b.x + b.w / 2, b.y + 44);
    }

    // 金币
    ctx.textAlign = 'left';
    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('金币：' + C.Save.data.coins, 20, 32);
    ctx.restore();
  };

  /* ================= 选关 ================= */
  function LevelScene() {
    this.t = 0;
    this.cellW = 160, this.cellH = 150;
    this.cols = 5;
    this.startX = (960 - this.cols * this.cellW) / 2 + 20;
    this.startY = 170;
    this.backBtn = { x: 20, y: 20, w: 110, h: 48, text: '← 返回' };
  }

  LevelScene.prototype.update = function (dt) { this.t += dt; };

  LevelScene.prototype.onDown = function (x, y) {
    const bk = this.backBtn;
    if (x > bk.x && x < bk.x + bk.w && y > bk.y && y < bk.y + bk.h) {
      C.Sfx.play('click');
      C.setScene(new MenuScene());
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
      ctx.fillStyle = '#5aa845';
      ctx.fillRect(0, 0, 960, 540);
    }
    ctx.fillStyle = 'rgba(20,40,15,0.55)';
    ctx.fillRect(0, 0, 960, 540);

    ctx.textAlign = 'center';
    ctx.font = 'bold 44px sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#1b5e20';
    ctx.strokeText('选择关卡', 480, 84);
    ctx.fillStyle = '#aed581';
    ctx.fillText('选择关卡', 480, 84);

    const save = C.Save.data;
    for (let i = 0; i < PVZ.LEVELS.length; i++) {
      const lv = PVZ.LEVELS[i];
      const pos = this.cellPos(i);
      const unlocked = i < save.unlocked;
      const cleared = !!save.cleared[i];

      ctx.save();
      ctx.fillStyle = unlocked ? 'rgba(255,241,180,0.92)' : 'rgba(80,80,80,0.55)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(pos.x, pos.y, this.cellW - 20, this.cellH - 20, 14) : ctx.rect(pos.x, pos.y, this.cellW - 20, this.cellH - 20);
      ctx.fill();
      ctx.strokeStyle = unlocked ? '#8d6e63' : '#555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(pos.x, pos.y, this.cellW - 20, this.cellH - 20, 14) : ctx.rect(pos.x, pos.y, this.cellW - 20, this.cellH - 20);
      ctx.stroke();

      if (unlocked) {
        const plants = lv.avail;
        const show = plants[Math.floor(this.t / 2 + i) % plants.length];
        S.draw(ctx, PVZ.PLANTS[show].sprite, pos.x + (this.cellW - 20) / 2, pos.y + 52, 62, 62);
      } else {
        ctx.fillStyle = '#757575';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText('🔒', pos.x + (this.cellW - 20) / 2, pos.y + 66);
      }

      ctx.fillStyle = unlocked ? '#4e342e' : '#999';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(lv.name, pos.x + (this.cellW - 20) / 2, pos.y + 102);

      if (cleared) {
        ctx.fillStyle = '#ffb300';
        ctx.font = '22px sans-serif';
        ctx.fillText('★ 已通关', pos.x + (this.cellW - 20) / 2, pos.y + 124);
      } else if (unlocked) {
        ctx.fillStyle = '#ef6c00';
        ctx.font = '18px sans-serif';
        ctx.fillText(lv.waves + ' 波僵尸', pos.x + (this.cellW - 20) / 2, pos.y + 124);
      }
      ctx.restore();
    }

    const bk = this.backBtn;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bk.x, bk.y, bk.w, bk.h, 10) : ctx.rect(bk.x, bk.y, bk.w, bk.h);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(bk.text, bk.x + bk.w / 2, bk.y + 32);
  };

  PVZ.MenuScene = MenuScene;
  PVZ.LevelScene = LevelScene;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
