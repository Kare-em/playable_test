/*
 * Вшивает векторные иконки в игру как data-URI: ни одного внешнего запроса
 * (требование модерации Яндекс Игр) и работает даже с file://.
 *   node tools/build-art.mjs
 */
import { writeFile } from 'node:fs/promises';
import { ICONS, ORDER } from '../art/products.mjs';

const compact = (svg) => svg.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
const uri = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(compact(svg));

const body = ORDER.map((id) => '  ' + id + ': ' + JSON.stringify(uri(ICONS[id]))).join(',\n');
const out = `/* Сгенерировано tools/build-art.mjs из art/products.mjs — не править руками. */\nwindow.SHOP_ART = {\n${body}\n};\n`;

await writeFile(new URL('../prototype/src/art.js', import.meta.url), out);
console.log('prototype/src/art.js:', (out.length / 1024).toFixed(1), 'КБ,', ORDER.length, 'иконок');
