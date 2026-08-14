import { describe, it, expect } from 'vitest';
import { MECHA_FRAMES, SPARK, SPARK_PALETTE } from '../src/data/sprites.js';
import { PALETTES } from '../src/config.js';

const FRAME_W = 16;
const FRAME_H = 20;

describe('像素素材数据完整性', () => {
  it('机甲全部姿态：尺寸 16×20 且行列一致', () => {
    for (const [pose, rows] of Object.entries(MECHA_FRAMES)) {
      expect(rows.length, `${pose} 行数`).toBe(FRAME_H);
      rows.forEach((row, y) => {
        expect(row.length, `${pose} 第 ${y} 行宽度`).toBe(FRAME_W);
      });
    }
  });

  it('机甲全部姿态：字符均在两套调色板中可解析', () => {
    const allowed = new Set(['.', ...Object.keys(PALETTES.blu), ...Object.keys(PALETTES.red)]);
    for (const [pose, rows] of Object.entries(MECHA_FRAMES)) {
      rows.forEach((row, y) => {
        for (const ch of row) {
          expect(allowed.has(ch), `${pose}(${y}) 未知字符 '${ch}'`).toBe(true);
        }
      });
    }
  });

  it('关键姿态齐全：idle/walkA/walkB/jump/attackA/attackB/defend/hit/dead', () => {
    const poses = Object.keys(MECHA_FRAMES);
    ['idle', 'walkA', 'walkB', 'jump', 'attackA', 'attackB', 'defend', 'hit', 'dead']
      .forEach((p) => expect(poses).toContain(p));
  });

  it('攻击判定帧手臂前伸（第 13 列存在手臂像素）', () => {
    const row = MECHA_FRAMES.attackB[9];
    expect(row[13] === '.').toBe(false); // 右侧手臂/拳部位
  });

  it('防御帧含盾牌字符 S', () => {
    expect(MECHA_FRAMES.defend.some((r) => r.includes('S'))).toBe(true);
  });

  it('倒地帧位于画面底部（前 15 行为空）', () => {
    MECHA_FRAMES.dead.slice(0, 15).forEach((r, i) => expect(r, `dead 第 ${i} 行`).toBe('.'.repeat(FRAME_W)));
  });

  it('火花素材 3×3 且颜色可解析', () => {
    expect(SPARK.length).toBe(3);
    SPARK.forEach((r) => expect(r.length).toBe(3));
    for (const r of SPARK) for (const ch of r) {
      expect(ch === '.' || SPARK_PALETTE[ch]).toBeTruthy();
    }
  });
});
