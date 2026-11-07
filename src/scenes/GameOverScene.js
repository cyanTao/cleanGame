// ===== 结算场景 =====
import Phaser from 'phaser';
import { SCENE, VIEW, FONT, COLORS } from '../config.js';
import { formatScore, formatTime } from '../systems/gameLogic.js';
import { sfx } from '../systems/SoundFX.js';
import { createButton } from '../systems/ui.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SCENE.GAMEOVER);
  }

  init(data) {
    this.result = {
      score: 0,
      kills: 0,
      time: 0,
      best: 0,
      newBest: false,
      ...data
    };
  }

  create() {
    this.starting = false;

    this.add.image(0, 0, 'bg_space').setOrigin(0).setDepth(0);
    this.starsFar = this.add.tileSprite(0, 0, VIEW.width, VIEW.height, 'stars_far')
      .setOrigin(0).setDepth(1).setAlpha(0.6);
    this.starsNear = this.add.tileSprite(0, 0, VIEW.width, VIEW.height, 'stars_near')
      .setOrigin(0).setDepth(2).setAlpha(0.9);
    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(3);

    // 背景残骸
    for (let i = 0; i < 3; i++) {
      const x = Phaser.Math.Between(70, VIEW.width - 70);
      const y = Phaser.Math.Between(120, 360);
      const fx = this.add.sprite(x, y, 'explosion_0')
        .setDepth(4).setScale(1.2).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
      fx.play({ key: 'explode', delay: i * 700, repeat: -1, repeatDelay: 1600 });
    }

    const glow = this.add.text(VIEW.width / 2, 176, 'GAME OVER', {
      fontFamily: FONT, fontSize: '58px', fontStyle: 'bold', color: '#ff5a5a'
    }).setOrigin(0.5).setDepth(9).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD);
    glow.setShadow(0, 0, '#ff5a5a', 34, true, true);

    this.add.text(VIEW.width / 2, 176, 'GAME OVER', {
      fontFamily: FONT, fontSize: '58px', fontStyle: 'bold',
      color: '#ffe9e9', stroke: '#2a0509', strokeThickness: 10
    }).setOrigin(0.5).setDepth(10).setShadow(0, 0, '#ff5a5a', 18, true, true);

    this.add.text(VIEW.width / 2, 232, '任务失败 · 战机已全部损毁', {
      fontFamily: FONT, fontSize: '15px', color: '#9fb0d4'
    }).setOrigin(0.5).setDepth(10);

    this.drawPanel();

    if (this.result.newBest) {
      const badge = this.add.text(VIEW.width / 2, 424, '★ NEW RECORD ★', {
        fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffd75e',
        stroke: '#2a1c02', strokeThickness: 4
      }).setOrigin(0.5).setDepth(12);
      this.tweens.add({
        targets: badge, alpha: 0.35, scale: 1.06,
        duration: 520, yoyo: true, repeat: -1, ease: 'sine.inout'
      });
    }

    this.drawStats();
    this.drawButtons();
    this.bindKeys();

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  drawPanel() {
    const g = this.add.graphics().setDepth(11);
    g.fillStyle(0x070d20, 0.86);
    g.fillRoundedRect(70, 274, VIEW.width - 140, 190, 16);
    g.lineStyle(2, 0x3d7bff, 0.55);
    g.strokeRoundedRect(70, 274, VIEW.width - 140, 190, 16);
    g.lineStyle(1, 0x63f2ff, 0.18);
    g.strokeRoundedRect(76, 280, VIEW.width - 152, 178, 12);

    this.add.text(VIEW.width / 2, 300, '本局得分', {
      fontFamily: FONT, fontSize: '13px', color: '#7f8db4'
    }).setOrigin(0.5).setDepth(12);

    this.add.text(VIEW.width / 2, 350, formatScore(this.result.score), {
      fontFamily: FONT, fontSize: '58px', fontStyle: 'bold', color: '#eafcff'
    }).setOrigin(0.5).setDepth(12).setShadow(0, 0, '#3de8ff', 16, true, true);
  }

  drawStats() {
    const rows = [
      ['击毁敌机', `${this.result.kills}`],
      ['生存时间', formatTime(this.result.time)],
      ['历史最高', formatScore(this.result.best)]
    ];
    rows.forEach(([label, value], i) => {
      const y = 500 + i * 46;
      this.add.text(120, y, label, {
        fontFamily: FONT, fontSize: '16px', color: '#8fa3c8'
      }).setOrigin(0, 0.5).setDepth(12);
      this.add.text(VIEW.width - 120, y, value, {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#dfe9ff'
      }).setOrigin(1, 0.5).setDepth(12);
      const line = this.add.graphics().setDepth(11);
      line.lineStyle(1, 0x22325c, 0.7);
      line.lineBetween(120, y + 23, VIEW.width - 120, y + 23);
    });
  }

  drawButtons() {
    createButton(this, {
      x: VIEW.width / 2, y: 688, w: 286, h: 62,
      label: '再 来 一 局', fontSize: 25, depth: 20,
      onClick: () => this.restart()
    });

    createButton(this, {
      x: VIEW.width / 2, y: 766, w: 286, h: 56,
      label: '返 回 标 题', color: COLORS.gold, fontSize: 21, depth: 20,
      onClick: () => this.toTitle()
    });

    this.add.text(VIEW.width / 2, 878, '按 R / Enter 重新开始 · Esc 返回标题', {
      fontFamily: FONT, fontSize: '13px', color: '#7f8db4'
    }).setOrigin(0.5).setDepth(12);
  }

  bindKeys() {
    this.input.keyboard.on('keydown-R', () => this.restart());
    this.input.keyboard.on('keydown-ENTER', () => this.restart());
    this.input.keyboard.on('keydown-ESC', () => this.toTitle());
  }

  restart() {
    if (this.starting) return;
    this.starting = true;
    sfx.unlock();
    sfx.play('start');
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE.BATTLE);
    });
  }

  toTitle() {
    if (this.starting) return;
    this.starting = true;
    sfx.play('ui');
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE.TITLE);
    });
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.starsFar.tilePositionY -= 16 * dt;
    this.starsNear.tilePositionY -= 46 * dt;
  }
}
