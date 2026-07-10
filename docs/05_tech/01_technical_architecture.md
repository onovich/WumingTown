# 技术架构设计

## 总图

```text
Content Source ──compile──▶ Immutable Catalog
                              │
Input/React ─PlayerCommand──▶ Simulation Worker (Authoritative)
                              │
                    ┌─────────┼──────────┐
                    │         │          │
              RenderSnapshot UiDelta SaveSnapshot
                    │         │          │
                  PixiJS    React      SaveStore
                    │                    │
                 Canvas             OPFS / Electron FS

Optional Kernel Pool / Wasm receives immutable numeric batches only.
```

## Monorepo

```text
apps/web
apps/desktop-electron
packages/foundation
packages/content-schema
packages/content-compiler
packages/sim-core
packages/sim-protocol
packages/sim-worker
packages/renderer-pixi
packages/ui-react
packages/persistence
packages/platform
packages/testkit
packages/benchmarks
tools/content-cli
tools/headless-runner
```

## 依赖方向

`foundation` 最底层；`sim-core` 只能依赖 foundation 和编译后内容契约；renderer/ui 依赖 protocol/read models，不依赖 sim 内部；platform 在最外层。用 ESLint boundaries 或自定义脚本强制。

## 权威线程

Simulation Worker 独占世界写权限。主线程发送命令并消费投影。Kernel Worker 不直接持有世界，只接收带版本的纯数据批次，返回补丁候选，由模拟线程验证和提交。

## 数据布局

- 高频：TypedArray + 活跃位图 + 容量管理。
- 稀疏：Arena/Pool + Handle。
- 内容：不可变 Catalog。
- 结构变更：Command Buffer。
- 跨线程：版本化二进制/结构化协议；大数组用 Transferable，测量后再用 SharedArrayBuffer 三缓冲。

## 表现

地图地形按 Chunk Mesh/Geometry 更新；灯光/危险使用低分辨率纹理或 Overlay；可见 Pawn 使用 Sprite/AnimatedSprite；不可为每格创建 DisplayObject。React 只管理 UI。

## 可测试性

所有系统接受显式 Context/Store，不读取单例。Node Headless 与 Worker 共享同一 Tick Runner。随机、时间、文件与平台 API 都通过 Port 注入。

## WM-0162 PR-1 GameSession note

Post-M8 product work now routes through one integrated authoritative
`GameSessionRuntime`; see `coordination/decisions/ADR-0017.md` and
`docs/05_tech/12_integrated_gamesession_architecture.md`. Historical M1-M8
scenario runners remain regression evidence and initializer references, not
the default product runtime. Simulation Worker and Node headless must host the
same deterministic runtime; React, Pixi, Electron and Web adapters remain
read-only projection consumers and explicit command senders. ADR-0017 also
approves the minimum PR-1 projection boundary: existing Worker message families,
envelope schema 3, and nested `GameSessionRenderProjectionV1` /
`GameSessionUiProjectionV1` with fail-closed negotiation. Proposed WM-0164 is
the sole `sim-protocol` writer; later Web and gate tasks consume that public
package surface in serial dependency order.
