// Headless stills. Requires playwright-core and Chrome; not part of the Pages build.
//   node scripts/capture.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
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
page.on('console', (msg) => {
  const t = msg.type();
  if (t === 'error' || t === 'warning') console.log('PAGE', t, msg.text());
});
page.on('pageerror', (err) => console.log('PAGEERROR', err.message));

async function shot(name, query) {
  const url = `http://127.0.0.1:4173/destinys-world-playcanvas/${query}`;
  console.log('OPEN', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DW_READY === true, null, { timeout: 60000 });
  await page.waitForTimeout(900);
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  console.log('SAVED', path);
}

await shot('street', '?capture=street');
await shot('alien', '?capture=alien');
await shot('lamp', '?capture=lamp');
await shot('journal', '?capture=journal');

await page.goto('http://127.0.0.1:4173/destinys-world-playcanvas/?capture=street&debug=1', {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction(() => window.__DW_READY === true, null, { timeout: 60000 });

const report = await page.evaluate(async () => {
  const g = window.__DW;
  const notes = [];
  const hs = g.hotspots();
  const notice = hs.find((h) => h.name === 'Evacuation Notice');
  const f01 = hs.find((h) => h.id === 'fragment-01');
  const f02 = hs.find((h) => h.id === 'fragment-02');
  const clock = hs.find((h) => h.name === 'Precinct Clock');
  const docket = hs.find((h) => h.name === 'Missing Persons Docket');

  g.teleport(notice.cx, 0.05, notice.cz + 1.8);
  g.lookAt(notice.cx, notice.cy, notice.cz);
  const prompt = g.getPrompt();
  notes.push('noticePrompt=' + prompt);
  const interacted = g.interact();
  notes.push('noticeId=' + interacted);
  g.openJournal();
  const journal = g.probe().journal;
  notes.push('hasLine=' + journal.includes('Evacuation was yesterday. My badge still works. That might be the trap.'));
  g.closeJournal();

  g.teleport(f01.cx + 1.15, 0.2, f01.cz);
  g.lookAt(f01.cx, f01.cy, f01.cz);
  notes.push('f01Prompt=' + g.getPrompt());
  notes.push('f01=' + g.interact());

  g.teleport(f02.cx, 0.05, f02.cz + 1.6);
  g.lookAt(f02.cx, f02.cy, f02.cz);
  notes.push('f02Prompt=' + g.getPrompt());
  notes.push('f02=' + g.interact());
  const after = g.probe();
  notes.push('fragments=' + after.fragments + ' chimes=' + after.chimes + ' y=' + after.y.toFixed(3));

  g.teleport(clock.cx + 1.4, 0.2, clock.cz);
  g.lookAt(clock.cx, clock.cy, clock.cz);
  notes.push('clockPrompt=' + g.getPrompt());
  g.teleport(docket.cx + 1.2, 0.2, docket.cz);
  g.lookAt(docket.cx, docket.cy, docket.cz);
  notes.push('docketPrompt=' + g.getPrompt());

  // Alien chase + damage
  const alien = g.probe().alien;
  g.teleport(alien[0], 0.05, alien[2] + 1.3);
  g.lookAt(alien[0], 1.4, alien[2]);
  for (let i = 0; i < 40; i++) g.step(0.05);
  let mid = g.probe();
  notes.push('afterApproach mode=' + mid.alienMode + ' hp=' + mid.health + ' alienHp=' + mid.alienHealth);
  g.melee();
  for (let i = 0; i < 12; i++) g.step(0.05);
  mid = g.probe();
  notes.push('afterMelee alienHp=' + mid.alienHealth + ' mode=' + mid.alienMode);

  // Barricade blocks the alien volume
  g.placeAt('barricade', mid.alien[0], mid.alien[2] + 0.2);
  const inside = g.blocked(mid.alien[0], mid.alien[1], mid.alien[2] + 0.2);
  notes.push('barricadeBlocks=' + inside + ' barricades=' + g.probe().barricades);

  g.placeAt('lamp', 1.2, 12);
  notes.push('lamps=' + g.probe().lamps);

  // Death respawn
  const beforeDieY = g.probe().y;
  for (let i = 0; i < 8; i++) {
    g.teleport(g.probe().alien[0] + 0.2, 0.05, g.probe().alien[2] + 0.8);
    for (let k = 0; k < 20; k++) g.step(0.05);
    if (g.probe().health <= 0 || g.probe().health < 100) break;
  }
  const hurt = g.probe();
  notes.push('healthAfterFight=' + hurt.health + ' mode=' + hurt.alienMode);
  return { notes, beforeDieY, hsCount: hs.length };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
