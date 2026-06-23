# 严格代码规范

## TypeScript 配置

必须：`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `useUnknownInCatchVariables`, `noPropertyAccessFromIndexSignature`, `isolatedModules`。

## 类型

- 禁止 `any`；测试桩也不例外。
- 外部输入为 `unknown`，必须经过边界 Validator。
- 优先判别联合与品牌类型；不要用字符串裸传 EntityId、DefId、Tick。
- 禁止数字 enum；使用 `as const` 对象和联合。
- 公共函数显式返回类型。
- `as` 只能用于经过证明的边界转换，邻近注释写明不变量。
- 非空断言默认禁止。

## 模块

- 禁止默认导出。
- 每包只有明确 public API；禁止跨包 deep import。
- 禁止循环依赖。
- 文件名 kebab-case，类型 PascalCase，函数/变量 camelCase，常量 UPPER_SNAKE_CASE。
- 一个文件一个主要职责；非生成文件 >400 行触发拆分评审。

## 函数与控制流

- 函数建议 ≤60 行、复杂度 ≤10、参数 ≤4；更多参数使用具名对象。
- 失败使用显式 Result/Reason，不以 `null` 混合多种含义。
- 避免布尔参数；使用语义类型。
- 禁止空 catch、静默 fallback 和无说明 retry。

## 模拟核心

- 禁止 `Math.random`, `Date.now`, `performance.now`, DOM, Node/Electron API。
- 规则结果使用安全整数；定点比例必须命名尺度。
- 热循环禁止 `map/filter/reduce/flatMap`, spread, 解构临时对象、字符串格式化、正则。
- 禁止每实体对象方法和闭包回调。
- 禁止运行中修改正在迭代的 Store；使用 Command Buffer。
- 排序必须显式比较器与稳定 tie-breaker。
- 缓存必须有拥有者、版本和失效事件。

## React

- React 不持有权威游戏状态。
- 使用 Read Model + selector 订阅；禁止每 Tick setState 全树刷新。
- 长列表虚拟化；Tooltip 延迟创建。
- 组件不直接发多个低级模拟命令，经过 Application Command API。

## PixiJS

- 不为格子创建 DisplayObject。
- 不在每个 Sprite 上挂独立 ticker。
- Chunk 与批处理优先；对象池用于高频 VFX。
- 渲染对象绝不能成为保存或规则真值。

## 注释

解释为什么、边界和不变量，不复述语法。TODO 必须关联任务 ID；禁止无主 TODO/FIXME。
