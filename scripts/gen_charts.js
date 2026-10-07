// Generates static chart SVGs (progress ring / bench-press trend line / muscle
// distribution donut) matching the original React app's hardcoded mock data.
// WeChat mini program doesn't support inline <svg>/<path> tags, so these are
// pre-baked into standalone .svg files and shown via <image>.
const fs = require("fs");
const path = require("path");

const outDir = __dirname;

// 1. progress ring: 75% (314 circumference, 78 dashoffset in the original CSS)
const ring = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <g transform="rotate(-90 60 60)">
    <circle cx="60" cy="60" r="50" fill="none" stroke="#ffffff17" stroke-width="8" />
    <circle cx="60" cy="60" r="50" fill="none" stroke="#68e1a6" stroke-width="8" stroke-linecap="round" stroke-dasharray="314" stroke-dashoffset="78" />
  </g>
</svg>
`;
fs.writeFileSync(path.join(outDir, "progress-ring.svg"), ring, "utf-8");

// 2. bench press trend line chart
const line = "0,82 42,72 84,78 126,52 168,57 210,30 252,39 294,12";
const lineChart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 294 100" preserveAspectRatio="none">
  <defs>
    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#23d18b" stop-opacity=".22" />
      <stop offset="1" stop-color="#23d18b" stop-opacity="0" />
    </linearGradient>
  </defs>
  <path d="M${line} L294,100 L0,100 Z" fill="url(#fill)" />
  <polyline points="${line}" fill="none" stroke="#17b978" stroke-width="3" />
  <circle cx="294" cy="12" r="5" fill="#fff" stroke="#17b978" stroke-width="3" />
</svg>
`;
fs.writeFileSync(path.join(outDir, "line-chart.svg"), lineChart, "utf-8");

// 3. muscle distribution donut: green 28%, blue 24%, orange 21%, gray 27%
const segments = [
  { color: "#26bd7c", pct: 28 },
  { color: "#5a91e3", pct: 24 },
  { color: "#e4a85b", pct: 21 },
  { color: "#d9dfdb", pct: 27 },
];
const outerR = 57.5; // 115 / 2
const innerR = 37; // 74 / 2, matches the white center hole
const strokeWidth = outerR - innerR; // ring thickness
const r = (outerR + innerR) / 2; // centerline radius for the stroked circles
const circumference = 2 * Math.PI * r;
let cursor = 0;
const arcs = segments
  .map((seg) => {
    const segLen = (seg.pct / 100) * circumference;
    const dasharray = `${segLen.toFixed(2)} ${(circumference - segLen).toFixed(2)}`;
    const dashoffset = -cursor;
    cursor += segLen;
    return `    <circle cx="57.5" cy="57.5" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${strokeWidth}" stroke-dasharray="${dasharray}" stroke-dashoffset="${dashoffset.toFixed(2)}" />`;
  })
  .join("\n");
const donut = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 115 115">
  <g transform="rotate(-90 57.5 57.5)">
${arcs}
  </g>
  <circle cx="57.5" cy="57.5" r="${innerR}" fill="#ffffff" />
</svg>
`;
fs.writeFileSync(path.join(outDir, "donut.svg"), donut, "utf-8");

console.log("generated progress-ring.svg, line-chart.svg, donut.svg in", outDir);
