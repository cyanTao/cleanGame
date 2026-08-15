// ===== 触屏虚拟按键（仅触屏设备显示，控制 P1） =====
import Phaser from 'phaser';
import { VIEW } from '../config.js';

/** 检测触屏设备 */
export function isTouchDevice() {
  return typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

/**
 * 虚拟按键层：
 * - held: 持续按压状态（left / right / defend）
 * - pending: 边沿触发集合（jump / attack / special），consume() 读取后清零
 * 释放策略：zone 自身 pointerup/pointerout + 全局 pointerup 按 pointerId 兜底
 * （手指抬起位置偏移时 zone 收不到 up，必须全局兜底，否则 held 卡死）
 */
export class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.held = { left: false, right: false, defend: false };
    this.pending = new Set();
    this.byPointer = new Map(); // pointerId → Set(按下的按钮名)
    this.build();
    scene.input.on('pointerup', (pointer) => this.releasePointer(pointer.id));
    scene.input.on('pointerupoutside', (pointer) => this.releasePointer(pointer.id));
  }

  /** 释放指定指针按下的所有 hold 按钮 */
  releasePointer(pointerId) {
    const names = this.byPointer.get(pointerId);
    if (!names) return;
    names.forEach((name) => { this.held[name] = false; });
    this.byPointer.delete(pointerId);
    this.redrawAll();
  }

  redrawAll() {
    this.buttons.forEach((b) => b.draw(this.held[b.name] === true));
  }

  build() {
    this.buttons = [];
    const mk = (x, y, w, h, label, name, opts = {}) => {
      const g = this.scene.add.graphics().setDepth(1000);
      const draw = (on) => {
        g.clear();
        g.fillStyle(on ? 0x4763a8 : 0x1d2436, 0.85);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
        g.lineStyle(2, on ? 0x8fb0f0 : 0x4763a8, 0.9);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      };
      draw(false);
      g.setPosition(x, y);

      this.scene.add.text(x, y, label, {
        fontFamily: 'Courier New, monospace', fontSize: opts.size || '20px', fontStyle: 'bold',
        color: '#e8f0ff', stroke: '#10141f', strokeThickness: 3
      }).setOrigin(0.5).setDepth(1001);

      const zone = this.scene.add.zone(x, y, w + 16, h + 16)
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1002);

      const press = (pointer) => {
        if (opts.hold) {
          this.held[name] = true;
          if (!this.byPointer.has(pointer.id)) this.byPointer.set(pointer.id, new Set());
          this.byPointer.get(pointer.id).add(name);
          draw(true);
        } else {
          this.pending.add(name);
        }
      };
      const release = () => {
        if (opts.hold && this.held[name]) {
          this.held[name] = false;
          draw(false);
        }
      };
      zone.on('pointerdown', press);
      zone.on('pointerup', release);
      zone.on('pointerout', release);
      this.buttons.push({ name, draw });
    };

    const bottom = VIEW.height;
    // 左侧：方向键（持续按压）
    mk(66, bottom - 64, 64, 64, '◀', 'left', { hold: true, size: '24px' });
    mk(148, bottom - 64, 64, 64, '▶', 'right', { hold: true, size: '24px' });
    // 右侧：动作键（跳/防 为上排，击/杀 为下排）
    mk(768, bottom - 96, 72, 52, '跳', 'jump');
    mk(856, bottom - 96, 72, 52, '防', 'defend', { hold: true });
    mk(768, bottom - 30, 72, 52, '击', 'attack');
    mk(856, bottom - 30, 72, 52, '杀', 'special');
  }

  /** 边沿触发：读取并清除 */
  consume(name) {
    if (this.pending.has(name)) {
      this.pending.delete(name);
      return true;
    }
    return false;
  }
}
