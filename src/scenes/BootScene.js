// ===== 启动场景：程序化生成全部纹理 =====
import Phaser from 'phaser';
import { SCENE, PALETTES } from '../config.js';
import { MECHA_FRAMES, SPARK, SPARK_PALETTE } from '../data/sprites.js';
import { registerCharArt, registerPoseDict, registerSkyGradient, registerStar } from '../systems/TextureFactory.js';

export class BootScene extends Phaser.Scene {
  constructor() { super(SCENE.BOOT); }

  create() {
    // 两台机甲：同一套字符画 + 不同调色板
    for (const key of Object.keys(PALETTES)) {
      registerPoseDict(this, key, MECHA_FRAMES, PALETTES[key]);
    }
    // 火花与星星
    registerCharArt(this, 'spark', [SPARK], SPARK_PALETTE);
    registerStar(this, 'star');
    // 夜空渐变（16-bit 多层色带）
    registerSkyGradient(this, 'sky', 480, [
      '#070812', '#0b0d1f', '#10142e', '#161c40',
      '#1d2550', '#252e62', '#2e3874', '#384286'
    ]);

    // 自检：关键纹理必须存在
    const required = ['blu_idle', 'red_idle', 'blu_attackB', 'red_defend', 'blu_dead', 'spark', 'sky', 'star'];
    for (const key of required) {
      if (!this.textures.exists(key)) {
        throw new Error(`纹理自检失败：${key}`);
      }
    }

    this.scene.start(SCENE.TITLE);
  }
}
