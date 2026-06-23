# WM-0009 - Build the content schema validator and Def compiler spike

## 目标

把内容源校验和 Def 编译做成一个可重复运行的最小闭环：能定位非法 ID、重复 ID、缺失引用和本地化键，能稳定输出编译结果顺序，能把示例异常/事件内容编译成不可变目录，并能报告 patch 冲突。

## 已读上下文

- `AGENTS.md`
- `.agents/skills/wuming-town-agent-workflow/SKILL.md`
- `docs/01_design/06_content_and_modding_overview.md`
- `docs/04_content_balance/00_content_design_guide.md`
- `docs/05_tech/04_persistence_mods_security.md`
- `schemas/def-base.schema.json`
- `docs/06_engineering/03_definition_of_done.md`
- `packages/content-schema/src/index.ts`
- `packages/content-compiler/src/index.ts`
- `tools/content-validation.mjs`
- `tools/content-cli/src/index.ts`
- `coordination/reports/WM-0007.md`
- `coordination/reports/WM-0008.md`

## 不做什么

- 不引入任意代码 mod、运行时代码注入或网络能力。
- 不改 `sim-core`、UI、Electron、保存协议或其他无关包。
- 不新增未批准的公共协议或新的运行时依赖。
- 不把问题藏到临时脚本里；校验和编译逻辑要放在可复用包入口中。

## 当前判断

- `packages/content-schema` 和 `packages/content-compiler` 目前只是 smoke 占位入口，缺少真正的 schema/编译实现。
- `tools/content-validation.mjs` 目前只检查工作区和 schema 文件基本形态，不能满足 WM-0009 的内容质量要求。
- 任务验收需要结构化错误和源位置，因此实现里必须显式保留文件、行、列或等价位置信息。

## 方案

1. 先盘点现有内容源目录和样例数据，确定最小支持的 Def / localization / patch 结构。
2. 在 `packages/content-schema` 增加内容源类型、结构化诊断模型、JSON5/JSON 读取和基础 schema 校验入口。
3. 在 `packages/content-compiler` 增加按稳定顺序编译 catalog 的入口，包含 ID 去重、引用解析、本地化键检查和 patch 冲突检测。
4. 提供 `core-smoke` fixture，让异常与事件示例内容不依赖自定义 runtime code 即可编译。
5. 把 `tools/content-validation.mjs` 和 CLI 入口接到新包能力上，确保 `pnpm content:validate` 与 `pnpm content:compile -- --fixture core-smoke` 都可跑。
6. 增补针对失败路径与稳定排序的测试，再跑任务要求的验证命令。

## 风险

- 如果现有内容文件格式不完整，可能需要先补最小样例而不是重写全部内容规范。
- 源位置要真实可读；如果 JSON5/CSV/localization 解析器不能直接给出行列，就需要额外映射层。
- patch 冲突与缺失引用都要报告，而不是自动合并或静默覆盖。

## 验证顺序

1. `pnpm content:validate`
2. `pnpm test --filter content`
3. `pnpm content:compile -- --fixture core-smoke`
4. `pnpm typecheck`
5. `pnpm lint`
6. `pnpm format:check`
7. `pnpm boundaries:check`

## 完成条件

- 四类验收失败都带源位置。
- 编译输出排序稳定。
- 样例异常和事件内容可以编译。
- patch 冲突被显式报告。
- 任务要求的检查全部通过，并记录到 `coordination/reports/WM-0009.md`。
