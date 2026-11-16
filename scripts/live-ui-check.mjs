// Live UI check for the hosted Worker. Reads DEMO_ACCESS_SECRET from the environment (node --env-file=.env); never prints it.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const { chromium } = await import(pathToFileURL(join(process.env.CAVLI_PLAYWRIGHT, 'index.mjs')).href);
const base = 'https://cavli-assignment-1.nishanameenk.workers.dev';
const browser = await chromium.launch({ executablePath: process.env.CAVLI_CHROME, headless: true });
const results = [];
try {
  for (const [width, height, name] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
    const context = await browser.newContext({ viewport: { width, height },
      httpCredentials: { username: 'reviewer', password: process.env.DEMO_ACCESS_SECRET } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + new URL(r.url()).pathname); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base);
    await page.getByRole('heading', { name: 'Ask about a Cavli module' }).waitFor();
    assert.equal(await page.getByRole('img', { name: 'Cavli Wireless' }).evaluate(async i => { await i.decode(); return i.naturalWidth > 0; }), true);
    assert.equal(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Space Grotesk"'); }), true);
    await page.getByRole('button', { name: 'Compare peak speeds' }).click();
    const box = page.getByRole('textbox', { name: 'Your question' });
    assert.equal(await box.evaluate(i => getComputedStyle(i).outlineStyle), 'none');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `outputs/private/live-${name}-home.png` });
    await box.press('Enter');
    await page.getByText(/150 Mbps/).first().waitFor({ timeout: 40000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `outputs/private/live-${name}-answer.png` });
    assert.deepEqual(errors, []);
    results.push('PASS · ' + name + ': logo, font, chip fill, no focus box, live answer, no errors');
    await context.close();
  }
  await writeFile('outputs/hosted-ui-check.json', JSON.stringify({ base, checkedAt: new Date().toISOString(), passed: true,
    checks: results.map(r => r.replace('PASS · ', '')),
    note: 'Live Chrome check of the redesigned UI. Reduced motion keeps the chip rows still so chips can be clicked by name.' }, null, 2));
  console.log(results.join('\n'));
} finally { await browser.close(); }
