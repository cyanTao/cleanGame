// ===== 玩家战机：移动、尾焰、无敌帧、护盾 =====
import Phaser from 'phaser';
import { PLAYER, VIEW } from '../config.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(20);
    this.setCollideWorldBounds(true);
    this.body.setCircle(
      PLAYER.hitRadius,
      this.width / 2 - PLAYER.hitRadius,
      this.height / 2 - PLAYER.hitRadius
    );

    this.flame = scene.add.image(x, y + 34, 'flame')
      .setDepth(19)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.shieldSprite = scene.add.image(x, y, 'shield')
      .setDepth(22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setVisible(false);

    this.invulnUntil = 0;
    this.shieldUntil = 0;
    this.laserUntil = 0;
    this.alive = true;
  }

  updateMovement(time, input) {
    if (!this.alive) return;

    const vec = input.getMoveVector();
    const target = input.getPointerTarget();

    if (vec.x !== 0 || vec.y !== 0) {
      this.setVelocity(vec.x * PLAYER.speed, vec.y * PLAYER.speed);
    } else if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        const speed = Math.min(PLAYER.pointerSpeed, dist * 14);
        this.setVelocity((dx / dist) * speed, (dy / dist) * speed);
      } else {
        this.setVelocity(0, 0);
      }
    } else {
      this.setVelocity(0, 0);
    }

    // 尾焰
    const flicker = 0.82 + Math.random() * 0.32;
    this.flame.setPosition(this.x, this.y + 34);
    this.flame.setScale(0.9 + Math.random() * 0.18, flicker);
    this.flame.setVisible(this.visible);
    this.flame.setAlpha(0.88);

    // 转向倾斜
    const vx = this.body.velocity.x;
    this.setAngle(Phaser.Math.Clamp(vx * 0.035, -13, 13));

    // 无敌闪烁
    if (time < this.invulnUntil) {
      this.setAlpha(Math.floor(time / 70) % 2 === 0 ? 1 : 0.32);
    } else {
      this.setAlpha(1);
    }

    // 护盾
    const shielded = time < this.shieldUntil;
    this.shieldSprite.setVisible(shielded);
    if (shielded) {
      this.shieldSprite.setPosition(this.x, this.y);
      this.shieldSprite.setAlpha(0.55 + Math.sin(time / 110) * 0.18);
      this.shieldSprite.setScale(0.92 + Math.sin(time / 180) * 0.05);
    }
  }

  isInvulnerable(time) {
    return !this.alive || time < this.invulnUntil;
  }

  hasShield(time) {
    return time < this.shieldUntil;
  }

  activateShield(time, duration) {
    this.shieldUntil = Math.max(this.shieldUntil, time + duration);
  }

  hasLaser(time) {
    return this.alive && time < this.laserUntil;
  }

  activateLaser(time, duration) {
    this.laserUntil = Math.max(this.laserUntil, time + duration);
  }

  /** 被击中隐身，等待复活 */
  hide() {
    this.alive = false;
    this.setActive(false).setVisible(false);
    this.setVelocity(0, 0);
    if (this.body) this.body.enable = false;
    this.flame.setVisible(false);
    this.shieldSprite.setVisible(false);
    this.shieldUntil = 0;
    this.laserUntil = 0;
    this.setAngle(0);
    this.setAlpha(1);
  }

  /** 复活 / 重置位置 */
  reveal(x, y, time, invulnMs) {
    this.alive = true;
    this.setActive(true).setVisible(true);
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    if (this.body) this.body.enable = true;
    this.invulnUntil = time + invulnMs;
    this.setAlpha(1);
    this.flame.setVisible(true);
  }

  /** 回到初始位置（重开时） */
  resetPosition(x, y) {
    this.setPosition(Phaser.Math.Clamp(x, 30, VIEW.width - 30), y);
    this.setVelocity(0, 0);
  }
}
