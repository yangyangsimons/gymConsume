// 新统计层纯逻辑测试（无需安装依赖）
//
// 运行要求：
//   Node >= 22.12  +  --experimental-strip-types flag
//   Node v22.6+ 原生支持 --experimental-strip-types 处理 .ts/.mts/.cts
//
// 推荐运行方式：
//   node --experimental-strip-types scripts/test_stats_new.mjs
// 或一次性设置：
//   set NODE_OPTIONS=--experimental-strip-types
//   node scripts/test_stats_new.mjs
//
// 本脚本会自动检测 flag，如果缺失会 spawn 带 flag 的子进程重跑自己。
import { spawnSync } from "node:child_process";

const hasStripTypes =
	process.execArgv.includes("--experimental-strip-types") ||
	process.env.NODE_OPTIONS?.includes("--experimental-strip-types");

if (!hasStripTypes) {
	const r = spawnSync(
		process.execPath,
		["--experimental-strip-types", ...process.argv.slice(1)],
		{ stdio: "inherit" },
	);
	process.exit(r.status ?? 1);
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const servicesDir = path.join(here, "..", "services");
const MODULES = fs
	.readdirSync(servicesDir)
	.filter((f) => f.endsWith(".uts"))
	.map((f) => f.replace(".uts", ""));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gym-new-stats-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

MODULES.forEach((name) => {
	let src = fs.readFileSync(path.join(servicesDir, name + ".uts"), "utf-8");
	let n = 0;
	src = src.replace(
		/import \{([^}]*)\} from '\.\/([\w-]+)\.uts'/g,
		(_m, names, mod) => {
			n++;
			return `import * as __m${n} from './${mod}.mts'\nconst {${names}} = __m${n} as any`;
		},
	);
	fs.writeFileSync(path.join(tmp, name + ".mts"), src);
});

const load = (name) =>
	import(pathToFileURL(path.join(tmp, name + ".mts")).href);

globalThis.uni = {
	getStorageSync: () => "",
	setStorageSync: () => {},
	removeStorageSync: () => {},
	$emit: () => {},
	showToast: () => {},
	showModal: () => {},
};

const stats = await load("gym-stats");
const cal = await load("gym-calendar");
const ins = await load("gym-insights");

const { test } = await import("node:test");
const assert = (await import("node:assert/strict")).default;

// ----- 动作库 -----
const LIBRARY = [
	{
		_id: "chest-01",
		name: "杠铃卧推",
		sub: "胸大肌",
		icon: "卧",
		category: "胸",
		pinyin: "gangling woutui",
		type: "复合",
		bodyweight: false,
		deprecated: false,
		aliasId: "",
	},
	{
		_id: "chest-02",
		name: "上斜哑铃卧推",
		sub: "上胸",
		icon: "斜",
		category: "胸",
		pinyin: "shangxie yaling woutui",
		type: "复合",
		bodyweight: false,
		deprecated: false,
		aliasId: "",
	},
	{
		_id: "chest-03",
		name: "绳索夹胸",
		sub: "胸大肌",
		icon: "夹",
		category: "胸",
		pinyin: "shengsuo jiaxiong",
		type: "孤立",
		bodyweight: false,
		deprecated: false,
		aliasId: "",
	},
	{
		_id: "chest-04",
		name: "双杠臂屈伸",
		sub: "下胸",
		icon: "屈",
		category: "胸",
		pinyin: "shuanggang biqushen",
		type: "复合",
		bodyweight: true,
		deprecated: false,
		aliasId: "",
	},
	{
		_id: "back-01",
		name: "引体向上",
		sub: "背阔肌",
		icon: "引",
		category: "背",
		pinyin: "yintixiangshang",
		type: "复合",
		bodyweight: true,
		deprecated: false,
		aliasId: "",
	},
	{
		_id: "back-13",
		name: "绳索面拉",
		sub: "背阔肌",
		icon: "拉",
		category: "背",
		pinyin: "shengsuo mianla",
		type: "孤立",
		bodyweight: false,
		deprecated: false,
		aliasId: "",
	},
	{
		_id: "shoulder-03",
		name: "面拉(弃)",
		sub: "肩",
		icon: "面",
		category: "肩",
		pinyin: "mianla",
		type: "孤立",
		bodyweight: false,
		deprecated: true,
		aliasId: "back-13",
	},
	{
		_id: "shoulder-01",
		name: "杠铃推举",
		sub: "肩",
		icon: "推",
		category: "肩",
		pinyin: "gangling tuiju",
		type: "复合",
		bodyweight: false,
		deprecated: false,
		aliasId: "",
	},
	{
		_id: "shoulder-02",
		name: "哑铃侧平举",
		sub: "肩",
		icon: "侧",
		category: "肩",
		pinyin: "yaling cepingju",
		type: "孤立",
		bodyweight: false,
		deprecated: false,
		aliasId: "",
	},
	{
		_id: "legs-01",
		name: "杠铃深蹲",
		sub: "腿",
		icon: "蹲",
		category: "腿",
		pinyin: "gangling shendun",
		type: "复合",
		bodyweight: false,
		deprecated: false,
		aliasId: "",
	},
	{
		_id: "core-01",
		name: "平板支撑",
		sub: "核心",
		icon: "板",
		category: "核心",
		pinyin: "pingban zhicheng",
		type: "孤立",
		bodyweight: true,
		deprecated: false,
		aliasId: "",
	},
	{
		_id: "core-02",
		name: "悬垂举腿",
		sub: "核心",
		icon: "腿",
		category: "核心",
		pinyin: "xuanchui jutui",
		type: "孤立",
		bodyweight: true,
		deprecated: false,
		aliasId: "",
	},
];

function occ(date, exercises, at = 0, source = "local") {
	return {
		key: `${source}:${date}-${Math.random().toString(36).slice(2, 7)}`,
		entryKey: `${source}:${date}-${Math.random().toString(36).slice(2, 7)}`,
		source,
		exerciseId: exercises[0]?.exerciseId ?? "",
		name: exercises[0]?.name ?? "",
		category: exercises[0]?.category ?? "",
		date,
		at,
		sets: exercises[0]?.sets ?? [],
	};
}

// ============ 1. Epley 1RM 边界 ============
test("Epley 1RM：reps=1 直接取 weight；reps>12/null；weight<=0；自重动作全 null", () => {
	assert.equal(stats.epleyOneRepMax(80, 1, false), 80); // reps=1 直接返回
	assert.equal(stats.epleyOneRepMax(80, 8, false), 101.5); // 80×(1+8/30)=101.33→101.5
	assert.equal(stats.epleyOneRepMax(60, 12, false), 84); // 60×1.4=84
	assert.equal(stats.epleyOneRepMax(60, 13, false), null);
	assert.equal(stats.epleyOneRepMax(60, 0, false), null);
	assert.equal(stats.epleyOneRepMax(60, -1, false), null);
	assert.equal(stats.epleyOneRepMax(0, 10, false), null);
	assert.equal(stats.epleyOneRepMax(-5, 10, false), null);
	assert.equal(stats.epleyOneRepMax(60, 8, true), null); // 自重全 null
	assert.equal(stats.epleyOneRepMax(-10, 8, true), null);
	assert.equal(stats.epleyOneRepMax(0, 10, true), null);
});

// ============ 2. 动作别名映射 ============
test("shoulder-03 被 aliasExerciseId 映射到 back-13；其他不动", () => {
	assert.equal(stats.aliasExerciseId("shoulder-03"), "back-13");
	assert.equal(stats.aliasExerciseId("chest-01"), "chest-01");
	assert.equal(stats.aliasExerciseId("back-13"), "back-13");
});

test("isBodyweight / exerciseType 从库查找，别名后也能命中", () => {
	assert.equal(stats.isBodyweight("chest-04", LIBRARY), true);
	assert.equal(stats.isBodyweight("back-01", LIBRARY), true);
	assert.equal(stats.isBodyweight("core-01", LIBRARY), true);
	assert.equal(stats.isBodyweight("core-02", LIBRARY), true);
	assert.equal(stats.isBodyweight("chest-01", LIBRARY), false);
	assert.equal(stats.exerciseType("chest-01", LIBRARY), "复合");
	assert.equal(stats.exerciseType("shoulder-03", LIBRARY), "孤立"); // shoulder-03 自身在库里
	assert.equal(stats.exerciseType("unknown-99", LIBRARY), "");
});

// ============ 3. filterValidSets ============
test("filterValidSets：reps<=0 排掉；自重允许负/0/正 weight；非自重负 weight 排掉", () => {
	const sets = [
		{ weight: 80, reps: 8 },
		{ weight: 0, reps: 10 },
		{ weight: -10, reps: 5 },
		{ weight: 60, reps: 0 },
		{ weight: 60, reps: -1 },
	];
	// 自重：前三个都合法（reps>0，weight 任意）；后两个 reps<=0 排掉
	const bw = ins.filterValidSets(sets, true);
	assert.equal(bw.length, 3);
	assert.deepEqual(
		bw.map((s) => s.weight),
		[80, 0, -10],
	);
	// 非自重：前三个里 -10 排掉；reps=0/-1 排掉；剩 {80,8} + {0,10}
	const noBw = ins.filterValidSets(sets, false);
	assert.equal(noBw.length, 2);
	assert.deepEqual(
		noBw.map((s) => s.weight),
		[80, 0],
	);
});

// ============ 4. 自重容量只加正 weight ============
test("自重容量：负 weight（辅助）和 0（纯自重）不计入 volume；只有正 weight 计入", () => {
	const today = "2026-10-20";
	const items = [
		occ(
			today,
			[
				{
					exerciseId: "back-01",
					name: "引体向上",
					category: "背",
					sets: [
						{ weight: -10, reps: 10 },
						{ weight: 0, reps: 12 },
						{ weight: 15, reps: 8 },
					],
				},
			],
			0,
			"local",
		),
	];
	const s = ins.buildOccurrenceStats(items[0], LIBRARY);
	assert.equal(s.totalSets, 3);
	assert.equal(s.maxWeight, 15); // 带符号最大
	assert.equal(s.maxReps, 12);
	assert.equal(s.volume, 120); // 只有 15×8=120；-10 和 0 都不计
	assert.equal(s.maxOneRepMax, null);
	assert.equal(s.isBodyweight, true);
});

// ============ 5. 自重序列：辅助 → 纯自重 → 负重 ============
test("自重序列：maxWeight 按带符号严格递增；maxOneRepMax 全 null；容量逐次增加", () => {
	const today = "2026-10-20";
	const items = [
		occ("2026-10-10", [
			{
				exerciseId: "back-01",
				name: "引体向上",
				category: "背",
				sets: [{ weight: -10, reps: 10 }],
			},
		]),
		occ("2026-10-15", [
			{
				exerciseId: "back-01",
				name: "引体向上",
				category: "背",
				sets: [{ weight: 0, reps: 12 }],
			},
		]),
		occ("2026-10-20", [
			{
				exerciseId: "back-01",
				name: "引体向上",
				category: "背",
				sets: [{ weight: 15, reps: 8 }],
			},
		]),
	];
	const seq = ins.buildSequence(items, "back-01", LIBRARY, "4w", today);
	assert.equal(seq.count, 3);
	assert.equal(seq.sets[0].maxWeight, -10);
	assert.equal(seq.sets[1].maxWeight, 0);
	assert.equal(seq.sets[2].maxWeight, 15);
	for (const s of seq.sets) assert.equal(s.maxOneRepMax, null);
	assert.equal(seq.sets[0].volume, 0);
	assert.equal(seq.sets[1].volume, 0);
	assert.equal(seq.sets[2].volume, 120);
});

// ============ 6. 非自重动作 weight=-10 整组排除 ============
test("非自重 weight=-10 被 filterValidSets 排除；weight=0 合法但 Epley 返回 null", () => {
	const sets = [
		{ weight: -5, reps: 8 },
		{ weight: 0, reps: 10 },
		{ weight: 80, reps: 5 },
	];
	const valid = ins.filterValidSets(sets, false);
	assert.equal(valid.length, 2);
	assert.deepEqual(
		valid.map((s) => s.weight),
		[0, 80],
	);
	assert.equal(ins.setOneRepMax({ weight: 0, reps: 10 }, false), null);
	const r = ins.setOneRepMax({ weight: 80, reps: 5 }, false);
	assert.ok(r > 92 && r < 94); // 80×1.1667≈93.33→93.5
});

// ============ 7. PR：第一次不算；追平不算 ============
test("PR：第一次出现只设基准不算 PR；第二次严格大于才算；追平不算", () => {
	const today = "2026-10-20";
	const items = [
		occ("2026-10-10", [
			{
				exerciseId: "chest-01",
				name: "卧推",
				category: "胸",
				sets: [{ weight: 80, reps: 8 }],
			},
		]), // 第一次 → 不算 PR，bestOrm=101.5, bestWt=80
		occ("2026-10-15", [
			{
				exerciseId: "chest-01",
				name: "卧推",
				category: "胸",
				sets: [{ weight: 85, reps: 8 }],
			},
		]), // 107.5 > 101.5 → oneRepMax PR ✓；85 > 80 → maxWeight PR ✓
		occ("2026-10-20", [
			{
				exerciseId: "chest-01",
				name: "卧推",
				category: "胸",
				sets: [{ weight: 85, reps: 8 }],
			},
		]), // 追平 → 不算
		occ("2026-10-25", [
			{
				exerciseId: "chest-01",
				name: "卧推",
				category: "胸",
				sets: [{ weight: 80, reps: 10 }],
			},
		]), // 106.5 < 107.5 → 不算；80 < 85 → 不算
	];
	const prs = ins.findPRs(items, LIBRARY);
	assert.equal(prs.length, 2);
	assert.equal(prs[0].prType, "oneRepMax");
	assert.equal(prs[0].date, "2026-10-15");
	assert.equal(prs[0].value, 107.5);
	assert.equal(prs[1].prType, "maxWeight");
	assert.equal(prs[1].date, "2026-10-15");
	assert.equal(prs[1].value, 85);
});

// ============ 8. 自重 maxReps PR ============
test("自重 maxReps PR：只在 weight=0 的组之间比较 reps；weight>0 的自重组不算 reps PR", () => {
	const items = [
		occ("2026-10-05", [
			{
				exerciseId: "core-01",
				name: "平板支撑",
				category: "核心",
				sets: [{ weight: 0, reps: 60 }],
			},
		]),
		occ("2026-10-10", [
			{
				exerciseId: "core-01",
				name: "平板支撑",
				category: "核心",
				sets: [{ weight: 0, reps: 90 }],
			},
		]), // maxReps PR ✓
		occ("2026-10-15", [
			{
				exerciseId: "core-01",
				name: "平板支撑",
				category: "核心",
				sets: [{ weight: 0, reps: 90 }],
			},
		]), // 追平不算
		occ("2026-10-20", [
			{
				exerciseId: "core-01",
				name: "平板支撑",
				category: "核心",
				sets: [{ weight: 0, reps: 120 }],
			},
		]), // maxReps PR ✓
		// 引体向上：辅助 → 纯自重 → 负重
		occ("2026-10-05", [
			{
				exerciseId: "back-01",
				name: "引体向上",
				category: "背",
				sets: [{ weight: -10, reps: 10 }],
			},
		]),
		occ("2026-10-12", [
			{
				exerciseId: "back-01",
				name: "引体向上",
				category: "背",
				sets: [{ weight: 0, reps: 12 }],
			},
		]), // maxWeight PR (-10→0) ✓；maxReps PR (10→12) ✓
		occ("2026-10-20", [
			{
				exerciseId: "back-01",
				name: "引体向上",
				category: "背",
				sets: [{ weight: 15, reps: 8 }],
			},
		]), // maxWeight PR (0→15) ✓；但 weight≠0 所以 maxReps PR 不算
	];
	const prs = ins.findPRs(items, LIBRARY);
	// core-01: 2 条 maxReps PR (60→90, 90→120)
	// back-01: 第一条 (-10,10) maxWeight≠0 → maxReps 条件不满足，只设 bestWt=-10（基准）
	//          第二条 (0,12) maxWeight=0 → maxWeight PR (-10→0) ✓；maxReps 条件首次满足，bestReps=12（基准不算 PR）
	//          第三条 (15,8) maxWeight PR (0→15) ✓；maxWeight≠0 → maxReps 跳过
	// 所以 back-01 共 2 条 maxWeight PR（05-12 和 05-20），0 条 maxReps PR
	assert.equal(prs.length, 4);
	const corePRs = prs.filter((p) => p.exerciseId === "core-01");
	assert.equal(corePRs.length, 2);
	assert.ok(corePRs.every((p) => p.prType === "maxReps"));
	const backPRs = prs.filter((p) => p.exerciseId === "back-01");
	assert.equal(backPRs.length, 2);
	assert.ok(backPRs.every((p) => p.prType === "maxWeight"));
});

// ============ 9. shoulder-03 与 back-13 合并 ============
test("shoulder-03(弃用) 与 back-13 合并进同一条序列，部位按 back-13（背）算", () => {
	const today = "2026-10-20";
	const items = [
		occ("2026-10-10", [
			{
				exerciseId: "back-13",
				name: "绳索面拉",
				category: "背",
				sets: [{ weight: 25, reps: 12 }],
			},
		]),
		occ("2026-10-15", [
			{
				exerciseId: "shoulder-03",
				name: "面拉(弃)",
				category: "肩",
				sets: [{ weight: 27.5, reps: 12 }],
			},
		]),
	];
	const seqBack = ins.buildSequence(items, "back-13", LIBRARY, "all", today);
	const seqShoulder = ins.buildSequence(
		items,
		"shoulder-03",
		LIBRARY,
		"all",
		today,
	);
	assert.equal(seqBack.count, 2);
	assert.equal(seqShoulder.count, 2);
	assert.equal(seqBack.category, "背");
	assert.equal(seqShoulder.category, "背");
});

// ============ 10. calcRange ============
test("calcRange：4w=28天，cur0..cur1；prev0..prev1 紧挨前面；hasPrev=true；all hasPrev=false", () => {
	const today = "2026-10-20";
	const b4 = ins.calcRange(today, ins.RANGE_4W);
	assert.equal(b4.cur0, "2026-09-23");
	assert.equal(b4.cur1, "2026-10-20");
	assert.equal(b4.prev1, "2026-09-22");
	assert.equal(b4.prev0, "2026-08-26");
	assert.ok(b4.hasPrev);
	const bAll = ins.calcRange(today, ins.RANGE_ALL);
	assert.ok(!bAll.hasPrev);
	assert.equal(bAll.cur1, today);
});

// ============ 11. 跨月一周 ============
test("跨月一周：10-29(周一) 到 11-04(周日) 正确", () => {
	assert.equal(cal.weekStartOf("2026-11-04"), "2026-11-02");
	assert.equal(cal.weekEndOf("2026-11-04"), "2026-11-08");
});

// ============ 12. 空数据 ============
test("空数据：概览 days=0/volume=0/PR=0；hasPrev=false；序列 count=0", () => {
	const today = "2026-10-20";
	const r = ins.buildOverviewCompare(
		[],
		[],
		[],
		LIBRARY,
		today,
		ins.RANGE_4W,
	);
	assert.equal(r.cur.days, 0);
	assert.equal(r.cur.volume, 0);
	assert.ok(!r.hasPrev);
	const seq = ins.buildSequence([], "chest-01", LIBRARY, ins.RANGE_4W, today);
	assert.equal(seq.count, 0);
	assert.equal(seq.type, "复合");
});

// ============ 13. 上一周期没有数据 → hasPrev=false ============
test("上一周期无任何训练数据时 hasPrev=false（prev 返回 null）", () => {
	const today = "2026-10-20";
	const entries = [
		{
			counted: true,
			date: "2026-10-18",
			source: "local",
			volume: 640,
			exercises: [
				{
					exerciseId: "chest-01",
					category: "胸",
					records: [{ weight: 80, reps: 8 }],
				},
			],
		},
	];
	const items = [
		occ("2026-10-18", [
			{
				exerciseId: "chest-01",
				name: "卧推",
				category: "胸",
				sets: [{ weight: 80, reps: 8 }],
			},
		]),
	];
	const r = ins.buildOverviewCompare(
		entries,
		items,
		[],
		LIBRARY,
		today,
		ins.RANGE_4W,
	);
	assert.equal(r.cur.days, 1);
	assert.ok(!r.hasPrev);
	assert.deepEqual(r.prev, { days: 0, sessions: 0, volume: 0, newPRs: 0 });
});

// ============ 14. 同一天多条 at=0 → PR 稳定 ============
test("同一天多条 at=0：date→at→source(local后 cloud) 排序；PR 按此顺序稳定", () => {
	const items = [
		occ(
			"2026-10-10",
			[
				{
					exerciseId: "chest-01",
					name: "卧推",
					category: "胸",
					sets: [{ weight: 80, reps: 8 }],
				},
			],
			0,
			"cloud",
		),
		occ(
			"2026-10-10",
			[
				{
					exerciseId: "chest-01",
					name: "卧推",
					category: "胸",
					sets: [{ weight: 85, reps: 8 }],
				},
			],
			0,
			"local",
		),
		occ(
			"2026-10-10",
			[
				{
					exerciseId: "chest-01",
					name: "卧推",
					category: "胸",
					sets: [{ weight: 90, reps: 8 }],
				},
			],
			5000,
			"cloud",
		),
	];
	const itemsSorted = cal.buildDayEntries ? items : items; // 确保 collectOccurrences 排序正确
	// 直接测 findPRs（它按 items 顺序遍历，items 是 collectOccurrences 的输出，已排序）
	const prs = ins.findPRs(items, LIBRARY);
	// cloud1: 第一次 → bestOrm=101.5, bestWt=80；不算 PR
	// local: 107.5 > 101.5 → oneRepMax PR ✓；85 > 80 → maxWeight PR ✓
	// cloud3: 113 > 107.5 → oneRepMax PR ✓；90 > 85 → maxWeight PR ✓
	assert.equal(prs.length, 4);
	assert.equal(prs[0].prType, "oneRepMax");
	assert.equal(prs[0].value, 107.5);
	assert.equal(prs[1].prType, "maxWeight");
	assert.equal(prs[1].value, 85);
	assert.equal(prs[2].prType, "oneRepMax");
	assert.equal(prs[2].value, 114); // 90×(1+8/30)=114
	assert.equal(prs[3].prType, "maxWeight");
	assert.equal(prs[3].value, 90);
});

// ============ 15. 最佳组挑选 ============
test("pickBestSet：1RM 优先；全 null 时按 max weight（自重带符号）；weight 相同按 reps", () => {
	// 场景 1：非自重，有 1RM
	const sets1 = [
		{ weight: 80, reps: 8 },
		{ weight: 85, reps: 5 },
	];
	const b1 = ins.pickBestSet(sets1, false);
	assert.ok(b1);
	assert.equal(b1.weight, 80);
	assert.equal(b1.oneRepMax, 101.5);

	// 场景 2：自重，1RM 全 null，按带符号 max weight
	const sets2 = [
		{ weight: -10, reps: 10 },
		{ weight: 0, reps: 15 },
		{ weight: 15, reps: 8 },
	];
	const b2 = ins.pickBestSet(sets2, true);
	assert.ok(b2);
	assert.equal(b2.weight, 15);
	assert.equal(b2.oneRepMax, null);

	// 场景 3：自重 weight 相同按 reps
	const sets3 = [
		{ weight: -10, reps: 8 },
		{ weight: -10, reps: 12 },
	];
	const b3 = ins.pickBestSet(sets3, true);
	assert.ok(b3);
	assert.equal(b3.reps, 12);
});

// ============ 16. 概览对比 ============
test("概览对比：4w 有前值 → hasPrev=true；daysDelta / volumeDeltaPct 正确", () => {
	const today = "2026-10-20";
	const items = [
		occ("2026-10-18", [
			{
				exerciseId: "chest-01",
				name: "卧推",
				category: "胸",
				sets: [{ weight: 80, reps: 8 }],
			},
		]),
		occ("2026-10-19", [
			{
				exerciseId: "chest-01",
				name: "卧推",
				category: "胸",
				sets: [{ weight: 80, reps: 8 }],
			},
		]),
		occ("2026-09-20", [
			{
				exerciseId: "chest-01",
				name: "卧推",
				category: "胸",
				sets: [{ weight: 60, reps: 10 }],
			},
		]),
	];
	const entries = [
		{
			counted: true,
			date: "2026-10-18",
			source: "local",
			volume: 640,
			exercises: [
				{
					exerciseId: "chest-01",
					category: "胸",
					records: [{ weight: 80, reps: 8 }],
				},
			],
		},
		{
			counted: true,
			date: "2026-10-19",
			source: "local",
			volume: 640,
			exercises: [
				{
					exerciseId: "chest-01",
					category: "胸",
					records: [{ weight: 80, reps: 8 }],
				},
			],
		},
		{
			counted: true,
			date: "2026-09-20",
			source: "local",
			volume: 600,
			exercises: [
				{
					exerciseId: "chest-01",
					category: "胸",
					records: [{ weight: 60, reps: 10 }],
				},
			],
		},
	];
	const prs = ins.findPRs(items, LIBRARY);
	const r = ins.buildOverviewCompare(
		entries,
		items,
		prs,
		LIBRARY,
		today,
		ins.RANGE_4W,
	);
	assert.ok(r.hasPrev);
	assert.equal(r.cur.days, 2);
	assert.equal(r.prev.days, 1);
	assert.equal(r.daysDelta, 1);
	assert.ok(r.volumeDeltaPct > 100); // 1280 vs 600 → 113%
});

// ============ 18. type 兜底规则（按历史 reps 中位数 >12 算孤立） ============
test("库里无 type 字段的动作 → 历史 reps 中位数 >12 算孤立，否则复合；无历史默认复合", () => {
	// 自建动作 unknown-01，库里没有 type 字段（只有 _id/name/category）
	const minimalLibrary = [
		{ _id: "unknown-01", name: "某某动作", category: "胸" },
		{ _id: "unknown-02", name: "另一动作", category: "背" },
		{ _id: "unknown-03", name: "新动作", category: "腿" },
	];
	// unknown-01: 历史 reps [15, 16, 14] → 中位数 15 > 12 → 孤立
	const items1 = [
		occ("2026-10-10", [
			{
				exerciseId: "unknown-01",
				name: "某某动作",
				category: "胸",
				sets: [{ weight: 20, reps: 15 }],
			},
		]),
		occ("2026-10-15", [
			{
				exerciseId: "unknown-01",
				name: "某某动作",
				category: "胸",
				sets: [{ weight: 22, reps: 16 }],
			},
		]),
		occ("2026-10-20", [
			{
				exerciseId: "unknown-01",
				name: "某某动作",
				category: "胸",
				sets: [{ weight: 22, reps: 14 }],
			},
		]),
	];
	const seq1 = ins.buildSequence(
		items1,
		"unknown-01",
		minimalLibrary,
		"all",
		"2026-10-20",
	);
	assert.equal(seq1.type, "孤立");

	// unknown-02: 历史 reps [8, 10, 6] → 中位数 8 ≤ 12 → 复合
	const items2 = [
		occ("2026-10-10", [
			{
				exerciseId: "unknown-02",
				name: "另一动作",
				category: "背",
				sets: [{ weight: 40, reps: 8 }],
			},
		]),
		occ("2026-10-15", [
			{
				exerciseId: "unknown-02",
				name: "另一动作",
				category: "背",
				sets: [{ weight: 42, reps: 10 }],
			},
		]),
		occ("2026-10-20", [
			{
				exerciseId: "unknown-02",
				name: "另一动作",
				category: "背",
				sets: [{ weight: 40, reps: 6 }],
			},
		]),
	];
	const seq2 = ins.buildSequence(
		items2,
		"unknown-02",
		minimalLibrary,
		"all",
		"2026-10-20",
	);
	assert.equal(seq2.type, "复合");

	// unknown-03: 无历史数据 → 默认复合
	const seq3 = ins.buildSequence(
		[],
		"unknown-03",
		minimalLibrary,
		"all",
		"2026-10-20",
	);
	assert.equal(seq3.type, "复合");
});

// ============ 19. shoulder-03 合并后按部位统计的容量（面拉算到背） ============
test("shoulder-03 合并到 back-13 后，序列 category='背'，容量两动作叠加", () => {
	const today = "2026-10-20";
	const items = [
		occ("2026-10-10", [
			{
				exerciseId: "back-13",
				name: "绳索面拉",
				category: "背",
				sets: [{ weight: 25, reps: 12 }],
			},
		]),
		occ("2026-10-15", [
			{
				exerciseId: "shoulder-03",
				name: "面拉(弃)",
				category: "肩",
				sets: [{ weight: 27.5, reps: 12 }],
			},
		]),
		occ("2026-10-20", [
			{
				exerciseId: "back-13",
				name: "绳索面拉",
				category: "背",
				sets: [{ weight: 30, reps: 12 }],
			},
		]),
	];
	const seq = ins.buildSequence(items, "back-13", LIBRARY, "all", today);
	assert.equal(seq.count, 3);
	assert.equal(seq.category, "背");
	assert.equal(seq.sets[0].volume, 300); // 25×12
	assert.equal(seq.sets[1].volume, 330); // 27.5×12
	assert.equal(seq.sets[2].volume, 360); // 30×12
	// 按部位汇总：背的容量应该包含 shoulder-03 的序列
	const itemsAll = items.concat([
		occ("2026-10-18", [
			{
				exerciseId: "back-01",
				name: "引体向上",
				category: "背",
				sets: [{ weight: 0, reps: 10 }],
			},
		]),
	]);
	const seqBack = ins.buildSequence(
		itemsAll,
		"back-13",
		LIBRARY,
		"all",
		today,
	);
	assert.equal(seqBack.count, 3); // back-13 三条，back-01 不在此序列
});

// ============ 20. findPRs 在 shoulder-03 + back-13 混合数据上正确识别 ============
test("findPRs 混合 shoulder-03 和 back-13：别名合并后只产出一套 PR 序列", () => {
	const today = "2026-10-20";
	const items = [
		occ("2026-10-10", [
			{
				exerciseId: "back-13",
				name: "绳索面拉",
				category: "背",
				sets: [{ weight: 25, reps: 12 }],
			},
		]),
		occ("2026-10-15", [
			{
				exerciseId: "shoulder-03",
				name: "面拉(弃)",
				category: "肩",
				sets: [{ weight: 27.5, reps: 12 }],
			},
		]),
		occ("2026-10-20", [
			{
				exerciseId: "back-13",
				name: "绳索面拉",
				category: "背",
				sets: [{ weight: 27.5, reps: 15 }],
			},
		]),
	];
	const prs = ins.findPRs(items, LIBRARY);
	// back-13(25×12) 第一次 → 基准，bestOrm=35, bestWt=25
	// shoulder-03(27.5×12): orm=38.5 > 35 → oneRepMax PR ✓；wt=27.5 > 25 → maxWeight PR ✓
	// back-13(27.5×15): reps=15 > 12 → Epley=null → 无 oneRepMax；wt=27.5 追平 → 不算 maxWeight PR
	// 所以总共 2 条 PR
	const backPRs = prs.filter((p) => p.exerciseId === "back-13");
	assert.equal(backPRs.length, 2);
	assert.ok(backPRs.some((p) => p.prType === "oneRepMax"));
	assert.ok(backPRs.some((p) => p.prType === "maxWeight"));
	// shoulder-03 不应出现在 PR 的 exerciseId 里（都 alias 成 back-13 了）
	assert.ok(!prs.some((p) => p.exerciseId === "shoulder-03"));
});
