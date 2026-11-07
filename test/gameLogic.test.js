import { describe, it, expect } from 'vitest';
import {
  clampWeapon, weaponSpread, fireIntervalFor, difficultyAt, bossHpFor,
  spawnWeights, pickWeighted, pickPowerup, scoreFor, formatScore, formatTime,
  loadBest, saveBest, loadLives, saveLives, loadMode, saveMode
} from '../src/systems/gameLogic.js';
import { PLAYER, DIFFICULTY, INSANE } from '../src/config.js';

describe('武器等级与弹道', () => {
  it('等级钳制在 1..5', () => {
    expect(clampWeapon(0)).toBe(1);
    expect(clampWeapon(3)).toBe(3);
    expect(clampWeapon(99)).toBe(PLAYER.maxWeapon);
    expect(clampWeapon(NaN)).toBe(1);
  });

  it('每级弹道数量递增且左右对称', () => {
    for (let lv = 1; lv <= PLAYER.maxWeapon; lv++) {
      const shots = weaponSpread(lv);
      expect(shots.length).toBe(lv);
      const sum = shots.reduce((s, shot) => s + shot.dx, 0);
      expect(Math.abs(sum)).toBeLessThan(1e-6);
    }
  });

  it('弹道角度在合理范围内', () => {
    weaponSpread(5).forEach((shot) => {
      expect(Math.abs(shot.angle)).toBeLessThanOrEqual(15);
    });
  });

  it('等级越高射击间隔越短且不低于 80ms', () => {
    expect(fireIntervalFor(1)).toBe(PLAYER.fireInterval);
    expect(fireIntervalFor(5)).toBeLessThan(fireIntervalFor(1));
    expect(fireIntervalFor(99)).toBeGreaterThanOrEqual(80);
  });
});

describe('难度曲线', () => {
  it('初始难度为基础值', () => {
    const d = difficultyAt(0);
    expect(d.spawnInterval).toBe(DIFFICULTY.spawnBase);
    expect(d.speedMul).toBe(1);
    expect(d.wave).toBe(1);
    expect(d.bossIndex).toBe(0);
  });

  it('刷怪间隔随时间下降但有下限', () => {
    expect(difficultyAt(10).spawnInterval).toBeLessThan(difficultyAt(0).spawnInterval);
    expect(difficultyAt(9999).spawnInterval).toBe(DIFFICULTY.spawnMin);
  });

  it('敌机速度倍率有上限', () => {
    expect(difficultyAt(60).speedMul).toBeGreaterThan(1);
    expect(difficultyAt(9999).speedMul).toBe(DIFFICULTY.speedCap);
  });

  it('波次每 20 秒 +1，Boss 每 60 秒一位', () => {
    expect(difficultyAt(19).wave).toBe(1);
    expect(difficultyAt(20).wave).toBe(2);
    expect(difficultyAt(59).bossIndex).toBe(0);
    expect(difficultyAt(60).bossIndex).toBe(1);
  });

  it('Boss 血量随登场次数成长', () => {
    expect(bossHpFor(0)).toBe(DIFFICULTY.bossHpBase);
    expect(bossHpFor(2)).toBe(DIFFICULTY.bossHpBase + DIFFICULTY.bossHpStep * 2);
  });

  it('变态模式：刷怪更密、速度上限更高、Boss 更硬', () => {
    const normal = difficultyAt(30, false);
    const insane = difficultyAt(30, true);
    expect(insane.spawnInterval).toBeLessThan(normal.spawnInterval);
    expect(insane.speedMul).toBeGreaterThan(normal.speedMul);
    expect(insane.wave).toBeGreaterThan(normal.wave);
    expect(difficultyAt(9999, true).spawnInterval).toBe(INSANE.spawnMin);
    expect(bossHpFor(0, true)).toBe(INSANE.bossHpBase);
    expect(bossHpFor(0, true)).toBeGreaterThan(bossHpFor(0, false));
  });
});

describe('刷怪权重与掉落', () => {
  it('前期以侦察机为主，后期重装机权重上升', () => {
    const early = spawnWeights(1);
    const late = spawnWeights(8);
    expect(early.find((e) => e.type === 'scout').weight)
      .toBeGreaterThan(late.find((e) => e.type === 'scout').weight);
    expect(late.find((e) => e.type === 'tank').weight)
      .toBeGreaterThan(early.find((e) => e.type === 'tank').weight);
  });

  it('加权抽取命中边界值', () => {
    const entries = spawnWeights(5);
    expect(pickWeighted(entries, () => 0)).toBe(entries[0].type);
    expect(pickWeighted(entries, () => 0.999999)).toBe(entries[entries.length - 1].type);
  });

  it('道具概率分布覆盖四种类型', () => {
    expect(pickPowerup(() => 0.1)).toBe('power');
    expect(pickPowerup(() => 0.6)).toBe('shield');
    expect(pickPowerup(() => 0.8)).toBe('bomb');
    expect(pickPowerup(() => 0.95)).toBe('laser');
  });

  it('击毁得分与配置一致', () => {
    expect(scoreFor('scout')).toBe(100);
    expect(scoreFor('tank')).toBe(500);
    expect(scoreFor('boss')).toBe(6000);
    expect(scoreFor('unknown')).toBe(0);
  });
});

describe('格式化与最高分存档', () => {
  it('计分板补足六位', () => {
    expect(formatScore(0)).toBe('000000');
    expect(formatScore(1234)).toBe('001234');
    expect(formatScore(1234567)).toBe('1234567');
  });

  it('时间格式化为 mm:ss', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65_000)).toBe('01:05');
    expect(formatTime(3_725_000)).toBe('62:05');
  });

  it('最高分可读写，脏数据回退为 0', () => {
    const store = new Map();
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v)
    };
    expect(loadBest(storage)).toBe(0);
    saveBest(4321.9, storage);
    expect(loadBest(storage)).toBe(4321);
    storage.setItem('skyStrike.best', 'not-a-number');
    expect(loadBest(storage)).toBe(0);
  });

  it('生命数可读写并钳制在 1..9', () => {
    const store = new Map();
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v)
    };
    expect(loadLives(storage)).toBe(3);
    saveLives(5, storage);
    expect(loadLives(storage)).toBe(5);
    saveLives(99, storage);
    expect(loadLives(storage)).toBe(9);
    saveLives(-3, storage);
    expect(loadLives(storage)).toBe(1);
  });

  it('难度模式可读写，默认普通', () => {
    const store = new Map();
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v)
    };
    expect(loadMode(storage)).toBe('normal');
    saveMode('insane', storage);
    expect(loadMode(storage)).toBe('insane');
    saveMode('weird', storage);
    expect(loadMode(storage)).toBe('normal');
  });
});
