// Captures the 10 deck screenshots (ss01..ss10) at 1920x1080 from the built static site.
// usage: BASE=http://localhost:3100 node scripts/screenshots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const OUT = new URL('../../shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const problems = [];

async function open(path, wait = 6500) {
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`${path}: ${m.text().slice(0, 160)}`));
  page.on('pageerror', (e) => problems.push(`${path}: ${e.message.slice(0, 160)}`));
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(wait);
  return page;
}
const shot = async (page, name, opts = {}) => {
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log('saved', name);
  await page.close();
};

// ss01 + ss10: shift map with a level-5 zone popover
let p = await open('/supervisor/map/');
await p.click('aside ol li:first-child button');
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}ss01_shift_map.png` });
console.log('saved ss01');
const pop = p.locator('[role=dialog]');
await pop.screenshot({ path: `${OUT}ss10_zone_closeup.png` });
console.log('saved ss10');
await p.close();

// ss02 plan
p = await open('/supervisor/plan/');
await shot(p, 'ss02_plan');

// ss03 alert: toast + suggestion card
p = await open('/supervisor/alerts/');
await p.getByRole('button', { name: /محاكاة بلاغ جديد/ }).click();
await p.waitForTimeout(2600);
await shot(p, 'ss03_alert');

// ss04 supervisor chat: "two cars down" with the trace expanded
p = await open('/supervisor/ask/', 2500);
await p.getByRole('button', { name: /دوريتان معطلتان/ }).click();
await p.waitForTimeout(6500);
await shot(p, 'ss04_chat_supervisor');

p = await open('/manager/forecast/');
await shot(p, 'ss05_forecast_7d');
p = await open('/manager/performance/', 3500);
await shot(p, 'ss06_performance');
p = await open('/manager/hotspots/', 3500);
await shot(p, 'ss07_hotspots');
p = await open('/manager/brief/', 3000);
await shot(p, 'ss08_weekly_brief');

p = await open('/manager/ask/', 2500);
await p.getByRole('button', { name: /ماذا لو أصلحنا الإنارة/ }).click();
await p.waitForTimeout(6000);
await shot(p, 'ss09_chat_manager');

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no console errors');
