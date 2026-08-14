// ===== 字符画 → Phaser 纹理生成器 =====

/**
 * 将一组字符画帧注册为纹理。
 * 单帧：纹理名 = key；多帧：key_0, key_1, ...
 * @param {Phaser.Scene} scene
 * @param {string} key 纹理名（单帧）或前缀（多帧）
 * @param {string[][]} frames 每帧为字符串行数组
 * @param {Object} palette 字符 → 颜色映射
 */
export function registerCharArt(scene, key, frames, palette) {
  frames.forEach((rows, i) => {
    const w = rows[0].length;
    const h = rows.length;
    const textureKey = frames.length === 1 ? key : `${key}_${i}`;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      if (row.length !== w) {
        throw new Error(`纹理 ${textureKey} 第 ${y} 行宽度异常：${row.length} ≠ ${w}`);
      }
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const color = palette[ch];
        if (!color) throw new Error(`纹理 ${textureKey} 未知颜色字符 '${ch}' at (${x},${y})`);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
    scene.textures.addCanvas(textureKey, canvas);
  });
}

/** 将姿态字典（{pose: rows}）注册为 key_pose 形式的纹理 */
export function registerPoseDict(scene, prefix, poseDict, palette) {
  for (const [pose, rows] of Object.entries(poseDict)) {
    registerCharArt(scene, `${prefix}_${pose}`, [rows], palette);
  }
}

/** 生成夜空渐变纹理（多层色带，1×height） */
export function registerSkyGradient(scene, key, height, colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const bands = colors.length;
  const bandH = Math.ceil(height / bands);
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i * bandH, 1, bandH);
  });
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

/** 生成 1×1 星星纹理 */
export function registerStar(scene, key, color = '#cfd8ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}
