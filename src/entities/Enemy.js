// ===== 敌机：侦察机 / 突击机 / 重装机 / Boss =====
import Phaser from 'phaser';
import { ENEMY, VIEW } from '../config.js';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemy_scout');
    this.setActive(false).setVisible(false);
  }

  spawn(type, x, y, opts = {}) {
    const cfg = ENEMY[type];
    this.enemyType = type;
    this.dying = false;
    this.setTexture(cfg.texture);
    this.enableBody(true, x, y, true, true);
    this.clearTint();
    this.setAlpha(1);
    this.setDepth(type === 'boss' ? 9 : 10);
    this.setScale(1);

    this.hp = opts.hp || cfg.hp;
    this.maxHp = this.hp;
    this.speedMul = opts.speedMul || 1;
    this.baseX = x;
    this.spawnedAt = this.scene.time.now;
    this.phase = Math.random() * Math.PI * 2;
    this.fireAcc = 0;
    this.stopY = opts.stopY || 210;
    this.attackInterval = 850;
    this.bossAttackAcc = 0;
    this.patternIndex = 0;

    const r = cfg.radius;
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r);

    if (type === 'boss') {
      this.setVelocity(0, 90);
    } else {
      this.setVelocity(0, cfg.speed * this.speedMul);
    }
    return this;
  }

  update(time, delta) {
    if (!this.active || this.scene.paused) return;

    const t = time - this.spawnedAt;
    const cfg = ENEMY[this.enemyType];

    if (this.enemyType === 'scout') {
      this.setVelocityY(cfg.speed * this.speedMul);
      this.x = Phaser.Math.Clamp(this.baseX + Math.sin(t / 320 + this.phase) * 28, 18, VIEW.width - 18);
    } else if (this.enemyType === 'striker') {
      if (this.y < this.stopY) {
        this.setVelocityY(cfg.speed * this.speedMul);
      } else {
        this.setVelocityY(16);
        this.x = Phaser.Math.Clamp(this.baseX + Math.sin(t / 700 + this.phase) * 74, 30, VIEW.width - 30);
      }
      this.tryFire(delta, cfg, () => this.scene.enemyAimedShot(this));
    } else if (this.enemyType === 'tank') {
      if (this.y < this.stopY) {
        this.setVelocityY(cfg.speed * this.speedMul);
      } else {
        this.setVelocityY(0);
        this.x = Phaser.Math.Clamp(this.baseX + Math.sin(t / 900 + this.phase) * 56, 40, VIEW.width - 40);
      }
      this.tryFire(delta, cfg, () => this.scene.enemyFanShot(this));
    } else if (this.enemyType === 'boss') {
      this.updateBoss(time, delta, t);
    }

    if (this.y > VIEW.height + 100) {
      this.disableBody(true, true);
    }
  }

  updateBoss(time, delta, t) {
    if (this.y < 155) {
      this.x = VIEW.width / 2;
      this.setVelocity(0, 90);
      return;
    }
    this.setVelocity(0, 0);
    this.x = VIEW.width / 2 + Math.sin(t / 1200) * 142;

    const enraged = this.hp < this.maxHp * 0.5;
    const base = this.scene.bossAttackMs || 820;
    this.attackInterval = enraged ? Math.round(base * 0.68) : base;
    this.bossAttackAcc += delta;
    if (this.bossAttackAcc >= this.attackInterval) {
      this.bossAttackAcc = 0;
      this.scene.bossAttack(this);
    }
  }

  tryFire(delta, cfg, shoot) {
    if (!cfg.fire || this.y < 70) return;
    const player = this.scene.player;
    if (!player || !player.alive) return;
    this.fireAcc += delta;
    if (this.fireAcc >= cfg.fire * (this.scene.fireIntervalMul || 1)) {
      this.fireAcc = 0;
      shoot();
    }
  }

  /** 受伤：返回是否击毁 */
  hit(damage) {
    if (!this.active || this.dying) return false;
    this.hp -= damage;
    if (this.hp <= 0) {
      this.dying = true;
      this.scene.onEnemyDestroyed(this);
      this.disableBody(true, true);
      return true;
    }
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(45, () => {
      if (this.active) this.clearTint();
    });
    return false;
  }
}
