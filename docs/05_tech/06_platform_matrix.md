# 平台兼容矩阵

| 能力 | Windows Electron | Chrome/Edge Web | macOS Browser | Native macOS |
|---|---|---|---|---|
| 首发目标 | 完整 | 门禁后完整/缩放 | 尽力 | 延后 |
| 存档 | 本地文件 | OPFS + 导入导出 | OPFS + 导入导出 | 未来文件 |
| 数据模组 | Mods 目录/ZIP | ZIP 导入 | ZIP 导入 | 未来 |
| SharedArrayBuffer | 可控 | 需跨源隔离 | 浏览器条件 | 可控 |
| Steam/成就 | 可选 | 无 | 无 | 未来 |
| 最大快进 | 目标 6× | 目标 3×，通过后提高 | 视浏览器 | 未承诺 |

## Web 决策门

真实垂直切片运行 192×192、40 活动角色、20k 实体，在目标浏览器中达到 30 TPS、可接受内存和加载体积。失败时按顺序：降低快进 → 降上限 → Web 作为试玩 → 取消正式 Web，不重写核心。

## WM-0088 存档互通状态

- Chrome/Edge Web：WM-0088 证明了 OPFS 本地写入、读取、导出、导入与配额失败恢复的 gate evidence 路径。
- Windows Electron：截至 WM-0088，桌面 preload 仍只暴露 placeholder
  unavailable save ports，因此 Windows/Web save container interoperability
  尚未证明，必须作为 M6 product-gate blocker 记录，待后续桌面安全存档桥接完成后复核。
