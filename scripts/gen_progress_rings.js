// 生成每周目标进度环 progress-ring-g{目标天数}-{已训练天数}.svg 到 static/charts（小程序不支持内联 svg）
// 目标 1–7 天；已训练天数超过目标时界面按目标天数显示满环
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "static", "charts");

for (const file of fs.readdirSync(outDir)) {
	if (/^progress-ring-(\d+|g\d+-\d+)\.svg$/.test(file)) fs.unlinkSync(path.join(outDir, file));
}

for (let goal = 1; goal <= 7; goal++) {
	for (let n = 0; n <= goal; n++) {
		const offset = Math.round(314 * (1 - n / goal));
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <g transform="rotate(-90 60 60)">
    <circle cx="60" cy="60" r="50" fill="none" stroke="#ffffff17" stroke-width="8" />
    <circle cx="60" cy="60" r="50" fill="none" stroke="#68e1a6" stroke-width="8" stroke-linecap="round" stroke-dasharray="314" stroke-dashoffset="${offset}" />
  </g>
</svg>
`;
		fs.writeFileSync(path.join(outDir, `progress-ring-g${goal}-${n}.svg`), svg, "utf-8");
	}
}
