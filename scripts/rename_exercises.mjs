// 动作改名存量迁移：
//   「正握下拉（宽握）」→「高位下拉（对握）」(back-05)
//   「反握下拉」→「高位下拉（反握）」(back-06)
//
// 默认只读报告；加 --apply 才真正写入。
// 写入范围：
//   1) workouts（legacy）：exercises[].name（应用端从不写 workouts，安全）
//   2) gym_private（kind=session）：value.exercises[].name（含 value.editing.exercise），
//      同步重算 digest 并 revision+1，使云端成为“服务端新版本”，
//      本机旧副本若再提交会走正常 CONFLICT 流程而不是静默覆盖改名。
// 前置：已 tcb login，环境 cloud1-d0gjxp9f1819c8c1e。

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ENV = "cloud1-d0gjxp9f1819c8c1e";
const APPLY = process.argv.includes("--apply");

const RENAMES = [
	{ from: "正握下拉（宽握）", to: "高位下拉（对握）", id: "back-05" },
	{ from: "反握下拉", to: "高位下拉（反握）", id: "back-06" },
];
const OLD_NAMES = RENAMES.map((r) => r.from);
const renameOf = (name) => RENAMES.find((r) => r.from === name) ?? null;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

const nodeDir = path.dirname(process.execPath);
const tcbBin = path.join(nodeDir, "node_modules", "@cloudbase", "cli", "bin", "tcb");
if (!fs.existsSync(tcbBin)) {
	console.error("找不到 tcb bin:", tcbBin);
	process.exit(1);
}

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

function runCmd(mgoCmd) {
	const cmdStr = JSON.stringify([{
		TableName: mgoCmd.table,
		CommandType: mgoCmd.type ?? "QUERY",
		Command: JSON.stringify(mgoCmd.body),
	}]);
	const args = [tcbBin, "db", "nosql", "execute", "-e", ENV, "--json", "--command", cmdStr];
	const r = spawnSync(process.execPath, args, { encoding: "utf-8" });
	let parsed = null;
	try { parsed = JSON.parse(r.stdout || "{}"); } catch (e) {
		return { ok: false, error: "JSON 解析失败: " + e.message, stdout: r.stdout, stderr: r.stderr };
	}
	const requestId = parsed?.data?.requestId ?? null;
	const inner = parsed?.data?.results;
	if (r.status !== 0 || !Array.isArray(inner)) {
		return { ok: false, requestId, error: "tcb 执行失败", stdout: r.stdout, stderr: r.stderr };
	}
	return { ok: true, result: normalize(inner)[0], requestId };
}

function find(collection, filter = {}, limit = 500, projection = undefined) {
	const body = { find: collection, limit };
	if (Object.keys(filter).length > 0) body.filter = filter;
	if (projection != null) body.projection = projection;
	const r = runCmd({ table: collection, body });
	if (!r.ok) { console.error("查询失败:", r.error, r.stdout?.slice(0, 300)); process.exit(1); }
	return r.result ?? [];
}

function update(collection, updates) {
	const r = runCmd({ table: collection, type: "UPDATE", body: { update: collection, updates } });
	if (!r.ok) { console.error("写入失败:", r.error, r.stdout?.slice(0, 500), r.stderr?.slice(0, 300)); process.exit(1); }
	const doc = Array.isArray(r.result) ? r.result[0] : r.result;
	if (!doc || doc.ok !== 1 || (doc.writeErrors ?? []).length > 0) {
		console.error("写入校验失败:", JSON.stringify(doc));
		process.exit(1);
	}
	return doc;
}

// ============ 1. exercises 现状 ============
console.log("=== exercises 现状 ===");
const libRows = find("exercises", { _id: { $in: ["back-05", "back-06", "chest-13", "chest-14", "core-03", "core-04"] } }, 20, { _id: 1, name: 1, category: 1, pinyin: 1 });
for (const e of libRows) console.log(`  ${e._id}  ${e.name}  [${e.category}]  pinyin=${e.pinyin}`);
const libIds = new Set(libRows.map((e) => e._id));
for (const id of ["chest-13", "chest-14", "core-03", "core-04"]) {
	if (!libIds.has(id)) console.log(`  ${id}  （云端尚不存在，等待 seed 插入）`);
}

// ============ 2. workouts 受影响 ============
console.log("\n=== workouts（legacy）含旧名称 ===");
const workouts = find("workouts", { "exercises.name": { $in: OLD_NAMES } }, 500);
let workoutHits = 0;
for (const w of workouts) {
	const hits = (w.exercises ?? []).filter((x) => renameOf(x.name));
	workoutHits += hits.length;
	console.log(`  ${w._id}  date=${w.date}  命中 ${hits.length} 项: ` +
		hits.map((x) => `${x.name}→${renameOf(x.name).to} (exerciseId=${x.exerciseId ?? "无"})`).join("；"));
}
if (workouts.length === 0) console.log("  无");

// ============ 3. gym_private session 受影响 ============
console.log("\n=== gym_private（kind=session）含旧名称 ===");
const sessions = find("gym_private", { kind: "session", "value.exercises.name": { $in: OLD_NAMES } }, 500);
let sessionHits = 0;
for (const s of sessions) {
	const hits = (s.value?.exercises ?? []).filter((x) => renameOf(x.name));
	sessionHits += hits.length;
	console.log(`  id=${s.id}  date=${s.value?.date}  revision=${s.revision}  deleted=${s.deleted}  命中 ${hits.length} 项: ` +
		hits.map((x) => `${x.name}→${renameOf(x.name).to}`).join("；"));
}
if (sessions.length === 0) console.log("  无");

console.log(`\n汇总：workouts ${workouts.length} 条文档 / ${workoutHits} 个动作项；gym_private ${sessions.length} 条 / ${sessionHits} 个动作项`);

if (!APPLY) {
	console.log("\n[只读模式] 未写入。确认后执行：node scripts/rename_exercises.mjs --apply");
	process.exit(0);
}

// ============ 4. 写入 workouts ============
console.log("\n=== 写入 workouts ===");
if (workouts.length > 0) {
	const updates = workouts.map((w) => {
		const exercises = (w.exercises ?? []).map((x) => {
			const r = renameOf(x.name);
			if (!r) return x;
			const nx = { ...x, name: r.to };
			// 旧记录缺 exerciseId 时按名称补上，使其能归入动作趋势统计
			if ((nx.exerciseId ?? "") === "" || nx.exerciseId == null) nx.exerciseId = r.id;
			return nx;
		});
		return { q: { _id: w._id }, u: { $set: { exercises } }, multi: false };
	});
	const doc = update("workouts", updates);
	console.log(`  ✅ n=${doc.n} nModified=${doc.nModified}`);
} else {
	console.log("  无需写入");
}

// ============ 5. 写入 gym_private ============
console.log("\n=== 写入 gym_private ===");
if (sessions.length > 0) {
	const updates = sessions.map((s) => {
		const value = s.value;
		value.exercises = (value.exercises ?? []).map((x) => {
			const r = renameOf(x.name);
			return r ? { ...x, name: r.to } : x;
		});
		if (value.editing?.exercise && renameOf(value.editing.exercise.name)) {
			value.editing.exercise = { ...value.editing.exercise, name: renameOf(value.editing.exercise.name).to };
		}
		const digest = sha256(JSON.stringify({ deleted: false, value }));
		return {
			q: { _id: s._id },
			u: { $set: { value, digest, revision: s.revision + 1, savedAt: Date.now() } },
			multi: false,
		};
	});
	const doc = update("gym_private", updates);
	console.log(`  ✅ n=${doc.n} nModified=${doc.nModified}`);
} else {
	console.log("  无需写入");
}

console.log("\n迁移完成。");
