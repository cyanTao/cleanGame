// ===== 通用 UI：霓虹按钮 =====
import Phaser from 'phaser';
import { FONT, COLORS } from '../config.js';
import { sfx } from './SoundFX.js';

export function createButton(scene, opts) {
  const {
    x, y, w = 250, h = 58,
    label, color = COLORS.cyan, onClick,
    depth = 200, fontSize = 24
  } = opts;

  const container = scene.add.container(x, y).setDepth(depth).setAlpha(1);
  const bg = scene.add.graphics();
  const text = scene.add.text(0, 0, label, {
    fontFamily: FONT,
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
    color: '#eafcff',
    stroke: '#06101f',
    strokeThickness: 4
  }).setOrigin(0.5);

  const draw = (hover) => {
    bg.clear();
    bg.fillStyle(hover ? 0x1b2a58 : 0x0c1430, 0.94);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.lineStyle(2, color, hover ? 1 : 0.62);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    if (hover) {
      bg.lineStyle(1, 0xffffff, 0.22);
      bg.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 9);
    }
  };
  draw(false);

  container.add([bg, text]);
  container.setSize(w, h);
  // Container 的输入热区需以中心为原点，否则只有右下半区可点击
  container.setInteractive(
    new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
    Phaser.Geom.Rectangle.Contains
  );
  if (container.input) container.input.cursor = 'pointer';
  container.on('pointerover', () => draw(true));
  container.on('pointerout', () => draw(false));
  container.on('pointerdown', () => {
    draw(false);
    sfx.play('ui');
    if (onClick) onClick();
  });
  return container;
}

/** 顶部小图标按钮（暂停 / 静音） */
export function createIconButton(scene, x, y, label, onClick, depth = 110) {
  const text = scene.add.text(x, y, label, {
    fontFamily: FONT,
    fontSize: '18px',
    fontStyle: 'bold',
    color: '#cfe2ff',
    backgroundColor: 'rgba(12, 20, 44, 0.85)',
    padding: { x: 10, y: 6 }
  }).setOrigin(0.5).setDepth(depth).setInteractive({ useHandCursor: true });

  text.on('pointerover', () => text.setColor('#ffffff'));
  text.on('pointerout', () => text.setColor('#cfe2ff'));
  text.on('pointerdown', (pointer, localX, localY, event) => {
    if (event) event.stopPropagation();
    sfx.play('ui');
    if (onClick) onClick();
  });
  return text;
}
