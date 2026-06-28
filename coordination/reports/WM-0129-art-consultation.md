# WM-0129 Art Direction Consultation

角色：Art Direction Consultation  
范围：Post-M8 UI / Playability / Localization remediation 咨询  
约束：不修改产品代码、任务状态、发布/平台 verdict；不进入 public release / EA / store / signing / telemetry / accounts / paid services / public save compatibility。

## 0. 基线判断

三张 UI 原画的取材基线维持如下：

- 主布局取 B：顶部时间/资源、左侧居民、中央格网、右侧选中对象、底部全局命令和情境命令最清晰。
- 美术气质取 C：木、纸、墨、灯火、民俗恐怖氛围最强。
- 地图灯光/路径取 A + C：A 的灯圈和路径说明更直观，C 的暗区和灯火边界更有主题性。
- 左侧居民列表取 B。
- 右侧 inspector 取 C 的分段秩序，加 A 的任务/原因/操作信息密度。
- 顶部警报取 C 的纸条气质或 B 的扫读结构。
- 底部命令栏取 B 的分组和 C 的大按钮质感。

当前 remediation 的首要目标不是终局美术，而是让默认 demo 从 diagnostics/product gate harness 变成可理解、可点、可拖拽/缩放、语言一致的玩家界面。

## 1. 推荐主布局

桌面优先级最高，窗口化第二，全屏第三。原因是当前需要尽快解决 1280x720 到 2560x1440 的可玩性和可读性，而不是先追求电影化全屏表现。

桌面基线：

- 顶栏：左侧游戏名/年季日期/天气，中段日阶段条和暂停/倍速，右侧关键资源。不要出现 fixture、hash、product gate、diagnostics 文案。
- 左栏：居民/访客/守灯人摘要。只放当前有行动意义的人：选中、风险、闲置有原因、夜班、事件关联。
- 中央地图：Pixi 主空间。支持点击选择、拖拽平移、滚轮缩放、键盘平移/缩放。地图永远是第一视觉主体。
- 右栏：选中对象 inspector。居民、灯、建筑、区域、旅客都使用同一分段框架：状态、当前任务、原因、可用操作。
- 底栏：上排全局模式，建造、区域、工作、镇规、镇志、守夜、调查；下排情境动作，随选中对象变化，例如补灯油、设巡逻、关闭区域、登记旅客。
- 顶部警报：最多 3 条，按灯网、居民、资源、镇规/旅客等来源分组，可点击定位到对象或打开解释。

响应式优先级：

- 1366x768 和 1280x720 必须可用：左右栏可窄，底栏可两行，文字必须截断或折叠但不能重叠。
- 1600x900 作为主要审美基线：保留地图空间，左右栏完整显示。
- 1920x1080 以上增加地图呼吸和警报/资源横向容量，不放大字体到失控。
- 窄窗口下左右栏折叠为 tabs/drawers，顶栏和地图操作保持可达。

## 2. 视觉风格 token

颜色建议沿用 M8 token，并将样图 C 的气质收进材质：

- `canvas.day`: `#D8C9AA`，白日地图邻近底色。
- `canvas.dusk`: `#6F5840`，黄昏框架和风险过渡。
- `canvas.night`: `#161411`，夜间外框和暗区。
- `surface.paper`: `#F1E6CC`，主要可读面板。
- `surface.agedPaper`: `#D8C49B`，纸条、任务、警报。
- `surface.wood`: `#6A4A2F`，底栏、钉板、工具托盘。
- `surface.ink`: `#25211B`，高对比深色浮层。
- `border.record`: `#7E6F55`，镇志、账簿、普通分隔。
- `border.lamp`: `#D9963A`，灯火覆盖、焦点和选中。
- `status.stable`: `#2F6F4E`，稳定。
- `status.watch`: `#B57A22`，警戒。
- `status.danger`: `#A33B32`，危险。
- `status.unknown`: `#5D6580`，未确认。
- `status.contradicted`: `#7B4B83`，反证/冲突。
- `anomaly.accent`: `#3E8C86`，少量异类提示，禁用大面积铺色。
- `debug.surface`: `#10151C`，只用于显式 Debug/Diagnostics。

面板：

- 玩家面板以纸面为主，外框可用木板或深墨半透明底。
- 面板圆角 4-6px，不做现代 SaaS 大圆角。
- 面板内不再嵌套卡片套卡片。分段用细线、标题、印章和空隙解决。
- 滚动区域必须固定标题和关键操作，不让按钮随滚动消失。

边框和材质：

- 纸张边缘可先用 CSS `box-shadow`、`border-image` 占位，未来再换 9-slice。
- 木托盘用深棕、轻微噪声纹理、内阴影即可，不要厚重写实。
- 警报纸条可用夹钉/红印章作为图形语言，但文字仍由 i18n 渲染。

字体层级：

- UI 正文使用系统 sans-serif 加中文 fallback，稳定可读。
- 镇志/标题可使用 Song/serif 风格 fallback，但只用于标题，不用于密集正文。
- 顶栏阶段 20-22px；面板标题 18px；正文 14px；caption 12px。
- 不用 viewport width 缩放字体。长中文/英文必须换行、截断并提供详情。

状态：

- 警报不能只靠颜色：必须有 severity 文本、图标/形状、来源标签。
- 选中状态使用灯色描边、角标或地图环，不用纯发光糊成一片。
- 禁用按钮保留可读文字，显示锁/灰印，并提供原因入口，例如“缺灯油 8”“未登记旅客”。
- 可点击对象 hover 显示微弱外框和 cursor，不把不可点物也做同样反馈。

## 3. 推荐组件层级

主菜单：

- 视觉上是玩家入口，不是测试门禁。可用 C 的纸/木/灯气质。
- 只保留新游戏、继续、设置、语言。不要出现 product gate、fixture、verdict。
- 中英文完全走 locale，不允许同一按钮中英混杂，除品牌名 `Wuming Town / 无明镇` 例外。

默认 HUD：

- 顶栏回答当前阶段、时间、速度、暂停、资源。
- 左栏回答谁需要注意。
- 右栏回答选中了什么、为什么重要、能做什么。
- 底栏回答当前可用命令。
- 警报回答下一步最值得处理什么。

地图层：

- Pixi 负责地形、建筑、居民/访客/灯/区域、灯火覆盖、路径预览、选中/hover。
- React 不直接修改世界，只发显式玩家命令或请求详情。
- 地图交互最低要求：点击实体/结构选中，拖拽相机，滚轮缩放，键盘 pan/zoom，点击警报定位。

左侧居民：

- 每项显示头像占位、姓名、身份/工作、当前 Job 或状态、2-3 个状态点。
- 不做匿名单位列表。居民是社会对象，不是纯战斗单位。
- 风险、闲置、夜班、事件关联排序优先于普通居民。

右侧 inspector：

- 标题：对象名、类型、状态章。
- 状态：灯油/覆盖/风险，或居民健康/情绪/需求，或建筑/区域状态。
- 当前任务：参与者、Job、下一步。
- 原因：最多 3 条结构化原因，提供“查看详情”。
- 操作：3-5 个情境按钮。按钮必须能表明不可用原因。

底部命令栏：

- 全局模式按钮采用图标加短词：建造、区域、工作、镇规、镇志、守夜、调查。
- 情境动作只显示和当前对象相关的命令。灯柱显示补灯油/设巡逻；旅客显示登记/询问；区域显示关闭/解除。
- 暂不可实现的命令可以 disabled，但不能是假按钮；必须说明“未接命令协议”或具体缺失原因。

Debug overlay 分离：

- Debug/Diagnostics 必须使用深色技术主题，带明确标题。
- 默认 HUD 不显示 hash、fixture、protocol packet、product gate verdict、release readiness。
- Debug 入口可以隐藏在 dev route、快捷键或显式按钮下，打开后不能覆盖玩家核心 HUD 到不可操作。

## 4. 未来实际切图资产清单

图标：

- 时间阶段：黎明、白日、黄昏、夜晚。
- 速度：暂停、1x、2x、3x。
- 资源：粮食、木材、药材、纸/镇志、灯油、灯芯、钱/银、旧债关键物。
- 模式：建造、区域、工作、镇规、镇志、守夜、调查、仓储、生产、旅客名册。
- 来源：灯网、居民、资源、事件、镇规、旧债、镇志、异类。
- 状态：稳定、警戒、危险、未知、反证、禁用、锁定、可定位、可解释。

面板皮肤：

- 纸面主面板 9-slice。
- 纸条/警报 9-slice。
- 木质底栏/顶栏 9-slice。
- 右侧账簿/挂纸面板 9-slice。
- 小印章、钉子、绳夹、分隔线。

地图效果：

- 灯火覆盖圆/扇形/阻挡边缘。
- 暗区和未知区纹理。
- 路径虚线、不可达路径、夜间风险路径。
- 选中环、hover 环、警报定位脉冲。
- 区域边界、禁区边界、巡逻路线。

角色与对象：

- 居民头像占位套件：居民、守灯人、医官、记事、旅客、商人、守夜。
- 建筑/对象小图标：客栈、仓库、诊所、工坊、民居、农田、灯柱、桥、门槛、名册。
- 异类/未知不要先做具象怪物头像，优先做“未知访客/痕迹/反证”符号。

按钮/纸条：

- 主按钮、次按钮、危险按钮、禁用按钮四状态。
- 印章状态：已确认、存疑、反证、过期、禁令、缺资源。
- 通知纸条：普通、警戒、危险、未知、反证。

## 5. 现在可先用 CSS/Pixi 绘制的占位组件

CSS 先行：

- 顶栏、左右栏、底部命令栏、纸面面板、木质托盘。
- 纸条警报、印章状态、资源 chip、居民列表项。
- 按钮四状态、disabled 原因、tooltip/detail popover。
- 主菜单纸面/木框/灯色焦点。
- Debug 深色 overlay。

Pixi 先行：

- 格网地形色块和轻纹理。
- 建筑矩形/屋顶占位。
- 居民/访客/守灯人圆点或小人 silhouette。
- 灯火覆盖半透明圆形/多边形。
- 选中环、hover 框、路径虚线、区域边界。
- 相机拖拽/缩放反馈。

这些占位足够让 reviewer 判断可玩性，不必等待最终切图。

## 6. 不该现在做的高成本美术或误区

- 不做完整手绘大地图替换。当前最缺的是可点、可读、可解释，不是最终地图插画。
- 不做复杂角色立绘批量生产。先用头像占位和身份视觉语言。
- 不做全屏电影化主菜单。它会掩盖核心 HUD 问题。
- 不做怪物图鉴式异类表现。项目要求玩家界面不泄露真值。
- 不做真实法律/宗教符号堆砌。保持民俗气质，但避免现实宣称和冒犯。
- 不做厚重拟物导致响应式失控。纸木墨必须服务信息层级。
- 不用颜色作为唯一状态信号。
- 不把 debug 数据伪装成世界观信息。
- 不把不可实现命令画成可用按钮。占位必须诚实显示 disabled 和原因。
- 不引入新运行时美术依赖、在线素材服务、账号、遥测、付费资源或商店流程。

## 7. Asset Replacement Contract

资产替换必须通过 semantic slots，而不是组件硬编码文件名。建议 manifest 示例字段：

```json
{
  "assetVersion": "wm-ui-art.v1",
  "localeScope": "visual-only",
  "slots": [
    {
      "slot": "panel.paper.primary",
      "type": "nineSlice",
      "src": "ui/panels/paper_primary.png",
      "scale": 1,
      "nineSlice": { "left": 18, "top": 18, "right": 18, "bottom": 18 },
      "states": ["default"],
      "minSize": { "w": 96, "h": 64 }
    }
  ]
}
```

Semantic slots：

- `panel.paper.primary`
- `panel.paper.alert`
- `panel.wood.toolbar`
- `panel.ledger.inspector`
- `button.primary.default|hover|active|disabled`
- `button.secondary.default|hover|active|disabled`
- `button.danger.default|hover|active|disabled`
- `stamp.confirmed|suspected|contradicted|obsolete|forbidden|missing`
- `icon.resource.food|lampOil|medicine|timber|paper|money|obligationItem`
- `icon.mode.build|zone|work|ordinance|chronicle|nightWatch|investigate`
- `icon.source.lamp|resident|resource|event|ordinance|obligation|chronicle`
- `map.effect.lampCoverage|lampLeak|pathPreview|pathBlocked|selection|hover|regionBoundary|patrolRoute`
- `portrait.role.resident|lampkeeper|medic|chronicler|visitor|merchant|watch`

命名规则：

- 小写 kebab-case 或点分 semantic slot，不使用中文文件名。
- 文件名包含 slot 和状态，例如 `button-primary-disabled.png`。
- 资产版本固定在 manifest，不在组件里散落 cachebuster。
- 所有图片路径相对 asset root。

分辨率与 9-slice：

- 面板和按钮必须提供 9-slice 边距。
- 图标提供至少 24px 和 48px 基准，允许 CSS/Pixi 缩放。
- 地图效果提供可程序化 tint 的白色或中性 alpha 贴图，避免为每个颜色切一份。
- 头像可先 128x128，列表中裁成 48x48 或 64x64。

状态变体：

- 所有可点击按钮至少 default、hover、active、disabled。
- 警报至少 stable、watch、danger、unknown、contradicted。
- 选中/hover/定位不能共用同一视觉强度，避免地图混乱。

i18n 文本边界：

- 图片不得包含玩家可见文本。
- 印章如果必须有字，只能作为装饰，不承担唯一语义；真实状态由 locale 文本渲染。
- 图标 alt/tooltip/title 走 localization key。
- 中英布局差异由组件处理，不为英文和中文切两套文字图片。

## 8. Reviewer 判断标准

可以判定“已从 diagnostics harness 变成可玩 UI”的最低标准：

- 默认首屏没有 `M6 Web Product Gate Harness`、fixture、hash、protocol、release verdict、diagnostics 等文案。
- 玩家无需打开 debug，就能看懂当前阶段、下一目标、夜间风险、关键资源、警报、选中对象和可用动作。
- 顶栏、左右栏、底栏、地图在 1280x720、1366x768、1600x900、1920x1080 不重叠。
- 中文界面不混入英文测试文案；英文界面不混入中文按钮，品牌名例外。
- 地图实体/灯/建筑/旅客至少可点击选中，右侧 inspector 随选择更新。
- 相机可拖拽、滚轮缩放、键盘 pan/zoom；警报或列表项能定位相关对象。
- 底部按钮看起来是命令面板：可用命令能触发当前支持的行为或请求详情；未接协议的命令明确 disabled 并显示原因。
- Debug overlay 仍可显式打开，但视觉上与玩家 HUD 分离，且不会作为默认体验。
- 状态不是只靠颜色，警报、禁用、选中、未知、反证都有文字或图形辅助。
- UI 只消费 read model 或发显式命令，不把 React/Pixi 变成权威模拟。

验收时不要求最终切图全部完成。CSS/Pixi 占位只要满足上述交互、层级、语言和 debug 隔离，就已经足够支撑下一轮 client-engineer remediation。
