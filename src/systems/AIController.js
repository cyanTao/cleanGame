// ===== 简单 AI：实现与 InputSystem 相同的 getState() 接口 =====
import { AI } from '../config.js';

export class AIController {
  /**
   * @param {import('../entities/Mecha.js').Mecha} self
   * @param {import('../entities/Mecha.js').Mecha} opponent
   */
  constructor(self, opponent) {
    this.self = self;
    this.opponent = opponent;
    this.decision = { left: false, right: false, jump: false, attack: false, defend: false, special: false };
    this.acc = 0;
    this.attackPulse = 0;   // 让 attack/special 只保持 1 帧（模拟边沿触发）
    this.jumpPulse = 0;
  }

  update(dt) {
    this.acc += dt;
    if (this.acc >= AI.tick) {
      this.acc = 0;
      this.think();
    }
    if (this.attackPulse > 0) { this.attackPulse--; if (this.attackPulse <= 0) this.decision.attack = false; }
    if (this.jumpPulse > 0) { this.jumpPulse--; if (this.jumpPulse <= 0) this.decision.jump = false; }
    return this.decision;
  }

  think() {
    const s = this.self;
    const o = this.opponent;
    const dist = Math.abs(o.x - s.x);
    const toward = o.x > s.x ? 'right' : 'left';
    const away = toward === 'right' ? 'left' : 'right';

    const d = { left: false, right: false, jump: false, attack: false, defend: false, special: false };

    try {
      // 1. 对方攻击且距离近 → 防御反应
      if ((o.isAttacking || o.isChargingSpecial) && dist < AI.defendRange) {
        d.defend = true;
      }
      // 2. 能量满且近身 → 必杀
      else if (s.energy >= 100 && dist < AI.attackRange + 20) {
        d.special = true;
        this.attackPulse = 1;
      }
      // 3. 距离远 → 接近
      else if (dist > AI.attackRange) {
        d[toward] = true;
        if (Math.random() < AI.jumpChance * 0.5) { d.jump = true; this.jumpPulse = 1; }
      }
      // 4. 近身 → 攻击 / 跳 / 后撤 / 待机
      else {
        const r = Math.random();
        if (r < AI.aggression) { d.attack = true; this.attackPulse = 1; }
        else if (r < AI.aggression + AI.jumpChance) { d.jump = true; this.jumpPulse = 1; }
        else if (r < AI.aggression + AI.jumpChance + AI.retreatChance) { d[away] = true; }
        // 其余待机
      }
    } catch {
      // 决策异常兜底：待机，不中断主循环
      d.left = d.right = d.jump = d.attack = d.special = d.defend = false;
    }

    this.decision = d;
  }

  /** 与 InputSystem 同构接口 */
  getState() {
    return this.decision;
  }
}
