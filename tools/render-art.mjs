/*
 * Растеризация векторных иконок в PNG через headless Chromium.
 *   node tools/render-art.mjs [--size 256] [--sheet]
 * Кладёт файлы в prototype/assets/products/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { ICONS, ORDER } from '../art/products.mjs';

const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const size = Number((process.argv.find(a => a.startsWith('--size='))||'').split('=')[1] || 256);
const outDir = new URL('../prototype/assets/products/', import.meta.url);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: size, height: size } });

for (const id of ORDER) {
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${ICONS[id]}`,
    { waitUntil: 'load' }
  );
  const png = await page.screenshot({ omitBackground: true });
  await writeFile(new URL(id + '.png', outDir), png);
  console.log('rendered', id + '.png', png.length + ' B');
}

// контактный лист — быстрый визуальный контроль набора
if (process.argv.includes('--sheet')) {
  const cell = 160;
  const sheet = await browser.newPage({ viewport: { width: cell * 4, height: cell * 3 } });
  await sheet.setContent(`<style>
    body{margin:0;background:#F3E7D3;display:grid;grid-template-columns:repeat(4,${cell}px)}
    div{display:flex;align-items:center;justify-content:center}
    svg{width:120px;height:120px}
  </style>` + ORDER.map(id => `<div>${ICONS[id]}</div>`).join(''));
  await writeFile(new URL('../../art-sheet.png', outDir), await sheet.screenshot());
  console.log('contact sheet: prototype/art-sheet.png');
}

await browser.close();
