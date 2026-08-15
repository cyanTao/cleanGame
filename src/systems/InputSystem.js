// ===== 键盘 + 触屏/鼠标 → 统一输入接口 =====
import { KEYS } from '../config.js';
import { TouchControls } from './TouchControls.js';

/**
 * 统一输入接口：getState() → { left, right, jump, attack, defend, special }
 * jump/attack/special 为边沿触发（本帧刚按下）
 * 虚拟按键始终显示：触屏用手指、桌面用鼠标均可点击（控制 P1）
 */
export class InputSystem {
  constructor(scene) {
    const k = scene.input.keyboard;
    this.map = {
      p1: k.addKeys(KEYS.p1),
      p2: k.addKeys(KEYS.p2)
    };
    this.prev = { p1: {}, p2: {} };
    this.touch = new TouchControls(scene);
  }

  /** @param {'p1'|'p2'} player */
  getState(player) {
    const m = this.map[player];
    const prev = this.prev[player];
    const down = (key) => key.isDown;
    const justDown = (key, name) => {
      const now = down(key);
      const was = prev[name] || false;
      prev[name] = now;
      return now && !was;
    };
    const s = {
      left: down(m.left),
      right: down(m.right),
      jump: justDown(m.jump, 'jump'),
      attack: justDown(m.attack, 'attack'),
      defend: down(m.defend),
      special: justDown(m.special, 'special')
    };

    // 合并触屏虚拟按键（仅 P1）
    const t = this.touch;
    if (player === 'p1' && t) {
      s.left = s.left || t.held.left;
      s.right = s.right || t.held.right;
      s.defend = s.defend || t.held.defend;
      s.jump = s.jump || t.consume('jump');
      s.attack = s.attack || t.consume('attack');
      s.special = s.special || t.consume('special');
    }
    return s;
  }
}
