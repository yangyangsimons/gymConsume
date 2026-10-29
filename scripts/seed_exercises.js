// 初始化/补齐动作库：node scripts/seed_exercises.js（需已 tcb login 并选定环境 cloud1-d0gjxp9f1819c8c1e）
// 幂等：新动作按 _id upsert（$setOnInsert），已存在的按 $set 覆盖 SET_FIELDS（含改名）；不清空动作库，不删除用户自定义动作，可重复执行。
// --dry-run：只打印将写入的差异，不实际执行。
const { spawnSync } = require("child_process");

// [_id, name, sub, icon, category, pinyin, sort, type, bodyweight, deprecated, aliasId]
// 前 7 项是既有字段，后 4 项是本轮新增（全部可选）
const exercises = [
	// ---- 胸（14）----
	[
		"chest-01",
		"杠铃卧推",
		"胸大肌 · 三头肌",
		"卧",
		"胸",
		"gangling woutui",
		0,
		"复合",
		false,
		false,
		"",
	],
	[
		"chest-02",
		"上斜哑铃卧推",
		"上胸 · 三角肌前束",
		"斜",
		"胸",
		"shangxie yaling woutui",
		1,
		"复合",
		false,
		false,
		"",
	],
	[
		"chest-03",
		"绳索夹胸",
		"胸大肌",
		"夹",
		"胸",
		"shengsuo jiaxiong",
		2,
		"孤立",
		false,
		false,
		"",
	],
	[
		"chest-04",
		"双杠臂屈伸",
		"下胸 · 三头肌",
		"屈",
		"胸",
		"shuanggang biqushen",
		3,
		"复合",
		true,
		false,
		"",
	],
	[
		"chest-05",
		"上斜卧推",
		"胸大肌",
		"推",
		"胸",
		"shangxie woutui",
		20,
		"复合",
		false,
		false,
		"",
	],
	[
		"chest-06",
		"史密斯卧推",
		"胸大肌",
		"推",
		"胸",
		"shimisi wotui",
		21,
		"复合",
		false,
		false,
		"",
	],
	[
		"chest-07",
		"史密斯上斜卧推",
		"胸大肌 · 三头肌",
		"推",
		"胸",
		"shimisi shangxie wotui",
		22,
		"复合",
		false,
		false,
		"",
	],
	[
		"chest-08",
		"哑铃卧推",
		"胸大肌",
		"推",
		"胸",
		"yaling woutui",
		23,
		"复合",
		false,
		false,
		"",
	],
	[
		"chest-09",
		"器械平板卧推",
		"胸大肌",
		"推",
		"胸",
		"qixie pingban woutui",
		24,
		"复合",
		false,
		false,
		"",
	],
	[
		"chest-10",
		"器械上斜卧推",
		"上胸",
		"推",
		"胸",
		"qixie shangxie woutui",
		25,
		"复合",
		false,
		false,
		"",
	],
	[
		"chest-11",
		"坐姿推胸机",
		"胸大肌",
		"推",
		"胸",
		"zuozi tuixiongji",
		26,
		"复合",
		false,
		false,
		"",
	],
	[
		"chest-12",
		"蝴蝶机夹胸",
		"胸大肌",
		"夹",
		"胸",
		"hudieji jiaxiong",
		27,
		"孤立",
		false,
		false,
		"",
	],
	[
		"chest-13",
		"哑铃上斜卧推（宽握）",
		"上胸 · 三角肌前束",
		"推",
		"胸",
		"yaling shangxie woutui kuan",
		52,
		"复合",
		false,
		false,
		"",
	],
	[
		"chest-14",
		"哑铃上斜卧推（窄握）",
		"上胸 · 肱三头肌",
		"推",
		"胸",
		"yaling shangxie woutui zhai",
		53,
		"复合",
		false,
		false,
		"",
	],

	// ---- 背（13）----
	[
		"back-01",
		"引体向上",
		"背阔肌 · 二头肌",
		"引",
		"背",
		"yintixiangshang",
		4,
		"复合",
		true,
		false,
		"",
	],
	[
		"back-02",
		"杠铃划船",
		"背阔肌 · 斜方肌",
		"划",
		"背",
		"gangling huachuan",
		5,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-03",
		"高位下拉",
		"背阔肌",
		"拉",
		"背",
		"gaowei xiala",
		6,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-04",
		"坐姿划船",
		"中背 · 菱形肌",
		"坐",
		"背",
		"zuozi huachuan",
		7,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-05",
		"高位下拉（对握）",
		"背阔肌",
		"拉",
		"背",
		"gaowei xiala duiwo",
		28,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-06",
		"高位下拉（反握）",
		"中背 · 背阔肌",
		"拉",
		"背",
		"gaowei xiala fanwo",
		29,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-07",
		"坐姿器械划船（中握）",
		"背阔肌",
		"划",
		"背",
		"zuozi qixie huachuan zhong",
		30,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-08",
		"坐姿划船（宽握）",
		"背阔肌",
		"划",
		"背",
		"zuozi huachuan kuan",
		31,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-09",
		"坐姿划船（中握）",
		"背阔肌",
		"划",
		"背",
		"zuozi huachuan zhong",
		32,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-10",
		"坐姿划船（窄握）",
		"背阔肌",
		"划",
		"背",
		"zuozi huachuan zhai",
		33,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-11",
		"杠铃划船(正握)",
		"背阔肌",
		"划",
		"背",
		"gangling huachuan zheng",
		34,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-12",
		"杠铃划船(反握)",
		"背阔肌",
		"划",
		"背",
		"gangling huachuan fan",
		35,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-13",
		"绳索面拉",
		"背阔肌",
		"拉",
		"背",
		"shengsuo mianla",
		36,
		"孤立",
		false,
		false,
		"",
	],

	// ---- 腿（11）----
	[
		"legs-01",
		"杠铃深蹲",
		"股四头肌 · 臀大肌",
		"蹲",
		"腿",
		"gangling shendun",
		8,
		"复合",
		false,
		false,
		"",
	],
	[
		"legs-02",
		"罗马尼亚硬拉",
		"腘绳肌 · 臀大肌",
		"硬",
		"腿",
		"luomaniya yingla",
		9,
		"复合",
		false,
		false,
		"",
	],
	[
		"legs-03",
		"腿举",
		"股四头肌 · 臀大肌",
		"举",
		"腿",
		"tuiju",
		10,
		"复合",
		false,
		false,
		"",
	],
	[
		"legs-04",
		"腿弯举",
		"腘绳肌",
		"弯",
		"腿",
		"tuiwanju",
		11,
		"孤立",
		false,
		false,
		"",
	],
	[
		"legs-05",
		"史密斯深蹲",
		"股四头肌",
		"蹲",
		"腿",
		"shimisi shendun",
		37,
		"复合",
		false,
		false,
		"",
	],
	[
		"legs-06",
		"坐姿腿屈伸",
		"股四头肌",
		"伸",
		"腿",
		"zuozi qushen",
		38,
		"孤立",
		false,
		false,
		"",
	],
	[
		"legs-07",
		"坐姿腿推机",
		"股四头肌",
		"推",
		"腿",
		"zuozi tuituiji",
		39,
		"复合",
		false,
		false,
		"",
	],
	[
		"legs-08",
		"哈克深蹲",
		"股四头肌",
		"蹲",
		"腿",
		"hake shendun",
		40,
		"复合",
		false,
		false,
		"",
	],
	[
		"legs-09",
		"哈克深蹲（反向）",
		"股四头肌",
		"蹲",
		"腿",
		"hake shendun fan",
		41,
		"复合",
		false,
		false,
		"",
	],
	[
		"legs-10",
		"髋内收训练机(外展)",
		"内收肌",
		"外",
		"腿",
		"neishouji wai",
		42,
		"孤立",
		false,
		false,
		"",
	],
	[
		"legs-11",
		"髋内收训练机(内收)",
		"内收肌",
		"内",
		"腿",
		"neishouji nei",
		43,
		"孤立",
		false,
		false,
		"",
	],

	// ---- 肩（10；shoulder-03 弃用，alias 到 back-13）----
	[
		"shoulder-01",
		"杠铃推举",
		"三角肌前束 · 三头肌",
		"推",
		"肩",
		"gangling tuiju",
		12,
		"复合",
		false,
		false,
		"",
	],
	[
		"shoulder-02",
		"哑铃侧平举",
		"三角肌中束",
		"侧",
		"肩",
		"yaling cepingju",
		13,
		"孤立",
		false,
		false,
		"",
	],
	[
		"shoulder-03",
		"面拉",
		"三角肌后束",
		"面",
		"肩",
		"mianla",
		14,
		"孤立",
		false,
		true,
		"back-13",
	],
	[
		"shoulder-04",
		"史密斯推举",
		"肩",
		"推",
		"肩",
		"shimisi tuiju",
		44,
		"复合",
		false,
		false,
		"",
	],
	[
		"shoulder-05",
		"器械肩上推举（对握）",
		"肩",
		"推",
		"肩",
		"qixie jianshang tuiju duiwo",
		45,
		"复合",
		false,
		false,
		"",
	],
	[
		"shoulder-06",
		"器械肩上推举（正握）",
		"肩",
		"推",
		"肩",
		"qixie jianshang tuiju zhengwo",
		46,
		"复合",
		false,
		false,
		"",
	],
	[
		"shoulder-07",
		"哑铃推举",
		"肩",
		"推",
		"肩",
		"yaling tuiju",
		47,
		"复合",
		false,
		false,
		"",
	],
	[
		"shoulder-08",
		"哑铃侧平举（反握）",
		"肩",
		"飞",
		"肩",
		"yaling cepingju fan",
		48,
		"孤立",
		false,
		false,
		"",
	],
	[
		"shoulder-09",
		"绳索侧平举",
		"肩",
		"飞",
		"肩",
		"shengsuo cepingju",
		49,
		"孤立",
		false,
		false,
		"",
	],
	[
		"shoulder-10",
		"蝴蝶机（反向）",
		"肩",
		"飞",
		"肩",
		"hudieji fan",
		50,
		"孤立",
		false,
		false,
		"",
	],

	// ---- 手臂（4）----
	[
		"arm-01",
		"杠铃弯举",
		"肱二头肌",
		"弯",
		"手臂",
		"gangling wanju",
		15,
		"孤立",
		false,
		false,
		"",
	],
	[
		"arm-02",
		"锤式弯举",
		"肱肌 · 前臂",
		"锤",
		"手臂",
		"chuishi wanju",
		16,
		"孤立",
		false,
		false,
		"",
	],
	[
		"arm-03",
		"绳索下压",
		"肱三头肌",
		"压",
		"手臂",
		"shengsuo xiaya",
		17,
		"孤立",
		false,
		false,
		"",
	],
	[
		"arm-04",
		"坐姿绳索弯举",
		"肱二头肌",
		"弯",
		"手臂",
		"shengsuo wanju",
		51,
		"孤立",
		false,
		false,
		"",
	],

	// ---- 核心（4）----
	[
		"core-01",
		"平板支撑",
		"腹横肌 · 核心",
		"板",
		"核心",
		"pingban zhicheng",
		18,
		"孤立",
		true,
		false,
		"",
	],
	[
		"core-02",
		"悬垂举腿",
		"下腹 · 髂腰肌",
		"腿",
		"核心",
		"xuanchui jutui",
		19,
		"孤立",
		true,
		false,
		"",
	],
	[
		"core-03",
		"龙门架卷腹",
		"腹直肌",
		"卷",
		"核心",
		"longmenjia juanfu",
		54,
		"孤立",
		false,
		false,
		"",
	],
	[
		"core-04",
		"反向山羊挺身",
		"下背 · 臀大肌",
		"挺",
		"核心",
		"fanxiang shanyang tingshen",
		55,
		"孤立",
		true,
		false,
		"",
	],
].map(
	([
		_id,
		name,
		sub,
		icon,
		category,
		pinyin,
		sort,
		type,
		bodyweight,
		deprecated,
		aliasId,
	]) => ({
		_id,
		name,
		sub,
		icon,
		category,
		pinyin,
		sort,
		type,
		bodyweight,
		deprecated,
		aliasId,
	}),
);

// 自检：ID 与名称不得重复；type 只允许 '复合'|'孤立'；bodyweight/deprecated 必须 boolean
(function selfCheck() {
	const ids = new Set();
	const names = new Set();
	for (const e of exercises) {
		for (const k of ["_id", "name", "sub", "icon", "category", "pinyin"]) {
			if (typeof e[k] !== "string" || e[k] === "") {
				console.error("必填字段缺失:", e._id, k);
				process.exit(1);
			}
		}
		if (
			typeof e.type !== "string" ||
			(e.type !== "复合" && e.type !== "孤立")
		) {
			console.error("非法 type:", e._id, e.type);
			process.exit(1);
		}
		if (typeof e.bodyweight !== "boolean") {
			console.error("bodyweight 必须 boolean:", e._id);
			process.exit(1);
		}
		if (typeof e.deprecated !== "boolean") {
			console.error("deprecated 必须 boolean:", e._id);
			process.exit(1);
		}
		if (
			e.deprecated &&
			(typeof e.aliasId !== "string" || e.aliasId === "")
		) {
			console.error("deprecated=true 的动作必须有 aliasId:", e._id);
			process.exit(1);
		}
		if (ids.has(e._id)) {
			console.error("重复 ID:", e._id);
			process.exit(1);
		}
		ids.add(e._id);
		if (names.has(e.name)) {
			console.error("重复名称:", e.name);
			process.exit(1);
		}
		names.add(e.name);
	}
	let comp = 0,
		isol = 0,
		bw = 0,
		dep = 0;
	for (const e of exercises) {
		if (e.type === "复合") comp++;
		else isol++;
		if (e.bodyweight) bw++;
		if (e.deprecated) dep++;
	}
	console.log(
		`[自检通过] 共 ${exercises.length} 条：复合 ${comp} / 孤立 ${isol} / 自重 ${bw} / 弃用 ${dep}`,
	);
})();

// ============================================================
// 写入层重写（2026-10-27）
//
// 执行模式：
//   node scripts/seed_exercises.js --dry-run      只打印将发送的 args 数组，不执行
//   node scripts/seed_exercises.js --set-only     只执行 $set，跳过 upsert
//   node scripts/seed_exercises.js                upsert + $set
//
// 技术：
//   - shell:false，直接 node + tcb bin JS 入口（复用 query_runtime 的 bin 查找）
//   - --json 让 tcb 输出纯 JSON：{ data: { results: [...], requestId: "..." } }
//   - CommandType: "UPDATE"（官方文档 UPDATE 才是更新命令类型）
//   - 每条 MgoCommand 的 Command 是 update 命令的 JSON 字符串
//   - 分批 10 条，每批检查 exit_code==0 && ok==1 && !writeErrors && n==batch.length
//   - 任何一批失败立即停止，打印完整 stdout/stderr/exitCode/requestId
//   - $set 覆盖 SET_FIELDS 全部字段（seed 对内置 _id 是权威的，含改名）
// ============================================================

const fs = require("fs");
const path = require("path");

const ENV = "cloud1-d0gjxp9f1819c8c1e";
const DRY_RUN = process.argv.includes("--dry-run");
const SET_ONLY = process.argv.includes("--set-only");
// $set 覆盖的全部字段：seed 对这些 _id 的文档是权威的（含改名 / 改拼音等）
const SET_FIELDS = ["name", "sub", "icon", "category", "pinyin", "sort", "type", "bodyweight", "deprecated", "aliasId"];

// 找 tcb bin JS（和 query_runtime.mjs 同一位置）
const nodeDir = path.dirname(process.execPath);
const tcbBin = path.join(nodeDir, "node_modules", "@cloudbase", "cli", "bin", "tcb");
if (!fs.existsSync(tcbBin)) {
	console.error("找不到 tcb bin:", tcbBin);
	console.error("请确认已全局安装 @cloudbase/cli");
	process.exit(1);
}

// EJSON 数字转换
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

// 构造一批的 spawnSync args 数组（不执行，只返回）
function buildArgs(mgoCmds) {
	const cmdStr = JSON.stringify(mgoCmds);
	return [tcbBin, "db", "nosql", "execute", "-e", ENV, "--json", "--command", cmdStr];
}

// 执行一批，返回 { ok, exitCode, okField, n, nModified, requestId, writeErrors, stdout, stderr }
function executeBatch(mgoCmds, expectedN) {
	const args = buildArgs(mgoCmds);
	const r = spawnSync(process.execPath, args, { encoding: "utf-8" });
	let parsed = null;
	try { parsed = JSON.parse(r.stdout || "{}"); } catch (e) {
		return { ok: false, exitCode: r.status, requestId: null, parseError: e.message, stdout: r.stdout, stderr: r.stderr };
	}
	const requestId = parsed?.data?.requestId ?? null;
	const inner = parsed?.data?.results;
	const exitCode = r.status;

	if (exitCode !== 0 || !Array.isArray(inner) || inner.length === 0) {
		return { ok: false, exitCode, requestId, error: "CLI 退出码非 0 或无 results", stdout: r.stdout, stderr: r.stderr };
	}

	const norm = normalize(inner);
	const firstResult = norm[0];
	// UPDATE 的 result 是 { ok: 1, n: 10, nModified: 3, writeErrors: [], upserted: [] }
	const doc = Array.isArray(firstResult) ? firstResult[0] : firstResult;
	if (!doc) return { ok: false, exitCode, requestId, error: "UPDATE 返回空文档", stdout: r.stdout, stderr: r.stderr };

	const okField = doc.ok ?? 0;
	const n = doc.n ?? 0;
	const nModified = doc.nModified ?? 0;
	const writeErrors = doc.writeErrors ?? [];
	const upserted = doc.upserted ?? [];

	let ok = true;
	if (exitCode !== 0) ok = false;
	if (okField !== 1) ok = false;
	if (writeErrors.length > 0) ok = false;
	if (n !== expectedN) ok = false;

	return { ok, exitCode, okField, n, nModified, writeErrors, upserted, requestId, stdout: r.stdout, stderr: r.stderr };
}

// 构造一批的 $set MgoCommand
function buildSetBatch(batch) {
	return [{
		TableName: "exercises",
		CommandType: "UPDATE",
		Command: JSON.stringify({
			update: "exercises",
			updates: batch.map((e) => {
				const u = {};
				for (const k of SET_FIELDS) u[k] = e[k];
				return {
					q: { _id: e._id },
					u: { $set: u },
					multi: false,
				};
			}),
		}),
	}];
}

// 构造一批的 upsert MgoCommand
function buildUpsertBatch(batch) {
	const fullDoc = (e) => ({
		_id: e._id, name: e.name, sub: e.sub, icon: e.icon, category: e.category,
		pinyin: e.pinyin, sort: e.sort,
		type: e.type, bodyweight: e.bodyweight, deprecated: e.deprecated, aliasId: e.aliasId,
	});
	return [{
		TableName: "exercises",
		CommandType: "UPDATE",
		Command: JSON.stringify({
			update: "exercises",
			updates: batch.map((e) => ({
				q: { _id: e._id },
				u: { $setOnInsert: fullDoc(e) },
				upsert: true,
				multi: false,
			})),
		}),
	}];
}

// ============ 主循环 ============
const BATCH_SIZE = 10;
const batches = [];
for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
	batches.push(exercises.slice(i, i + BATCH_SIZE));
}

if (DRY_RUN) {
	console.log(`\n[DRY RUN 模式] 共 ${batches.length} 批，每批 ${BATCH_SIZE} 条（最后一批 ${batches[batches.length - 1].length} 条）`);
	for (let bi = 0; bi < batches.length; bi++) {
		const batch = batches[bi];
		console.log(`\n=== 批次 ${bi + 1}/${batches.length} (${batch.length} 条) ===`);

		if (!SET_ONLY) {
			const upsertCmds = buildUpsertBatch(batch);
			const upsertArgs = buildArgs(upsertCmds);
			console.log(`  [upsert] args: ${JSON.stringify(upsertArgs).slice(0, 200)}...${JSON.stringify(upsertArgs).length > 200 ? ` (${JSON.stringify(upsertArgs).length} chars)` : ""}`);
		}

		const setCmds = buildSetBatch(batch);
		const setArgs = buildArgs(setCmds);
		console.log(`  [$set]   args: ${JSON.stringify(setArgs).slice(0, 200)}...${JSON.stringify(setArgs).length > 200 ? ` (${JSON.stringify(setArgs).length} chars)` : ""}`);

		// 详情
		for (const e of batch) {
			const newVals = SET_FIELDS.map((k) => `${k}=${JSON.stringify(e[k])}`).join(", ");
			console.log(`    ${e._id}  ${e.name.padEnd(14)}  ${e.category}/${e.type}/${e.bodyweight}${e.deprecated ? "  ⚠弃用→" + e.aliasId : ""}  →  $set { ${newVals} }`);
		}
	}
	console.log("\n[DRY RUN 完成] 未实际执行任何 tcb 命令。");
	process.exit(0);
}

// ============ 正式写入 ============
console.log(`\n=== 正式写入 ===`);
console.log(`批次: ${batches.length} 批，每批 ${BATCH_SIZE} 条`);
console.log(`模式: ${SET_ONLY ? "--set-only (跳过 upsert)" : "upsert + $set"}`);
console.log(`\n⚠ 此操作将修改云端 exercises 集合。Ctrl+C 可中止。\n`);

let totalN = 0;
let totalNModified = 0;
let totalFail = 0;

for (let bi = 0; bi < batches.length; bi++) {
	const batch = batches[bi];

	if (!SET_ONLY) {
		console.log(`--- 批次 ${bi + 1} upsert (${batch.length} 条) ---`);
		const r1 = executeBatch(buildUpsertBatch(batch), batch.length);
		if (!r1.ok) {
			console.error(`  ❌ upsert 批次 ${bi + 1} 失败，停止执行`);
			console.error(`  exitCode=${r1.exitCode} requestId=${r1.requestId ?? "null"}`);
			if (r1.parseError) console.error(`  parseError=${r1.parseError}`);
			if (r1.error) console.error(`  error=${r1.error}`);
			if (r1.okField != null) console.error(`  ok=${r1.okField} n=${r1.n} nModified=${r1.nModified}`);
			if (r1.writeErrors?.length > 0) console.error(`  writeErrors=${JSON.stringify(r1.writeErrors)}`);
			console.error(`  stdout=${r1.stdout?.slice(0, 500)}`);
			console.error(`  stderr=${r1.stderr?.slice(0, 500)}`);
			totalFail += batch.length;
			break;
		}
		console.log(`  ✅ n=${r1.n}  nModified=${r1.nModified}  requestId=${r1.requestId}`);
	}

	console.log(`--- 批次 ${bi + 1} \$set (${batch.length} 条) ---`);
	const r2 = executeBatch(buildSetBatch(batch), batch.length);
	if (!r2.ok) {
		console.error(`  ❌ $set 批次 ${bi + 1} 失败，停止执行`);
		console.error(`  exitCode=${r2.exitCode} requestId=${r2.requestId ?? "null"}`);
		if (r2.parseError) console.error(`  parseError=${r2.parseError}`);
		if (r2.error) console.error(`  error=${r2.error}`);
		if (r2.okField != null) console.error(`  ok=${r2.okField} n=${r2.n} nModified=${r2.nModified}`);
		if (r2.writeErrors?.length > 0) console.error(`  writeErrors=${JSON.stringify(r2.writeErrors)}`);
		console.error(`  stdout=${r2.stdout?.slice(0, 500)}`);
		console.error(`  stderr=${r2.stderr?.slice(0, 500)}`);
		totalFail += batch.length;
		break;
	}
	console.log(`  ✅ n=${r2.n}  nModified=${r2.nModified}  requestId=${r2.requestId}`);
	totalN += r2.n;
	totalNModified += r2.nModified;
}

console.log(
	`\n完成：\$set 影响 ${totalN} 条 / 实际修改 ${totalNModified} 条` +
	(totalFail > 0 ? ` / 失败 ${totalFail} 条` : ""),
);
process.exit(totalFail > 0 ? 1 : 0);
