# 测试政策

## 命名

`<subject>.<condition>.<expected>.test.ts`，场景使用稳定 ID。测试种子必须写明，失败输出可重放命令。

## 禁止不稳定因素

单测不访问网络、真实时钟、系统随机、用户目录或共享全局状态。E2E 使用隔离 profile 和临时存储。

## 覆盖重点

不追求单一全局百分比。`foundation`, `sim-core`, `persistence`, `content-compiler` 的分支和不变量必须高覆盖；视觉组件以行为和截图为主。

## Bug 修复

先提交能失败的最小重放/测试，再修复。若无法自动化，报告必须解释原因并创建测试能力任务。

## 长跑

每日运行 1M Tick 场景：Reservation 泄漏、实体引用、资源负数、队列增长、存档 round-trip 和 Hash 分歧。

WM-0029 adds `pnpm test --filter m1-invariants` as the focused M1
hauling/building 100000-tick long-run entry. It fails on reservation leaks,
stale work offers or entity references, negative resources, sustained queue
growth, save round-trip mismatch and replay/hash divergence.
