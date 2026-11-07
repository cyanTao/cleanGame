// ===== 标题场景 =====
import Phaser from 'phaser';
import { SCENE, VIEW, FONT, COLORS } from '../config.js';
import { loadBest, formatScore } from '../systems/gameLogic.js';
import { sfx } from '../systems/SoundFX.js';
import { createButton, createIconButton } from '../systems/ui.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SCENE.TITLE);
  }

  create() {
    this.starting = false;

    this.add.image(0, 0, 'bg_space').setOrigin(0).setDepth(0);
    this.starsFar = this.add.tileSprite(0, 0, VIEW.width, VIEW.height, 'stars_far')
      .setOrigin(0).setDepth(1).setAlpha(0.72);
    this.starsNear = this.add.tileSprite(0, 0, VIEW.width, VIEW.height, 'stars_near')
      .setOrigin(0).setDepth(2).setAlpha(0.95);
    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(3);

    this.time.addEvent({ delay: 1200, loop: true, callback: this.flyBy, callbackScope: this });
    this.flyBy();

    this.createHero();
    this.createTitle();
    this.createPowerupHints();

    // 最高分
    const best = loadBest();
    this.add.text(VIEW.width / 2, 606, '最高分  BEST', {
      fontFamily: FONT, fontSize: '13px', color: '#7f8db4'
    }).setOrigin(0.5).setDepth(20);
    this.add.text(VIEW.width / 2, 632, formatScore(best), {
      fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#ffd75e'
    }).setOrigin(0.5).setDepth(20);

    createButton(this, {
      x: VIEW.width / 2, y: 700, w: 286, h: 64,
      label: '开 始 游 戏', fontSize: 26, depth: 30,
      onClick: () => this.startGame()
    });

    const hints = [
      '拖动屏幕 / 方向键 / WASD 移动 · 自动开火',
      'K 或右下 BOMB 清屏 · P 暂停 · M 静音',
      '每 60 秒迎战 BOSS · 挑战你的最高分'
    ];
    hints.forEach((line, i) => {
      this.add.text(VIEW.width / 2, 842 + i * 24, line, {
        fontFamily: FONT, fontSize: '13px', color: '#8fa3c8'
      }).setOrigin(0.5).setDepth(20);
    });

    this.muteBtn = createIconButton(this, VIEW.width - 40, 30, this.muteLabel(), () => {
      sfx.toggleMute();
      this.muteBtn.setText(this.muteLabel());
    }, 40);

    this.input.keyboard.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard.on('keydown-SPACE', () => this.startGame());
    this.input.keyboard.on('keydown-M', () => {
      sfx.toggleMute();
      this.muteBtn.setText(this.muteLabel());
    });

    // 点击屏幕任意位置开始（右上角音效按钮除外）
    this.input.on('pointerdown', (pointer) => {
      if (pointer.y < 70 && pointer.x > VIEW.width - 140) return;
      this.startGame();
    });

    this.cameras.main.fadeIn(260, 0, 0, 0);
  }

  muteLabel() {
    return sfx.muted ? '音效 关' : '音效 开';
  }

  createHero() {
    const hero = this.add.container(VIEW.width / 2, 508).setDepth(10);
    const glow = this.add.image(0, 0, 'glow')
      .setScale(2.6).setAlpha(0.34).setBlendMode(Phaser.BlendModes.ADD);
    const ship = this.add.image(0, 0, 'player').setScale(1.85);
    const flame = this.add.image(0, 34 * 1.85, 'flame')
      .setScale(1.5).setBlendMode(Phaser.BlendModes.ADD);
    hero.add([glow, flame, ship]);

    this.tweens.add({
      targets: hero, y: 492, duration: 1700, yoyo: true, repeat: -1, ease: 'sine.inout'
    });
    this.tweens.add({
      targets: flame, scaleY: 2.1, alpha: 0.72,
      duration: 130, yoyo: true, repeat: -1, ease: 'sine.inout'
    });
  }

  createTitle() {
    const cx = VIEW.width / 2;

    const glow = this.add.text(cx, 208, '飞机大战', {
      fontFamily: FONT, fontSize: '78px', fontStyle: 'bold', color: '#63f2ff'
    }).setOrigin(0.5).setDepth(8).setAlpha(0.32).setBlendMode(Phaser.BlendModes.ADD);
    glow.setShadow(0, 0, '#63f2ff', 34, true, true);

    this.add.text(cx, 208, '飞机大战', {
      fontFamily: FONT, fontSize: '78px', fontStyle: 'bold',
      color: '#f2feff', stroke: '#07122e', strokeThickness: 12
    }).setOrigin(0.5).setDepth(9).setShadow(0, 0, '#3de8ff', 20, true, true);

    this.add.text(cx, 276, 'S K Y   S T R I K E', {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#6ea8ff'
    }).setOrigin(0.5).setDepth(9);

    const line = this.add.graphics().setDepth(9);
    line.lineStyle(2, 0x3d7bff, 0.6);
    line.lineBetween(70, 276, 150, 276);
    line.lineBetween(VIEW.width - 150, 276, VIEW.width - 70, 276);
  }

  createPowerupHints() {
    const items = [
      { x: 152, key: 'powerup_power', label: '强化火力', color: '#63f2ff' },
      { x: 270, key: 'powerup_shield', label: '能量护盾', color: '#7ea8ff' },
      { x: 388, key: 'powerup_bomb', label: '清屏炸弹', color: '#ffd75e' }
    ];
    items.forEach((it) => {
      this.add.image(it.x, 770, it.key).setScale(0.78).setDepth(20);
      this.add.text(it.x, 796, it.label, {
        fontFamily: FONT, fontSize: '12px', color: it.color
      }).setOrigin(0.5).setDepth(20);
    });
  }

  flyBy() {
    if (!this.scene.isActive()) return;
    const keys = ['enemy_scout', 'enemy_striker', 'enemy_tank'];
    const key = Phaser.Utils.Array.GetRandom(keys);
    const img = this.add.image(
      Phaser.Math.Between(40, VIEW.width - 40), -80, key
    ).setScale(0.62).setAlpha(0.28).setDepth(4).setAngle(180);

    this.tweens.add({
      targets: img,
      y: VIEW.height + 100,
      x: img.x + Phaser.Math.Between(-70, 70),
      angle: 180 + Phaser.Math.Between(-30, 30),
      duration: Phaser.Math.Between(4200, 6800),
      ease: 'linear',
      onComplete: () => img.destroy()
    });
  }

  startGame() {
    if (this.starting) return;
    this.starting = true;
    sfx.unlock();
    sfx.play('start');
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE.BATTLE);
    });
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.starsFar.tilePositionY -= 18 * dt;
    this.starsNear.tilePositionY -= 54 * dt;
  }
}
