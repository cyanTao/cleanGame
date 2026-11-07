// ===== 道具：力量 / 护盾 / 炸弹 =====
import Phaser from 'phaser';
import { VIEW } from '../config.js';

export class Powerup extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y) {
    super(scene, x, y, 'powerup_power');
    this.setActive(false).setVisible(false);
  }

  spawn(x, y, type) {
    this.powerType = type;
    this.setTexture(`powerup_${type}`);
    this.enableBody(true, x, y, true, true);
    this.setDepth(15);
    this.setBlendMode(Phaser.BlendModes.NORMAL);
    this.body.setCircle(17, this.width / 2 - 17, this.height / 2 - 17);
    this.baseX = x;
    this.spawnedAt = this.scene.time.now;
    this.setVelocity(0, 82);
    this.setScale(1);
    this.setAlpha(1);
    return this;
  }

  update(time) {
    if (!this.active || this.scene.paused) return;
    this.x = this.baseX + Math.sin((time - this.spawnedAt) / 420) * 16;
    const pulse = 1 + Math.sin((time - this.spawnedAt) / 160) * 0.06;
    this.setScale(pulse);
    if (this.y > VIEW.height + 40) this.disableBody(true, true);
  }
}
