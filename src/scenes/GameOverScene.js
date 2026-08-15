// ===== 结算场景 =====
import Phaser from 'phaser';
import { SCENE, VIEW } from '../config.js';
import { SPRITE_SCALE } from '../data/sprites.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super(SCENE.GAMEOVER); }

  init(data) {
    this.winnerName = data.winnerName || '???';
    this.paletteKey = data.paletteKey || 'blu';
  }

  create() {
    this.add.image(0, 0, 'sky').setOrigin(0).setDisplaySize(VIEW.width, VIEW.groundY);

    for (let i = 0; i < 50; i++) {
      const star = this.add.image(
        Phaser.Math.Between(0, VIEW.width), Phaser.Math.Between(0, VIEW.groundY - 80), 'star'
      ).setDepth(1).setAlpha(Phaser.Math.FloatBetween(0.3, 0.9));
      this.tweens.add({ targets: star, alpha: 0.1, duration: Phaser.Math.Between(600, 1800), yoyo: true, repeat: -1 });
    }

    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x1d2436, 1);
    g.fillRect(0, VIEW.groundY, VIEW.width, VIEW.height - VIEW.groundY);
    g.fillStyle(0x384286, 1);
    g.fillRect(0, VIEW.groundY, VIEW.width, 4);

    // 胜者机甲
    const winner = this.add.image(VIEW.width / 2, VIEW.groundY, `${this.paletteKey}_idle`)
      .setOrigin(0.5, 1).setScale(SPRITE_SCALE + 2).setDepth(10);
    this.tweens.add({ targets: winner, y: VIEW.groundY - 10, duration: 800, yoyo: true, repeat: -1, ease: 'sine.inout' });

    this.add.text(VIEW.width / 2, 110, 'WINNER', {
      fontFamily: 'Courier New, monospace', fontSize: '30px', fontStyle: 'bold',
      color: '#ffd75e', stroke: '#10141f', strokeThickness: 6
    }).setOrigin(0.5).setDepth(20);
    this.add.text(VIEW.width / 2, 150, this.winnerName, {
      fontFamily: 'Courier New, monospace', fontSize: '40px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#10141f', strokeThickness: 8
    }).setOrigin(0.5).setDepth(20);

    const restart = this.add.text(VIEW.width / 2, 505, '按 R 或点击返回标题', {
      fontFamily: 'Courier New, monospace', fontSize: '22px', fontStyle: 'bold',
      color: '#8fb0f0', stroke: '#10141f', strokeThickness: 4
    }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: restart, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    restart.on('pointerdown', () => this.scene.start(SCENE.TITLE));

    this.keyR = this.input.keyboard.addKey('R');
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
      this.scene.start(SCENE.TITLE);
    }
  }
}
