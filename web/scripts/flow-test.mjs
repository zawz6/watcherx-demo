// Smoke-tests the demo's interactions against the built site. usage: BASE=http://localhost:3100 node scripts/flow-test.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3100';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [];
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 150)));
p.on('pageerror', (e) => errs.push(e.message.slice(0, 150)));
const results = [];
const check = (name, ok) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };
const txt = (t) => p.getByText(t).first();
const visible = async (t, ms = 4000) => txt(t).waitFor({ timeout: ms }).then(() => true, () => false);

await p.goto(BASE + '/supervisor/plan/'); await p.waitForTimeout(4000);
check('S2 pattern warning shown', await visible('تنبيه نمط متكرر'));
await p.getByRole('button', { name: /تطبيق البديل/ }).first().click(); await p.waitForTimeout(500);
check('S2 alternative applied hides warning', !(await txt('تنبيه نمط متكرر').isVisible().catch(() => false)));
await p.getByRole('button', { name: 'تعديل', exact: true }).click(); await p.waitForTimeout(500);
check('S2 edit drawer opens', await visible('انقل منطقة بين الدوريات'));
await p.locator('[role=dialog] button.card-flat').first().click(); await p.waitForTimeout(400);
await p.getByRole('button', { name: 'تم', exact: true }).click();
await p.getByRole('button', { name: 'اعتماد الخطة' }).click(); await p.waitForTimeout(400);
check('S2 approve plan', await visible('الخطة معتمدة'));

await p.getByRole('link', { name: /التنبيهات المباشرة/ }).click(); await p.waitForTimeout(3500);
check('S3 empty state', await visible('لا توجد تنبيهات جديدة'));
await p.keyboard.press('n'); await p.waitForTimeout(1500);
check('S3 N key fires toast', await visible('بلاغ جديد:'));
await p.getByRole('button', { name: 'اعتماد', exact: true }).click(); await p.waitForTimeout(500);
check('S3 approve alert', await visible('معتمد'));
await p.keyboard.press('n'); await p.keyboard.press('n'); await p.waitForTimeout(800);
const cards = await p.locator('main button.card').count();
check('S3 all three alerts listed', cards === 3);

await p.getByRole('link', { name: /اسأل الوكيل/ }).click(); await p.waitForTimeout(2500);
await p.getByPlaceholder('اكتب سؤالك هنا').fill('ما أفضل خطة لو تعطلت دوريتان الليلة'); await p.keyboard.press('Enter'); await p.waitForTimeout(7000);
check('S4 free text matches keywords', await visible('أعدت التخطيط بأربع دوريات'));
await p.getByPlaceholder('اكتب سؤالك هنا').fill('كم عدد المصانع'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
check('S4 unknown question fallback', await visible('أستطيع الإجابة عن الأسئلة المقترحة'));

await p.getByRole('link', { name: 'مدير أمن المدينة' }).click(); await p.waitForTimeout(3000);
check('role switch lands on manager', p.url().includes('/manager/forecast'));
await p.getByRole('link', { name: /البؤر المتكررة/ }).click(); await p.waitForTimeout(2500);
await p.getByRole('button', { name: 'اعتماد', exact: true }).first().click(); await p.waitForTimeout(400);
check('M3 approve hotspot', await visible('أُرسلت كمهمة إلى الصيانة'));
await p.getByRole('link', { name: /الملخص الأسبوعي/ }).click(); await p.waitForTimeout(2000);
check('M4 decision reflects approval', await visible('معتمد'));

await p.getByRole('button', { name: /إعادة العرض/ }).click(); await p.waitForTimeout(800);
check('reset clears approvals', !(await txt('معتمد').isVisible().catch(() => false)));

await p.getByRole('button', { name: /المدينة الصناعية الثانية بالرياض/ }).click(); await p.waitForTimeout(300);
check('city switcher shows coming soon', (await p.getByText('قريباً').count()) >= 3);

console.log(results.join('\n'));
console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.filter((e) => !e.includes('luma')).join('\n') : 'no console errors');
await b.close();
