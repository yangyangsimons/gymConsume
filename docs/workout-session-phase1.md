# 训练记录第一阶段（前端）约定

范围：训练填写页、动作目标编辑、本次训练总览。未修改数据库结构、云函数、安全规则。
相关代码：`services/workout-session.uts`（模型/校验/本机存储）、`services/workout-adapter.uts`（云端字段映射）、
`components/gym-workout-overview`、`gym-workout-sheet`、`gym-target-editor`、`gym-rir-picker`、`pages/workout/workout`。

## 流程

首页开始/继续训练 → 本次训练总览 → 添加/编辑动作（弹层）→ 保存动作返回总览 → 结束训练 → 摘要。

- 保存动作：只保存当前填写状态到本机并返回总览，不结束整场训练，不自动完成任何组。
- 结束训练：先提示未完成组；只统计已完成的组；未完成组不会被自动标记完成。
- 退出页面不等于结束训练；训练保持“进行中”，再次进入会恢复，包括未保存的动作编辑。

## 本机存储（非云端同步）

| key | 内容 |
| --- | --- |
| `gymConsume.workoutSession.v1` | 当前训练会话（进行中或刚结束） |
| `gymConsume.workoutSessionHistory.v1` | 已归档的历史会话，最多 30 条 |

key 带版本号；版本不匹配时读取为空且不删除原数据。不读写任何已有缓存。

## 字段

会话 `WorkoutSession`：`status`（active/finished）、`date`（开始日期）、`cloudStatus`（none/pending/synced/failed/skipped）、`editing`（未保存的动作编辑草稿）。

动作 `SessionExercise`：`target`（本次目标，独立保存）、`weightRequired`（是否要求重量 > 0）、`cloudSynced`。

目标 `ExerciseTarget`：`workSets` 正式组数、`repsMin/Max`、`rirEnabled` + `rirMin/Max`（可不设置）、`restSeconds`。

组 `SetEntry`：
- `id` 稳定 ID，删除其他组不会错位。
- `kind`：`work` 正式组 / `warmup` 热身组。缺失时按 `work` 读取，不改写原数据。
- `weight` / `reps`：字符串，空串表示未填写；重量最多 2 位小数，次数为正整数。
- `rir`（实际 RIR，与目标 RIR 独立）：`''` 未填写｜`'0'`–`'4'`｜`'5+'`｜`'unsure'` 不确定。不自动继承目标或上一组。
- `done`：完成状态。完成时需通过校验；RIR 选填，不参与校验。

## 统计约定

- 完成正式组数 = `kind=work` 且 `done` 且数据合法的组；热身组不计入目标组数、容量与云端。
- 容量 = 已完成正式组的 重量 × 次数。
- 目标 3 组、实际完成 2 组是合法状态；修改目标不会增删组，也不会改动重量、次数、RIR、完成状态。
- 重量要求：核心类和自重动作（`back-01`、`chest-04`、`core-01`、`core-02`）重量可空，其余需 > 0。
- 没有任何已完成组时结束训练：直接丢弃，不产生记录。只完成热身组：保存在本机，不提交云端。

## 云端（现有接口，未扩展）

结束训练时经 `saveExerciseLog` 提交，仅包含已完成正式组的 `{ weight, reps, done }`（沿用现有 workouts 文档，
按训练开始日期累加）。以下仅在本机：目标、组类型/热身组、实际 RIR、组 ID。
逐动作提交并标记 `cloudStatus`/`cloudSynced`，失败可重试且不会重复写入。后端支持新字段后只需改 `toCloudLog`。
