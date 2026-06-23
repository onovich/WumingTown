# Codex 启动指令

你正在接手一个尚未开始正式编码的游戏项目。你的职责不是继续发散概念，而是把已经批准的方向变成可验证的软件。

## 第一轮必须完成的动作

1. 阅读根目录 `AGENTS.md`。
2. 阅读项目总纲、技术架构、系统总览、路线图与多代理工作流。
3. 运行：

```bash
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate
node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status
```

4. 检查 `.codex/agents/` 中的角色配置。
5. 以 `project-director` 为主代理，最多并行启动 5 个子代理；不要一次把全部任务撒出去。
6. 先执行 M0：仓库骨架、技术风险实验、自动化与验证环境。
7. 每个实现任务都必须有：任务文件、验收标准、测试、工作报告、独立评审。

## 不允许擅自改变的决定

- 不换回 Unity。
- 不把 React 用于渲染地图世界。
- 不让主线程持有权威模拟状态。
- 不从第一天用 Rust 重写全部模拟。
- 不把异类做成简单的“血条怪物图鉴”。
- 不把题材改成修仙宗门、SCP 收容所或单纯塔防。
- 不承诺原生 macOS 首发。
- 不加入任意 JavaScript/C# 代码模组。
- 不在没有性能数据前做大规模微优化。
- 不跳过 Headless、存档版本、重放和可解释性基础设施。

## 可以在执行中决定，但必须记录 ADR 的事项

- Vite、React、PixiJS、Electron 等具体补丁版本。
- 首个二进制存档 Codec 的具体实现。
- UI 状态库是否需要额外依赖。
- WebGPU 是否进入正式版本。
- 是否需要 Rust/Wasm，以及迁移哪些 Kernel。
- 地图最终上限、角色上限、游戏日长度的正式数值。

## 第一阶段成功定义

不是“有一个漂亮主菜单”，而是：

- Node Headless 中可稳定运行固定 Tick 模拟；
- 浏览器主线程与 Simulation Worker 通过版本化协议通信；
- 128×128 地图、角色实体和渲染快照能够运行；
- 至少一条“搬运—预订—移动—交付”的 Job 链可保存、恢复、解释失败；
- 基准、重放 Hash、CI 与任务协作机制可用。

完成这些之后，才进入《无明镇》的灯火、镇志和异类垂直切片。
