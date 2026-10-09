// 初始化动作库：node scripts/seed_exercises.js（需已 tcb login 并选定环境）
const { spawnSync } = require("child_process");

const exercises = [
	["chest-01", "杠铃卧推", "胸大肌 · 三头肌", "卧", "胸", "gangling woutui"],
	[
		"chest-02",
		"上斜哑铃卧推",
		"上胸 · 三角肌前束",
		"斜",
		"胸",
		"shangxie yaling woutui",
	],
	["chest-03", "绳索夹胸", "胸大肌", "夹", "胸", "shengsuo jiaxiong"],
	[
		"chest-04",
		"双杠臂屈伸",
		"下胸 · 三头肌",
		"屈",
		"胸",
		"shuanggang biqushen",
	],
	["back-01", "引体向上", "背阔肌 · 二头肌", "引", "背", "yintixiangshang"],
	["back-02", "杠铃划船", "背阔肌 · 斜方肌", "划", "背", "gangling huachuan"],
	["back-03", "高位下拉", "背阔肌", "拉", "背", "gaowei xiala"],
	["back-04", "坐姿划船", "中背 · 菱形肌", "坐", "背", "zuozi huachuan"],
	[
		"legs-01",
		"杠铃深蹲",
		"股四头肌 · 臀大肌",
		"蹲",
		"腿",
		"gangling shendun",
	],
	[
		"legs-02",
		"罗马尼亚硬拉",
		"腘绳肌 · 臀大肌",
		"硬",
		"腿",
		"luomaniya yingla",
	],
	["legs-03", "腿举", "股四头肌 · 臀大肌", "举", "腿", "tuiju"],
	["legs-04", "腿弯举", "腘绳肌", "弯", "腿", "tuiwanju"],
	[
		"shoulder-01",
		"杠铃推举",
		"三角肌前束 · 三头肌",
		"推",
		"肩",
		"gangling tuiju",
	],
	["shoulder-02", "哑铃侧平举", "三角肌中束", "侧", "肩", "yaling cepingju"],
	["shoulder-03", "面拉", "三角肌后束", "面", "肩", "mianla"],
	["arm-01", "杠铃弯举", "肱二头肌", "弯", "手臂", "gangling wanju"],
	["arm-02", "锤式弯举", "肱肌 · 前臂", "锤", "手臂", "chuishi wanju"],
	["arm-03", "绳索下压", "肱三头肌", "压", "手臂", "shengsuo xiaya"],
	["core-01", "平板支撑", "腹横肌 · 核心", "板", "核心", "pingban zhicheng"],
	["core-02", "悬垂举腿", "下腹 · 髂腰肌", "腿", "核心", "xuanchui jutui"],
].map(([_id, name, sub, icon, category, pinyin], i) => ({
	_id,
	name,
	sub,
	icon,
	category,
	pinyin,
	sort: i,
}));

const command = JSON.stringify([
	{
		TableName: "exercises",
		CommandType: "COMMAND",
		Command: JSON.stringify({
			delete: "exercises",
			deletes: [{ q: {}, limit: 0 }],
		}),
	},
	{
		TableName: "exercises",
		CommandType: "INSERT",
		Command: JSON.stringify({ insert: "exercises", documents: exercises }),
	},
]);

const arg = '"' + command.replace(/(\\*)"/g, '$1$1\\"') + '"';
const r = spawnSync("tcb", ["db", "nosql", "execute", "--command", arg], {
	shell: true,
	stdio: "inherit",
});
process.exit(r.status === null ? 1 : r.status);
