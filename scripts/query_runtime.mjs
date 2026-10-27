// 运行时只读查询脚本 —— 统计层写入云端前的健康检查
// 前置：已 tcb login 并选定环境 cloud1-d0gjxp9f1819c8c1e
// 首次：tcb login → tcb env use cloud1-d0gjxp9f1819c8c1e
// 运行：node scripts/query_runtime.mjs
// 全部只读，零写入。
// 限制：无法读取本地 storage 里的 session（只有 gym_private 已同步的）。

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ENV = "cloud1-d0gjxp9f1819c8c1e";

// 找 tcb bin JS（node_modules/@cloudbase/cli/bin/tcb）
// tcb.cmd 最终调：node node_modules/@cloudbase/cli/bin/tcb
const nodeDir = path.dirname(process.execPath);
const tcbBin = path.join(nodeDir, "node_modules", "@cloudbase", "cli", "bin", "tcb");
if (!fs.existsSync(tcbBin)) {
	console.error("找不到 tcb bin:", tcbBin);
	console.error("请确认已全局安装 @cloudbase/cli");
	process.exit(1);
}

// ============ tcb 执行层 ============

// 把 Extended JSON 数字转换回 JS number
function normalize(obj) {
	if (obj == null) return obj;
	if (Array.isArray(obj)) return obj.map(normalize);
	if (typeof obj !== "object") return obj;
	const keys = Object.keys(obj);
	if (keys.length === 1) {
		const k = keys[0];
		if (k === "$numberInt") return parseInt(obj[k], 10);
		if (k === "$numberLong") return parseInt(obj[k], 10);
		if (k === "$numberDouble") return parseFloat(obj[k]);
	}
	const out = {};
	for (const k of keys) out[k] = normalize(obj[k]);
	return out;
}

// 单次 MgoCommand：{ TableName, CommandType, Command: JSON.stringify({...}) }
function runCmd(mgoCmd) {
	const cmdStr = JSON.stringify([{
		TableName: mgoCmd.table,
		CommandType: mgoCmd.type ?? "QUERY",
		Command: JSON.stringify(mgoCmd.body),
	}]);
	const args = [tcbBin, "db", "nosql", "execute", "-e", ENV, "--command", cmdStr];
	const r = spawnSync(process.execPath, args, { encoding: "utf-8" });
	const rawStatus = r.status;
	if (rawStatus !== 0) {
		return { ok: false, status: rawStatus, error: r.stderr?.trim() || r.stdout?.trim() || "(empty)", stdout: r.stdout, stderr: r.stderr };
	}
	// 跳开头 3 行 banner: "CloudBase CLI 3.8.9\n试试 tcb ai 命令...\n- 数据加载中...\n"
	const lines = (r.stdout || "").split("\n");
	const jsonStart = lines.findIndex((l) => l.trim().startsWith("["));
	if (jsonStart < 0) {
		return { ok: false, status: 0, error: "无法在输出中找到 JSON 数组", stdout: r.stdout, stderr: r.stderr };
	}
	try {
		const parsed = JSON.parse(lines.slice(jsonStart).join("\n"));
		return { ok: true, data: normalize(parsed), stdout: r.stdout, stderr: r.stderr };
	} catch (e) {
		return { ok: false, status: 0, error: "JSON 解析失败: " + e.message, stdout: r.stdout, stderr: r.stderr };
	}
}

function aggregateCount(collection, filter = {}) {
	const r = runCmd({ table: collection, body: { aggregate: collection, pipeline: [{ $match: filter }, { $count: "n" }], cursor: {} } });
	if (!r.ok) return { n: 0, _err: r.error };
	return { n: r.data[0]?.n ?? 0 };
}

function aggregateGroup(collection, pipeline) {
	const r = runCmd({ table: collection, body: { aggregate: collection, pipeline, cursor: {} } });
	if (!r.ok) return { rows: [], _err: r.error };
	return { rows: r.data };
}

function find(collection, filter = {}, limit = 500, projection = undefined) {
	const body = { find: collection, limit };
	if (Object.keys(filter).length > 0) body.filter = filter;
	if (projection != null) body.projection = projection;
	const r = runCmd({ table: collection, body });
	if (!r.ok) return { rows: [], _err: r.error };
	return { rows: r.data };
}

// ============ 执行 ============

const failures = [];
const t = (name, fn) => {
	console.log(`\n${"=".repeat(60)}\n=== ${name} ===`);
	try { fn(); } catch (e) {
		console.error("🔥 节内异常:", e.message);
		failures.push(name + ": " + e.message);
	}
};

console.log("=== 运行时只读查询 ===");
console.log("环境:", ENV);
console.log("tcb bin:", tcbBin);

// seed 精简 id 列表（用于对比）
const SEED_IDS = new Set([
	"chest-01","chest-02","chest-03","chest-04","chest-05","chest-06","chest-07","chest-08","chest-09","chest-10","chest-11","chest-12",
	"back-01","back-02","back-03","back-04","back-05","back-06","back-07","back-08","back-09","back-10","back-11","back-12","back-13",
	"legs-01","legs-02","legs-03","legs-04","legs-05","legs-06","legs-07","legs-08","legs-09","legs-10","legs-11",
	"shoulder-01","shoulder-02","shoulder-03","shoulder-04","shoulder-05","shoulder-06","shoulder-07","shoulder-08","shoulder-09","shoulder-10",
	"arm-01","arm-02","arm-03","arm-04",
	"core-01","core-02",
]);

// seed 的 name/category 对照表（仅用于对比）
const SEED_NAMES = {
	"chest-01": ["杠铃卧推", "胸"], "chest-02": ["上斜哑铃卧推", "胸"], "chest-03": ["绳索夹胸", "胸"],
	"chest-04": ["双杠臂屈伸", "胸"], "chest-05": ["上斜卧推", "胸"], "chest-06": ["史密斯卧推", "胸"],
	"chest-07": ["史密斯上斜卧推", "胸"], "chest-08": ["哑铃卧推", "胸"], "chest-09": ["器械平板卧推", "胸"],
	"chest-10": ["器械上斜卧推", "胸"], "chest-11": ["坐姿推胸机", "胸"], "chest-12": ["蝴蝶机夹胸", "胸"],
	"back-01": ["引体向上", "背"], "back-02": ["杠铃划船", "背"], "back-03": ["高位下拉", "背"],
	"back-04": ["坐姿划船", "背"], "back-05": ["正握下拉（宽握）", "背"], "back-06": ["反握下拉", "背"],
	"back-07": ["坐姿器械划船（中握）", "背"], "back-08": ["坐姿划船（宽握）", "背"], "back-09": ["坐姿划船（中握）", "背"],
	"back-10": ["坐姿划船（窄握）", "背"], "back-11": ["杠铃划船(正握)", "背"], "back-12": ["杠铃划船(反握)", "背"],
	"back-13": ["绳索面拉", "背"],
	"legs-01": ["杠铃深蹲", "腿"], "legs-02": ["罗马尼亚硬拉", "腿"], "legs-03": ["腿举", "腿"],
	"legs-04": ["腿弯举", "腿"], "legs-05": ["史密斯深蹲", "腿"], "legs-06": ["坐姿腿屈伸", "腿"],
	"legs-07": ["坐姿腿推机", "腿"], "legs-08": ["哈克深蹲", "腿"], "legs-09": ["哈克深蹲（反向）", "腿"],
	"legs-10": ["髋内收训练机(外展)", "腿"], "legs-11": ["髋内收训练机(内收)", "腿"],
	"shoulder-01": ["杠铃推举", "肩"], "shoulder-02": ["哑铃侧平举", "肩"], "shoulder-03": ["面拉", "肩"],
	"shoulder-04": ["史密斯推举", "肩"], "shoulder-05": ["器械肩上推举（对握）", "肩"], "shoulder-06": ["器械肩上推举（正握）", "肩"],
	"shoulder-07": ["哑铃推举", "肩"], "shoulder-08": ["哑铃侧平举（反握）", "肩"], "shoulder-09": ["绳索侧平举", "肩"],
	"shoulder-10": ["蝴蝶机（反向）", "肩"],
	"arm-01": ["杠铃弯举", "手臂"], "arm-02": ["锤式弯举", "手臂"], "arm-03": ["绳索下压", "手臂"], "arm-04": ["坐姿绳索弯举", "手臂"],
	"core-01": ["平板支撑", "核心"], "core-02": ["悬垂举腿", "核心"],
};

// ===== 0. exercises vs seed 对比 =====
t("0. exercises 集合 vs seed 数据对比", () => {
	const r = find("exercises", {}, 500, { _id: 1, name: 1, category: 1, type: 1, bodyweight: 1, deprecated: 1, aliasId: 1, _openid: 1 });
	if (r._err) { console.error("查询失败:", r._err); failures.push("exercises 对比: " + r._err); return; }
	const cloudIds = new Set();
	const missing = [];
	const extra = [];
	const nameMismatch = [];
	const withNewFields = [];

	for (const e of r.rows) {
		cloudIds.add(e._id);
		const hasNew = e.type != null && e.type !== "" && e.bodyweight != null;
		if (hasNew) withNewFields.push(e);
		if (!SEED_IDS.has(e._id)) extra.push(e);
		const seedEntry = SEED_NAMES[e._id];
		if (seedEntry) {
			const [seedName, seedCat] = seedEntry;
			if (e.name !== seedName) nameMismatch.push({ id: e._id, cloud: e.name, seed: seedName, field: "name" });
			if (e.category !== seedCat) nameMismatch.push({ id: e._id, cloud: e.category, seed: seedCat, field: "category" });
		}
	}
	for (const id of SEED_IDS) if (!cloudIds.has(id)) missing.push(id);

	console.log(`云端 exercises 总条数: ${r.rows.length}`);
	console.log(`seed 预期条数: ${SEED_IDS.size}`);
	console.log(`已带 type+bodyweight 新字段的: ${withNewFields.length}`);
	if (missing.length > 0) console.log(`⚠ 云端缺失的 seed id (${missing.length}): ${missing.join(", ")}`);
	else console.log("✓ 云端包含全部 52 条 seed 动作");
	if (extra.length > 0) {
		console.log(`⚠ 云端多出的动作 (${extra.length}):`);
		for (const e of extra) console.log(`  ${e._id}  ${e.name}  category=${e.category ?? "?"}  ${e._openid ? "(自建)" : ""}`);
	} else console.log("✓ 无多余动作");
	if (nameMismatch.length > 0) {
		console.log(`⚠ name/category 和 seed 不一致的记录 (${nameMismatch.length}):`);
		for (const m of nameMismatch) console.log(`  ${m.id}  ${m.field}: cloud="${m.cloud}"  seed="${m.seed}"`);
	} else console.log("✓ 所有 seed 记录的 name/category 和云端一致");
});

// ===== 1. Legacy Workout =====
t("1. Legacy Workout (workouts collection)", () => {
	const c = aggregateCount("workouts");
	if (c._err) { console.error("查询失败:", c._err); failures.push("workouts: " + c._err); return; }
	console.log("总条数:", c.n);
	if (c.n === 0) { console.log("(空)"); return; }

	// 日期范围
	const firstR = runCmd({ table: "workouts", body: { aggregate: "workouts", pipeline: [{ $sort: { date: 1 } }, { $limit: 1 }, { $project: { date: 1 } }], cursor: {} } });
	const lastR = runCmd({ table: "workouts", body: { aggregate: "workouts", pipeline: [{ $sort: { date: -1 } }, { $limit: 1 }, { $project: { date: 1 } }], cursor: {} } });
	const firstDate = firstR.ok ? firstR.data[0]?.date ?? "?" : "?";
	const lastDate = lastR.ok ? lastR.data[0]?.date ?? "?" : "?";
	console.log("日期范围:", firstDate, "~", lastDate);

	// 汇总
	const grp = aggregateGroup("workouts", [
		{ $group: { _id: null, totalSets: { $sum: "$totalSets" }, totalVol: { $sum: "$totalVolume" }, count: { $sum: 1 } } },
	]);
	if (grp.rows.length > 0) {
		const g = grp.rows[0];
		console.log(`汇总: 总组数=${g.totalSets ?? "?"}, 总容量=${g.totalVol ?? "?"}`);
	}

	// 前 10 条详情
	const rows = find("workouts", {}, 10, { date: 1, totalSets: 1, totalVolume: 1, exercises: 1 });
	if (rows._err) { console.error("详情查询失败:", rows._err); return; }
	console.log(`\n前 ${rows.rows.length} 条详情（共 ${c.n} 条）:`);
	for (const w of rows.rows) {
		const nEx = (w.exercises || []).length;
		console.log(`  ${w.date}  sets=${w.totalSets ?? "?"}  vol=${w.totalVolume ?? "?"}  exercises=${nEx}`);
	}
});

// ===== 2. gym_private session =====
t("2. gym_private (已同步 session，按 _openid 分组)", () => {
	console.log("⚠ 注意: 此查询仅覆盖已同步到云端的 session (gym_private.kind=session)");
	console.log("       本机 storage 里的 session 无法从这里读取。\n");

	const openids = aggregateGroup("gym_private", [
		{ $match: { kind: "session", deleted: false } },
		{ $group: { _id: "$_openid", count: { $sum: 1 } } },
		{ $sort: { count: -1 } },
	]);
	if (openids._err) { console.error("查询失败:", openids._err); failures.push("gym_private: " + openids._err); return; }
	console.log("按 _openid 分组:");
	for (const g of openids.rows) console.log(`  openid=${g._id?.slice(0, 16) ?? "null"}...  条数=${g.count}`);

	const sess = find("gym_private", { kind: "session", deleted: false }, 500, { _openid: 1, value: 1 });
	if (sess._err) { console.error("详情查询失败:", sess._err); return; }
	const byOid = {};
	for (const row of sess.rows) {
		const oid = row._openid ?? "unknown";
		if (!byOid[oid]) byOid[oid] = { finished: [], active: [] };
		const v = row.value || {};
		if (v.status === "finished") {
			let sets = 0, vol = 0;
			for (const ex of v.exercises || []) for (const s of ex.sets || []) if (s.done) { sets++; vol += (Number(s.weight) || 0) * (Number(s.reps) || 0); }
			byOid[oid].finished.push({ date: v.date, sets, vol });
		} else if (v.status === "active") {
			byOid[oid].active.push({ date: v.date });
		}
	}
	for (const [oid, grp] of Object.entries(byOid)) {
		console.log(`\n  openid=${oid?.slice(0, 16)}...`);
		grp.finished.sort((a, b) => a.date.localeCompare(b.date));
		if (grp.finished.length > 0) {
			console.log(`    已完成 session (${grp.finished.length}):`);
			const show = grp.finished.slice(-10); // 最新 10
			if (grp.finished.length > 10) console.log(`      (省略 ${grp.finished.length - 10} 条旧记录)`);
			for (const s of show) console.log(`      ${s.date}  sets=${s.sets}  vol=${s.vol}`);
		}
		if (grp.active.length > 0) console.log(`    进行中 session: ${grp.active.length}`);
	}

	// 重叠检查
	const wk = aggregateGroup("workouts", [{ $project: { date: 1 } }, { $group: { _id: "$date" } }]);
	const wkDates = new Set(wk.rows.map((r) => r._id));
	const sessDates = new Set();
	for (const [, grp] of Object.entries(byOid)) for (const s of grp.finished) sessDates.add(s.date);
	const overlap = [...wkDates].filter((d) => sessDates.has(d)).sort();
	if (overlap.length > 0) {
		console.log(`\n⚠ 发现 ${overlap.length} 个日期同时有 legacy workout 和 gym_private session:`);
		for (const d of overlap) console.log(`  ${d}  — buildDayEntries 保留两条 DayEntry（两场独立训练）`);
	} else {
		console.log("\n✓ 无同日重叠");
	}
});

// ===== 3. 自建动作 =====
t("3. 云端自建动作（exercises 带 _openid）", () => {
	const rows = find("exercises", { _openid: { $exists: true } }, 200, { _id: 1, name: 1, category: 1, type: 1, bodyweight: 1 });
	if (rows._err) { console.error("查询失败:", rows._err); failures.push("自建动作: " + rows._err); return; }
	if (rows.rows.length > 0) {
		console.log(`共 ${rows.rows.length} 条:`);
		for (const e of rows.rows) console.log(`  ${e._id}  ${e.name}  category=${e.category ?? "?"}  type=${e.type ?? "(无)"}  bw=${e.bodyweight ?? "(无)"}`);
	} else console.log("0 条自建动作");
});

// ===== 4. shoulder-03 引用数 =====
t("4. shoulder-03 历史引用", () => {
	const wk = aggregateCount("workouts", { "exercises.exerciseId": "shoulder-03" });
	console.log("workouts 引用 shoulder-03 的条数:", wk.n || 0);
	if (wk.n > 0) {
		const rows = find("workouts", { "exercises.exerciseId": "shoulder-03" }, 50, { date: 1, exercises: 1 });
		for (const w of rows.rows) {
			const sh = (w.exercises || []).filter((e) => e.exerciseId === "shoulder-03");
			const sets = sh.reduce((a, e) => a + (e.sets || []).filter((s) => s.done).length, 0);
			console.log(`  ${w.date}  shoulder-03 done 组数=${sets}`);
		}
	}

	const sess = aggregateCount("gym_private", { kind: "session", deleted: false, "value.exercises.exercise.id": "shoulder-03" });
	console.log("gym_private session 引用 shoulder-03 的条数:", sess.n || 0);
});

// ===== 5. 引体 / 双杠 历史 weight =====
function inspectBw(exId, exName) {
	console.log(`\n  [${exId}] ${exName}`);
	const wk = find("workouts", { "exercises.exerciseId": exId }, 500, { date: 1, exercises: 1 });
	let wkGroups = 0;
	const wkNonZero = [];
	for (const w of wk.rows) {
		for (const ex of w.exercises || []) {
			if (ex.exerciseId !== exId) continue;
			for (const s of ex.sets || []) {
				if (!s.done) continue;
				wkGroups++;
				if (s.weight != null && s.weight !== 0 && s.weight !== "0" && s.weight !== "") {
					wkNonZero.push({ date: w.date, weight: s.weight, reps: s.reps });
				}
			}
		}
	}
	console.log(`    legacy workouts 总 done 组数: ${wkGroups}`);
	if (wkNonZero.length > 0) {
		console.log(`    ⚠ 发现非零 weight 值 (${wkNonZero.length} 组):`);
		for (const nz of wkNonZero) console.log(`      ${nz.date}  weight=${nz.weight}  reps=${nz.reps}`);
	} else console.log("    ✓ 全部 weight = 0 或空");

	const sess = find("gym_private", { kind: "session", deleted: false, "value.exercises.exercise.id": exId }, 500, { value: 1 });
	let sessGroups = 0;
	const sessNonZero = [];
	for (const row of sess.rows) {
		const v = row.value || {};
		for (const ex of v.exercises || []) {
			if (ex.exercise?.id !== exId) continue;
			for (const s of ex.sets || []) {
				if (!s.done) continue;
				sessGroups++;
				const wVal = Number(s.weight);
				if (s.weight != null && s.weight !== "" && !Number.isNaN(wVal) && wVal !== 0) {
					sessNonZero.push({ date: v.date, weight: s.weight, reps: s.reps });
				}
			}
		}
	}
	console.log(`    gym_private session 总 done 组数: ${sessGroups}`);
	if (sessNonZero.length > 0) {
		console.log(`    ⚠ 发现非零 weight 值 (${sessNonZero.length} 组):`);
		for (const nz of sessNonZero) console.log(`      ${nz.date}  weight=${nz.weight}  reps=${nz.reps}`);
	} else console.log("    ✓ 全部 weight = 0 或空");
}

t("5. 引体向上(back-01) / 双杠臂屈伸(chest-04) 历史 weight", () => {
	inspectBw("back-01", "引体向上");
	inspectBw("chest-04", "双杠臂屈伸");
});

// ===== 汇总 =====
console.log("\n" + "=".repeat(60));
console.log("=== 查询完成（全部只读，零写入）===");
if (failures.length > 0) {
	console.log(`\n⚠ 有 ${failures.length} 节失败：`);
	for (const f of failures) console.log(`  - ${f}`);
} else {
	console.log("\n✓ 所有节成功完成");
}
