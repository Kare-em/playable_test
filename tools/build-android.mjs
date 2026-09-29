/*
 * Сборка для Android (RuStore): dist/android/index.html — это webDir Capacitor.
 *   node tools/build-android.mjs && npx cap sync android
 *
 * Берём розничную сборку Яндекса как есть (плейтест снят, метка сборки стоит)
 * и вырезаем из неё /sdk.js площадки: в APK его неоткуда грузить, а ysdk.js
 * без YaGames просто молчит. Так у двух площадок один шаблон страницы, а не
 * две копии, которые разъедутся при первой же правке.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = new URL('../', import.meta.url);

await run(process.execPath, [fileURLToPath(new URL('tools/build-yandex.mjs', root)), '--no-zip']);

const src = await readFile(new URL('dist/yandex/index.html', root), 'utf8');
const html = src.replace('<script src="/sdk.js"></script>\n', '');
if (html === src) throw new Error('в сборке Яндекса не нашёлся <script src="/sdk.js"> — шаблон поменялся');

const outDir = new URL('dist/android/', root);
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await writeFile(new URL('index.html', outDir), html);
console.log('dist/android/index.html:', (Buffer.byteLength(html) / 1024 / 1024).toFixed(2), 'МБ');
