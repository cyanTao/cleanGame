// ===== 标题场景：模式选择（键盘 / 点击） =====
import Phaser from 'phaser';
import { SCENE, MECHAS, VIEW } from '../config.js';
import { SPRITE_SCALE } from '../data/sprites.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super(SCENE.TITLE); }

  create() {
    this.add.image(0, 0, 'sky').setOrigin(0).setDisplaySize(VIEW.width, VIEW.groundY);
    this.spawnStars();

    // 标题
    this.add.text(VIEW.width / 2, 96, '机甲擂台', {
      fontFamily: 'Courier New, monospace', fontSize: '64px', fontStyle: 'bold',
      color: '#ffd75e', stroke: '#10141f', strokeThickness: 8
    }).setOrigin(0.5).setDepth(20);
    this.add.text(VIEW.width / 2, 148, 'MECHA ARENA', {
      fontFamily: 'Courier New, monospace', fontSize: '22px', fontStyle: 'bold',
      color: '#8fb0f0', stroke: '#10141f', strokeThickness: 4
    }).setOrigin(0.5).setDepth(20);

    // 两台机甲展示（浮动）
    const blu = this.add.image(260, VIEW.groundY, 'blu_idle')
      .setOrigin(0.5, 1).setScale(SPRITE_SCALE + 1).setDepth(10);
    const red = this.add.image(700, VIEW.groundY, 'red_idle')
      .setOrigin(0.5, 1).setScale(SPRITE_SCALE + 1).setDepth(10).setFlipX(true);
    this.tweens.add({ targets: blu, y: VIEW.groundY - 6, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inout' });
    this.tweens.add({ targets: red, y: VIEW.groundY - 6, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inout', delay: 250 });

    // 地面
    this.drawGround();

    // 菜单（键盘数字 / 点击均可）
    const mkMenu = (y, label, mode) => {
      const t = this.add.text(VIEW.width / 2, y, label, {
        fontFamily: 'Courier New, monospace', fontSize: '28px', fontStyle: 'bold',
        color: '#ffffff', backgroundColor: '#161c40', padding: { x: 18, y: 8 }
      }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#ffd75e'));
      t.on('pointerout', () => t.setColor('#ffffff'));
      t.on('pointerdown', () => this.scene.start(SCENE.BATTLE, { mode }));
    };
    mkMenu(268, '[1] 人机对战', 'pve');
    mkMenu(324, '[2] 双人对战', 'pvp');

    // 操作说明（触屏 / 键盘通用）
    const help = [
      `P1 ${MECHAS.blu.name}：A/D 移动  W 跳  J 攻击  K 防御  L 必杀（或点击屏幕按钮）`,
      `P2 ${MECHAS.red.name}：←/→ 移动  ↑ 跳  1 攻击  2 防御  3 必杀`,
      '能量满 100 可释放必杀 · 防御减伤 75% · 60 秒倒计时 HP 高者胜'
    ];
    help.forEach((line, i) => {
      this.add.text(VIEW.width / 2, 400 + i * 22, line, {
        fontFamily: 'Courier New, monospace', fontSize: '14px', color: '#aebcd4'
      }).setOrigin(0.5).setDepth(20);
    });

    this.keys = this.input.keyboard.addKeys('ONE,TWO,NUMPAD_ONE,NUMPAD_TWO');
  }

  spawnStars() {
    for (let i = 0; i < 70; i++) {
      const star = this.add.image(
        Phaser.Math.Between(0, VIEW.width),
        Phaser.Math.Between(0, VIEW.groundY - 80), 'star'
      ).setDepth(1).setAlpha(Phaser.Math.FloatBetween(0.3, 0.9));
      this.tweens.add({
        targets: star, alpha: 0.1, duration: Phaser.Math.Between(600, 1800),
        yoyo: true, repeat: -1
      });
    }
  }

  drawGround() {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x1d2436, 1);
    g.fillRect(0, VIEW.groundY, VIEW.width, VIEW.height - VIEW.groundY);
    g.fillStyle(0x384286, 1);
    g.fillRect(0, VIEW.groundY, VIEW.width, 4);
    g.fillStyle(0x2b3f66, 1);
    for (let x = 0; x < VIEW.width; x += 24) g.fillRect(x, VIEW.groundY + 4, 12, 3);
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE) || Phaser.Input.Keyboard.JustDown(this.keys.NUMPAD_ONE)) {
      this.scene.start(SCENE.BATTLE, { mode: 'pve' });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO) || Phaser.Input.Keyboard.JustDown(this.keys.NUMPAD_TWO)) {
      this.scene.start(SCENE.BATTLE, { mode: 'pvp' });
    }
  }
}
