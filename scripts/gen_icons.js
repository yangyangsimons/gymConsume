// One-off generator for static icon SVGs used by the mini program.
// WeChat mini program <image> can render a local .svg file directly, but it
// cannot recolor it dynamically (no CSS currentColor), so we bake one file
// per icon+color combination actually used in the UI.
// Run once with: node gen_icons.js
const fs = require("fs");
const path = require("path");

const COLORS = {
  brand: "#1b9d68",
  mint: "#c9f6df",
  muted: "#6e7872",
  "muted-light": "#a4aca7",
  "on-dark": "#b8cec3",
  white: "#ffffff",
};

const ICONS = {
  home: '<path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" />',
  chart: '<path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19H2" />',
  user: '<circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" />',
  flame: '<path d="M12 22c4.2 0 7-3 7-7.1 0-3.4-2.1-6.1-5.1-9.5-.4 2.7-1.8 4-3.1 5.1.1-3.5-1.7-6.3-2.1-6.9C7.2 6.8 5 9.7 5 14.4 5 18.8 8 22 12 22Z" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  chevron: '<path d="m9 18 6-6-6-6" />',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />',
  close: '<path d="m6 6 12 12M18 6 6 18" />',
  search: '<circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />',
  check: '<path d="m5 12 4 4L19 6" />',
  scale: '<path d="M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" /><path d="M9 9a3 3 0 0 1 6 0M12 9l2-2" />',
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 20h14" />',
  moon: '<path d="M20 15.2A8.8 8.8 0 0 1 8.8 4a9 9 0 1 0 11.2 11.2Z" />',
  clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
};

const NEEDED = {
  home: ["muted-light", "brand"],
  chart: ["muted-light", "brand"],
  user: ["muted-light", "brand"],
  flame: ["mint"],
  plus: ["white", "brand"],
  chevron: ["muted", "muted-light", "on-dark"],
  dumbbell: ["brand", "muted"],
  clock: ["muted"],
  close: ["muted"],
  search: ["muted-light"],
  check: ["white"],
  scale: ["brand"],
  download: ["brand"],
  moon: ["brand"],
};

const outDir = __dirname;
let count = 0;
for (const [name, variants] of Object.entries(NEEDED)) {
  const body = ICONS[name];
  for (const variant of variants) {
    const color = COLORS[variant];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;
    fs.writeFileSync(path.join(outDir, `${name}-${variant}.svg`), svg, "utf-8");
    count++;
  }
}
console.log(`generated ${count} icon svg files in ${outDir}`);
