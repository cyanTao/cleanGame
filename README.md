# 黏土怪物合成进化游戏

大西瓜式合成进化游戏：投掷程序化生成的黏土怪物，同级相撞触发黏土融合动态特效并进化，10 级封顶，容器溢出失败。

## 运行

- Web：`npm install && npm run dev` → http://localhost:5173
- 构建：`npm run build:web`（dist/web）；`npm run build:wechat`（wechat/game.js）；`npm run build:douyin`（douyin/game.js）
- 测试：`npm test`；类型检查：`npm run typecheck`

## 三端部署

| 端 | 方式 |
|---|---|
| Web | 静态托管 dist/web |
| 微信小游戏 | 微信开发者工具导入 `wechat/` 目录，上传发布 |
| 抖音小游戏 | 抖音开发者工具导入 `douyin/` 目录，上传发布 |

## 架构

- `src/engine/`：渲染/物理/怪物生成/融合/特效/状态机（跨端共享）
- `src/ui/`：Canvas 2D 自绘界面（跨端共享）
- `src/platform/`：web / wechat / douyin 三端适配层
- 设计文档：`docs/superpowers/specs/2026-08-21-clay-monster-game-design.md`

## 规则

- 投放等级随机 1~3；融合得分 = 新等级 × 10
- 合成 10 级胜利；容器溢出失败
- 存档：最高分 + 图鉴（localStorage / wx / tt storage）