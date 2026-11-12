// Headless verification stills for the unified build.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const OUT = '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--enable-webgl2',
    '--disable-gpu-sandbox',
    '--no-sandbox',
  ],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
page.on('pageerror', (err) => console.log('PAGEERROR', err.message));

async function shot(name, query) {
  await page.goto(`http://localhost:4173/?capture=${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__DW_READY === true, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

await shot('street', 'street');
await shot('metro', 'metro');
await shot('dialogue', 'dialogue');
await shot('director', 'director');
await browser.close();
console.log('done');
