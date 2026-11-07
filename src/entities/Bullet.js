// ===== 子弹（玩家 / 敌机共用，对象池复用） =====
import Phaser from 'phaser';
import { VIEW } from '../config.js';

export class Bullet extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y) {
    super(scene, x, y, 'bullet_player');
    this.setActive(false).setVisible(false);
  }

  fire(x, y, vx, vy, texture = 'bullet_player', scale = 1) {
    this.setTexture(texture);
    this.setScale(scale);
    this.enableBody(true, x, y, true, true);
    this.setDepth(texture === 'bullet_player' ? 21 : 12);
    this.setBlendMode(Phaser.BlendModes.ADD);
    this.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    this.setVelocity(vx, vy);
    return this;
  }

  update() {
    if (!this.active) return;
    if (this.y < -50 || this.y > VIEW.height + 50 || this.x < -50 || this.x > VIEW.width + 50) {
      this.disableBody(true, true);
    }
  }
}
