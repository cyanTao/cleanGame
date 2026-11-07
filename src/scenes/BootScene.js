// ===== 启动场景：生成全部程序化纹理与动画 =====
import Phaser from 'phaser';
import { SCENE } from '../config.js';
import { createGameTextures } from '../systems/TextureFactory.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.BOOT);
  }

  create() {
    createGameTextures(this);

    this.anims.create({
      key: 'explode',
      frames: [0, 1, 2, 3, 4].map((i) => ({ key: `explosion_${i}` })),
      frameRate: 20,
      hideOnComplete: true
    });

    const required = [
      'bg_space', 'stars_far', 'stars_near', 'vignette',
      'player', 'flame', 'shield',
      'enemy_scout', 'enemy_striker', 'enemy_tank', 'boss',
      'bullet_player', 'bullet_enemy', 'bullet_boss', 'laser_beam',
      'explosion_0', 'explosion_4', 'spark', 'glow', 'shockwave',
      'powerup_power', 'powerup_shield', 'powerup_bomb', 'powerup_laser',
      'icon_life', 'icon_bomb', 'btn_bomb'
    ];
    for (const key of required) {
      if (!this.textures.exists(key)) {
        throw new Error(`纹理自检失败：${key}`);
      }
    }

    this.scene.start(SCENE.TITLE);
  }
}
