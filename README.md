# Pixel Agents Live Demo

**一句话卖点**：输入一句指令，看两位性格迥异的 AI 伙伴在像素世界里边走边聊、分工协作，把任务做成一场实时上演的小剧场。

## 功能亮点
- 2D 像素风俯视网格地图（20x14，32px 单元）
- 两位 Agent（阿岚 / 小夏）协作执行指令，并实时推送可解释过程
- 直播式流程面板：ThoughtSummary / Plan / Observation / Action / Dialogue
- 支持 Pause / Step / Resume
- 双人协作机关：双人开关门 + Synergy 指标
- 3 个预设任务 + `/help` 文案
- Streaming 事件流（WebSocket）+ Trace ID 显示

## 快速开始

### 1) 启动后端
```bash
cd backend
cp ../.env.example .env
npm install
npm run dev
```

### 2) 启动前端
```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173

> 如果没有 OPENAI_API_KEY，默认启用 `USE_MOCK_AGENT=1`，可直接体验脚本化 Demo。

## 玩法说明
- 顶部输入指令，点击任一任务按钮即可开始。
- `Pause/Step/Resume` 控制步进。
- 右侧面板可切换总览 / 单人视角 / 世界事件。
- 底部进度条与 Synergy 值反映协作完成度。

## 架构说明
```
root
├── backend/               # Express + WebSocket + Agents SDK
│   ├── src/world.ts       # 地图/物品/角色/机关状态
│   ├── src/pathfinding.ts # A* 寻路
│   ├── src/agents.ts      # Agent 编排 + 工具定义 + 事件推送
│   ├── src/tasks.ts       # 3 个预设任务脚本
│   └── src/index.ts       # API + WS 服务
└── frontend/              # Vite + React 画布渲染
    └── src/App.tsx        # UI 布局 + 事件流处理
```

### 世界状态与工具
所有世界变更必须通过工具发生：`move / inspect / talk / pickup / drop / useSwitch / emitUIEvent`。
每次变更都会触发 `world_update` 事件，前端只做渲染，不维护权威状态。

### Streaming 与 Trace
- 后端通过 WebSocket 向前端推送 `ui_event` 和 `world_update`。
- `trace_id` 会写入后端日志，并显示在前端开发者信息区域。

## 任务扩展示例
1. 在 `backend/src/tasks.ts` 中新增 TaskScript。
2. 如需新机关，在 `backend/src/world.ts` 增加实体，并在工具中处理逻辑。
3. UI 会自动展示事件流，无需改动前端。

## 角色设定
- **阿岚（Lan）**：冷静理性、策略控、风险检查专家。
- **小夏（Xia）**：乐观行动派、社交高手、推动进度。

## 自测 Checklist
- [ ] 输入指令后两位 Agent 移动并协作完成任务
- [ ] Pause / Step / Resume 生效
- [ ] 双人开关门出现且要求协作
- [ ] ThoughtSummary / Plan / Observation 简短可读
- [ ] 画布移动为逐格动画无瞬移
- [ ] OPENAI_API_KEY 不暴露在前端
