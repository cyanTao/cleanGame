// ===== 统一输入：键盘 / 指针拖动 =====
import Phaser from 'phaser';
import { VIEW } from '../config.js';

export function isTouchDevice() {
  return typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

/**
 * 键盘：方向键 / WASD 移动，K/X 炸弹，P 暂停，M 静音
 * 指针：按住并拖动即可移动战机（相对屏幕绝对跟随，手指上方偏移避免遮挡）
 */
export class InputSystem {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;
    this.pointerTarget = null;
    this.blocks = [];

    this.keys = scene.input.keyboard.addKeys({
      up: 'UP',
      down: 'DOWN',
      left: 'LEFT',
      right: 'RIGHT',
      w: 'W',
      a: 'A',
      s: 'S',
      d: 'D',
      bomb: 'K',
      bombAlt: 'X',
      pause: 'P',
      mute: 'M'
    });

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  /** 屏蔽 UI 按钮区域，避免拖动战机时误触 */
  addBlockCircle(x, y, r) {
    this.blocks.push({ type: 'circle', x, y, r });
  }

  addBlockRect(x, y, w, h) {
    this.blocks.push({ type: 'rect', x, y, w, h });
  }

  isBlocked(x, y) {
    return this.blocks.some((b) => {
      if (b.type === 'circle') {
        return Phaser.Math.Distance.Between(x, y, b.x, b.y) <= b.r;
      }
      return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    });
  }

  onPointerDown(pointer) {
    if (!this.enabled) return;
    if (this.isBlocked(pointer.x, pointer.y)) return;
    this.pointerTarget = {
      x: Phaser.Math.Clamp(pointer.x, 24, VIEW.width - 24),
      y: Phaser.Math.Clamp(pointer.y - 36, 90, VIEW.height - 40)
    };
  }

  onPointerMove(pointer) {
    if (!this.enabled || !this.pointerTarget || !pointer.isDown) return;
    if (this.isBlocked(pointer.x, pointer.y)) return;
    this.pointerTarget = {
      x: Phaser.Math.Clamp(pointer.x, 24, VIEW.width - 24),
      y: Phaser.Math.Clamp(pointer.y - 36, 90, VIEW.height - 40)
    };
  }

  onPointerUp() {
    this.pointerTarget = null;
  }

  /** 归一化移动向量 */
  getMoveVector() {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.left.isDown || k.a.isDown) x -= 1;
    if (k.right.isDown || k.d.isDown) x += 1;
    if (k.up.isDown || k.w.isDown) y -= 1;
    if (k.down.isDown || k.s.isDown) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  getPointerTarget() {
    return this.pointerTarget;
  }

  justBomb() {
    return Phaser.Input.Keyboard.JustDown(this.keys.bomb) ||
      Phaser.Input.Keyboard.JustDown(this.keys.bombAlt);
  }

  justPause() {
    return Phaser.Input.Keyboard.JustDown(this.keys.pause);
  }

  justMute() {
    return Phaser.Input.Keyboard.JustDown(this.keys.mute);
  }
}
