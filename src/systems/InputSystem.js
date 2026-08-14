// ===== 双人键位 → 统一输入接口 =====
import { KEYS } from '../config.js';

/**
 * 统一输入接口：getState() → { left, right, jump, attack, defend, special }
 * jump/attack/special 为边沿触发（本帧刚按下）
 */
export class InputSystem {
  constructor(scene) {
    const k = scene.input.keyboard;
    this.map = {
      p1: k.addKeys(KEYS.p1),
      p2: k.addKeys(KEYS.p2)
    };
    this.prev = { p1: {}, p2: {} };
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
    return {
      left: down(m.left),
      right: down(m.right),
      jump: justDown(m.jump, 'jump'),
      attack: justDown(m.attack, 'attack'),
      defend: down(m.defend),
      special: justDown(m.special, 'special')
    };
  }
}
