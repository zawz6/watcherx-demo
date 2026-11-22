// usage: node scripts/shot.mjs <path> <out.png> [clickSelector] [waitMs]
import { chromium } from 'playwright';
const [, , path, out, click, wait] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://localhost:3000${path}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(Number(wait ?? 3500));
if (click) {
  await page.click(click);
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: out });
console.log(logs.slice(0, 12).join('\n') || 'no console errors');
await browser.close();
