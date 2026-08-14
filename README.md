# 植物大战僵尸 · 手机版（H5 + 微信小游戏）

一套代码同时支持 H5 浏览器与微信小游戏双端运行的横屏塔防游戏。

## 玩法内容（第一期 · 白天草坪篇）

- **10 个关卡**，难度递增（僵尸血量/速度/波次随关卡提升）
- **6 种植物**：向日葵（产阳光）、豌豆射手、坚果墙、寒冰射手（减速）、双发射手、樱桃炸弹（范围爆炸）
- **5 种僵尸**：普通、路障、铁桶、撑杆跳（跳过首个植物）、疾跑
- **机制**：天降阳光收集、种植冷却、每行割草机最后防线、波次进度条、最终大波
- **音效**：WebAudio 代码合成（种植/射击/啃食/爆炸/胜负等），零音频文件
- **存档**：关卡进度与金币（H5 用 localStorage，微信用 wx.storage）
- 后续二期可扩展：黑夜墓地、泳池派对场景 + 商店（配置已数据驱动，见 `src/config.js`）

## 运行

### H5

直接起静态服务器打开 `index.html`（手机浏览器建议横屏）：

```bash
python3 -m http.server 8000
# 访问 http://localhost:8000
```

### 微信小游戏

1. 打开微信开发者工具 → 导入项目 → 选择本目录
2. AppID 可选"测试号"（已配置 `touristappid`）
3. 直接编译运行；真机预览建议基础库 ≥ 2.33.0

## 架构

```
index.html          H5 入口
game.js             微信入口（按依赖顺序 require）
src/
  platform.js       平台适配层（canvas/图片/存储/触摸/音频/帧循环 双端抽象）
  core.js           引擎：逻辑分辨率 960x540 适配、场景管理、输入、音效合成、存档
  sprites.js        素材加载 + 蓝幕抠像（含去噪/裁剪）
  config.js         植物/僵尸/关卡 数据配置
  entities.js       Plant / Zombie / Bullet / Sun / Mower 实体
  gamescene.js      游戏主场景：棋盘、波次、胜负
  ui.js             主菜单 / 选关
  main.js           启动：加载素材 → 主菜单
assets/             AI 生成卡通素材（JPG，运行时抠像去背）
test/               Node 冒烟/机制/渲染测试（不参与微信打包）
```

## 测试

```bash
node test/smoke.js      # 完整流程冒烟（加载→菜单→种植→战斗→弹窗→选关）
node test/mechanics.js  # 机制测试（通关存档/樱桃炸弹/割草机/撑杆跳/寒冰减速）
node test/render.js     # 真实渲染验证（需 node-canvas，截图输出到 test/shots）
```
