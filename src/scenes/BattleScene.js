// ===== 核心战斗场景 =====
import Phaser from 'phaser';
import { SCENE, MECHAS, VIEW, COMBAT, PALETTES } from '../config.js';
import { Mecha } from '../entities/Mecha.js';
import { InputSystem } from '../systems/InputSystem.js';
import { AIController } from '../systems/AIController.js';
import { resolveHit, energyGain, resolveTimerEnd } from '../systems/combat.js';

export class BattleScene extends Phaser.Scene {
  constructor() { super(SCENE.BATTLE); }

  init(data) {
    this.mode = data.mode || 'pve';
  }

  create() {
    this.groundY = VIEW.groundY;
    this.phase = 'intro';         // intro | fight | sudden | end
    this.fightElapsed = 0;
    this.suddenDeath = false;

    this.drawBackground();

    // 双方机甲（需先于地板碰撞器创建，collider 依赖实体引用）
    this.p1 = new Mecha(this, 260, 1, 'blu', { ...MECHAS.blu.stats });
    this.p2 = new Mecha(this, 700, -1, 'red', { ...MECHAS.red.stats });
    this.p1.locked = this.p2.locked = true;
    this.createFloor();

    // 输入源
    this.inputSystem = new InputSystem(this);
    this.ai = this.mode === 'pve' ? new AIController(this.p2, this.p1) : null;

    this.createHUD();
    this.createEffects();

    // 开场流程
    this.banner('ROUND 1', 700);
    this.time.delayedCall(800, () => this.banner('FIGHT!', 600));
    this.time.delayedCall(1400, () => {
      this.phase = 'fight';
      this.p1.locked = this.p2.locked = false;
    });
  }

  // ---------- 视觉 ----------

  drawBackground() {
    this.add.image(0, 0, 'sky').setOrigin(0).setDisplaySize(VIEW.width, this.groundY).setDepth(0);

    // 闪烁星星
    for (let i = 0; i < 60; i++) {
      const star = this.add.image(
        Phaser.Math.Between(0, VIEW.width), Phaser.Math.Between(0, this.groundY - 90), 'star'
      ).setDepth(1).setAlpha(Phaser.Math.FloatBetween(0.3, 0.9));
      this.tweens.add({ targets: star, alpha: 0.1, duration: Phaser.Math.Between(600, 1800), yoyo: true, repeat: -1 });
    }

    // 城市剪影（两层）
    const far = this.add.graphics().setDepth(2).fillStyle(0x161c40, 1);
    const near = this.add.graphics().setDepth(3).fillStyle(0x10142e, 1);
    let x = 0;
    while (x < VIEW.width) {
      const w = Phaser.Math.Between(40, 90);
      const h = Phaser.Math.Between(40, 110);
      far.fillRect(x, this.groundY - h, w, h);
      if (Math.random() < 0.5) far.fillRect(x + w / 2 - 2, this.groundY - h - 12, 4, 12); // 天线
      x += w + Phaser.Math.Between(8, 30);
    }
    x = 0;
    while (x < VIEW.width) {
      const w = Phaser.Math.Between(60, 130);
      const h = Phaser.Math.Between(20, 60);
      near.fillRect(x, this.groundY - h, w, h);
      x += w + Phaser.Math.Between(20, 70);
    }

    // 地面
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0x1d2436, 1);
    g.fillRect(0, this.groundY, VIEW.width, VIEW.height - this.groundY);
    g.fillStyle(0x384286, 1);
    g.fillRect(0, this.groundY, VIEW.width, 4);
    g.fillStyle(0x2b3f66, 1);
    for (let px = 0; px < VIEW.width; px += 24) g.fillRect(px, this.groundY + 4, 12, 3);
  }

  createFloor() {
    const floor = this.add.rectangle(VIEW.width / 2, (this.groundY + VIEW.height) / 2, VIEW.width, VIEW.height - this.groundY);
    this.physics.add.existing(floor, true);
    this.physics.add.collider(this.p1, floor);
    this.physics.add.collider(this.p2, floor);
  }

  createEffects() {
    // 命中火花
    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 80, max: 260 },
      scale: { start: 2, end: 0 },
      lifespan: 320,
      quantity: 12,
      emitting: false
    }).setDepth(15);
  }

  createHUD() {
    this.hud = this.add.graphics().setDepth(20);
    const txt = (x, y, size, color, origin = 0.5) => this.add.text(x, y, '', {
      fontFamily: 'Courier New, monospace', fontSize: `${size}px`, fontStyle: 'bold',
      color, stroke: '#10141f', strokeThickness: 4
    }).setOrigin(origin, 0.5).setDepth(20);

    this.nameText1 = txt(40, 18, 14, '#8fb0f0', 0);
    this.nameText2 = txt(920, 18, 14, '#e08a74', 1);
    this.nameText1.setText(MECHAS.blu.name);
    this.nameText2.setText(MECHAS.red.name);
    this.timerText = txt(VIEW.width / 2, 34, 36, '#ffd75e');

    this.displayHp = { p1: this.p1.hp, p2: this.p2.hp };
  }

  banner(text, duration = 800) {
    const t = this.add.text(VIEW.width / 2, 220, text, {
      fontFamily: 'Courier New, monospace', fontSize: '56px', fontStyle: 'bold',
      color: '#ffd75e', stroke: '#10141f', strokeThickness: 10
    }).setOrigin(0.5).setDepth(30).setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'back.out' });
    this.time.delayedCall(duration, () => {
      this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
    });
  }

  drawHUD(dt) {
    const g = this.hud;
    g.clear();
    const barW = 300, barH = 14, enH = 8;

    // 延迟白条插值
    for (const key of ['p1', 'p2']) {
      const target = this[key].hp;
      this.displayHp[key] += (target - this.displayHp[key]) * Math.min(1, dt * 0.004);
      if (Math.abs(this.displayHp[key] - target) < 0.5) this.displayHp[key] = target;
    }

    // P1（左侧，从左向右）
    this.drawHpBar(g, 40, 28, barW, barH, this.p1, this.displayHp.p1, false, 0x8fb0f0);
    this.drawEnergyBar(g, 40, 46, barW, enH, this.p1, false, 0x4df0ff);
    // P2（右侧，从右向左）
    this.drawHpBar(g, 920 - barW, 28, barW, barH, this.p2, this.displayHp.p2, true, 0xe08a74);
    this.drawEnergyBar(g, 920 - barW, 46, barW, enH, this.p2, true, 0xffb03a);

    // 倒计时
    if (this.phase === 'fight') {
      const remain = Math.max(0, Math.ceil(COMBAT.roundTime - this.fightElapsed / 1000));
      this.timerText.setText(String(remain).padStart(2, '0'));
      if (remain <= 10) this.timerText.setColor('#ff4136');
    }
  }

  drawHpBar(g, x, y, w, h, mecha, displayHp, mirror, color) {
    g.fillStyle(0x10141f, 1);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    // 延迟白条
    const dw = (displayHp / mecha.maxHp) * w;
    g.fillStyle(0xffffff, 1);
    g.fillRect(mirror ? x + w - dw : x, y, dw, h);
    // 即时血条
    const hw = (mecha.hp / mecha.maxHp) * w;
    g.fillStyle(color, 1);
    g.fillRect(mirror ? x + w - hw : x, y, hw, h);
  }

  drawEnergyBar(g, x, y, w, h, mecha, mirror, color) {
    g.fillStyle(0x10141f, 1);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    const ew = (mecha.energy / COMBAT.energyMax) * w;
    const full = mecha.energy >= COMBAT.energyMax;
    g.fillStyle(color, full ? (this.time.now % 400 < 200 ? 1 : 0.55) : 0.9);
    g.fillRect(mirror ? x + w - ew : x, y, ew, h);
  }

  // ---------- 战斗逻辑 ----------

  update(time, delta) {
    const dt = delta;

    // 朝向对手（非攻击/防御/死亡时自动转向）
    if (this.phase === 'fight' || this.phase === 'sudden') {
      this.p1.faceToward(this.p2.x);
      this.p2.faceToward(this.p1.x);
    }

    // 采集输入
    const input1 = this.phase === 'fight' || this.phase === 'sudden' ? this.inputSystem.getState('p1') : null;
    let input2 = null;
    if (this.phase === 'fight' || this.phase === 'sudden') {
      input2 = this.ai ? this.ai.update(dt) : this.inputSystem.getState('p2');
    }

    // 实体更新
    this.p1.tick(dt, input1);
    this.p2.tick(dt, input2);

    // 命中判定
    if (this.phase === 'fight' || this.phase === 'sudden') {
      this.checkHit(this.p1, this.p2);
      this.checkHit(this.p2, this.p1);
    }

    // 计时
    if (this.phase === 'fight') {
      this.fightElapsed += dt;
      if (this.fightElapsed >= COMBAT.roundTime * 1000) this.onTimerEnd();
    }

    this.drawHUD(dt);

    // 胜负
    if (this.phase === 'fight' || this.phase === 'sudden') {
      if (this.p1.isDead || this.p2.isDead) this.onBattleEnd();
    }
  }

  checkHit(attacker, defender) {
    if (!attacker.isActiveWindow || defender.isDead) return;
    if (attacker.hitLanded) return; // 本次攻击已结算

    const box = attacker.getAttackBox();
    const bodyBox = defender.getBodyBox();
    if (!Phaser.Geom.Rectangle.Overlaps(box, bodyBox)) return;

    attacker.hitLanded = true;

    const isSpecial = attacker.state === 'special';
    const { damage, blocked } = resolveHit({
      damage: isSpecial ? attacker.stats.specialDamage : attacker.stats.damage,
      isSpecial,
      defenderDefending: defender.isDefending,
      defenderFacing: defender.facing,
      attackerX: attacker.x,
      defenderX: defender.x
    });

    const fromDir = attacker.x <= defender.x ? 1 : -1;
    defender.applyHit(damage, fromDir, blocked, isSpecial);

    // 能量结算
    attacker.energy = energyGain(attacker.energy, COMBAT.energyOnHit);
    defender.energy = energyGain(defender.energy, COMBAT.energyOnHurt);

    // 命中反馈
    const contactX = (attacker.x + defender.x) / 2;
    const contactY = defender.y - 50;
    this.sparks.emitParticleAt(contactX, contactY, blocked ? 6 : 14);
    if (isSpecial) this.shockwave(contactX, contactY);
    this.cameras.main.shake(isSpecial ? 200 : 100, isSpecial ? 0.012 : 0.005);
    if (blocked) this.cameras.main.flash(60, 255, 255, 255);
  }

  shockwave(x, y) {
    const circle = this.add.circle(x, y, 8).setStrokeStyle(4, 0xffd75e, 1).setDepth(14);
    this.tweens.add({
      targets: circle, radius: 90, alpha: 0, duration: 320,
      ease: 'cubic.out', onComplete: () => circle.destroy()
    });
  }

  onTimerEnd() {
    const result = resolveTimerEnd(this.p1.hp, this.p2.hp);
    if (result === 'sudden') {
      this.phase = 'sudden';
      this.suddenDeath = true;
      this.p1.hp = 1;
      this.p2.hp = 1;
      this.timerText.setText('!!');
      this.banner('SUDDEN DEATH!', 1200);
      this.cameras.main.flash(200, 255, 215, 94);
    } else {
      this.onBattleEnd(result);
    }
  }

  onBattleEnd(forcedWinner = null) {
    if (this.phase === 'end') return;
    this.phase = 'end';
    this.p1.locked = this.p2.locked = true;

    const winner = forcedWinner
      ? (forcedWinner === 'A' ? this.p1 : this.p2)
      : (this.p1.isDead ? this.p2 : this.p1);

    this.time.delayedCall(1300, () => {
      this.scene.start(SCENE.GAMEOVER, {
        winnerName: winner === this.p1 ? MECHAS.blu.name : MECHAS.red.name,
        paletteKey: winner === this.p1 ? 'blu' : 'red'
      });
    });
  }
}
