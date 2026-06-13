// Screenshot tool for the descent. Captures the page at several scroll depths.
// Usage: node tools/shoot.mjs [url] [tag] [width] [height]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url    = process.argv[2] || 'http://localhost:8000/index.html';
const tag    = process.argv[3] || 'shot';
const width  = parseInt(process.argv[4] || '1440', 10);
const height = parseInt(process.argv[5] || '900', 10);

// scroll fractions to capture along the descent
const depths = [0, 0.12, 0.28, 0.45, 0.62, 0.78, 0.92, 1.0];

const outDir = 'screenshots';
mkdirSync(outDir, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

// The headless shell intermittently dies at launch on this machine (AV/OneDrive
// race). Retry launch + first page acquisition a few times.
async function boot() {
  let lastErr;
  for (let i = 0; i < 6; i++) {
    try {
      // Bundled headless shell can't do swiftshader WebGL on this machine;
      // the system Edge channel reaches a real GPU and renders correctly.
      const browser = await chromium.launch({ channel: 'msedge' });
      const page = await browser.newPage({ viewport: { width, height } });
      return { browser, page };
    } catch (e) {
      lastErr = e;
      await sleep(800);
    }
  }
  throw lastErr;
}

const { browser, page } = await boot();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('crash', () => errors.push('PAGE CRASHED'));

await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3000); // let loader hide + first frames render

const scrollH = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);

for (const d of depths) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(scrollH * d));
  await page.waitForTimeout(2200); // wait for scrub smoothing to settle
  const name = `${outDir}/${tag}_${String(Math.round(d * 100)).padStart(3, '0')}.png`;
  await page.screenshot({ path: name });
  console.log('saved', name);
}

if (errors.length) {
  console.log('\n=== PAGE ERRORS ===');
  errors.slice(0, 20).forEach(e => console.log(' -', e));
} else {
  console.log('\nno console/page errors');
}

await browser.close();
