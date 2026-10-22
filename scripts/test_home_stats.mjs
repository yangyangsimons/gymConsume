// 首页周目标 / 日历 / 数据页（热力图、动作表现）统计的纯逻辑测试（无需安装任何依赖，Node 22.6+）。
// 运行：node scripts/test_home_stats.mjs
// 原理：把 services/*.uts 复制为临时 .mts（改写 import），用 Node 自带的类型剥离加载，再分别在多个时区下运行 node:test。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const servicesDir = path.join(here, '..', 'services')
const MODULES = ['gym-stats', 'gym-cloud', 'gym-api', 'gym-days', 'workout-session', 'gym-calendar', 'weekly-goal', 'gym-insights', 'gym-demo', 'workout-entry']
const ZONES = ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Auckland', 'UTC']

if (!process.env.GYM_TEST_CHILD) {
	let failed = false
	for (const tz of ZONES) {
		console.log('\n=== TZ=' + tz + ' ===')
		const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url)], {
			env: { ...process.env, GYM_TEST_CHILD: '1', TZ: tz },
			stdio: 'inherit'
		})
		if (r.status !== 0) failed = true
	}
	process.exit(failed ? 1 : 0)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-home-stats-'))
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }))
MODULES.forEach((name) => {
	let src = fs.readFileSync(path.join(servicesDir, name + '.uts'), 'utf-8')
	let n = 0
	src = src.replace(/import \{([^}]*)\} from '\.\/([\w-]+)\.uts'/g, (_m, names, mod) => {
		n++
		return `import * as __m${n} from './${mod}.mts'\nconst {${names}} = __m${n} as any`
	})
	fs.writeFileSync(path.join(tmp, name + '.mts'), src)
})
const load = (name) => import(pathToFileURL(path.join(tmp, name + '.mts')).href)
// 内存版本机存储，替代小程序的 uni.*Storage*；测试里的“当前时间”都通过显式传入的 Date 控制
const store = new Map()
globalThis.uni = {
	getStorageSync: (k) => (store.has(k) ? store.get(k) : ''),
	setStorageSync: (k, v) => { store.set(k, v) },
	removeStorageSync: (k) => { store.delete(k) },
	$emit: () => {}, showToast: () => {}
}

const stats = await load('gym-stats')
const session = await load('workout-session')
const cal = await load('gym-calendar')
const goal = await load('weekly-goal')
const ins = await load('gym-insights')
const demo = await load('gym-demo')
const entry = await load('workout-entry')
await load('gym-days')

const { test } = await import('node:test')
const assert = (await import('node:assert/strict')).default

const TODAY = '2026-10-20' // 周二

function cloud(date, sets, id) {
	const done = sets.filter((s) => s.done)
	return {
		_id: id || 'w-' + date,
		date,
		durationMin: 50,
		totalSets: done.length,
		totalVolume: done.reduce((a, s) => a + s.weight * s.reps, 0),
		exercises: [{ exerciseId: 'chest-01', name: '杠铃卧推', category: '胸', sets }]
	}
}
const doneSet = (weight = 60, reps = 10) => ({ weight, reps, done: true })

function local(id, date, opts = {}) {
	const kinds = opts.kinds || ['work']
	return {
		version: 1,
		id,
		date,
		startedAt: Date.parse(date + 'T10:00:00'),
		updatedAt: 0,
		finishedAt: opts.status === 'active' ? 0 : Date.parse(date + 'T11:00:00'),
		status: opts.status || 'finished',
		exercises: [{
			id: 'ex-' + id,
			exerciseId: 'chest-01',
			name: '杠铃卧推',
			category: '胸',
			weightRequired: true,
			target: session.defaultTarget(),
			cloudSynced: false,
			sets: kinds.map((k, i) => ({ id: id + '-' + i, kind: k, weight: '60', reps: '10', rir: '', done: opts.done !== false }))
		}],
		editing: null,
		cloudStatus: opts.cloud || 'pending',
		durationSent: opts.cloud === 'synced'
	}
}

function trainedOf(workouts, sessions, loaded = true) {
	return cal.trainedDaysMap(cal.buildDayEntries(workouts, sessions, loaded))
}

test('日期：周一为一周起点，跨月 / 跨年正确', () => {
	assert.equal(cal.weekStartOf('2026-10-19'), '2026-10-19')
	assert.equal(cal.weekStartOf('2026-10-25'), '2026-10-19')
	assert.equal(cal.weekStartOf('2026-11-01'), '2026-10-26')
	assert.equal(cal.weekStartOf('2027-01-01'), '2026-12-28')
	assert.equal(cal.weekEndOf('2026-10-20'), '2026-10-25')
	assert.equal(cal.nextWeekStart('2026-10-25'), '2026-10-26')
})

test('日期：夏令时切换日不发生日期偏移', () => {
	assert.equal(stats.formatDate(stats.parseDate('2026-03-08')), '2026-03-08')
	assert.equal(cal.addDaysStr('2026-03-07', 1), '2026-03-08')
	assert.equal(cal.addDaysStr('2026-03-08', 1), '2026-03-09')
	assert.equal(cal.addDaysStr('2026-04-04', 2), '2026-04-06')
	assert.equal(cal.weekStartOf('2026-03-08'), '2026-03-02')
})

test('周进度：无记录', () => {
	const p = cal.calcWeekProgress(new Map(), TODAY, 4)
	assert.deepEqual([p.trainedDays, p.remaining, p.extra, p.met], [0, 4, 0, false])
})

test('周进度：同一天多次训练只计 1 天', () => {
	const t = trainedOf([cloud('2026-10-19', [doneSet()])], [local('a', '2026-10-19'), local('b', '2026-10-19', { cloud: 'failed' })])
	const p = cal.calcWeekProgress(t, TODAY, 4)
	assert.equal(p.trainedDays, 1)
})

test('周进度：进行中、空训练、仅热身、未完成组都不计入', () => {
	const entriesInput = [
		local('active', '2026-10-20', { status: 'active' }),
		local('warm', '2026-10-19', { kinds: ['warmup'], cloud: 'skipped' }),
		local('undone', '2026-10-19', { done: false })
	]
	const t = trainedOf([cloud('2026-10-18', [{ weight: 60, reps: 10, done: false }])], entriesInput)
	assert.equal(t.size, 0)
	const entries = cal.buildDayEntries([], entriesInput, true)
	// 进行中和仅热身的训练会展示，没有任何已完成组的结束训练不展示
	assert.deepEqual(entries.map((e) => e.key).sort(), ['local:active', 'local:warm'])
	assert.deepEqual(cal.activeDates(entries), ['2026-10-20'])
	assert.equal(cal.entryTag(entries.find((e) => e.key === 'local:active')), '进行中')
	assert.equal(cal.entryTag(entries.find((e) => e.key === 'local:warm')), '仅热身')
})

test('周进度：达标与超额完成不出现负数', () => {
	const w = ['2026-10-19', '2026-10-20', '2026-10-21'].map((d) => cloud(d, [doneSet()]))
	const t = trainedOf(w, [])
	const met = cal.calcWeekProgress(t, '2026-10-21', 3)
	assert.deepEqual([met.trainedDays, met.remaining, met.extra, met.met], [3, 0, 0, true])
	const over = cal.calcWeekProgress(t, '2026-10-21', 2)
	assert.deepEqual([over.remaining, over.extra, over.met], [0, 1, true])
})

test('周进度：跨周边界（周日与周一分属不同周）', () => {
	const t = trainedOf([cloud('2026-10-25', [doneSet()]), cloud('2026-10-26', [doneSet()])], [])
	assert.equal(cal.calcWeekProgress(t, '2026-10-25', 4).trainedDays, 1)
	assert.equal(cal.calcWeekProgress(t, '2026-10-26', 4).trainedDays, 1)
	assert.equal(cal.calcWeekProgress(t, '2026-10-18', 4).trainedDays, 0)
})

test('合并：本机已同步训练在云端加载成功时不重复，云端失败时回退展示', () => {
	const synced = local('s', '2026-10-19', { cloud: 'synced' })
	const w = [cloud('2026-10-19', [doneSet()])]
	assert.equal(cal.entriesOnDate(cal.buildDayEntries(w, [synced], true), '2026-10-19').length, 1)
	const fallback = cal.buildDayEntries([], [synced], false)
	assert.equal(fallback.length, 1)
	assert.equal(fallback[0].counted, true)
})

test('合并：同一天云端 + 本机多条完整展示，进行中排在最前', () => {
	const entries = cal.buildDayEntries([cloud('2026-10-19', [doneSet()])], [local('a', '2026-10-19'), local('b', '2026-10-19', { status: 'active' })], true)
	const day = cal.entriesOnDate(entries, '2026-10-19')
	assert.deepEqual(day.map((e) => e.status), ['active', 'finished', 'finished'])
	assert.deepEqual(day.map((e) => e.source), ['local', 'local', 'cloud'])
	assert.equal(day[2].exercises[0].sets[0], '60 kg × 10')
})

test('日历：10 月网格从周一开始，星期与日期对应', () => {
	const cells = cal.buildMonthCells(2026, 9, TODAY, TODAY, new Map(), [])
	assert.equal(cells.length, 35)
	assert.equal(cells[0].date, '2026-09-28')
	assert.equal(cells[3].date, '2026-10-01')
	assert.equal(cells[3].inMonth, true)
	assert.equal(cells[0].inMonth, false)
	cells.forEach((c, i) => {
		assert.equal(stats.weekdayIndex(stats.parseDate(c.date)), i % 7)
	})
	assert.equal(cells.filter((c) => c.inMonth).length, 31)
})

test('日历：5 / 6 行网格与二月', () => {
	assert.equal(cal.buildMonthCells(2026, 7, TODAY, TODAY, new Map(), []).length, 42)
	const feb = cal.buildMonthCells(2026, 1, TODAY, TODAY, new Map(), [])
	assert.equal(feb.length, 35)
	assert.equal(feb[6].date, '2026-02-01')
	assert.equal(feb.filter((c) => c.inMonth).length, 28)
	assert.equal(cal.buildMonthCells(2028, 1, TODAY, TODAY, new Map(), []).filter((c) => c.inMonth).length, 29)
})

test('日历：今天 / 选中 / 训练 / 进行中 / 未来 状态互相独立', () => {
	const trained = new Map([['2026-10-10', 5], ['2026-10-20', 3]])
	const cells = cal.buildMonthCells(2026, 9, TODAY, '2026-10-10', trained, ['2026-10-20'])
	const by = (d) => cells.find((c) => c.date === d)
	assert.deepEqual([by('2026-10-20').today, by('2026-10-20').selected, by('2026-10-20').trained, by('2026-10-20').active, by('2026-10-20').future], [true, false, true, true, false])
	assert.deepEqual([by('2026-10-10').today, by('2026-10-10').selected, by('2026-10-10').trained], [false, true, true])
	assert.equal(by('2026-10-21').future, true)
	assert.equal(by('2026-10-19').future, false)
})

test('月份切换与月训练天数（跨月 / 跨年）', () => {
	assert.deepEqual({ ...cal.shiftMonth(2026, 0, -1) }, { year: 2025, month: 11 })
	assert.deepEqual({ ...cal.shiftMonth(2026, 11, 1) }, { year: 2027, month: 0 })
	const t = trainedOf([cloud('2026-09-30', [doneSet()]), cloud('2026-10-01', [doneSet()]), cloud('2026-10-31', [doneSet()]), cloud('2026-11-01', [doneSet()])], [])
	assert.equal(cal.monthTrainedDays(t, 2026, 9), 2)
	assert.equal(cal.monthTrainedDays(t, 2026, 8), 1)
	assert.equal(cal.monthTrainedDays(t, 2026, 10), 1)
})

test('连续训练天数与周/月口径一致', () => {
	const t = trainedOf([cloud('2026-10-18', [doneSet()]), cloud('2026-10-19', [doneSet()])], [local('a', '2026-10-20', { status: 'active' })])
	assert.equal(stats.calcStreak(t, stats.parseDate(TODAY)), 2)
})

test('周容量只统计已计入的训练', () => {
	const entries = cal.buildDayEntries([cloud('2026-10-19', [doneSet(100, 10)])], [local('a', '2026-10-20', { status: 'active' })], true)
	assert.equal(cal.weekVolume(entries, '2026-10-19'), 1000)
})

test('周目标：没有设置时使用默认值且标记为未设置', () => {
	const info = goal.goalForWeek(goal.emptyGoalConfig(), '2026-10-19')
	assert.deepEqual({ ...info }, { goal: 4, known: false })
})

test('周目标：本周生效立即使用，更早的周次保持未知', () => {
	const cfg = goal.applyGoal(goal.emptyGoalConfig(), 5, 'now', TODAY, 1)
	assert.deepEqual({ ...goal.goalForWeek(cfg, '2026-10-19') }, { goal: 5, known: true })
	assert.deepEqual({ ...goal.goalForWeek(cfg, '2026-10-26') }, { goal: 5, known: true })
	assert.equal(goal.goalForWeek(cfg, '2026-10-12').known, false)
	assert.equal(goal.pendingChange(cfg, TODAY), null)
})

test('周目标：下周生效，本周沿用原目标，到生效周后切换', () => {
	let cfg = goal.applyGoal(goal.emptyGoalConfig(), 3, 'now', TODAY, 1)
	cfg = goal.applyGoal(cfg, 6, 'next', TODAY, 2)
	assert.equal(goal.goalForWeek(cfg, '2026-10-19').goal, 3)
	assert.equal(goal.goalForWeek(cfg, '2026-10-26').goal, 6)
	assert.equal(goal.goalForWeek(cfg, '2026-11-02').goal, 6)
	const pending = goal.pendingChange(cfg, TODAY)
	assert.deepEqual([pending.week, pending.goal], ['2026-10-26', 6])
	// 到生效周后不再是“待生效”
	assert.equal(goal.pendingChange(cfg, '2026-10-27'), null)
	assert.equal(goal.goalForWeek(cfg, cal.weekStartOf('2026-10-27')).goal, 6)
	// 旧周次的目标保持不变（历史与当前分开）
	assert.equal(goal.goalForWeek(cfg, '2026-10-12').known, false)
})

test('周目标：本周生效会取消尚未生效的下周变更；原对象不被修改', () => {
	const base = goal.applyGoal(goal.emptyGoalConfig(), 3, 'now', TODAY, 1)
	const withNext = goal.applyGoal(base, 6, 'next', TODAY, 2)
	const snapshot = JSON.stringify(withNext)
	const replaced = goal.applyGoal(withNext, 2, 'now', TODAY, 3)
	assert.equal(JSON.stringify(withNext), snapshot)
	assert.equal(goal.pendingChange(replaced, TODAY), null)
	assert.equal(goal.goalForWeek(replaced, '2026-10-26').goal, 2)
})

test('周目标：旧周次改动不被覆盖（跨周后修改只影响新周）', () => {
	let cfg = goal.applyGoal(goal.emptyGoalConfig(), 3, 'now', '2026-10-13', 1)
	cfg = goal.applyGoal(cfg, 5, 'now', TODAY, 2)
	assert.equal(goal.goalForWeek(cfg, '2026-10-12').goal, 3)
	assert.equal(goal.goalForWeek(cfg, '2026-10-19').goal, 5)
})

test('周目标：存储内容校验，非法条目被丢弃', () => {
	assert.equal(goal.isValidGoal(0), false)
	assert.equal(goal.isValidGoal(8), false)
	assert.equal(goal.isValidGoal(3.5), false)
	assert.equal(goal.isValidGoal(7), true)
	const cfg = goal.sanitizeGoalConfig({
		version: 1,
		changes: [
			{ week: '2026-10-21', goal: 3, setAt: 1 },
			{ week: '2026-10-26', goal: 9, setAt: 1 },
			{ week: '2026-10-19', goal: 3, setAt: 1 }
		]
	})
	assert.deepEqual(cfg.changes.map((c) => c.week), ['2026-10-19'])
	assert.equal(goal.sanitizeGoalConfig({ version: 2, changes: [] }).changes.length, 0)
	assert.equal(goal.sanitizeGoalConfig(null).changes.length, 0)
})

// ------------------------------------------------------------ 数据页：热力图 / 动作表现
function cloudEx(date, logs, id) {
	const all = logs.flatMap((l) => l.sets.filter((s) => s.done))
	return {
		_id: id || 'w-' + date,
		date,
		durationMin: 40,
		totalSets: all.length,
		totalVolume: all.reduce((a, s) => a + s.weight * s.reps, 0),
		exercises: logs.map((l) => ({ category: '胸', name: '杠铃卧推', ...l }))
	}
}
const bench = (sets, extra = {}) => ({ exerciseId: 'chest-01', name: '杠铃卧推', category: '胸', sets, ...extra })

function localEx(id, date, exId, name, category, sets, opts = {}) {
	const s = local(id, date, opts)
	s.exercises = [{
		id: 'ex-' + id,
		exerciseId: exId,
		name,
		category,
		weightRequired: session.isWeightRequired(exId, category),
		target: session.defaultTarget(),
		cloudSynced: false,
		sets: sets.map(([kind, weight, reps, done], i) => ({ id: id + '-' + i, kind, weight: '' + weight, reps: '' + reps, rir: '', done: done !== false }))
	}]
	return s
}

const entriesOf = (workouts, sessions = [], loaded = true) => cal.buildDayEntries(workouts, sessions, loaded)

test('热力图：分档边界集中配置', () => {
	const lv = (n) => ins.heatLevel(n)
	assert.deepEqual([0, 1, 5, 6, 10, 11, 15, 16, 200].map(lv), [0, 1, 1, 2, 2, 3, 3, 4, 4])
	assert.deepEqual(ins.HEAT_STEPS.map((s) => s.label), ['0 组', '1–5 组', '6–10 组', '11–15 组', '16 组及以上'])
})

test('热力图：12 周按周对齐，星期 / 月份与位置对应，本周未来日期单独标识', () => {
	const hm = ins.buildHeatmap(new Map(), TODAY, 12)
	assert.equal(hm.columns.length, 12)
	assert.equal(hm.columns[0].cells[0].date, '2026-08-03')
	assert.equal(hm.columns[11].cells[0].date, '2026-10-19')
	hm.columns.forEach((c) => {
		assert.equal(c.cells.length, 7)
		c.cells.forEach((cell, i) => assert.equal(stats.weekdayIndex(stats.parseDate(cell.date)), i))
	})
	const last = hm.columns[11].cells
	assert.deepEqual(last.map((c) => c.future), [false, false, true, true, true, true, true])
	assert.equal(last[1].today, true)
	assert.equal(last[2].color, 'transparent')
	// 月份标识：该周包含 1 日（周一 8/31 含 9/1，9/28 含 10/1），第一列显示所在月份
	assert.deepEqual(hm.columns.map((c) => c.label).filter(Boolean), ['8月', '9月', '10月'])
	assert.equal(hm.columns[4].label, '9月')
	assert.ok(hm.columns[4].cells.some((c) => c.date === '2026-09-01'))
	assert.equal(hm.columns[8].label, '10月')
	assert.ok(hm.columns[8].cells.some((c) => c.date === '2026-10-01'))
})

test('热力图：只汇总已结束训练的已完成正式组，同日合并，未来不统计', () => {
	const entries = entriesOf(
		[cloudEx('2026-10-19', [bench([doneSet(), doneSet(), { weight: 60, reps: 10, done: false }])])],
		[
			localEx('a', '2026-10-19', 'chest-01', '杠铃卧推', '胸', [['warmup', 20, 10], ['work', 60, 10], ['work', 60, 8], ['work', 60, 8, false]]),
			localEx('act', '2026-10-20', 'chest-01', '杠铃卧推', '胸', [['work', 60, 10]], { status: 'active' }),
			localEx('warm', '2026-10-18', 'chest-01', '杠铃卧推', '胸', [['warmup', 20, 10]], { cloud: 'skipped' })
		]
	)
	const hm = ins.buildHeatmap(cal.trainedDaysMap(entries), TODAY, 12)
	const cell = (d) => hm.columns.flatMap((c) => c.cells).find((c) => c.date === d)
	assert.equal(cell('2026-10-19').sets, 4) // 云端 2 组 + 本机 2 个正式组；热身与未完成不算
	assert.equal(cell('2026-10-19').level, 1)
	assert.equal(cell('2026-10-20').sets, 0) // 进行中不计入
	assert.equal(cell('2026-10-18').sets, 0) // 仅热身不计入
	assert.equal(hm.totalSets, 4)
	assert.equal(hm.activeDays, 1)
})

test('热力图与首页周进度共用同一统计：删除 / 修改训练后同步变化', () => {
	const a = localEx('a', '2026-10-19', 'chest-01', '杠铃卧推', '胸', [['work', 60, 10]])
	const b = localEx('b', '2026-10-20', 'chest-01', '杠铃卧推', '胸', [['work', 60, 10], ['work', 60, 10]])
	let t = cal.trainedDaysMap(entriesOf([], [a, b]))
	assert.equal(cal.calcWeekProgress(t, TODAY, 4).trainedDays, 2)
	assert.equal(ins.buildHeatmap(t, TODAY, 12).totalSets, 3)
	t = cal.trainedDaysMap(entriesOf([], [a]))
	assert.equal(cal.calcWeekProgress(t, TODAY, 4).trainedDays, 1)
	assert.equal(ins.buildHeatmap(t, TODAY, 12).totalSets, 1)
	b.exercises[0].sets[1].done = false
	t = cal.trainedDaysMap(entriesOf([], [a, b]))
	assert.equal(ins.buildHeatmap(t, TODAY, 12).totalSets, 2)
})

test('动作表现：最高工作重量取已完成正式组最大值，并列时列出全部对应记录；不含热身 / 未完成', () => {
	const entries = entriesOf([], [localEx('a', '2026-10-19', 'chest-01', '杠铃卧推', '胸', [
		['warmup', 100, 5], ['work', 60, 10], ['work', 62.5, 8], ['work', 62.5, 6], ['work', 80, 5, false]
	])])
	const occ = ins.collectOccurrences(entries)
	const r = ins.buildTrend(occ.items, 'chest-01', '胸', 'weight', TODAY, 84)
	assert.equal(r.points.length, 1)
	const p = r.points[0]
	assert.equal(p.value, 62.5)
	assert.deepEqual(p.topSets.map((s) => [s.weight, s.reps]), [[62.5, 8], [62.5, 6]])
	assert.equal(p.sets.length, 3)
	assert.deepEqual(r.ticks, [0, 50, 100]) // 轴上限为 1/2/5×10^n
})

test('动作表现：训练容量 = 重量 × 次数之和，给出公式，缺失值不当作 0', () => {
	const entries = entriesOf([
		cloudEx('2026-10-12', [bench([doneSet(60, 10), doneSet(62.5, 8)])]),
		cloudEx('2026-10-14', [bench([{ weight: 0, reps: 8, done: true }])]) // 旧数据缺少重量
	], [])
	const occ = ins.collectOccurrences(entries)
	const r = ins.buildTrend(occ.items, 'chest-01', '胸', 'volume', TODAY, 84)
	assert.equal(r.points.length, 1)
	assert.equal(r.points[0].value, 1100)
	assert.equal(ins.volumeFormula(r.points[0]), '60 × 10 + 62.5 × 8 = 1100 kg')
	assert.equal(r.noValue, 1)
	assert.equal(r.total, 2)
	assert.equal(r.last.hasValue, false) // 最近一次记录存在，但没有有效重量
})

test('动作表现：一次训练一个点，按时间排序，同一天多次可区分，不补 0', () => {
	const entries = entriesOf(
		[cloudEx('2026-10-05', [bench([doneSet(60, 10)])]), cloudEx('2026-10-19', [bench([doneSet(65, 8)])])],
		[
			localEx('late', '2026-10-19', 'chest-01', '杠铃卧推', '胸', [['work', 50, 12]]),
			localEx('early', '2026-10-05', 'chest-01', '杠铃卧推', '胸', [['work', 55, 10]])
		]
	)
	const r = ins.buildTrend(ins.collectOccurrences(entries).items, 'chest-01', '胸', 'weight', TODAY, 84)
	assert.deepEqual(r.points.map((p) => p.date), ['2026-10-05', '2026-10-05', '2026-10-19', '2026-10-19'])
	assert.deepEqual(r.points.map((p) => [p.seq, p.countOnDate]), [[1, 2], [2, 2], [1, 2], [2, 2]])
	assert.deepEqual(r.points.map((p) => p.value), [60, 55, 65, 50]) // 云端在前、本机在后，中间没有补 0 的日期
})

test('动作表现：时间范围过滤、单数据点、范围内无数据、无记录', () => {
	const entries = entriesOf([cloudEx('2026-08-01', [bench([doneSet(60, 10)])])], [])
	const items = ins.collectOccurrences(entries).items
	const r28 = ins.buildTrend(items, 'chest-01', '胸', 'weight', TODAY, 28)
	assert.equal(r28.points.length, 0)
	assert.equal(r28.total, 1)
	assert.equal(r28.last.date, '2026-08-01') // 最近一次与时间范围无关
	const r365 = ins.buildTrend(items, 'chest-01', '胸', 'weight', TODAY, 365)
	assert.equal(r365.points.length, 1) // 单数据点也能展示
	const none = ins.buildTrend(items, 'chest-03', '胸', 'weight', TODAY, 365)
	assert.deepEqual([none.total, none.points.length, none.last], [0, 0, null])
})

test('动作表现：自重 / 核心类动作不支持重量指标；动作变式按 ID 分开；缺少 ID 的旧记录不猜测', () => {
	const entries = entriesOf([
		cloudEx('2026-10-12', [
			bench([doneSet(60, 10)]),
			{ exerciseId: 'chest-05', name: '杠铃卧推', category: '胸', sets: [doneSet(24, 10)] }, // 同名不同 ID：不合并
			{ exerciseId: 'back-01', name: '引体向上', category: '背', sets: [{ weight: 0, reps: 8, done: true }] },
			{ exerciseId: '', name: '杠铃卧推', category: '胸', sets: [doneSet(99, 5)] }
		])
	], [])
	const occ = ins.collectOccurrences(entries)
	assert.equal(occ.unlinked, 1)
	const bp = ins.buildTrend(occ.items, 'chest-01', '胸', 'weight', TODAY, 84)
	assert.deepEqual(bp.points.map((p) => p.value), [60])
	const db = ins.buildTrend(occ.items, 'chest-05', '胸', 'weight', TODAY, 84)
	assert.deepEqual(db.points.map((p) => p.value), [24])
	const pull = ins.buildTrend(occ.items, 'back-01', '背', 'weight', TODAY, 84)
	assert.equal(pull.supported, false)
	assert.equal(pull.points.length, 0)
	assert.equal(pull.total, 1)
	assert.equal(pull.last.sets[0].reps, 8)
})

test('动作表现：选择器排序 / 搜索 / 记录中出现但不在动作库的动作', () => {
	const entries = entriesOf([
		cloudEx('2026-10-01', [bench([doneSet()])]),
		cloudEx('2026-10-15', [{ exerciseId: 'legs-01', name: '杠铃深蹲', category: '腿', sets: [doneSet(100, 5)] }]),
		cloudEx('2026-10-16', [{ exerciseId: 'old-9', name: '已删除动作', category: '胸', sets: [doneSet(10, 5)] }])
	], [])
	const library = [
		{ _id: 'chest-01', name: '杠铃卧推', sub: '胸大肌', icon: '卧', category: '胸', pinyin: 'gangling woutui' },
		{ _id: 'chest-03', name: '绳索夹胸', sub: '胸大肌', icon: '夹', category: '胸', pinyin: 'shengsuo jiaxiong' },
		{ _id: 'legs-01', name: '杠铃深蹲', sub: '股四头肌', icon: '蹲', category: '腿', pinyin: 'gangling shendun' }
	]
	const opts = ins.buildExerciseOptions(library, ins.collectOccurrences(entries).items)
	assert.deepEqual(opts.map((o) => o.id), ['old-9', 'legs-01', 'chest-01', 'chest-03'])
	assert.equal(opts[0].inLibrary, false)
	assert.equal(opts[3].count, 0)
	assert.deepEqual(ins.filterExerciseOptions(opts, 'woutui').map((o) => o.id), ['chest-01'])
	assert.deepEqual(ins.filterExerciseOptions(opts, '腿').map((o) => o.id), ['legs-01'])
	assert.equal(ins.filterExerciseOptions(opts, 'zzz').length, 0)
	assert.equal(ins.resolveExerciseId(opts, 'chest-03'), 'chest-03') // 无记录动作也可以被选中
	assert.equal(ins.resolveExerciseId(opts, 'gone'), 'old-9') // 偏好失效：回退到最近训练过的动作
	assert.equal(ins.resolveExerciseId([], ''), '')
})

test('动作表现：本地偏好校验，非法值回退默认', () => {
	assert.deepEqual({ ...ins.sanitizePrefs(null) }, { exerciseId: '', metric: 'weight', rangeDays: 84 })
	assert.deepEqual({ ...ins.sanitizePrefs({ exerciseId: 'chest-02', metric: 'volume', rangeDays: 365 }) }, { exerciseId: 'chest-02', metric: 'volume', rangeDays: 365 })
	assert.deepEqual({ ...ins.sanitizePrefs({ exerciseId: 5, metric: 'e1rm', rangeDays: 7 }) }, { exerciseId: '5', metric: 'weight', rangeDays: 84 })
})

test('纵轴上限：1 / 2 / 5 × 10^n', () => {
	assert.deepEqual([0, 0.3, 7, 62.5, 100, 101, 1100, 4800].map(ins.niceMax), [10, 0.5, 10, 100, 100, 200, 2000, 5000])
})

test('概览与部位分布与首页使用同一份计入记录', () => {
	const entries = entriesOf(
		[cloudEx('2026-10-19', [bench([doneSet(100, 10)])])],
		[
			localEx('a', '2026-10-19', 'legs-01', '杠铃深蹲', '腿', [['work', 100, 5], ['warmup', 40, 5]]),
			localEx('act', '2026-10-20', 'chest-01', '杠铃卧推', '胸', [['work', 60, 10]], { status: 'active' })
		]
	)
	const o = ins.calcOverview(entries, TODAY)
	assert.equal(o.days, 1)
	assert.equal(o.tons, 1.5)
	const m = ins.calcMuscleStats(entries, TODAY)
	assert.equal(m.totalSets, 2) // 热身与进行中不计入
	assert.deepEqual(m.shares.map((s) => s.percent), [50, 0, 50, 0])
	assert.equal(m.shares.reduce((a, s) => a + s.percent, 0), 100)
})

test('演示数据：默认关闭，覆盖各类场景，不会被当作真实数据', () => {
	assert.equal(demo.DEMO_MODE, false)
	const sessions = demo.demoSessions(TODAY)
	const entries = entriesOf([], sessions)
	const occ = ins.collectOccurrences(entries)
	const ids = new Set(occ.items.map((o) => o.exerciseId))
	assert.ok(['chest-01', 'chest-02', 'chest-05', 'legs-01', 'back-01', 'shoulder-01'].every((id) => ids.has(id)))
	// 同一天多场训练
	const byDate = new Map()
	entries.forEach((e) => byDate.set(e.date, (byDate.get(e.date) || 0) + 1))
	assert.ok([...byDate.values()].some((n) => n >= 2))
	// 单数据点 / 无数据 / 不支持重量指标
	const lib = demo.demoExercises()
	assert.equal(ins.buildTrend(occ.items, 'shoulder-01', '肩', 'weight', TODAY, 365).points.length, 1)
	assert.equal(ins.buildTrend(occ.items, 'arm-01', '手臂', 'weight', TODAY, 365).total, 0)
	assert.equal(ins.buildTrend(occ.items, 'core-01', '核心', 'weight', TODAY, 365).supported, false)
	assert.equal(ins.buildTrend(occ.items, 'back-01', '背', 'weight', TODAY, 365).supported, false)
	assert.ok(lib.some((e) => e._id === 'chest-03') && !ids.has('chest-03'))
	// 缺少 ID 的旧记录；只有未完成组的训练不产生记录；热身组 / 未完成组不进入趋势
	assert.ok(occ.unlinked >= 1)
	assert.ok(!entries.some((e) => e.date === cal.addDaysStr(TODAY, -2)))
	entries.filter((e) => e.counted).forEach((e) => e.exercises.forEach((ex) => assert.equal(ex.records.length, ex.workSets)))
	// 演示数据不会是 synced / 云端来源
	assert.ok(entries.every((e) => e.source === 'local'))
	const hm = ins.buildHeatmap(cal.trainedDaysMap(entries), TODAY, 12)
	assert.ok(hm.totalSets > 0 && hm.columns.flatMap((c) => c.cells).some((c) => c.level === 4 || c.level === 3 || c.level === 2))
})

// ------------------------------------------------------------ 开始 / 继续训练：日期与草稿身份
const clock = (y, m, d, h = 10, mi = 0) => new Date(y, m - 1, d, h, mi) // 本地时间，m 为 1 基
const resetStore = () => store.clear()
const plan = () => entry.planStart(session.loadSession(), session.loadHistorySessions(), '2026-10-21')

test('开始训练：日期只取自传入的时钟，与任何“选中日期”无关', () => {
	resetStore()
	const s = session.createSession(clock(2026, 10, 21, 9, 30))
	assert.equal(s.date, '2026-10-21')
	assert.equal(s.startedAt, clock(2026, 10, 21, 9, 30).getTime())
	assert.equal(s.status, 'active')
	assert.equal(session.loadSession().id, s.id)
})

test('开始训练：今天已有未结束训练时不重复新建（含当前会话与历史中的草稿）', () => {
	resetStore()
	const a = session.createSession(clock(2026, 10, 21, 9))
	assert.equal(session.createSession(clock(2026, 10, 21, 18)).id, a.id)
	assert.equal(session.loadHistorySessions().length, 0)
})

test('旧草稿：不会被当作今日训练，也不会被覆盖；新训练开始后旧草稿保留在历史中', () => {
	resetStore()
	const old = session.createSession(clock(2026, 10, 20, 20))
	old.exercises.push({ ...local('x', '2026-10-20').exercises[0] })
	session.saveSession(old)
	const p = plan()
	assert.deepEqual([p.kind, p.sessionId, p.date], ['conflict', old.id, '2026-10-20'])
	const fresh = session.createSession(clock(2026, 10, 21, 8))
	assert.notEqual(fresh.id, old.id)
	assert.equal(fresh.date, '2026-10-21')
	const kept = session.loadHistorySessions().find((s) => s.id === old.id)
	assert.equal(kept.status, 'active')
	assert.equal(kept.date, '2026-10-20')
	assert.equal(kept.exercises.length, 1)
	// 旧草稿仍未结束，不计入统计
	const entries = cal.buildDayEntries([], session.loadLocalSessions(), true)
	assert.equal(cal.trainedDaysMap(entries).size, 0)
	assert.deepEqual(cal.activeDates(entries).sort(), ['2026-10-20', '2026-10-21'])
	// 之后今天的草稿优先“继续”
	assert.deepEqual([plan().kind, plan().sessionId], ['continue', fresh.id])
})

test('跨午夜：明确继续午夜前开始的训练，ID、开始时间和日期归属保持不变', () => {
	resetStore()
	const s = session.createSession(clock(2026, 10, 20, 23, 50))
	const id = s.id
	const parked = session.createSession(clock(2026, 10, 21, 0, 10)) // 午夜后的新训练：是另一场，不是原训练的延续
	assert.notEqual(parked.id, id)
	const back = session.activateSession(id)
	assert.equal(back.id, id)
	assert.equal(back.date, '2026-10-20')
	assert.equal(back.startedAt, clock(2026, 10, 20, 23, 50).getTime())
	assert.equal(session.loadSession().id, id)
	// 另一场被保留而不是丢弃
	assert.ok(session.loadHistorySessions().some((x) => x.id === parked.id))
})

test('打开训练：找不到 ID 时返回 null，不创建任何训练', () => {
	resetStore()
	assert.equal(session.activateSession('nope'), null)
	assert.equal(session.loadSession(), null)
	assert.equal(session.loadHistorySessions().length, 0)
})

test('开始 / 继续决策：无草稿、今日草稿、旧草稿、上次提交失败', () => {
	resetStore()
	assert.equal(plan().kind, 'new')
	const t = session.createSession(clock(2026, 10, 21))
	assert.equal(plan().kind, 'continue')
	t.status = 'finished'; t.cloudStatus = 'failed'
	const failed = entry.planStart(t, [], '2026-10-21')
	assert.deepEqual([failed.kind, failed.sessionId], ['failed-last', t.id])
	t.cloudStatus = 'synced'
	assert.equal(entry.planStart(t, [], '2026-10-21').kind, 'new')
	// 选中日期不是输入：同一份存储在不同“今天”下得到不同结果
	const old = session.createSession(clock(2026, 10, 20))
	assert.equal(entry.planStart(old, [], '2026-10-20').kind, 'continue')
	assert.equal(entry.planStart(old, [], '2026-10-21').kind, 'conflict')
	assert.equal(entry.planStart(old, [], '2026-10-19').kind, 'conflict')
})

test('结束训练：没有完成组时丢弃且不产生记录；只有当前会话中的未结束训练可以被结束', () => {
	resetStore()
	const a = session.createSession(clock(2026, 10, 21))
	assert.equal(session.finishSession(a), 'empty')
	assert.equal(session.loadSession(), null)
	// 非当前会话
	const b = session.createSession(clock(2026, 10, 20))
	const c = session.createSession(clock(2026, 10, 21, 12)) // b 被保留在历史中
	assert.equal(session.finishSession(b), 'stale')
	assert.equal(session.loadHistorySessions().find((x) => x.id === b.id).status, 'active')
	// 已结束的训练不会被再次改写
	const done = localEx('d', '2026-10-21', 'chest-01', '杠铃卧推', '胸', [['work', 60, 10]], { status: 'active' })
	session.saveSession(done)
	assert.equal(session.finishSession(done), 'recorded')
	assert.equal(session.finishSession(done), 'stale')
	assert.equal(c.id !== undefined, true)
})

test('历史归档：未确认同步的记录和未结束草稿均不自动丢弃', () => {
	resetStore()
	const draft = session.createSession(clock(2026, 9, 1))
	for (let i = 0; i < 35; i++) {
		const d = new Date(2026, 9, 2 + (i % 20), 10, i)
		const s = session.createSession(d)
		// 每场结束后再开始下一场：当前会话被归档进历史
		s.status = 'finished'; session.saveSession(s)
	}
	const hist = session.loadHistorySessions()
	assert.ok(hist.some((x) => x.id === draft.id && x.status === 'active'))
	assert.ok(hist.length >= 35)
})

test('草稿归档写入失败：不覆盖当前训练或开始新的训练', () => {
	resetStore()
	const original = session.createSession(clock(2026, 10, 20))
	const write = uni.setStorageSync
	uni.setStorageSync = (key, value) => {
		if (key === 'gymConsume.workoutSessionHistory.v1') throw new Error('storage full')
		write(key, value)
	}
	try {
		assert.throws(() => session.createSession(clock(2026, 10, 21)), /ARCHIVE_FAILED/)
		assert.equal(session.loadSession().id, original.id)
		assert.equal(session.loadSession().date, '2026-10-20')
	} finally {
		uni.setStorageSync = write
	}
})

test('总览统计展示：400 kg 不显示为吨，达到 1000 kg 才换算，最多两位小数', () => {
	const v = (n) => ({ ...ins.formatVolume(n) })
	assert.deepEqual(v(400), { value: '400', unit: 'kg' })
	assert.deepEqual(v(62.5), { value: '62.5', unit: 'kg' })
	assert.deepEqual(v(999.9), { value: '999.9', unit: 'kg' })
	assert.deepEqual(v(1000), { value: '1', unit: '吨' })
	assert.deepEqual(v(1250), { value: '1.25', unit: '吨' })
	assert.deepEqual(v(1234.5), { value: '1.23', unit: '吨' })
	assert.deepEqual(v(72800), { value: '72.8', unit: '吨' })
})

test('总览统计展示：不足 1 小时显示分钟，缺失显示 —', () => {
	const d = (n) => ({ ...ins.formatDuration(n) })
	assert.deepEqual(d(0), { value: '—', unit: '' })
	assert.deepEqual(d(1), { value: '1', unit: '分钟' })
	assert.deepEqual(d(59), { value: '59', unit: '分钟' })
	assert.deepEqual(d(60), { value: '1', unit: 'h' })
	assert.deepEqual(d(95), { value: '1.6', unit: 'h' })
})
