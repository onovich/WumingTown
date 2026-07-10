# 可玩产品恢复路线图

Status: WM-0161 formal product rebaseline. This document is the authoritative
roadmap for product work after the historical M0-M8 capability milestones. It
does not invalidate accepted deterministic hashes, benchmarks, security
boundaries or platform evidence. It does replace task-count and milestone
closeout as the measure of current product readiness.

## 一、执行结论

《无明镇》现有仓库具备可复用的模拟、协议、内容、平台和测试基础，但默认
Web/Windows 路径还不是一个统一、持续运行、可保存、可理解的殖民地模拟游戏。

后续产品工作必须遵循以下顺序：

1. 先建立一个统一的权威 `GameSession`。
2. 再让居民持续、自主、可感知地生活和工作。
3. 再接入通用选择、命令、工作优先级和建造流程。
4. 再重做地图优先的玩家界面与首玩体验。
5. 再完成可保存的 30 分钟垂直切片。
6. 最后重返性能、平台和发布门禁。

任何阶段未过门禁，不得用更多内容、更多任务、更多静态文案或更多测试夹具掩盖
基础问题。

## 二、历史里程碑的正式定位

| 历史阶段 | 保留价值 | 不再代表 |
| --- | --- | --- |
| M0-M1 | 工程骨架、确定性内核、Worker/Headless 基础 | 可玩游戏 |
| M2 | Job、Reservation、路径、物流和建造能力证据 | 已集成的玩家建造系统 |
| M3 | 需求、健康、医疗、情绪、关系和日夜能力证据 | 持续生活的城镇 |
| M4 | 灯网、镇志、旧债、镇规和危机链证据 | 默认产品中的完整核心循环 |
| M5 | 内容框架、异类、派系、治理和季节事件证据 | 可长期游玩的 Alpha |
| M6 | Web/Windows 壳层、输入、存储、打包和安全证据 | 同规格 Web 游戏或正式 Windows 产品 |
| M7 | 教程、隐私、外测和商店材料准备证据 | Early Access 已就绪或已获批准 |
| M8 | 内部 1.0 范围、内容、i18n、长存档和回归证据 | 可玩的 1.0 产品或公开发布批准 |

历史里程碑保持 `done`，因为其局部能力和证据真实存在。产品路线从 PR-0 重新
计量，不把历史 `done` 数量换算为产品完成百分比。

## 三、可玩产品的定义

本路线图中的“可玩”至少意味着：

- 新游戏进入同一个持续运行的权威城镇，而不是静态底图加专用演示切片。
- 正常速度下模拟以固定 30 TPS 连续推进，玩家可以暂停和切换速度。
- 默认可见居民全部来自同一个权威世界，会自主选择、执行、完成或放弃工作。
- 玩家可以使用真实鼠标和键盘选择居民、地块、物品与建筑，并发出有效命令。
- 至少存在灯火、搬运和建造三条通用玩家命令链。
- 玩家能从地图和简洁 UI 看懂移动、工作、阻塞、完成和失败。
- 游戏可以在任意稳定 Tick 保存，重新启动后继续同一个权威状态。
- 一名未读仓库文档的玩家可以独立完成 30 分钟垂直切片。

静态角色文案、shell-local 状态、debug payload、人工派发 canvas 事件、截图和
预录视频都不能单独满足上述定义。

## 四、目标架构

```text
Compiled Content + ScenarioDefinition
                 |
                 v
        GameSessionRuntime (authoritative)
        - world/time/RNG
        - residents/needs/health/relations
        - jobs/offers/reservations/pathing
        - items/storage/building/production
        - lamps/Chronicle/obligations/events
                 |
          fixed 30 TPS in Simulation Worker
                 |
       +---------+----------+
       |                    |
 RenderSnapshot/UiDelta   SaveSnapshot
       |                    |
 Pixi presentation       OPFS/Electron adapter
 React player HUD
```

### 架构硬约束

1. `GameSessionRuntime` 是产品唯一权威运行时。历史场景可作为初始化器、回归夹具
   或测试驱动，但不得继续成为彼此互斥的产品运行时。
2. `ScenarioDefinition` 只描述初始内容、地图、种子、目标和可选脚本，不拥有
   Tick、Job、居民位置或存档权威。
3. Worker 自己维护连续 Tick、暂停、速度和快照节奏。主线程不得通过 UI promise
   或命令 drain 模拟正常时间流逝。
4. Pixi 对离散权威快照做表现插值，但不改变权威位置。非瞬时工作不得在同一
   个可见帧内跳过 moving 和 working 全过程。
5. React 只显示结构化读模型和发送显式命令。玩家可见状态不得由静态 fixture
   prose 伪装成模拟事实。
6. SaveSnapshot 必须包含恢复同一 `GameSession` 所需的权威 Store、随机流、
   Tick、命令尾和内容清单。壳层选择证据不是游戏存档。
7. 默认产品路径不得依赖 `WEB_PRODUCT_GATE_READ_MODEL`。该 fixture 可以保留在
   测试、Storybook 或显式 diagnostics 中。

## 五、阶段依赖

```text
PR-0 Product Truth Reset
  -> PR-1 Integrated GameSession
      -> PR-2 Autonomous Town Life
      -> PR-3 Player Agency And Building
          -> PR-4 Map-First Product UX
              -> PR-5 Saveable 30-Minute Vertical Slice
                  -> PR-6 Product And Platform Hardening
                      -> PR-7 Content Scale And Owner Release Decision
```

PR-2 和 PR-3 在 PR-1 公共契约 verified 后可以并行，但同时最多运行三个重写任务。
PR-4 可以提前做信息架构和 UI kit，不得提前伪造尚未存在的命令或居民行为。

### 阶段规模与主要责任

| 阶段 | 相对规模 | 主要责任角色 | 可对外使用的状态名称 |
| --- | --- | --- | --- |
| PR-0 | S | project-director / reviewer | product rebaseline |
| PR-1 | XL | systems-architect / simulation-engineer | integrated prototype |
| PR-2 | L | simulation-engineer / client-engineer | autonomous prototype |
| PR-3 | L | simulation-engineer / client-engineer | commandable prototype |
| PR-4 | L | gameplay-designer / client-engineer | comprehensible prototype |
| PR-5 | XL | cross-functional / reviewer | internal playable |
| PR-6 | L | qa-performance / platform owners | controlled-test candidate |
| PR-7 | ongoing | gameplay/content/art/product | release candidate only after Owner approval |

相对规模不是日历承诺。当前集成债务尚未完成清单，不能负责任地给出 PR-1 至
PR-5 的周数。WM-0162 必须先输出 PR-1 工作分解、关键路径和容量假设；此后每个
阶段 planning task 更新自己的工期区间。任何状态名称都不得提前使用：例如只有
PR-5 verified 后才可以称为 `internal playable`。

## PR-0：产品事实与门禁重置

### 玩家结果

无直接玩家功能。项目停止把局部技术证据描述为产品完成。

### 交付

- 本路线图成为后续产品工作的权威入口。
- M0-M8 重分类为历史能力证据。
- 当前静态/动态世界拼接、真实输入、NPC 感知、存档和测试假阳性成为显式停止线。
- WM-0154 至 WM-0156 的旧 closeout 语义被冻结并等待重整。
- 只创建一个下一阶段规划入口，不批量生成完整 PR-1 至 PR-7 实现任务。

### 退出门禁

- 路线图经独立 reviewer verified。
- `coordination/project-state.json` 与路线图一致。
- 下一任务只规划 PR-1 架构和有限 DAG，不启动实现。

### 非目标

不修改产品代码、协议、存档、平台结论或公开发布状态。

## PR-1：统一权威 GameSession

### 玩家结果

进入新游戏后，即使玩家不点击任何命令，城镇时间和居民状态也会持续推进。

### 技术范围

- 定义 `GameSessionRuntime` 的生命周期、Tick、Store 组合和公开读取接口。
- 将现有地图、居民、需求、Job、Reservation、路径、物品、存储、灯火和建造
  能力接入同一个最小运行时。
- Worker 启动、暂停、速度、快照和 backpressure 使用真实连续调度。
- Web、Headless 和 Electron 使用相同 session 初始化路径。
- 建立从历史场景 runner 到统一 session initializer 的迁移表。
- 默认 Web 路径停止使用静态产品门禁世界作为游戏事实源。

### 最小场景

- 地图：不小于 64 x 64 的可导航镇区。
- 居民：至少 8 名权威居民。
- 资源：食物、木材、石料、灯油。
- 设施：库存区、床位、灯柱、一个可建造结构。
- 时间：白日、黄昏、夜间和黎明字段可连续推进。

### 退出门禁

- 正常速度连续运行 10 分钟，无 UI advance helper 驱动 Tick。
- 8 名默认可见居民、资源、警报和选择详情都来自同一 session。
- Headless 和浏览器 Worker 在固定命令流上 Hash 一致。
- 100000 Tick 不出现 Job、Reservation、队列或资源守恒泄漏。
- 默认产品路由不读取静态 M6 fixture 作为城镇状态。
- 实现报告列出每个已复用 Store 和仍未接入的历史能力。

### 停止线

- 任一可见居民仍只靠静态文案表现工作。
- Worker 仍通过重跑完整历史场景生成每次投影。
- UI timer、promise 或 drain helper 继续拥有正常游戏时间。

## PR-2：自主且可感知的城镇生活

### 玩家结果

玩家暂停观察时，可以看到居民自己吃饭、休息、搬运、巡灯、治疗、等待或因具体
原因闲置。居民不是等待玩家命令才开始活动的棋子。

### 技术范围

- 接入需求、班次、能力、工作供给、Top-K 选择、Reservation 和路径结果。
- 支持 idle、claiming、moving、working、blocked、completed、failed 和
  interrupted 的权威状态。
- Pixi 对位置快照插值，显示目标、路径、工作标记和进度。
- HUD 只显示与当前选择、风险或目标有关的居民状态。
- 暂停、1x、2x、3x 生效；Web 更高速率保持平台门禁约束。

### 退出门禁

- 8 名居民连续自主运行一个完整游戏日，不需要玩家逐个分配任务。
- 同时至少有 3 名居民执行不同类型工作。
- 正常速度下，跨越 4 个以上地块的移动不会在一个渲染帧内完成。
- working 状态至少产生两个可见投影，玩家能看见进度变化。
- 闲置、阻塞和失败均显示结构化原因、目标及建议修复入口。
- 真实屏幕录制和 reviewer 观察确认行动可感知，debug payload 只作辅助证据。

### 停止线

- 通过人为延迟 UI 假装居民行动，而权威状态已经瞬时完成。
- 居民思考扫描全地图或绕过现有 WorkOffer/Reservation 体系。
- 只有测试专用的两个 Pawn 会移动。

## PR-3：玩家能真正组织工作与建造

### 玩家结果

玩家可以选择对象、设置工作倾向、放置多个有效建筑蓝图，并观察资源搬运、施工、
完成或失败。

### 必须存在的命令链

1. 灯火：选择灯位或灯网缺口 -> 优先补给/维修 -> 居民认领 -> 移动/工作 ->
   灯位与风险更新。
2. 搬运：选择物品或库存区 -> 设置优先级/紧急搬运 -> 预留 -> 搬运 ->
   库存与任务更新。
3. 建造：选择建筑类型 -> 在多个可用地块放置 -> 搬运材料 -> 施工 ->
   完成结构或给出阻塞原因。

### 技术范围

- 通用选择、hover、context action 和 command basis。
- 可扩展建筑 Def、footprint、旋转预留位和交互位。
- 通用 Blueprint/BuildOrder，不把固定灯柱格写死在产品 runtime。
- 工作优先级和紧急命令改变 offer 排序，不直接指定瞬移式执行。
- 缺人、无路、缺材料、被预留、镇规冲突和 stale basis 均返回结构化原因。

### 退出门禁

- 玩家可在至少 5 个不同有效地块放置同类蓝图。
- 两个建造订单可以并存，材料与 Reservation 无重复占用。
- 取消、目标失效、无路和材料不足都能正确清理状态。
- 1280x720、1366x768、1920x1080 和 2560x1440 使用真实鼠标命中目标。
- E2E 使用 Playwright 鼠标/键盘事件；禁止直接向 canvas dispatch 合成事件作为
  玩家输入验收。

### 停止线

- 命令只对一个固定 EntityId 或 CellRef 有效。
- disabled 按钮没有玩家可见原因。
- React/Pixi 直接创建 Job、修改位置或补充资源。

## PR-4：地图优先的产品 UX

### 玩家结果

陌生玩家进入游戏后，先看到城镇、居民和一个清晰目标，而不是教程文章、状态板或
诊断面板。玩家可以通过地图和上下文操作自然学习。

### 布局基线

- 顶部：时间、速度、关键资源、最多三个警报。
- 中央：地图、居民、路径、灯光和任务标记，是最大视觉区域。
- 右侧：当前选择的紧凑检查器。
- 底部：全局模式和当前对象行动栏。
- 管理页面：居民、工作、建造、镇志和旧债使用独立全屏/抽屉视图。
- 设置、diagnostics、fixture、Hash、协议和发布结论不在默认玩家路径。

### 技术范围

- 将 HUD、检查器、命令栏、资源栏和管理入口拆成可维护组件。
- 修复 HUD 覆盖世界输入的问题，并建立 map safe-area 合同。
- 使用语义 token 和资产插槽，不等待最终切图。
- 保持 zh-CN/en、系统语言默认、UI scale、键盘焦点和非颜色状态表达。
- 首玩引导改为短目标、高亮和上下文提示，不使用长篇首屏说明。

### 退出门禁

- 1280x720 首屏中地图占可用画面的主要部分，核心目标可直接命中。
- 新玩家在 60 秒内成功暂停/恢复、选择居民并打开一个有效命令。
- 新玩家在 5 分钟内完成第一条灯火或建造链，不阅读仓库文档。
- 关键任务的真实 hit target 不被 HUD 覆盖；自动检查 `elementFromPoint`。
- 真实中文和英文长文本不遮挡地图关键目标或命令。
- 独立 reviewer 明确判断界面是游戏 HUD，而非 diagnostics/status board。

### 停止线

- 用增加说明文字解决交互不可发现性。
- 为了截图好看隐藏实际失败、阻塞或未接线命令。
- 在没有真实玩法时先投入大规模最终美术生产。

## PR-5：可保存的 30 分钟核心垂直切片

### 玩家结果

玩家可以从一个小镇白日或黄昏开始，组织居民、补足灯火、完成一项建造、处理一项
生活压力和一个低压异常，并在黎明看到结果与原因。

### 内容边界

- 8 至 12 名居民。
- 一张经过设计的镇区地图。
- 灯火、搬运、建造、食物、休息和轻伤/治疗。
- 一条镇志证据链、一项旧债或镇规影响。
- 一个低压夜间事件和一页黎明复盘。
- 不要求完整 M8 异类、派系和终局内容进入本切片。

### 存档范围

- 可在移动、搬运、施工、休息、事件进行中保存。
- 重新启动 Web/Windows 后恢复相同 Tick、居民、Job、Reservation、资源、
  地图、事件和随机流。
- 继续按钮恢复权威游戏，不只恢复壳层选择。
- 不在本阶段承诺跨公开版本兼容。

### 退出门禁

- reviewer 从新游戏完成一段不少于 30 分钟的真实会话。
- 会话包含至少三种玩家命令、一次结构化失败和一次成功修复。
- 在 10 至 20 分钟随机稳定点保存、重启、加载并继续至黎明。
- uninterrupted 与 save/resume 在约定检查点 Hash 一致。
- 默认路径无 diagnostics、fixture、product gate 或未接线槽位文案。
- 至少 3 名未参与实现的测试者完成首 10 分钟，2 名以上无需口头指导完成
  第一目标；失败必须进入问题清单，不得只记录平均成功率。

### 停止线

- 只有自动化脚本能完成切片。
- 存档丢弃进行中的 Job、Reservation、事件或角色状态。
- 通过跳过模拟阶段或预设完成结果来压缩演示。

## PR-6：产品与平台硬化

### 玩家结果

Windows 受控外测和 Web demo 使用同一核心游戏会话，长时间运行、窗口切换和保存
恢复不会破坏体验。

### 技术范围

- 用真实 `GameSession` 重跑 Worker、渲染、内存和加载基准。
- 拆分浏览器安全内容 Schema 与 Node 文件加载模块。
- 拆分 Web 与 Electron 构建输出，清理大 chunk 和运行时警告。
- 完成 Windows 窄 save bridge 和诊断 bridge，保持 preload 白名单。
- 运行窗口化、全屏、失焦、恢复、长时 soak 和异常关闭恢复。

### 退出门禁

- Windows Electron 正常 Tick P95 <= 8 ms，主线程帧 P95 <= 12 ms。
- Chrome/Edge Web 正常 Tick P95 <= 12 ms，主线程帧 P95 <= 12 ms，或由
  Owner 接受明确降级规格并保持 `demo-only`。
- 192 x 192、40 活动角色、20k 实体目标使用真实集成 session 测量；若不通过，
  按平台矩阵降级，不以 fixture 数据代替。
- 连续 2 小时 soak 无持续队列和内存增长。
- Windows/Web 在受支持边界内可导入导出同一版本存档容器。
- `pnpm quality`、`pnpm ci:local`、E2E、基准、存档重放和安全检查通过。

### 停止线

- 性能证据仍来自静态 40-visible-actor fixture。
- 浏览器 bundle 继续包含未隔离的 Node 文件系统路径。
- 为通过门禁弱化确定性、Worker 权威或 Electron 沙箱。

## PR-7：内容扩展与 Owner 发布决策

### 玩家结果

在核心 30 分钟体验稳定后，逐步把已验证的镇志、旧债、派系、治理、异类和终局
能力接入同一个产品世界，形成可重复游玩的内容规模。

### 顺序

1. 扩展到 2 至 3 小时稳定局。
2. 接入 3 个异类和基础派系/治理。
3. 扩展季节、事件池、建筑和生产内容。
4. 完成正式美术、音频、文化审查和本地化润色。
5. 更新外测、EA 或 1.0 决策材料。

### 退出门禁

- 新内容通过数据管线进入，不为每项内容复制新 runtime。
- 10 小时局内无结构性死锁、存档漂移或性能持续增长。
- 核心灯火、镇志、旧债和居民生活在同一世界产生可解释交互。
- Owner 明确决定 EA、公开试玩、继续封闭开发或 1.0 路径。

PR-7 本身不批准公开发布、EA、商店提交、签名、遥测、账户、付费服务或公开
存档兼容承诺。

## 六、产品证据政策

### 三条证据线

| 证据线 | 必须证明 | 不能替代 |
| --- | --- | --- |
| Simulation | 确定性、权威 Store、ReasonCode、存档、性能、不变量 | 玩家是否看懂和能操作 |
| Interaction | 真实鼠标/键盘、命中、布局、状态变化、反馈、可访问性 | 居民是否真的由权威模拟驱动 |
| Human play | 无仓库知识玩家能否发现目标、完成命令、理解失败 | 自动回归和性能证据 |

任何产品阶段都必须同时拥有三条证据线。三者不能相互代替。

### 禁止作为单独验收依据

- 直接调用内部 handler 或向 canvas 人工 dispatch 事件。
- 只读取 `wm-shell-debug` 或其他 debug payload。
- 静态 fixture 中写着“正在工作”“正在移动”。
- 只验证按钮存在、文案本地化或矩形未溢出。
- 关闭动画后的截图。
- 实现者自己完成的唯一一次演示。

### 行为捕获

PR-2 之后，每个可玩 gate 至少保留一段连续行为证据，显示真实输入、时间推进、
居民移动、工作、世界变化和 UI 反馈。截图用于布局回归，不能证明时间行为。

## 七、产品记分板

| 指标 | WM-0161 基线 | PR-5 最低门禁 | PR-6 目标 |
| --- | ---: | ---: | ---: |
| 同一权威世界中的默认可见居民 | 2 个动态覆盖，其余静态 | 8-12 | 40 活动角色目标 |
| 连续游戏时间 | 无默认连续 30 TPS | 30 分钟真实会话 | 2 小时 soak |
| 通用玩家命令链 | 固定补灯/固定建造切片 | 灯火、搬运、建造 | 扩展工作/管理命令 |
| 通用建造位置 | 1 个固定目标 | 至少 5 个有效位置 | 内容驱动建筑目录 |
| 权威游戏存档 | 不支持，只有壳层证据 | 进行中状态可恢复 | Web/Windows 受控互操作 |
| 真实输入门禁 | 1280x720 核心目标可被覆盖 | 四个关键视口通过 | 全矩阵与桌面包通过 |
| 无指导首玩 | 未通过 | 3 名测试者，2 名完成第一目标 | 扩大受控外测 |
| Web 产品规模性能 | fixture/投影证据 | 垂直切片稳定 | 192x192/40/20k 实测或明确降级 |

记分板只按当前权威证据更新。不得将“存在代码”“任务 done”或“未来目标”填写为
已通过。

## 八、任务运行模型

1. 每个 PR 阶段先有一个 reviewed planning task，再创建有限实现 DAG。
2. 同时最多三个 write-heavy 任务，且必须有一条明确集成主线。
3. 不一次性创建 PR-1 至 PR-7 的全部实现任务。
4. 每阶段必须包含 integration task 和独立 product acceptance task。
5. 阶段 closeout 只能引用当前产品路径，不得用历史 fixture 或独立 scenario 替代。
6. reviewer 必须检查真实运行页面和行为，不只检查报告、Hash 和 debug payload。
7. 发现产品 gate 失败时，先创建修复任务；不得继续推进内容或 closeout。

### 当前任务处置

- WM-0154：保留为历史可玩证据任务，但在 WM-0162 完成重整前不得 claim。其
  原验收不足以证明真实输入和持续可感知行为。
- WM-0155：旧版 product-UX verdict 任务，不得基于 WM-0154 原语义提升产品
  readiness。
- WM-0156：旧版 remediation closeout，不得在 PR-5 前关闭“产品可玩”问题。
- WM-0157 至 WM-0160：保留为 Worker session/projection/advance/drain 基础资产；
  drain 只可用于命令等待、测试或工具，不可作为正常 30 TPS 游戏时钟。
- WM-0161：本路线图与产品事实重置。
- WM-0162：唯一预创建的下一入口，只负责 PR-1 `GameSession` 架构和有限任务
  DAG，不执行产品实现。

## 九、Owner Gate

以下事项仍需 Owner 明确批准：

- 公开发布、Early Access、公开试玩招募或商店提交。
- 签名、安装器、更新器、Steam/平台接入或公开分发。
- 遥测、账户、联网服务、崩溃上传、付费服务或公开反馈系统。
- 公开存档兼容承诺、跨版本迁移承诺或云存档。
- Web 平台取消、超出 `demo-only` 的公开承诺或 Windows verdict 提升。
- 核心产品身份、主要美术方向或外部资产许可承诺的重大变化。

内部架构拆分、可逆 UI 结构、临时占位美术、测试结构和阶段内技术实现仍可按
已评审任务自主执行。

## 十、下一步

WM-0161 verified、integrated、done 后，只允许自动解锁 WM-0162：

`Integrated GameSession architecture and PR-1 reviewed task DAG`

WM-0162 必须先完成现有 Store/场景/协议/存档能力的集成清单，定义统一 session
接口、连续 Worker 调度、产品投影和存档边界，再创建不超过三个同时可写的 PR-1
实现任务。PR-2 及以后任务不得提前 claim。
