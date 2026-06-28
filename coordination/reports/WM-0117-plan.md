# WM-0117 — Player HUD and debug overlay separation

## 目标

默认进入城镇视图后显示玩家可读 HUD，而不是 M6 诊断/产品闸门面板；诊断信息仅在显式 `wmDiagnostics=1` 路径下可见。

## 已读上下文

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0117.json`
- `coordination/reports/WM-0111-m8-scope-amendment.md`
- `docs/01_design/00_game_design_overview.md`
- `docs/01_design/01_game_program_design.md`
- `docs/01_design/02_player_journey_and_story.md`
- `docs/01_design/03_daily_loop_and_pacing.md`
- `docs/01_design/04_progression_endings.md`
- `docs/01_design/05_ui_ux_information_design.md`
- `docs/01_design/06_content_and_modding_overview.md`
- `docs/01_design/07_system_interaction_matrix.md`
- `docs/01_design/08_m7_first_run_onboarding.md`
- `docs/01_design/09_m8_product_ui_design_system.md`
- `docs/07_roadmap/05_m7_web_demo_scope.md`
- `packages/ui-react/src/shell-hud.ts`
- `packages/ui-react/src/localization.ts`
- `packages/ui-react/src/shell-store.ts`
- `apps/web/src/product-gate-fixture.ts`
- `apps/web/src/shell-bootstrap.ts`
- `apps/web/src/web-shell.e2e.test.ts`
- `apps/desktop-electron/src/desktop-shell.e2e.test.ts`

## 不做什么

- 不修改 `packages/sim-core/**`、`packages/sim-worker/**`。
- 不改 Worker 协议、`packages/sim-protocol/**` 或权威数据写入边界。
- 不做发布、商店、签名、遥测、账号、付费服务相关工作。

## 当前事实与假设

- 当前默认城镇视图会在主 HUD 中混入 Product Gate / diagnostics surface。
- `wmDiagnostics=1` 已是现有显式调试入口，可继续作为调试路径。
- 当前读模型字段有限，因此玩家 HUD 需要从现有 read model 中做安全派生，而不是新增协议字段。
- React/Pixi 仍必须是只读消费者，不能直接变更权威模拟状态。

## 方案

- 在 `packages/ui-react` 里重组 HUD 信息层级：
  - 顶栏显示时段、状态摘要、关键资源。
  - 左侧显示 next goal、night risk、事件/任务分组。
  - 右侧显示 selected / at-risk resident 状态。
  - 保留 inspector，但让默认玩家信息优先于诊断信息。
- 使用 M8 视觉 token 常量替换当前偏 M6 harness 的面板风格，并为玩家 HUD 与 debug overlay 使用明显不同主题。
- 仅当 `diagnosticsVisible` 为 true 时渲染 debug overlay，并给 overlay 明确的 `Debug`/`Diagnostics` 标识及测试钩子。
- 更新 shell fixture 文案，使默认 post-start 视图读起来像玩家 HUD，而不是产品闸门证据页。
- 扩展 Web/Desktop E2E，分别验证默认模式与 `wmDiagnostics=1` 模式。

## 风险

- 读模型字段不足时容易把调试信息重新塞回默认 HUD；需要严格只用玩家可读摘要。
- 当前 fixture 为静态数据，过度依赖特定文案会让测试脆弱；E2E 应优先断言结构和 gated behavior。
- 紧凑视口布局可能因新增 HUD 区块再次出现遮挡或横向溢出。

## 实施步骤

1. 设计 HUD 派生结构与布局分区，确认 default/debug 两条渲染路径。
2. 更新 `shell-hud.ts` 和本地化文案，加入测试选择器与 M8 tokenized styles。
3. 调整 fixture 文案与默认 phase/goal/risk 呈现，保持 read-model-only。
4. 扩展 web/desktop E2E 断言，覆盖 default player HUD 与 debug overlay。
5. 运行 required checks，整理报告并 `taskctl complete`。

## 测试与基准

- `corepack pnpm typecheck`
- `corepack pnpm test:e2e --filter web-shell`
- `corepack pnpm test:e2e --filter desktop-shell`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status`
- `git diff --check`
- `corepack pnpm quality`

## 回滚

- 若新 HUD 影响默认可用性，可回退到仅保留 start surface 后最小 HUD，但仍保留 diagnostics 仅在 `wmDiagnostics=1` 显示的 gating。
- 若 compact 布局破坏严重，可先保留功能分离并缩减默认卡片数量，不回退 debug gating。

## 完成条件

- 默认 HUD 明确显示当前状态、next goal、resources、resident state、events/tasks 与 night risk。
- Diagnostics/Product Gate 默认隐藏，仅在显式 debug 路径中出现。
- HUD 使用本地化字符串和 M8 视觉 token。
- UI 仍为 read-model-only，不写权威模拟状态。
- Web/Desktop E2E 都能区分默认玩家 UI 与 debug overlay。
