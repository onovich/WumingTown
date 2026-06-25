# 时间、调度与随机系统

## 目标

在桌面与 Web 中提供一致、可暂停、可快进、可重放的权威模拟。帧率、真实时间和线程完成顺序不得改变游戏结果。

## 时间类型

- `Tick`: 非负安全整数。
- `GameDurationTicks`: 整数时长。
- `GameDay`, `HourOfDay`: 从 Tick 派生。
- 禁止模拟状态保存真实时间戳；真实时间只用于存档元数据和性能测量。

初始常量：`TICKS_PER_SECOND = 30`，`TICKS_PER_DAY = 36_000`。调整必须通过 ADR 和全局迁移。

## 分频

系统声明频率和相位：

```ts
interface ScheduledSystem {
  readonly id: SystemId;
  readonly intervalTicks: number;
  run(ctx: TickContext): void;
}
```

实体级更新使用稳定错峰 `(tick + entityIndex * salt) % interval === 0`，禁止所有 Pawn 同 Tick 思考。

## 随机流

根种子派生具名流：

```text
world-generation
story-director
combat
social
anomaly:<entityId>
incident:<incidentId>
```

使用可移植整数 PRNG；禁止共享一个全局流导致新增视觉随机改变玩法结果。随机调用必须在稳定排序后发生。

## M3 day/night and weather basics

WM-0049 adds pure `sim-core` owner state for the M3 ordinary-life environment.
`DayNightStore` derives day, hour, tick-of-day, and schedule window from
`Tick`, `TICKS_PER_DAY`, and the fixed dawn offset only. It does not read real
time and does not change `TICKS_PER_SECOND` or `TICKS_PER_DAY`.

`WeatherStore` owns current weather, previous weather, transition tick,
command-forced weather, severity lanes, source stream id, source stream
version, and weather version. Scheduled weather draws use only the named stream
`weather:m3-ordinary-life`; scenario commands such as `weather.force` can set
authoritative weather without consuming visual or UI randomness. Day/night and
weather changes enqueue exact environment dirty keys for schedule, rest, need,
mood, weather exposure, and read-model rebuilds.

The exported M3 environment projection is read-only and versioned. It may feed
schedule, need-rate, mood-context, outdoor-work, and explanation inputs in later
tasks, but those downstream systems remain separate owner stores.

## 快进

主线程累积目标模拟速度，Worker 批量执行 Tick，并定期让出消息循环。设置每批最大 Tick 和主线程心跳，避免浏览器“无响应”。极速模式允许降低快照频率，不允许跳过权威系统。

## 不变量

- 同构建、同内容 Hash、同种子与同命令流产生相同 World Hash。
- 暂停状态不推进模拟 Tick。
- 渲染帧丢失不影响模拟。
- 线程任务晚到只能被版本检查拒绝，不能覆盖新状态。
