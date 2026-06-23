# 存储、模组与安全架构

## SaveStore Port

```ts
interface SaveStore {
  list(): Promise<readonly SaveMeta[]>;
  read(id: SaveId): Promise<ArrayBuffer>;
  writeAtomic(id: SaveId, data: ArrayBuffer): Promise<void>;
  remove(id: SaveId): Promise<void>;
  export(id: SaveId): Promise<Blob>;
}
```

Web 使用 OPFS；Electron 通过安全 Preload 调用主进程。模拟 Worker 生成 SaveSnapshot，平台层写入。

## Electron

- 禁用 Node integration，启用 context isolation 与 sandbox。
- CSP 禁止任意远程脚本和 `eval`。
- Preload API 使用明确 Channel 和参数验证。
- 外部链接经白名单与系统浏览器打开。
- 不加载远程 Web 内容作为游戏主页面。

## Web

如启用 SharedArrayBuffer，部署 COOP/COEP/CORP。否则 Transferable 降级。存档 UI 明确浏览器清理风险并支持导出。

## 模组

ZIP/目录 → Manifest → 文件大小/路径安全检查 → Schema → 依赖 → Patch → 编译。防 Zip Slip、递归压缩炸弹和超大纹理。禁止代码、网络和平台 API。

## 供应链

pnpm lockfile 必须提交；依赖脚本默认禁用，只允许明确审核包。CI 运行审计、许可证和过期依赖报告；安全升级单独基准。
