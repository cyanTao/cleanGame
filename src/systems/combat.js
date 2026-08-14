// ===== 战斗结算纯函数（可单测） =====
import { COMBAT } from '../config.js';

/**
 * 命中结算
 * @param {Object} p
 * @param {number} p.damage 基础伤害
 * @param {boolean} p.isSpecial 是否必杀技
 * @param {boolean} p.defenderDefending 防御方是否举盾
 * @param {number} p.defenderFacing 防御方面向（1 右 / -1 左）
 * @param {number} p.attackerX 攻击方 x
 * @param {number} p.defenderX 防御方 x
 * @returns {{damage: number, blocked: boolean}}
 */
export function resolveHit({ damage, isSpecial, defenderDefending, defenderFacing, attackerX, defenderX }) {
  const attackerOnFacingSide =
    Math.sign(attackerX - defenderX) === defenderFacing;
  const blocked = defenderDefending && attackerOnFacingSide;
  let finalDamage = damage;
  if (blocked) {
    const reduce = isSpecial ? COMBAT.specialBlockReduce : COMBAT.blockReduce;
    finalDamage = Math.floor(damage * (1 - reduce));
  }
  return { damage: finalDamage, blocked };
}

/** 能量结算（上限截断） */
export function energyGain(current, gain) {
  return Math.min(COMBAT.energyMax, current + gain);
}

/**
 * 倒计时结束判定
 * @returns {'A'|'B'|'sudden'} 胜者编号或进入突然死亡
 */
export function resolveTimerEnd(hpA, hpB) {
  if (hpA > hpB) return 'A';
  if (hpB > hpA) return 'B';
  return 'sudden';
}
