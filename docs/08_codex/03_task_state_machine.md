# Agent 任务状态机

## 状态权限

| 状态 | 谁能设置 |
|---|---|
| proposed | 任意角色 |
| ready | project-director |
| claimed/in_progress | 指定 worker |
| review_requested | worker |
| changes_requested | reviewer |
| verified | reviewer/qa |
| integrated | integration/project-director |
| done | project-director |
| blocked | worker/reviewer |

## 自动条件

任务只有所有 `dependsOn` 为 done 时才可 ready。`complete` 要求报告存在。`verify` 要求 review 记录。`done` 要求 integrated 和验收证据。

## 任务大小

理想任务 0.5–2 个代理工作周期，可独立验证。超过 800 行手写变更或跨 3 个核心包，默认先拆分。纯生成内容例外，但要批次验证。

## Follow-up

范围外问题新建 `proposed` 任务并发消息，不在当前分支顺手修。
