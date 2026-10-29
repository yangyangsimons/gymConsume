# 数据页（pages/analytics）修复规格

## 根因确认（已读码验证）

1. **折线图/环形图不渲染**：两组件 canvas 的 `uni.createSelectorQuery()` 均未 `.in(组件实例)`，自定义组件内选不到节点；折线图另用了微信 canvas 2d 不支持的 `new Path2D()`（gym-exercise-performance.uvue L366），throw 后线与点都不执行，throw 前只画了网格/基线，故用户只见 Y 轴刻度。
2. **史密斯推举显示 680 kg**：`sanitizePrefs`（gym-insights.uts L462-472）只保留 volume、`defaultPrefs` 默认 weight，无"按动作类型自动默认"机制，偏好被错误回退。
3. **周达标 0/1 周**：`weeksGoalProgress`（L1082-1134）分母只统计有 goal 设置的周。
4. **"其他 1%"**：`calcMuscleStats` L643 `otherPct = 100 - used` 把四舍五入余数塞进"其他"。
5. **热力图副标题**：gym-heatmap.uvue L13 含"近 12 周"，与顶部选择器重复。

## 变更清单（精确到文件/函数）

### A. services/gym-insights.uts

**A1. 偏好 metric 引入 '' 哨兵（''=按动作类型自动默认）**
- `defaultPrefs()`（L458-460）：`metric: METRIC_WEIGHT` → `metric: ''`
- `sanitizePrefs()`（L462-472）：接受 `''` / e1rm / weight / volume / maxReps / totalReps；非法值回退 `''`

**A2. TrendPoint 增加 bestSet；e1RM 口径修正（makePoint L241-298）**
- TrendPoint 新增字段 `bestSet : SetRecord | null`
- e1rm 分支（L262-267）改为本地实现（不动全局 epleyOneRepMax，避免影响 PR 识别）：
  `orm = reps == 1 ? weight : weight * (1 + reps / 30)`，`Math.round(orm * 2) / 2` 按 0.5kg 取整，**无 reps 上限**；仅 `weight > 0 && reps > 0` 的组参与
- bestSet 按 metric 选：e1rm → orm 最大的一组；weight → topSets[0]；volume → weight×reps 最大的一组；maxReps/totalReps → reps 最大的一组；无有效组 → null

**A3. Y 轴不再固定从 0（buildTrend L342-380）**
- TrendResult 新增 `axisMin : number`
- 新算法：多点时 `minRaw = min - (max-min)*0.1`、`maxRaw = max + (max-min)*0.1`；单点或全部相等时以该值 v 为中心 `v*0.9 ~ v*1.1`（v=0 时 0~1）
- 新增私有 `niceStep(raw)`：1 / 2 / 2.5 / 5 × 10^n 中不小于 raw 的最小者
- `axisMin = max(0, floor(minRaw/step)*step)`，`axisMax = ceil(maxRaw/step)*step`，`ticks = [axisMin, round1((axisMin+axisMax)/2), axisMax]`
- `niceMax`（L310-320）grep 确认仅 buildTrend 使用，改后删除

**A4. calcMuscleStats（L602-650）**
- 各部位 percent 独立 `Math.round(counts[i]/total*100)`，移除 used 累加；总和不为 100% 不硬凑
- "其他"：`percent = round(counts[6]/total*100)`；`counts[6] == 0` 时不 push（"其他"只统计确实无部位的动作）
- L631 `resolveExerciseTypeWithFallback(resolvedId, lib, [])` → 先 `collectOccurrences(entries)` 构建全量 items 传入（修复中位数兜底失效）
- console.log 打印各部位组数、复合/孤立组数、总组数

**A5. weeksGoalProgress（L1082-1134）按新口径重写并加注释**
- 分母 = 自然周数（周一为起点）：从 `max(weekStartOf(区间起点), weekStartOf(首次训练日))` 逐周到本周；range=all 时起点=首训周
- 已结束周（周日 ≤ today）：进分母，达标进分子
- 当前周未结束：已达标才计入分子分母；未达标不计入分母
- goal 取 `goalForWeek(cfg, weekStart).goal`（无设置时 DEFAULT_GOAL=4）
- 函数顶部注释写清上述口径

### B. components/gym-exercise-performance.uvue

- B1. 标题（L3-8）：`PERFORMANCE/动作表现` → `STRENGTH/力量趋势`
- B2. `drawChart()`（L282-456）：
  - `uni.createSelectorQuery()` → `query.in(getCurrentInstance().proxy)`
  - 删除 `new Path2D()`：填充改为直接在 ctx 上重画完整闭合 path（曲线 + baseline），stroke 再 trace 一次曲线；fill/stroke 仅在 `cdps.length >= 2` 时执行；单点只画点
  - 坐标映射改 `ratio = (value - axisMin) / (axisMax - axisMin)`，span ≤ 0 时按 1 保护
- B3. Y 轴模板（L38-42）：硬编码 `"0"` → `ticks[0]`（新增 axisBottom computed）
- B4. 大数字下方加 `<text class="pf-head-best">最佳组 …</text>`：bestSet 为 null 或 metric==totalReps 时不显示；weight>0 → `最佳组 40kg × 8`；自重 → `最佳组 8 次`
- B5. metric computed（L132-142）：`m = prefs.metric`；该动作支持则用，不支持回退 `defaultMetricForOption`；`''` 永远走默认
- B6. `setMetric` 显式保存；`onSelectExercise`（L247-262）改 `prefs.metric = ''`（重置为自动）；`refreshPrefs`（L268-279）直接采用 sanitize 后的值
- B7. 保留"再练 N 次生成平滑趋势"提示（现有，不动）

### C. components/gym-analytics.uvue

- C1. `drawDonut()`（L208-247）：`uni.createSelectorQuery()` → `.in(getCurrentInstance().proxy)`；扇区角度按 `share.sets / muscle.totalSets * 2π`（原按 percent/100）；跳过 sets==0；颜色沿用 muscleColorMap
- C2. `sortedShares`（L173-177）：先 filter `sets > 0` 再按 percent 降序 —— **选定方案：0% 部位不进图例**（需在汇报中告知用户）
- C3. 环形图中心（模板 L73-81）改为两行 + 小字：
  - `复合 : 孤立`（第一行大字）
  - `{{ typeRatio }}`（第二行，如 `3 : 7`；c = Math.round(compound/t*10)，另一数 = 10-c；t≤0 显示 `- : -`）
  - `总组数 {{ muscle.totalSets }}`（小字）
  - 三行均 white-space:nowrap，宽度控制在圆环内径（≈86-114px）内
- C4. `goalSummary`（L184-188）：`totalWeeks == 0` 时 `暂无目标设置` → `—`

### D. components/gym-heatmap.uvue

- D1. L13 副标题 `每日完成正式组数 · 近 {{ WEEKS }} 周` → `每日完成正式组数`（WEEKS computed 保留，buildHeatmap 仍用）

## 验证

1. HBuilderX watch 编译通过（UTS 语法：无可选链、`as` 强转、谨慎解构）
2. MCP（`cli.bat auto --project ... --auto-port 9420`）+ evaluate 拉真实数据，输出结果表：训练次数、总容量、周达标分子/分母、各部位组数、复合/孤立组数、史密斯推举每次训练的 e1RM / 最高重量 / 容量
3. iPhone 12 Pro 截图：折线图/环形图是否画出、中心文字与 Y 轴刻度有无溢出

## 汇报要求（完成后）

1. 每条问题根因一句话 + 修法
2. 真实数据结果表（含周达标分子分母怎么算的）
3. 模拟器显示结论；告知 0% 部位处理选的是"不进图例"
