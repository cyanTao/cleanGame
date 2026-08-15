// ===== 入口：Phaser.Game 配置 =====
import Phaser from 'phaser';
import { VIEW, PHYSICS, SCENE } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: '#06070f',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: PHYSICS.gravity },
      debug: false
    }
  },
  scene: [BootScene, TitleScene, BattleScene, GameOverScene]
});

window.game = game; // 调试/自动化测试入口
