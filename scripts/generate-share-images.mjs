// Regenerates public/og-image.png (social share card) and public/apple-touch-icon.png
// from the brand assets. Run: node scripts/generate-share-images.mjs
import { chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const font = (pkg, file) => pathToFileURL(join(root, 'node_modules/@fontsource-variable', pkg, 'files', file)).href;
const Q = (stroke, tail, knock) => `
  <svg viewBox="0 0 124 100" style="height:.76em;width:auto;overflow:visible;margin:0 .005em 0 .03em">
    <ellipse cx="52" cy="50" rx="44" ry="41.5" fill="none" stroke="${stroke}" stroke-width="17"/>
    <path d="M63 75 L77 89 L114 52" fill="none" stroke="${knock}" stroke-width="29" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M63 75 L77 89 L114 52" fill="none" stroke="${tail}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
const css = `
  @font-face { font-family: Manrope; src: url(${font('manrope', 'manrope-latin-wght-normal.woff2')}); font-weight: 200 800; }
  @font-face { font-family: Inter; src: url(${font('inter', 'inter-latin-wght-normal.woff2')}); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  body { font-family: Inter; color: #171717; }
  .wm { font-family: Manrope; font-weight: 800; letter-spacing: .02em; display: inline-flex; align-items: baseline; line-height: 1; }`;

const og = `<!doctype html><meta charset="utf-8"><style>${css}
  body { width: 1200px; height: 630px; background: #F6F4EF; padding: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
  h1 { font-family: Manrope; font-weight: 800; font-size: 92px; line-height: 1.02; letter-spacing: -.025em; max-width: 900px; }
  p { font-size: 32px; color: #525252; margin-top: 28px; }
  .badge { display: inline-flex; align-items: center; gap: 14px; font-size: 26px; font-weight: 600; background: #fff; border: 2px solid #E7E5DF; border-radius: 999px; padding: 14px 26px; }
  .dot { width: 16px; height: 16px; border-radius: 99px; background: #C7FF2F; box-shadow: 0 0 0 3px #171717; }
  </style>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span class="wm" style="font-size:52px">CROMI${Q('#171717', '#171717', '#F6F4EF')}A</span>
    <span class="badge"><span class="dot"></span>Próximamente · Madrid sureste</span>
  </div>
  <div><h1>Tu bici, en buenas manos.</h1><p>Mecánicos de bici de confianza, cerca de ti.</p></div>`;

const icon = `<!doctype html><meta charset="utf-8"><style>${css}
  body { width: 180px; height: 180px; background: #171717; display: grid; place-items: center; }</style>
  <svg viewBox="0 0 124 100" width="118">
    <ellipse cx="52" cy="50" rx="44" ry="41.5" fill="none" stroke="#fff" stroke-width="17"/>
    <path d="M63 75 L77 89 L114 52" fill="none" stroke="#171717" stroke-width="29" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M63 75 L77 89 L114 52" fill="none" stroke="#C7FF2F" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const dir = mkdtempSync(join(tmpdir(), 'cromiqa-og-'));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [name, html, w, h] of [['og-image.png', og, 1200, 630], ['apple-touch-icon.png', icon, 180, 180]]) {
  const file = join(dir, name + '.html');
  writeFileSync(file, html);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'public', name) });
  await page.close();
  console.log('wrote public/' + name);
}
await browser.close();
