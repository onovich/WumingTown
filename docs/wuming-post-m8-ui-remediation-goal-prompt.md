# 《无明镇》Post-M8 UI / Playability / Art-Direction Remediation Prompt

把下面整段发送给当前唯一根线程 `project-director / Beacon`。

```text
/goal 完成《无明镇 / Wuming Town》Post-M8 UI、可玩交互、多语言与视觉产品化修复门禁。持续自主执行，直到 Owner 指出的 UI/可玩性阻塞项被完整审计、任务化、实现、独立评审、合入 origin/main，并形成新的 release-readiness verdict。不得执行 public release、EA launch、store submit、signing、telemetry、accounts、paid services 或 public save compatibility。不得自行进入任何公开发布阶段。

你继续担任唯一 active project-director / Beacon。

==================================================
一、Owner 新增事实与阻塞判断
==================================================

这是项目所有者的正式反馈和修正要求，编号：

OWNER-AMENDMENT-2026-06-28-POST-M8-UI-PLAYABILITY-REMEDIATION

Owner 亲自运行当前 demo 后得出结论：

1. 当前 UI 仍然非常简陋，距离可发布水平差距巨大。
2. 当前界面仍像内部 harness / diagnostics / product gate screen，而不是玩家可玩的正式游戏。
3. 当前语言混搭，中英混杂。
4. 场景中没有任何对象可被鼠标点中，包括按钮和角色。
5. 场景或相机不可拖拽。
6. 目前实际玩家可玩性接近 0。
7. M8 closeout 不能被解释为“可以公开发布”。
8. 后续不得进入公开发布、商店、签名、EA、1.0 launch 或最终发布承诺。
9. 必须先做 UI 产品化、交互可玩性、多语言、响应式适配与美术方向落地修复。

Owner 还提供了三张 UI 原画作为方向参考。内部美术 AI 已评估：

- B 图整体布局可用性最高：
  顶部时间/资源、左侧居民、中央格网、右侧选中对象、底部全局命令和情境命令最清晰。
- C 图美术气质最好：
  木、纸、墨、灯火、民俗恐怖氛围最强。
- A 图灯圈和路径表现有参考价值。
- 建议模块取材：
  - 整体布局：B；
  - 美术气质：C；
  - 地图灯光/路径：A + C；
  - 左侧居民列表：B；
  - 右侧对象详情：C + A；
  - 顶部警报：C 或 B；
  - 底部命令栏：B + C。

这些 owner observations 是当前 release-readiness 的硬阻塞证据。你必须把它们纳入控制面，不得将它们视为普通美术建议。

==================================================
二、当前基线
==================================================

以下只作为启动线索，必须通过仓库独立验证：

- M0–M8: done
- main / origin/main expected:
  611d2a135c2ff516e1199a25e23219929b5f0b3b
- existing tasks expected:
  128 done
- unread inbox expected:
  0
- WM-0127 M8 closeout:
  done / verified
- WM-0128 benchmark stop sign:
  done / verified
- Web verdict:
  demo-only
- Windows verdict:
  unsigned ready-for-controlled-external-test
- No public release / EA / store / signing / telemetry / accounts / paid services approved
- expected working tree:
  clean
- expected worktrees:
  main only

如果实际 origin/main 高于该 commit，不得回退；审计新增提交并以实际 origin/main 为准。

==================================================
三、先完成启动审计
==================================================

在任何修改前读取并遵守：

- AGENTS.md
- CODEX_START_HERE.md
- .agents/skills/wuming-town-agent-workflow/SKILL.md
- .codex/config.toml
- .codex/agents/*.toml
- coordination/roles.json
- coordination/project-state.json
- coordination/thread-registry.json
- coordination/tasks/*.json
- coordination/reports/WM-0127.md
- coordination/reports/WM-0128.md
- coordination/reports/WM-0127-future-owner-release-handoff.md
- docs/07_roadmap/*
- docs/05_tech/*
- docs/06_engineering/*
- docs/08_codex/*
- docs/01_design/*
- docs/02_systems/*
- docs/04_content_balance/*
- all accepted ADRs
- PLANS.md

随后：

1. 确认当前分支为 main。
2. fetch origin。
3. 使用 fast-forward-only 同步 main。
4. 确认 main 与 origin/main 一致。
5. 检查 git status、worktree、inbox、thread registry、是否有旧 goal 或残留子代理。
6. 不使用 reset --hard、force push、历史重写或破坏性清理。

运行：

- node tools/validate-handoff.mjs
- node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate
- node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status
- git diff --check
- pnpm quality

如果这些基础验证失败，先记录证据并按工作流修复控制面或质量门禁，不得跳过。

==================================================
四、建立 Post-M8 UI Remediation 阶段
==================================================

这不是重做 M8，也不是启动公开发布。

创建一个新的纠偏阶段或任务组，命名建议：

Post-M8 UI / Playability Remediation
或
RC-Audit UI Playability Blocker Remediation

若 task schema 需要 milestone 字段：
- 优先使用仓库已支持的 milestone 或 phase 机制；
- 如果只允许已知 milestone，请使用 M8 并增加 `phase: post-m8-owner-remediation` 或仓库等价字段；
- 不得破坏 taskctl validate；
- 不得把它误写成 M9 或 public release，除非仓库已有明确这种阶段。

创建首个任务，预计为下一个未占用编号：

Title:
Owner UI playability blocker audit and remediation planning

目标：
把 Owner 对当前 demo UI、交互、语言和可玩性为 0 的反馈，正式落入任务控制面，并生成可执行、可评审、可回归测试的 UI / i18n / interaction remediation DAG。

该 planning / audit 任务必须经过：

claim
→ plan
→ current UI/code audit
→ art-thread consultation
→ remediation DAG
→ report
→ complete
→ independent reviewer
→ verified
→ integrate
→ done
→ merge/push main

Planning verified 后，继续执行 remediation DAG，不等待 Owner 回复，除非遇到 owner gate。

==================================================
五、与美术线程沟通
==================================================

Owner 希望主线程与已存在的美术线程沟通，并利用其对三张 UI 原画的分析，以便未来有实际切图和美术定稿时可以低成本替换。

你必须执行以下流程：

1. 检查 coordination/thread-registry.json 是否已有 art / visual-design / art-direction / UI-art 相关线程。
2. 如果存在：
   - 向该线程投递 Art Direction Consultation 任务。
   - 该任务必须只做视觉方向、模块取材、资产插槽、UI kit、风格 token、未来切图替换建议。
   - 不让美术线程直接修改产品代码，除非任务明确允许。
3. 如果不存在可用美术线程：
   - 不要阻塞整个工作；
   - 在 coordination/outbox 或 reports 中生成一份可手动发送给美术线程的 prompt；
   - 继续执行代码审计和 remediation planning；
   - 在报告中标记 art thread consultation pending。
4. 如果当前环境无法自动投递给该线程：
   - 明确报告需要 Owner 手动转发；
   - 仍继续推进不依赖美术线程的技术任务；
   - 不伪称已完成沟通。

投递给美术线程的咨询内容必须包含：

- 三张 UI 原画模块取材结论；
- 当前 demo 问题摘要；
- 需要输出：
  1. 推荐主布局；
  2. 推荐视觉风格 token；
  3. 推荐组件层级；
  4. 需要实际切图的资产清单；
  5. 可以先用 CSS/Pixi 绘制的占位组件；
  6. 不该现在做的高成本美术；
  7. 未来美术定稿替换的 asset contract。

美术线程输出应写入：

coordination/reports/<TASK-ID>-art-consultation.md

或仓库既有 reports 路径。

==================================================
六、必须做的当前 UI / Interaction / i18n 审计
==================================================

基于当前代码和 owner 截图，审计以下内容：

A. 默认界面
- 默认是否仍是 diagnostics/product gate harness；
- 是否有真正主菜单；
- 是否有新游戏/继续/设置；
- 是否有玩家目标提示；
- 是否区分 player UI 与 dev/debug overlay。

B. 鼠标交互
- 地图对象能否被选中；
- 居民能否被选中；
- 建筑/灯柱/资源点能否被选中；
- UI 按钮是否真实可点击；
- 点击是否产生 state 或 command；
- 失败是否有反馈；
- 是否存在 pointer-events 被 overlay 拦截的问题。

C. 相机/地图操作
- 鼠标拖拽；
- 滚轮缩放；
- 方向键或 WASD；
- 复位；
- 边界限制；
- 窗口化和全屏下是否一致。

D. 玩家命令
- 是否仍只有 Noop/Echo 或过窄 command；
- 当前可执行命令有哪些；
- 底部按钮是否连接真实命令；
- 补灯油、巡逻、关区域、登记旅客等是否只是展示文案；
- 若命令未实现，必须在任务 DAG 中体现真实 minimum playable command set。

E. UI/i18n
- 玩家可见字符串是否走 localization key；
- 中文系统是否默认中文；
- 是否可手动切换语言；
- UI 是否存在中英混杂；
- 缺失 key 是否被测试捕获；
- 英文 fallback 是否仅作为 fallback，而不是中文用户默认体验。

F. 响应式
- 窗口化和全屏是否不同步；
- 面板是否遮挡地图；
- 关键视口尺寸是否 E2E 覆盖；
- 当前截图尺寸问题必须被纳入测试。

G. 视觉身份
- 是否仍像内部 web dashboard；
- 是否体现灯火、镇志、镇规、居民解释、夜晚风险；
- 是否有 Wuming Town design tokens；
- 是否可未来替换成切图/最终美术。

H. 可玩性
- 玩家打开后能否完成一个最小操作链；
- 例如：
  选择灯柱
  → 查看原因
  → 点击“优先补灯”
  → 任务进入队列
  → 居民或模拟状态变化
  → 得到反馈。
- 如果无法完成，必须将 minimum playable interaction chain 作为阻塞 gate。

==================================================
七、必须生成的 Remediation DAG
==================================================

在 planning 任务中生成并评审一个 UI / i18n / interaction remediation DAG。

DAG 至少应包含以下任务组；具体编号按下一个未占用 task id 生成：

1. UI/interaction audit task
   - 输出当前代码能力、缺口、截图证据和 owner blocker matrix。

2. Art direction consultation task
   - 与美术线程沟通；
   - 输出 module sourcing：B layout、C mood、A path/light；
   - 输出 asset replacement contract。

3. Product HUD architecture task
   - 明确 player HUD 与 debug overlay 分离；
   - default route 显示 player UI；
   - diagnostics 只在 dev/debug mode 出现。

4. Design tokens / component system task
   - color、type、spacing、panel、button、alert、resource card、resident card、inspector；
   - 支持未来切图替换；
   - 不硬编码最终美术图。

5. Localization infrastructure hardening task
   - zh-CN/en；
   - system language detection；
   - manual language setting；
   - missing key test；
   - hardcoded string extraction；
   - pseudo-loc or coverage report。

6. Responsive layout task
   - required viewports：
     1280x720
     1366x768
     1424x861
     1600x900
     1920x1080
     2560x1369
     2560x1440
   - windowed/fullscreen E2E;
   - no critical clipping/overlap.

7. World interaction task
   - selectable residents；
   - selectable buildings/lanterns；
   - selected object inspector updates；
   - pointer event layering fixed；
   - selection feedback.

8. Camera control task
   - drag pan；
   - wheel zoom；
   - keyboard movement；
   - bounds；
   - works in windowed/fullscreen.

9. Minimum playable command task
   - at least one real interaction chain:
     select lantern or resident
     → issue meaningful command
     → command reaches protocol/simulation or documented adapter
     → state/read model changes
     → UI feedback appears.
   - If current simulation protocol cannot support it, create properly reviewed protocol task instead of faking UI success.

10. First-play onboarding task
   - default first screen explains what can be done;
   - clear next objective;
   - language appropriate;
   - can be skipped/reopened.

11. Visual regression / screenshot task
   - capture required resolutions;
   - include baseline comparisons where possible;
   - human-review artifact for visual quality;
   - failure on massive layout regression.

12. Release-readiness verdict update task
   - update current release readiness:
     public release remains blocked until UI/playability gates pass.
   - record owner blocker resolved/unresolved.

13. Closeout task
   - produce remediation closeout;
   - reviewer verifies;
   - future release candidate audit prompt generated if gates pass.

如果仓库已有类似任务或设施，不重复创建；整合并补足缺口。

==================================================
八、实现约束
==================================================

1. 不得把“像原画”误解成一次性写死图片。
2. 先建立可替换的 UI/asset contract。
3. 未来切图应通过 asset manifest / tokens / semantic component slots 替换。
4. 不得让美术线程直接决定代码架构。
5. 不得让 UI 绕过 Simulation Worker 权威状态。
6. 不得为了让按钮能点而伪造不可追踪状态。
7. 不得在玩家默认 UI 中暴露大量 debug / gate 文案。
8. 不得把诊断界面删除；应保留为 debug/dev overlay。
9. 不得改变 Web demo-only 和 Windows controlled external test verdict，除非 owner approval。
10. 不得进入 public release / store / signing / telemetry / accounts / paid services。

==================================================
九、角色和模型
==================================================

严格遵守 coordination/roles.json 和 .codex/agents/*.toml。

建议分配：

- project-director:
  总控、Owner amendment 落地、release blocker、集成
  gpt-5.5 / xhigh

- gameplay-designer:
  可玩性、HUD 信息层级、教程、玩家目标、文案
  gpt-5.5 / high

- client-engineer:
  React/Pixi/Electron/Web UI、响应式、相机、鼠标交互、i18n UI
  gpt-5.4 / high

- systems-architect:
  localization architecture、command protocol boundary、asset replacement contract、settings persistence
  gpt-5.5 / xhigh

- qa-performance:
  E2E、screenshot、responsive、language、interaction、regression tests
  gpt-5.4 / high

- content-worker:
  translation tables、key coverage、copy catalog
  gpt-5.4-mini / medium

- reviewer:
  独立最终评审
  gpt-5.5 / xhigh

- rapid-implementer:
  only scoped small fixes after architecture is approved
  gpt-5.3-codex-spark / medium

- art / visual-design thread:
  advisory only unless explicitly assigned docs/assets task.

Spark 不得承担：
- UI strategy；
- i18n architecture；
- command protocol；
- visual direction final call；
- release readiness verdict；
- final review。

==================================================
十、质量门禁
==================================================

每项任务执行其 task JSON 中全部命令。

每次合入 main 后至少运行：

- node tools/validate-handoff.mjs
- node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs validate
- node .agents/skills/wuming-town-agent-workflow/scripts/taskctl.mjs status
- git diff --check
- pnpm quality

新增或使用以下测试/验证：

- UI E2E selection tests
- button click tests
- camera drag/zoom tests
- language default detection tests
- language switch tests
- missing localization key tests
- hardcoded player-facing string audit
- responsive layout tests for required viewport sizes
- screenshot or visual regression artifacts
- player HUD vs debug overlay route test
- settings persistence test
- minimum playable interaction chain test
- existing M0–M8 regression:
  pnpm ci:local
  pnpm bench
  pnpm test --filter m5-invariants
  relevant scenario tests

如果测试设施不存在，先创建测试设施任务，不得把没有测试当成通过。

==================================================
十一、Owner Gate
==================================================

必须请求 Owner 的事项：

1. public release；
2. EA launch；
3. store submit；
4. signing；
5. telemetry；
6. accounts；
7. paid services；
8. public save compatibility commitment；
9. final legal/privacy publish；
10. final store claims；
11. changing Web verdict away from demo-only；
12. changing Windows verdict beyond controlled external test；
13. introducing external art asset licensing commitments；
14. replacing core visual direction with a materially different art style；
15. destructive Git operations；
16. changing core product identity.

可以自主决定：
- UI component names；
- token names；
- internal CSS/React structure；
- localizable key naming；
- interim placeholder art；
- E2E test structure；
- reversible layout details；
- copy draft that is not public final.

==================================================
十二、停止条件
==================================================

该 remediation goal 只有满足以下条件才能 complete：

1. Owner UI/playability blocker 已正式记录。
2. Art thread consultation 已完成，或已明确 pending 且不阻塞技术 remediation。
3. Product UI vs debug overlay separation 完成。
4. 默认界面不再是 diagnostics harness。
5. zh-CN/en localization gate 通过。
6. 中文系统默认中文，非中文默认英文。
7. 设置中可切换语言并持久化。
8. 玩家可见硬编码字符串审计通过。
9. 响应式窗口/全屏 gate 通过。
10. 鼠标选择居民/对象可用。
11. 按钮点击可用。
12. 相机拖拽/缩放可用。
13. 至少一个 minimum playable interaction chain 通过。
14. UI 风格 token 和 asset replacement contract 存在。
15. 参考原画的模块取材已记录。
16. E2E / screenshot / localization / regression 验证通过。
17. 所有 remediation tasks done。
18. 所有 remediation tasks reviewer verified。
19. main 与 origin/main 同步。
20. 工作区干净，inbox 0，无残留 worktree。
21. closeout report 明确：
    - UI readiness verdict；
    - playability verdict；
    - i18n verdict；
    - responsive verdict；
    - remaining art production needs；
    - whether release candidate audit can proceed。
22. 不得自动执行 public release 或 store / signing 等事项。

==================================================
十三、真正阻塞时
==================================================

如果所有工作都被阻塞：

- 不伪造成功；
- 不降低 gate；
- 不绕过 owner；
- 保存并推送安全成果；
- 保持 main 干净；
- 输出 GOAL BLOCKED；
- 给出最多 3 个选项；
- 推荐一个选项并说明代价。

==================================================
十四、首次检查点
==================================================

完成以下事项后输出首次紧凑检查点，然后继续执行：

- 仓库启动审计；
- Owner blocker 记录；
- art thread 是否可联系；
- UI/interaction/i18n audit task 创建或 claim；
- remediation DAG 创建或开始创建；
- 当前 active threads；
- 是否存在 owner gate；
- 当前 main commit。

现在立即开始 Post-M8 UI / Playability / Localization remediation goal。
```
