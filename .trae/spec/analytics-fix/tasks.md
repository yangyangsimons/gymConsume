# tasks.md — 数据页修复任务清单

- [x] T1. 修 services/gym-insights.uts（spec A1-A5）：prefs '' 哨兵、makePoint e1RM+bestSet、buildTrend Y 轴 axisMin/niceStep、calcMuscleStats 其他修复+console.log、weeksGoalProgress 新口径+注释
- [x] T2. 修 components/gym-exercise-performance.uvue（spec B1-B7）：标题 STRENGTH/力量趋势、selector .in()、去 Path2D、Y 轴 ticks、最佳组文案、metric 自动默认逻辑
- [x] T3. 修 components/gym-analytics.uvue（spec C1-C4）：donut .in()、按组数画扇区、中心两行文案+typeRatio、图例排除 0 组、goalSummary 边界
- [x] T4. 修 components/gym-heatmap.uvue（spec D1）：副标题删"近 12 周"
- [x] T5. 编译通过 + MCP 拉真实数据出结果表
- [x] T6. iPhone 12 Pro 截图验证两图渲染与文字溢出（boundingClientRect + canvas 像素直方图 + 截图）
- [x] T7. 最终汇报：根因+修法、结果表、显示结论、0% 方案与周达标算法说明
- [x] T8. 修 gym-exercise-performance.uvue 模板 v-if 标识符冲突（isBodyweight → isBodyweightAction）：模板引用被编译成 gym-stats 导入函数，函数经 setData 序列化被剥离，5 个指标 chip 的 wx:if 全假导致 chips 不渲染
- [x] T9. 收尾：buildTrend 保证 Y 轴间隔为 step 偶数倍（中间刻度也落在 2.5 倍数上）；补 chartCssHeight 定义消除 "undefinedpx"
