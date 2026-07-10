# WM-0165 - PR-1 product read-model default GameSession route

## 目标

让默认 Web gameplay route 只渲染经过 schema-v3 / GameSession projection v1 协商和验证的 Simulation Worker 投影，并在没有合法同 basis 投影或会话 fatal 时保持 fail closed。

## 已读上下文

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0165.json`
- `coordination/decisions/ADR-0017.md`
- `coordination/reports/WM-0164.md`
- `docs/05_tech/01_technical_architecture.md`
- `docs/05_tech/12_integrated_gamesession_architecture.md`
- `docs/07_roadmap/12_playable_product_recovery_roadmap.md`
- WM-0165 listed Web bootstrap, projection, fixture, Worker-session, protocol, and E2E sources
- Public package-root GameSession exports and WM-0164 focused Worker/browser tests

## 不做什么

- 不修改 `sim-core`, `sim-worker`, `sim-protocol`, React, Pixi, Electron, persistence, package manifests, or public save contracts.
- 不接入 PR-2 autonomous life, PR-3 lamp/build command expansion, PR-4 map-first redesign, final art, or localization rewrite.
- 不用 WM-0160 advance/drain helpers、UI timers、synthetic canvas dispatch、fixture prose、summaries 或 debug payload 推进或证明正常 gameplay time。
- 不为缺失的公开字段猜测 job kind、resident position、resource quantity、build progress、blocked reason 或 command outcome。

## 当前事实与假设

- `BrowserSimulationWorkerSession.initGameSession()` 从 `@wuming-town/sim-worker` 根入口发送 PR-1 catalog、seed 和精确 `{ kind: "game_session", version: 1 }` 请求；浏览器会话只在精确 schema-v3 Ready 后进入 `active`。
- 浏览器公共会话已用 `@wuming-town/sim-protocol` 验证 envelope、Ready、RenderSnapshot、UiDelta、alerts 和跨投影 basis，并在 malformed/mismatch 时终止 Worker、进入 `fatal`。
- WM-0164 Worker scheduler 在默认 speed 1 下每 100 ms 推进 3 个整数 Tick；Web 不需要也不得发送正常时间 advance/drain。
- 当前 `shell-bootstrap.ts` 以 `WEB_PRODUCT_GATE_READ_MODEL` 初始化全镇，再用 WM-0150 playable slice 覆盖两名 Pawn，并在命令接受后 drain；这是本任务要移除的默认事实链。
- PR-1 `GameSessionUiJobMarkerV1` 没有 job-kind 字段。Web 只能显示其 marker id/state/progress/reason 和同 basis owner/target 位置，不能将其伪装成 lamp/build job。
- PR-1 不支持权威 GameSession save/load。现有 OPFS shell evidence 保持 diagnostics/local selection 边界，不成为 runtime restore。

## 方案

1. 在 Web Worker adapter 中增加 package-root-only GameSession start/read API，并保留 WM-0150 helpers 仅供历史 focused tests/diagnostics；默认 bootstrap 不再导入这些 helpers。
2. 将 `playable-worker-projection.ts` 改为 PR-1 product projection adapter：缓存最多一个待配对 render/UI 投影，仅在 `validateCoherentGameSessionProjectionPair()` 通过且 basis 完全一致时发布 frame。
3. 从同一 frame 建立 `WorldReadModel`：地图尺寸和实体位置只来自 RenderSnapshot；居民、资源、警报、job marker 状态、lamp/build facts 和 selection detail 只来自 UiDelta。客户端只格式化 def id、枚举、reason code 和有序参数。
4. 初始/关闭/fatal 读模型不包含实体、资源、警报、job、位置或 fixture facts。收到 fatal 后清除已呈现 gameplay frame，记录结构化 lifecycle reason，绝不回退 fixture。
5. 本地选择只保存 entity id。选中投影实体时调用公开 `requestUiDetail({ kind: "entity", entityId })`；清空选择时请求 session detail，所有 inspector facts仍由后续 UiDelta 提供。
6. 更新 Web debug evidence，记录 lifecycle、精确 projection contract 和单一 basis，供 E2E 断言来源；`fixtureId` 只保留在显式 diagnostics/release-gate evidence 中。
7. 更新 focused tests 和 Web E2E：证明默认 InitSession 请求精确、Ready 前不 running、malformed/mismatch fatal、默认 route 不导入 fixture/advance/drain、真实浏览器无需 canvas dispatch 或 UI time helper 即观察到 tick/world hash 推进。

## 风险

- 现有 UI `WorldReadModel` 是历史 Web projection shape，缺少通用 GameSession job kind 和独立 lifecycle surface；适配必须保持通用 label，避免把缺字段猜成 gameplay truth。
- Render/UI 独立到达；若先渲染一半会混 basis。适配器必须原子发布 coherent pair，并丢弃未配对旧帧。
- 现有 E2E 大量历史断言依赖 192x192 fixture、40 actors 和 WM-0152 command surface；默认-route测试需改为 PR-1 事实，同时保留 diagnostics/historical gate 测试的明确入口。
- E2E 会生成 WM-0135 报告；该文件不在 allowedPaths，运行后必须检查并排除生成 diff。
- `playable-worker-projection.ts` 现有文件超过 400 行；重写后应控制在 400 行附近，避免继续累积历史适配层。

## 实施步骤

1. 增加 GameSession Web adapter 和 focused lifecycle/projection tests；验证消息只通过 package roots。
2. 重写产品 projection/read-model adapter，加入 coherent basis、selection detail 和 fail-closed unit coverage。
3. 切换 `shell-bootstrap.ts` 默认 route，移除 fixture、playable command、advance/drain 正常时钟依赖。
4. 更新 E2E debug parser/断言，新增无 synthetic dispatch 的自动推进证据，并把历史 fixture/WM-0152 命令测试限制到 diagnostics/historical evidence。
5. 更新架构文档的 Web migration 状态和 fixture/debug 残留清单。
6. 运行所有 required checks，清理 allowedPaths 外生成物，完成报告、自审、显式文件提交和 `taskctl complete`。

## 测试与基准

- `corepack pnpm typecheck`
- `corepack pnpm exec vitest run apps/web/src/simulation-worker-session.test.ts apps/web/src/product-gate-harness.test.ts packages/sim-protocol/src/game-session-projection.test.ts packages/sim-worker/src/game-session-worker.test.ts`
- `node tools/test-runner.mjs e2e --filter web-shell`
- `node tools/test-runner.mjs e2e --filter worker-smoke`
- `corepack pnpm boundaries:check`
- `node tools/validate-handoff.mjs`
- `taskctl validate` / `taskctl status`
- `git diff --check`
- `corepack pnpm quality`
- Focused source scan proving default bootstrap has no fixture, reviewed playback, playable advance/drain, sim-core, subpath, or package-internal import.

## 回滚

回滚本任务的 Web adapter/bootstrap/test changes 后，默认产品 route 必须回到明确 blocked/loading 状态；不能恢复静态 fixture 作为 town truth，也不能混用 schema v2/v3 或用 advance/drain 伪造正常时钟。

## 完成条件

- 默认 route 精确协商 schema-v3 GameSession v1，只有 active + coherent render/UI pair 才显示 town gameplay。
- 可见 residents/resources/alerts/generic job markers/selection detail 均来自同一 basis，位置只来自 RenderSnapshot。
- malformed、mismatch、missing contract 和 fatal 清空 gameplay projection且不回退 fixture。
- 默认路由无需任何 UI advance/drain 或 synthetic canvas dispatch 即观察到 Worker scheduler 推进。
- fixtures/reviewed playback/playable helpers 仅保留在 tests、diagnostics 或明确历史 gate，报告逐项列出。
- 全部 required checks 通过，变更仅在 allowedPaths，提交后任务停在 `review_requested`。
