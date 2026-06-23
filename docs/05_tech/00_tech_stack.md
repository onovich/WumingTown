# 技术栈选择及原因

基线日期：2026-06-23。具体补丁版本在 M0 技术验证后锁入 lockfile；升级必须通过基准与回归。

## 最终选择

| 层 | 选择 | 原因 |
|---|---|---|
| 主语言 | TypeScript 5.9 基线、严格模式 | AI/人类可读写、文本化、CLI 验证快；暂不立即采用刚发布的 TS 6.0，待生态验证。 |
| 运行时 | Node 24 LTS | 与 Electron 42 内置 Node 主线接近，稳定、长期支持。 |
| 包管理 | pnpm 11 workspace | Monorepo、高效依赖、严格依赖边界与较强供应链默认。 |
| 构建 | Vite 8 基线 | 快速 HMR、Worker/Wasm 支持、Web 生态成熟。 |
| 世界渲染 | PixiJS 8 | 专注高性能 2D，支持 WebGL/WebGPU，不强加玩法框架生命周期。 |
| UI | React 19 | 复杂管理面板、生态与 AI 开发效率高；只渲染 DOM UI。 |
| 桌面壳 | Electron 42.x | 固定 Chromium/Node，Windows 一致性优于系统 WebView；未来可打 Mac。 |
| 模拟 | Dedicated Web Worker | 权威状态与 UI 隔离，主线程平滑，可 Headless/重放。 |
| 测试 | Vitest + Playwright | 单元/场景与真实浏览器 E2E；CLI 友好。 |
| 存储 | OPFS Web + Electron 文件适配器 | 同一存档容器，多平台导入导出。 |
| 性能后备 | Rust/Wasm Kernel | 只替换批量寻路、区域重建、扩散等测得热点。 |
| 内容 | JSON5/CSV + JSON Schema/Ajv | 策划和 AI 可编辑、可校验、可模组化。 |

## 平台

- 一级：Windows Electron。
- 一级验证：Chrome/Edge Web；能否同规格发布由垂直切片门禁决定。
- 二级：macOS 浏览器。
- 延后：原生 macOS Electron 打包、公证与完整回归。

## 为什么不采用 Unity

Unity 的运行时与编辑器成熟，但本项目将大量工作放在数据、UI、工具、测试和内容迭代。Scene/Prefab/Inspector 的隐式状态削弱 AI 自主验证；Web/CLI 技术栈能让代码、内容、测试和界面都通过文本与浏览器自动化操作。峰值性能差距由正确算法、Worker、TypedArray 和有限 Wasm 缓解。

## 为什么不是 Tauri

Tauri 更小，但引入 Rust 宿主和系统 WebView 差异。本游戏更重视固定 Chromium 图形行为、统一调试与单语言生产效率，Electron 的包体成本可接受。

## 为什么不是完整 Rust 核心

当前首要约束是开发吞吐、设计变化与 AI 执行可靠性。Job、情绪、镇志、导演和内容规则分支多且频繁修改，TypeScript 更合适。只有接口稳定、数据纯粹且证实为瓶颈的 Kernel 才移植。

## 参考

- Electron Releases: https://releases.electronjs.org/ （交接日稳定线 42.4.1）
- Electron 支持策略: https://electronjs.org/docs/latest/tutorial/electron-timelines
- PixiJS 8: https://pixijs.com/8.x/guides/getting-started/intro
- Vite Worker: https://vite.dev/guide/features
- React External Store: https://react.dev/reference/react/useSyncExternalStore
- Node Releases: https://nodejs.org/en/about/previous-releases
- pnpm 安装/安全: https://pnpm.io/installation 与 https://pnpm.io/supply-chain-security
