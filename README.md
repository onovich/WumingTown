# 《无明镇》项目交接包

版本：Handoff 0.1  
日期：2026-06-23  
状态：**概念与技术方向已锁定，尚未开始正式产品代码**

本目录不是讨论稿，而是交给 Codex 执行团队的仓库起点。解压后，应先阅读：

1. [`CODEX_START_HERE.md`](CODEX_START_HERE.md)
2. [`AGENTS.md`](AGENTS.md)
3. [`docs/00_project/00_executive_summary.md`](docs/00_project/00_executive_summary.md)
4. [`docs/05_tech/01_technical_architecture.md`](docs/05_tech/01_technical_architecture.md)
5. [`docs/07_roadmap/00_roadmap.md`](docs/07_roadmap/00_roadmap.md)
6. [`docs/08_codex/00_multi_agent_operating_model.md`](docs/08_codex/00_multi_agent_operating_model.md)

## 已锁定的产品方向

- 名称：**《无明镇》**，英文工作名 **Wuming Town / The Lantern Frontier**；英文名未最终定案。
- 类型：以人物涌现叙事为核心的 2D/2.5D 殖民地模拟与规则型志怪调查游戏。
- 核心幻想：白天经营普通人的聚落；黄昏布置人类秩序；夜晚在不完全理解的规则中维持灯火、调查异类并承担契约后果。
- 三大独占系统：**灯火边界、镇志知识、旧债契约**。
- 首发平台：Windows 桌面版与 Chromium 系浏览器版并行验证；原生 macOS 首发延后，Mac 用户优先通过 Web 版游玩。
- 技术路线：TypeScript-first、独立 Simulation Worker、PixiJS 8、React UI、Electron 桌面壳；性能热点经过测量后才迁移 Rust/Wasm。
- 开发原则：模拟与表现彻底分离；所有关键行为可解释；禁止全图扫描式 AI；从第一天支持 Headless、重放、基准和版本化存档。

## 本包包含

- 产品与策划总纲
- 游戏程序设计文档
- 14 份核心系统设计
- 世界观、文化版图、历史、派系与命名规范
- 内容填充、数值与平衡指南
- 技术栈、架构、性能、存档、Worker 协议与安全文档
- 极严格的代码规范、工作流、评审与完成定义
- 路线图、里程碑门禁、首 90 天任务和潜在扩展内容
- Codex 多角色配置、模型分工与协作协议
- 可安装的 Codex Skill：`.agents/skills/wuming-town-agent-workflow`
- 文件型任务控制面与线程邮箱脚本
- 模板、Schema 草案和起始任务队列

## 重要边界

该项目只借鉴殖民模拟的通用机制与公开可研究的架构思想。不得复制《环世界》或其他游戏的源码、命名、文本、图像、音频、事件、数值表或专有实现。涉及反编译材料时，仅用于理解抽象边界，执行时必须采用独立命名、独立接口和独立实现。

## 如何开始

在仓库根目录启动 Codex，给主线程发送：

> 阅读 CODEX_START_HERE.md 与 AGENTS.md。作为 project-director，使用 $wuming-town-agent-workflow 初始化协调目录，检查起始任务依赖，然后按 Roadmap M0 开始。先做计划和风险核对，不要立即批量写产品代码。

然后让主线程按文档生成实际 monorepo 包与测试骨架。
