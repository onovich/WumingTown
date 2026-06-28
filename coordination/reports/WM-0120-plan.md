# WM-0120 - Accessibility readability and UI-scale pass

## 目标

在不触碰 authoritative simulation 的前提下，让 Web/Desktop shell 在 `zh-CN`
与 `en` 下具备可用的 UI scale 设置、更明确的非颜色状态信号，以及可复验的
可读性/滚动/键鼠/对比验证证据。

## 已读上下文

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `coordination/tasks/WM-0120.json`
- `coordination/reports/WM-0111-m8-scope-amendment.md`
- `coordination/reports/WM-0118.md`
- `coordination/reports/WM-0119.md`
- `docs/06_engineering/03_definition_of_done.md`
- `docs/06_engineering/05_testing_policy.md`
- `PLANS.md`
- 现有实现与测试：
  `packages/ui-react/src/localization.ts`,
  `packages/ui-react/src/shell-main-menu-surface.ts`,
  `packages/ui-react/src/shell-settings-panel.ts`,
  `packages/ui-react/src/shell-hud.ts`,
  `apps/web/src/shell-bootstrap.ts`,
  `apps/web/src/shell-locale.ts`,
  `apps/web/src/web-shell.e2e.test.ts`,
  `apps/desktop-electron/src/desktop-shell.e2e.test.ts`

## 不做什么

- 不修改 `packages/sim-core/**`、`packages/sim-worker/**` 或任何 authoritative
  simulation / worker 协议。
- 不引入新运行时依赖、不改 Electron preload/API 边界、不添加 telemetry、
  account、paid-service、store/release 行为。
- 不重做现有 HUD 信息架构；优先复用现有 settings/main menu/HUD 结构。

## 当前事实与假设

- 已验证事实：现有 shell 已有 locale 持久化、start surface/HUD 响应式 E2E、
  以及显式 diagnostics 隔离。
- 已验证事实：现有状态徽章大多已有文字，但 UI scale 仍只有 renderer zoom
  调试信息，没有玩家可控的 shell 显示缩放设置。
- 已验证事实：Web/Desktop E2E 已覆盖视口矩阵与基础可达性，但对对比度、
  长文本与缩放持久化的证据还不够集中。
- 设计决定：把 UI scale 作为 shell 本地偏好，与 locale 一样仅影响 React/DOM
  壳层呈现，不影响 Pixi 世界、read model 或 sim authority。
- 临时假设：采用离散 scale 档位比自由输入更稳，便于本地化、持久化和稳定
  E2E 断言。

## 方案

- 扩展 shell 本地偏好模型，使 locale 与 UI scale 共享同一类本地设置边界，
  并保留 session-only / persistent 诊断语义。
- 在 `ShellSettingsPanel` 与 start-surface settings 中增加本地化的 UI scale
  控件和当前状态文案；必要时在 shell root 暴露 `data-ui-scale` 供 E2E 读取。
- 通过 CSS 变量或根容器缩放参数驱动 HUD 排版，确保紧凑视口下仍可滚动访问，
  并避免影响 Pixi authoritative world 渲染逻辑。
- 为风险/状态补充显式文本或 aria 文案，确保关键状态不是仅靠颜色传达。
- 扩展 Web/Desktop E2E：验证 scale 切换、持久化、缩放后布局可达性、滚动区、
  长文本约束、键鼠基础和对比/非颜色信号。
- 视需要补充 `ui-react` 单测，锁定本地化字符串、默认状态和 DOM 标记。

## 风险

- 缩放会放大已有布局边界，导致 390x720 或 1280x720 下滚动/遮挡回归。
- 若直接缩放整层 overlay，可能影响点击命中或 fixed/absolute 布局计算。
- 新偏好模型若设计过大，容易把 locale 逻辑复杂化并引入无关状态。
- E2E 若依赖过多视觉像素细节，会降低稳定性；应以 DOM 可达性和有限阈值为主。

## 实施步骤

1. 审查当前 locale/settings 状态流，确定最小扩展点用于 UI scale 偏好。
2. 在 `coordination/reports/WM-0120-plan.md` 固化方案和风险边界。
3. 实现 UI scale 本地偏好、设置控件、本地化文案和 shell root 标记。
4. 在 HUD/start-surface 中补强非颜色状态文本或 aria 信号，并处理长文本换行/
   滚动细节。
5. 扩展 `ui-react` 与 Web/Desktop E2E，覆盖 scale、可读性、scroll 和
   bilingual 行为。
6. 运行 required checks，整理 `coordination/reports/WM-0120.md`，再执行
   `taskctl complete`。

## 测试与基准

- `corepack pnpm typecheck`
- `corepack pnpm test:e2e --filter web-shell`
- `corepack pnpm test:e2e --filter desktop-shell`
- `corepack pnpm quality`
- `node tools/validate-handoff.mjs`
- `node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate`
- `git diff --check`
- 如需更快局部反馈，先运行相关 `ui-react` 单测和单文件 E2E。

## 回滚

- UI scale 仅为 shell 本地设置；若方案不稳，可回退到 locale-only 偏好模型。
- 若某个缩放档位导致紧凑视口不可用，可先移除该档位，保留更稳的离散档。
- 若对比/长文本验证需要过多 UI 改动，可保留语义与测试修复，避免扩大范围。

## 完成条件

- `zh-CN` 与 `en` 在 required viewports 下文本仍可读、无关键裁切或不可达区域。
- 重要状态包含文本/aria/非颜色信号，而不只依赖颜色。
- UI scale 或 font-scale 行为可在 shell 中使用，并有自动化测试覆盖。
- 键盘/鼠标基础、contrast、long text、scroll regions 有明确测试或证据。
- 不降低现有 E2E，不触碰 Simulation Worker/headless authoritative boundary。
