// 初始化/补齐动作库：node scripts/seed_exercises.js（需已 tcb login 并选定环境 cloud1-d0gjxp9f1819c8c1e）
// 幂等：新动作按 _id upsert（$setOnInsert），已存在的新字段按 $set 补齐；不清空动作库，不删除用户自定义动作，可重复执行。
// 注意：$set 只更新 type / bodyweight / deprecated / aliasId 这四个新字段，不动既有字段。
// --dry-run：只打印将写入的差异，不实际执行。
const { spawnSync } = require("child_process");

const DRY_RUN = process.argv.includes("--dry-run");

// [_id, name, sub, icon, category, pinyin, sort, type, bodyweight, deprecated, aliasId]
// 前 7 项是既有字段，后 4 项是本轮新增（全部可选）
const exercises = [
	// ---- 胸（12）----
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
		"正握下拉（宽握）",
		"背阔肌",
		"拉",
		"背",
		"zhengwo xiala kuan",
		28,
		"复合",
		false,
		false,
		"",
	],
	[
		"back-06",
		"反握下拉",
		"中背 · 背阔肌",
		"拉",
		"背",
		"fanwo xiala",
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

	// ---- 核心（2）----
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

// 只更新 type / bodyweight / deprecated / aliasId 这四个字段，不动既有字段
const NEW_FIELDS = ["type", "bodyweight", "deprecated", "aliasId"];

// 分批执行避免 Windows 命令行长度上限
let failed = 0;
let touchedUpdate = 0;
let touchedInsert = 0;

for (let i = 0; i < exercises.length; i += 10) {
	const batch = exercises.slice(i, i + 10);

	// Step 1: upsert 缺失动作（$setOnInsert 不碰已有）
	const upsertCmd = JSON.stringify([
		{
			TableName: "exercises",
			CommandType: "COMMAND",
			Command: JSON.stringify({
				update: "exercises",
				updates: batch.map((e) => ({
					q: { _id: e._id },
					u: { $setOnInsert: e },
					upsert: true,
					multi: false,
				})),
			}),
		},
	]);

	// Step 2: $set 新字段（已存在的也更新；只动这四个字段）
	const setCmd = JSON.stringify([
		{
			TableName: "exercises",
			CommandType: "COMMAND",
			Command: JSON.stringify({
				update: "exercises",
				updates: batch.map((e) => ({
					q: { _id: e._id },
					u: {
						$set: {
							type: e.type,
							bodyweight: e.bodyweight,
							deprecated: e.deprecated,
							aliasId: e.aliasId,
						},
					},
					multi: false,
				})),
			}),
		},
	]);

	if (DRY_RUN) {
		console.log(`\n=== 批次 ${i / 10 + 1} (${batch.length} 条) ===`);
		for (const e of batch) {
			const newVals = NEW_FIELDS.map(
				(k) => `${k}=${JSON.stringify(e[k])}`,
			).join(", ");
			console.log(
				`  ${e._id}  ${e.name.padEnd(14)}  ${e.category}/${e.type}/${e.bodyweight}${e.deprecated ? "  ⚠弃用→" + e.aliasId : ""}  →  $set { ${newVals} }`,
			);
		}
		touchedUpdate += batch.length;
		continue;
	}

	// 正式执行
	const upsertArg = '"' + upsertCmd.replace(/(\\*)"/g, '$1$1\\"') + '"';
	const r1 = spawnSync(
		"tcb",
		["db", "nosql", "execute", "--command", upsertArg],
		{ shell: true, stdio: "inherit" },
	);
	if (r1.status !== 0) {
		failed += batch.length;
		continue;
	}
	touchedInsert += batch.length;

	const setArg = '"' + setCmd.replace(/(\\*)"/g, '$1$1\\"') + '"';
	const r2 = spawnSync(
		"tcb",
		["db", "nosql", "execute", "--command", setArg],
		{ shell: true, stdio: "inherit" },
	);
	if (r2.status !== 0) {
		failed += batch.length;
		continue;
	}
	touchedUpdate += batch.length;
}

if (DRY_RUN) {
	console.log(
		`\n[DRY RUN 完成] 将对 ${touchedUpdate} 条记录执行 $set 更新新字段（type/bodyweight/deprecated/aliasId）。`,
	);
	console.log(
		`               同时对缺失的动作执行 $setOnInsert 补齐（不碰已有字段）。`,
	);
	console.log(`               未实际写入任何数据。`);
	process.exit(0);
}

console.log(
	`\n完成：upsert ${touchedInsert} 条 / $set 更新 ${touchedUpdate} 条 / 失败 ${failed} 条` +
		(failed > 0 ? "（已存在的 _id 不会被 $setOnInsert 覆盖）" : ""),
);
process.exit(failed > 0 ? 1 : 0);
