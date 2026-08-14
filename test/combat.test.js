import { describe, it, expect } from 'vitest';
import { resolveHit, energyGain, resolveTimerEnd } from '../src/systems/combat.js';
import { COMBAT } from '../src/config.js';

describe('resolveHit 伤害结算', () => {
  it('无防御：全额伤害', () => {
    const r = resolveHit({
      damage: 8, isSpecial: false, defenderDefending: false,
      defenderFacing: 1, attackerX: 200, defenderX: 400
    });
    expect(r.damage).toBe(8);
    expect(r.blocked).toBe(false);
  });

  it('正面防御普通攻击：减伤 75% 向下取整', () => {
    // 攻击者在防御者面向一侧（defender 面向右 x=400，attacker x=500 在右侧）
    const r = resolveHit({
      damage: 8, isSpecial: false, defenderDefending: true,
      defenderFacing: 1, attackerX: 500, defenderX: 400
    });
    expect(r.blocked).toBe(true);
    expect(r.damage).toBe(Math.floor(8 * 0.25)); // 2
  });

  it('背向防御：不减伤', () => {
    const r = resolveHit({
      damage: 8, isSpecial: false, defenderDefending: true,
      defenderFacing: -1, attackerX: 500, defenderX: 400 // 攻击者在右侧但防御者面向左
    });
    expect(r.blocked).toBe(false);
    expect(r.damage).toBe(8);
  });

  it('防御中吃必杀：只减伤 50%', () => {
    const r = resolveHit({
      damage: 25, isSpecial: true, defenderDefending: true,
      defenderFacing: 1, attackerX: 500, defenderX: 400
    });
    expect(r.blocked).toBe(true);
    expect(r.damage).toBe(Math.floor(25 * 0.5)); // 12
  });

  it('不同机甲伤害差异透传', () => {
    const blu = resolveHit({ damage: 8, isSpecial: false, defenderDefending: false, defenderFacing: 1, attackerX: 0, defenderX: 1 });
    const red = resolveHit({ damage: 10, isSpecial: false, defenderDefending: false, defenderFacing: 1, attackerX: 0, defenderX: 1 });
    expect(red.damage - blu.damage).toBe(2);
  });
});

describe('energyGain 能量结算', () => {
  it('命中 +15', () => {
    expect(energyGain(0, COMBAT.energyOnHit)).toBe(15);
  });
  it('上限 100 截断', () => {
    expect(energyGain(95, COMBAT.energyOnHit)).toBe(COMBAT.energyMax);
  });
  it('被击 +8', () => {
    expect(energyGain(10, COMBAT.energyOnHurt)).toBe(18);
  });
});

describe('resolveTimerEnd 倒计时判定', () => {
  it('HP 高者胜', () => {
    expect(resolveTimerEnd(80, 40)).toBe('A');
    expect(resolveTimerEnd(30, 70)).toBe('B');
  });
  it('HP 相同进入突然死亡', () => {
    expect(resolveTimerEnd(50, 50)).toBe('sudden');
    expect(resolveTimerEnd(0, 0)).toBe('sudden');
  });
});
