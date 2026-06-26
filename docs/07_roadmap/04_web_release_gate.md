# Web 发布门禁

## 测试内容

使用 M4 真实垂直切片，不使用空地图成绩：192×192、40 活动角色、20k 实体、灯网、案卷、事件、90 TPS 请求。

## 指标

- Chrome/Edge 30 TPS P95 ≤12ms
- 3× 无持续 Tick 债务；无法达成可限制 2×/3×
- 主线程操作稳定，P95 ≤12ms
- 内存无持续增长，目标总占用约 ≤1.2GB
- 初次压缩下载目标 ≤150MB
- OPFS 保存、导出、导入和配额错误可恢复
- 无 SharedArrayBuffer 时功能正确

## 决策

A 同规格；B 内容同等但快进降低；C 地图/人口上限降低；D 仅试玩；E 取消。任何结果保持存档容器可与 Windows 互通。

## WM-0086 Harness Baseline

- Repeatable harness command: `pnpm build:web`
- Build artifact: `apps/desktop-electron/dist/renderer/wm-release-gate-report.json`
- Fixture id: `wm-0086-web-product-gate`
- Fixture evidence root: WM-0083 `m5.alpha_content_framework.first_season.v1`
  with M4 regression reference `m4.core_vertical_slice.borrowed_shadow_lamps.v1`
- Browser target assumptions recorded in WM-0086: Chrome Stable and Edge Stable
  are the intended Chromium release-gate targets; actual perf and loading
  measurements stay in WM-0087
- Cross-origin-isolation assumption: SharedArrayBuffer is optional; enabling it
  requires `COOP same-origin` and `COEP require-corp`, otherwise the Web shell
  must remain on Transferable snapshot/projection fallback
- Bundle-size assumption: compare the 150 MB compressed target against runtime
  deliverable assets, not sourcemaps
- Asset assumption: WM-0086 uses a deterministic code-only fixture with no
  remote fetch requirement; later Web assets must remain same-origin or opt
  into CORP/CORS before SAB is enabled

## WM-0087 Measurement Note

- `tools/web-performance-gate.mjs` is the reproducible Chrome Stable / Edge
  Stable evidence entry point for WM-0087.
- The script measures built-artifact loading, shell-ready timing, deterministic
  selection latency, animation-frame pacing, long-task samples and JS-heap
  samples against the current WM-0086 harness without changing simulation
  authority.
- WM-0087 also raises the default benchmark sampling window from `5/1` to `9/2`
  samples/warmups after review exposed `entity-store` outlier sensitivity on
  the current Windows / Node environment. Thresholds and baselines are
  unchanged.
- WM-0087 also stabilizes the `map-dirty` microbenchmark conservatively: it
  keeps the original `dirtyCellsInsideChunk(...)` / `grid.updateCell(x, y,
  {...})` workload and original timer window, and adds only fixed repeated-pass
  averaging inside each sample. Thresholds and baselines are unchanged.
- WM-0087 does not relax the existing 10 percent warning or 20 percent
  blocking benchmark thresholds.
- The current Web shell remains a read-only 40-visible-actor fixture consumer.
  Any same-spec claim for the full 192x192 / 40 active actors / 20k entities /
  30 TPS gate remains blocked until browser evidence comes from a real
  product-scale authority path rather than fixture-only or checkpoint-only
  projection evidence.
