// ===== 像素字符画素材 =====
// 每帧 = 字符串数组（16 宽 × 20 高），'.' 为透明
// 字符含义：O 轮廓 | D 深甲 | M 中甲 | L 亮甲 | E 眼/天线 | V 能量核 | J 关节 | S 盾
// 机甲面向右侧绘制（P2 通过 flipX 翻转）

const IDLE = [
  '................',
  '........O.......',
  '........E.......',
  '......OOOO......',
  '.....OMLLMO.....',
  '.....OLEELO.....',
  '.....OMLLMO.....',
  '......OOOO......',
  '...OOOOMMOOOO...',
  '..ODMMLLMMMDO...',
  '..ODMLLVLLMDO...',
  '..ODMLLVLMDO....',
  '...ODMMMMDO.....',
  '....OMMMMO......',
  '...OMMOOMMO.....',
  '...OMO..OMO.....',
  '...OMO..OMO.....',
  '...OMO..OMO.....',
  '..OMMO..OMMO....',
  '.OJJO....OJJO...'
];

// 行走 A：大跨步
const WALK_A = [
  '................',
  '........O.......',
  '........E.......',
  '......OOOO......',
  '.....OMLLMO.....',
  '.....OLEELO.....',
  '.....OMLLMO.....',
  '......OOOO......',
  '...OOOOMMOOOO...',
  '..ODMMLLMMMDO...',
  '..ODMLLVLLMDO...',
  '..ODMLLVLMDO....',
  '...ODMMMMDO.....',
  '....OMMMMO......',
  '...OMMOOMMO.....',
  '..OMMO...OMO....',
  '..OMO.....OMO...',
  '.OMMO.....OMMO..',
  '.OMO.......OMO..',
  'OJJO.......OJJO.'
];

// 行走 B：并腿过渡
const WALK_B = [
  '................',
  '........O.......',
  '........E.......',
  '......OOOO......',
  '.....OMLLMO.....',
  '.....OLEELO.....',
  '.....OMLLMO.....',
  '......OOOO......',
  '...OOOOMMOOOO...',
  '..ODMMLLMMMDO...',
  '..ODMLLVLLMDO...',
  '..ODMLLVLMDO....',
  '...ODMMMMDO.....',
  '....OMMMMO......',
  '...OMMOOMMO.....',
  '....OMO.OMO.....',
  '....OMO.OMO.....',
  '...OMMO.OMMO....',
  '...OMO...OMO....',
  '..OJJO...OJJO...'
];

// 跳跃：收腿
const JUMP = [
  '................',
  '........O.......',
  '........E.......',
  '......OOOO......',
  '.....OMLLMO.....',
  '.....OLEELO.....',
  '.....OMLLMO.....',
  '......OOOO......',
  '...OOOOMMOOOO...',
  '..ODMMLLMMMDO...',
  '..ODMLLVLLMDO...',
  '..ODMLLVLMDO....',
  '...ODMMMMDO.....',
  '....OMMMMO......',
  '...OMMOOMMO.....',
  '...OMMOMMO......',
  '..OMMOOMMO......',
  '..OJJOOJJO......',
  '................',
  '................'
];

// 攻击前摇（收拳后仰）
const ATTACK_A = [
  '................',
  '........O.......',
  '........E.......',
  '......OOOO......',
  '.....OMLLMO.....',
  '.....OLEELO.....',
  '.....OMLLMO.....',
  '......OOOO......',
  '..OOOOMMOOOO....',
  '.ODMMLLMMMDO....',
  '.ODMLLVLLMDO....',
  '.ODMLLVLMDO.....',
  '..ODMMMMDO......',
  '...OMMMMO.......',
  '...OMMOOMMO.....',
  '...OMO..OMO.....',
  '...OMO..OMO.....',
  '...OMO..OMO.....',
  '..OMMO..OMMO....',
  '.OJJO....OJJO...'
];

// 攻击判定（出拳前冲）
const ATTACK_B = [
  '................',
  '........O.......',
  '........E.......',
  '......OOOO......',
  '.....OMLLMO.....',
  '.....OLEELO.....',
  '.....OMLLMO.....',
  '......OOOO......',
  '...OOOOMMOOOOOO.',
  '..ODMMLLMMMDDOO.',
  '..ODMLLVLLMDDLL.',
  '..ODMLLVLMDDOO..',
  '...ODMMMMDO.....',
  '....OMMMMO......',
  '...OMMOOMMO.....',
  '...OMO..OMO.....',
  '...OMO..OMO.....',
  '...OMO..OMO.....',
  '..OMMO..OMMO....',
  '.OJJO....OJJO...'
];

// 防御（举盾，整体左移 1px 便于盾牌前置）
const DEFEND = [
  '................',
  '........O.......',
  '........E.......',
  '......OOOO......',
  '....OMLLMO..SS..',
  '....OLEELO..SS..',
  '....OMLLMO..SS..',
  '.....OOOO...SS..',
  '..OOOOMMOOO.SS..',
  '.ODMMLLMMMD.SS..',
  '.ODMLLVLLMD.SS..',
  '.ODMLLVLMDO.SS..',
  '..ODMMMMDO..SS..',
  '...OMMMMO...SS..',
  '..OMMOOMMO..SS..',
  '..OMO..OMO......',
  '..OMO..OMO......',
  '..OMO..OMO......',
  '.OMMO..OMMO.....',
  'OJJO....OJJO....'
];

// 受击（后仰闭眼）
const HIT = [
  '................',
  '........O.......',
  '........E.......',
  '......OOOO......',
  '.....OMLLMO.....',
  '.....OLDDLO.....',
  '.....OMLLMO.....',
  '......OOOO......',
  '..OOOOMMOOOO....',
  '.ODMMLLMMMDO....',
  '.ODMLLVLLMDO....',
  '.ODMLLVLMDO.....',
  '..ODMMMMDO......',
  '...OMMMMO.......',
  '...OMMOOMMO.....',
  '...OMO..OMO.....',
  '...OMO..OMO.....',
  '...OMO..OMO.....',
  '..OMMO..OMMO....',
  '.OJJO....OJJO...'
];

// 倒地（水平躺）
const DEAD = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....OMLLM......',
  '......OOOO......',
  '.OOMLLLVMMLOO...',
  '.OJJOODOODJJO...',
  '.OJJOODOODJJO...'
];

// 机甲全部姿态帧（顺序即帧索引）
export const MECHA_FRAMES = {
  idle: IDLE,
  walkA: WALK_A,
  walkB: WALK_B,
  jump: JUMP,
  attackA: ATTACK_A,
  attackB: ATTACK_B,
  defend: DEFEND,
  hit: HIT,
  dead: DEAD
};

// 命中火花 3×3
export const SPARK = [
  '.Y.',
  'YWY',
  '.Y.'
];

export const SPARK_PALETTE = { Y: '#ffd75e', W: '#ffffff' };

// 像素比例：16×20 → 64×80
export const SPRITE_SCALE = 4;
