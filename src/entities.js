/* 游戏实体：植物 / 僵尸 / 子弹 / 阳光 / 割草机 */
(function (root) {
  'use strict';
  const PVZ = root.PVZ = root.PVZ || {};
  const S = PVZ.sprites;
  const C = PVZ.core;

  /* ================= 植物 ================= */
  function Plant(type, row, col) {
    const def = PVZ.PLANTS[type];
    this.type = type;
    this.def = def;
    this.row = row;
    this.col = col;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.timer = type === 'sunflower' ? (def.sunInterval * 0.55) : 0; // 向日葵提前少量产出
    this.fireTimer = Math.random() * 0.8;
    this.bombTimer = def.bombDelay || 0;
    this.dead = false;
    this.swayPhase = Math.random() * Math.PI * 2;
    this.x = PVZ.BOARD.x + col * PVZ.BOARD.cellW + PVZ.BOARD.cellW / 2;
    this.y = PVZ.BOARD.y + row * PVZ.BOARD.cellH + PVZ.BOARD.cellH / 2;
    this.w = 78;
    this.h = 82;
  }

  Plant.prototype.update = function (dt, game) {
    const def = this.def;
    this.swayPhase += dt * 2;

    if (this.type === 'sunflower') {
      this.timer += dt;
      if (this.timer >= def.sunInterval) {
        this.timer = 0;
        game.spawnSun(this.x + (Math.random() * 30 - 15), this.y - 10, true);
      }
    } else if (def.fireInterval) {
      // 射手：本行前方有僵尸才开火
      this.fireTimer += dt;
      const target = game.zombieInRowAhead(this.row, this.x - 40);
      if (target && this.fireTimer >= def.fireInterval) {
        this.fireTimer = 0;
        game.fireBullet(this, def.double ? 2 : 1);
      }
    } else if (this.type === 'cherrybomb') {
      this.bombTimer -= dt;
      if (this.bombTimer <= 0) {
        game.explode(this.x, this.y, def.bombRadius, def.bombDamage);
        this.dead = true;
      }
    }
  };

  Plant.prototype.hurt = function (dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) this.dead = true;
  };

  Plant.prototype.render = function (ctx, now) {
    const def = this.def;
    let w = this.w, h = this.h;
    let x = this.x, y = this.y + 4;
    let rot = 0;

    if (def.sway) {
      rot = Math.sin(this.swayPhase) * 0.05;
    }
    if (this.type === 'cherrybomb') {
      // 爆炸前膨胀闪烁
      const t = 1 - Math.max(0, this.bombTimer) / this.def.bombDelay;
      const pulse = 1 + t * 0.35 + Math.sin(now * 30) * 0.06 * t;
      w *= pulse; h *= pulse;
    }
    if (this.type === 'wallnut') {
      // 受损表现：轻微缩小变暗
      const hpRatio = this.hp / this.maxHp;
      if (hpRatio < 0.66) { w *= 0.97; h *= 0.97; }
      if (hpRatio < 0.33) { w *= 0.94; h *= 0.94; }
    }

    S.draw(ctx, def.sprite, x, y, w, h, rot);

    // 血条（受损时显示）
    if (this.hp < this.maxHp && this.type !== 'cherrybomb') {
      const ratio = Math.max(0, this.hp / this.maxHp);
      const bw = 56, bx = x - bw / 2, by = y - this.h / 2 - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = ratio > 0.5 ? '#4caf50' : (ratio > 0.25 ? '#ffb300' : '#e53935');
      ctx.fillRect(bx, by, bw * ratio, 4);
    }
  };

  /* ================= 僵尸 ================= */
  const Z_STATE = { WALK: 0, EAT: 1, JUMP: 2, DIE: 3 };

  function Zombie(type, row, hpMul, spdMul) {
    const def = PVZ.ZOMBIES[type];
    this.type = type;
    this.def = def;
    this.row = row;
    this.hp = Math.round(def.hp * hpMul);
    this.maxHp = this.hp;
    this.speed = def.speed * spdMul;
    this.dps = def.dps;
    this.x = PVZ.BOARD.x + PVZ.BOARD.width + 40 + Math.random() * 50;
    this.y = PVZ.BOARD.y + row * PVZ.BOARD.cellH + PVZ.BOARD.cellH / 2;
    this.w = 74;
    this.h = 92;
    this.state = Z_STATE.WALK;
    this.slowUntil = 0;
    this.jumpUsed = false;
    this.jumpT = 0;
    this.jumpFromX = 0;
    this.jumpToX = 0;
    this.dieT = 0;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.eatTimer = 0;
    this.dead = false;
    this.removed = false;
  }

  Zombie.prototype.curSpeed = function (now) {
    let s = this.speed;
    if (now < this.slowUntil) s *= 0.5;
    if (this.type === 'polevault' && this.jumpUsed) s = this.def.afterJumpSpeed;
    return s;
  };

  Zombie.prototype.update = function (dt, game) {
    const now = game.time;
    // 步频与移动速度挂钩：走得越快腿迈得越快
    this.walkPhase += dt * (2.2 + this.curSpeed(now) * 0.14);

    if (this.state === Z_STATE.DIE) {
      this.dieT += dt;
      if (this.dieT > 0.9) this.removed = true;
      return;
    }

    if (this.state === Z_STATE.JUMP) {
      this.jumpT += dt;
      const dur = 0.7;
      const t = Math.min(1, this.jumpT / dur);
      // 抛物线
      this.x = this.jumpFromX + (this.jumpToX - this.jumpFromX) * t;
      this.jumpY = -Math.sin(t * Math.PI) * 90;
      if (t >= 1) {
        this.jumpY = 0;
        this.jumpUsed = true;
        this.state = Z_STATE.WALK;
        C.Sfx.play('eat');
      }
      return;
    }

    // 检查前方植物（啃食/跳跃）
    const plant = game.plantBlocking(this.row, this.x);
    if (plant) {
      if (this.def.canJump && !this.jumpUsed) {
        this.state = Z_STATE.JUMP;
        this.jumpT = 0;
        this.jumpFromX = this.x;
        this.jumpToX = plant.x - PVZ.BOARD.cellW * 0.9; // 跳到植物后方
        return;
      }
      this.state = Z_STATE.EAT;
      this.eatTimer += dt;
      plant.hurt(this.dps * dt);
      if (this.eatTimer >= 0.55) {
        this.eatTimer = 0;
        C.Sfx.play('eat');
      }
      if (plant.dead) this.state = Z_STATE.WALK;
    } else {
      this.state = Z_STATE.WALK;
      this.x -= this.curSpeed(game.time) * dt;
    }
  };

  Zombie.prototype.hurt = function (dmg, slow) {
    if (this.state === Z_STATE.DIE) return;
    this.hp -= dmg;
    if (slow) {
      this.slowUntil = Math.max(this.slowUntil, slow);
    }
    if (this.hp <= 0) {
      this.state = Z_STATE.DIE;
      this.dieT = 0;
      C.Sfx.play('zombieDie');
    }
  };

  Zombie.prototype.render = function (ctx, now) {
    const def = this.def;
    let x = this.x, y = this.y + (this.jumpY || 0);
    let rot = 0;
    let alpha = 1;

    if (this.state === Z_STATE.DIE) {
      // 倒地
      rot = Math.min(1, this.dieT / 0.5) * Math.PI / 2.2;
      alpha = 1 - Math.max(0, (this.dieT - 0.4) / 0.5);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
    }

    // 步态动画：行走时身体起伏+左右摇摆+前后微蹭；啃食时俯冲抖动；跳跃时后仰
    let bob = 0, dx = 0;
    if (this.state === Z_STATE.WALK) {
      const ph = this.walkPhase;
      bob = -Math.abs(Math.sin(ph)) * 5;          // 脚步起伏
      rot = Math.sin(ph) * 0.1;                    // 身体左右摇
      dx = Math.sin(ph) * 3;                       // 重心前后蹭
    } else if (this.state === Z_STATE.EAT) {
      const ph = this.walkPhase * 4;
      rot = 0.12 + Math.sin(ph) * 0.07;            // 低头啃咬
      bob = Math.sin(ph) * 1.6;
      dx = Math.sin(ph) * 2;
    } else if (this.state === Z_STATE.JUMP) {
      rot = -0.22;                                 // 腾空后仰
    }
    S.draw(ctx, def.sprite, x + dx, y + bob, this.w, this.h, rot);

    // 冰冻减速特效
    if (now < this.slowUntil && this.state !== Z_STATE.DIE) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#7fd8ff';
      ctx.beginPath();
      ctx.ellipse(x, y + 6, this.w * 0.42, this.h * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 血条（受伤时显示）
    if (this.hp < this.maxHp && this.state !== Z_STATE.DIE) {
      const ratio = Math.max(0, this.hp / this.maxHp);
      const bw = 52, bx = x - bw / 2, by = y - this.h / 2 - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = ratio > 0.5 ? '#d32f2f' : '#ff7043';
      ctx.fillRect(bx, by, bw * ratio, 4);
    }

    if (this.state === Z_STATE.DIE) ctx.restore();
  };

  /* ================= 子弹 ================= */
  function Bullet(row, x, y, type, damage, slowDuration) {
    this.row = row;
    this.x = x;
    this.y = y;
    this.type = type;       // pea / ice
    this.damage = damage;
    this.slowDuration = slowDuration || 0;
    this.vx = 480;
    this.dead = false;
  }

  Bullet.prototype.update = function (dt, game) {
    this.x += this.vx * dt;
    if (this.x > PVZ.BOARD.x + PVZ.BOARD.width + 30) this.dead = true;
    // 命中检测
    const hit = game.zombieHitAt(this.row, this.x);
    if (hit) {
      hit.hurt(this.damage, this.slowDuration ? game.time + this.slowDuration : 0);
      C.Sfx.play(this.type === 'ice' ? 'hit' : 'hit');
      this.dead = true;
    }
  };

  Bullet.prototype.render = function (ctx) {
    ctx.save();
    if (this.type === 'ice') {
      ctx.fillStyle = '#8fe3ff';
      ctx.shadowColor = '#4fc3f7';
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = '#7cc242';
      ctx.shadowColor = '#4a8a1e';
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /* ================= 阳光 ================= */
  function Sun(x, y, fromSky, targetY) {
    this.x = x;
    this.y = y;
    this.fromSky = fromSky;
    this.value = 25;
    // 天降：落到目标位置；向日葵：弹出小弧线
    this.vy = fromSky ? 45 : -90;
    this.vx = fromSky ? 0 : (Math.random() * 40 - 20);
    this.targetY = targetY;
    this.age = 0;
    this.life = 9;         // 停留时间
    this.collected = false;
    this.collectT = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.dead = false;
  }

  Sun.prototype.update = function (dt, game) {
    this.phase += dt * 3;
    if (this.collected) {
      this.collectT += dt;
      // 飞向左上角阳光计数器
      const tx = 60, ty = 30;
      this.x += (tx - this.x) * Math.min(1, this.collectT * 6);
      this.y += (ty - this.y) * Math.min(1, this.collectT * 6);
      if (this.collectT > 0.5) this.dead = true;
      return;
    }
    this.age += dt;
    if (this.fromSky) {
      if (this.y < this.targetY) this.y += this.vy * dt;
    } else {
      this.vy += 320 * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      if (this.vy > 0 && this.y >= this.targetY) this.y = this.targetY;
    }
    if (this.age > this.life) this.dead = true;
  };

  Sun.prototype.collect = function () {
    if (this.collected) return;
    this.collected = true;
    this.collectT = 0;
  };

  Sun.prototype.render = function (ctx, now) {
    const pulse = 1 + Math.sin(this.phase) * 0.08;
    const fade = this.age > this.life - 2 ? (this.life - this.age) / 2 : 1;
    const r = 22 * pulse;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    // 光晕
    ctx.fillStyle = 'rgba(255, 235, 59, 0.35)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    // 本体
    const grad = ctx.createRadialGradient(this.x - 5, this.y - 5, 3, this.x, this.y, r);
    grad.addColorStop(0, '#fff59d');
    grad.addColorStop(1, '#ffb300');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
    // 光芒
    ctx.strokeStyle = 'rgba(255, 214, 0, 0.85)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = this.phase * 0.4 + i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * (r + 3), this.y + Math.sin(a) * (r + 3));
      ctx.lineTo(this.x + Math.cos(a) * (r + 9), this.y + Math.sin(a) * (r + 9));
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ================= 割草机 ================= */
  function Mower(row) {
    this.row = row;
    this.x = PVZ.BOARD.x - 34;
    this.y = PVZ.BOARD.y + row * PVZ.BOARD.cellH + PVZ.BOARD.cellH / 2;
    this.triggered = false;
    this.done = false;
  }

  Mower.prototype.update = function (dt, game) {
    if (!this.triggered || this.done) return;
    this.x += 560 * dt;
    // 清除本行僵尸
    for (let i = 0; i < game.zombies.length; i++) {
      const z = game.zombies[i];
      if (z.row === this.row && !z.removed && z.state !== 3 && Math.abs(z.x - this.x) < 46) {
        z.hurt(99999);
      }
    }
    if (this.x > PVZ.BOARD.x + PVZ.BOARD.width + 60) this.done = true;
  };

  Mower.prototype.render = function (ctx, now) {
    if (this.done) return;
    // 触发后机身高频抖动
    const shake = this.triggered ? Math.sin(now * 55) * 1.4 : 0;
    const x = this.x, y = this.y + 8 + shake;
    ctx.save();
    // 车轮（触发后辐条旋转）
    const wheelAngle = this.triggered ? now * 28 : 0;
    const wheels = [-14, 12];
    for (let i = 0; i < 2; i++) {
      const wx = x + wheels[i], wy = y + 14;
      ctx.fillStyle = '#263238';
      ctx.beginPath(); ctx.arc(wx, wy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#546e7a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(wx, wy, 9, 0, Math.PI * 2); ctx.stroke();
      // 旋转辐条（两根十字线 + 轮毂）
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(wheelAngle);
      ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
      ctx.fillStyle = '#eceff1';
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // 机身（渐变+高光）
    const bodyGrad = ctx.createLinearGradient(0, y - 12, 0, y + 12);
    bodyGrad.addColorStop(0, '#ef5350');
    bodyGrad.addColorStop(1, '#b71c1c');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(x - 22, y + 12);
    ctx.lineTo(x - 18, y - 8);
    ctx.lineTo(x + 16, y - 10);
    ctx.lineTo(x + 22, y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x - 16, y - 6, 30, 3); // 高光条
    // 手柄
    ctx.strokeStyle = '#546e7a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 14, y - 9);
    ctx.lineTo(x + 24, y - 22);
    ctx.stroke();
    // 触发时刀盘旋转特效 + 尾气尘土
    if (this.triggered) {
      ctx.strokeStyle = 'rgba(200,230,255,0.7)';
      ctx.lineWidth = 2;
      const a = now * 20;
      ctx.beginPath();
      ctx.arc(x - 2, y + 2, 20, a, a + 2);
      ctx.stroke();
      // 尾部尘土
      ctx.fillStyle = 'rgba(160,140,100,0.35)';
      for (let i = 0; i < 3; i++) {
        const r = 5 + ((now * 8 + i * 7) % 10);
        ctx.beginPath();
        ctx.arc(x - 30 - i * 12, y + 12 + Math.sin(now * 9 + i) * 3, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  PVZ.Z_STATE = Z_STATE;
  PVZ.Plant = Plant;
  PVZ.Zombie = Zombie;
  PVZ.Bullet = Bullet;
  PVZ.Sun = Sun;
  PVZ.Mower = Mower;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
