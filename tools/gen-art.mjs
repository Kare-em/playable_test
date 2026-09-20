/*
 * Генерация растрового арта через image-API (OpenAI-совместимый эндпоинт).
 *
 *   node tools/gen-art.mjs --prio=P0
 *
 * Ключ берётся из окружения: image_generator_api (или IMAGE_API_KEY).
 * База и модель — с дефолтами, переопределяются через IMAGE_API_BASE / IMAGE_MODEL.
 *
 * Флаги:
 *   --list-models     показать доступные модели и выйти
 *   --prio=P0         только ассеты этого приоритета (P0 | P1 | P2)
 *   --group=character только эту группу (character|interior|background|ui|promo)
 *   --only=a,b,c      конкретные id
 *   --limit=N         не больше N генераций за запуск
 *   --force           перегенерировать уже существующие файлы
 *   --dry-run         показать план и промпты, ничего не вызывать
 *
 * Результат: art/raw/<id>.<ext> + art/raw/manifest.json (промпт, модель, хэш).
 * Ключ берётся только из окружения и никогда не пишется в файлы и логи.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PROMPTS, ORDER } from '../art/prompts.mjs';

const BASE = (process.env.IMAGE_API_BASE || 'https://nordrouter.com/v1').replace(/\/+$/, '');
const KEY = process.env.image_generator_api || process.env.IMAGE_API_KEY || '';
const MODEL = process.env.IMAGE_MODEL || 'google/gemini-3.1-flash-image-preview';

const flag = (name, def = null) => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
};

const dryRun = !!flag('dry-run');
const outDir = new URL('../art/raw/', import.meta.url);
const manifestPath = new URL('manifest.json', outDir);

function fail(msg) {
  console.error('ОШИБКА:', msg);
  process.exit(1);
}

if (!KEY && !dryRun) fail('не задан ключ: ожидается image_generator_api или IMAGE_API_KEY в окружении');

// ключ мог случайно попасть в текст ошибки от сервера — вырезаем перед выводом
const scrub = (s) => (KEY ? String(s).split(KEY).join('sk-***') : String(s));

async function api(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

/** Повтор с экспоненциальной паузой: сеть моргнула или упёрлись в лимит запросов. */
async function withRetry(label, fn) {
  const delays = [2000, 4000, 8000, 16000];
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fn();
      const retryable = r.status === 429 || r.status >= 500;
      if (r.ok || !retryable || attempt >= delays.length) return r;
      console.warn(`  ${label}: HTTP ${r.status}, повтор через ${delays[attempt] / 1000}с`);
    } catch (e) {
      if (attempt >= delays.length) throw e;
      console.warn(`  ${label}: ${scrub(e.message)}, повтор через ${delays[attempt] / 1000}с`);
    }
    await new Promise((r) => setTimeout(r, delays[attempt]));
  }
}

if (flag('list-models')) {
  const r = await api('/models');
  if (!r.ok) fail(`/models вернул HTTP ${r.status}: ${scrub(JSON.stringify(r.body)).slice(0, 300)}`);
  const ids = (r.body?.data || []).map((m) => m.id).sort();
  console.log(ids.join('\n') || '(пусто)');
  console.log(`\nвсего моделей: ${ids.length}. Подходящую пропишите в IMAGE_MODEL.`);
  process.exit(0);
}

// ------------------------------------------------------------------- отбор
let ids = ORDER;
const only = flag('only');
if (typeof only === 'string') {
  ids = only.split(',').map((s) => s.trim()).filter(Boolean);
  const bad = ids.filter((id) => !PROMPTS[id]);
  if (bad.length) fail(`неизвестные id: ${bad.join(', ')}`);
}
const prio = flag('prio');
if (typeof prio === 'string') ids = ids.filter((id) => PROMPTS[id].prio === prio);
const group = flag('group');
if (typeof group === 'string') ids = ids.filter((id) => PROMPTS[id].group === group);

function hash(s) { return createHash('sha256').update(s).digest('hex').slice(0, 16); }

const manifest = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => ({}));
const force = !!flag('force');
const exists = async (p) => access(p).then(() => true, () => false);

if (!force) {
  const kept = [];
  for (const id of ids) {
    const prev = manifest[id];
    if (prev?.file && await exists(new URL(prev.file, outDir))) {
      if (prev.promptHash === hash(PROMPTS[id].prompt)) continue;  // уже сгенерировано тем же промптом
      console.log(`~ ${id}: промпт изменился с прошлой генерации`);
    }
    kept.push(id);
  }
  ids = kept;
}

const limit = Number(flag('limit', 0)) || 0;
if (limit > 0) ids = ids.slice(0, limit);

if (!ids.length) {
  console.log('нечего генерировать: всё на месте (или фильтры отсекли всё)');
  process.exit(0);
}

console.log(`к генерации: ${ids.length} шт., модель ${MODEL}`);
if (dryRun) {
  for (const id of ids) {
    const p = PROMPTS[id];
    console.log(`\n--- ${id}  [${p.group}/${p.prio}]  ${p.size}\n${p.prompt}`);
  }
  console.log(`\n--dry-run: ничего не вызывалось.`);
  process.exit(0);
}

// ------------------------------------------------- предполётная проверка денег
// Баланс копеечный, а прайс у моделей разный: считаем смету до первого запроса,
// иначе пачка обрывается на середине с пустым кошельком.
const [bal, pricing] = await Promise.all([api('/account/balance'), api('/account/pricing')]);
const balance = bal.ok ? Number(bal.body?.balance_usd) : NaN;
const card = pricing.ok ? (pricing.body?.data || []).find((m) => m.id === MODEL) : null;
const perImage = card?.billing_scheme === 'per_request' ? Number(card.price_usd) : NaN;

if (Number.isFinite(balance)) console.log(`баланс: $${balance.toFixed(4)}`);
else console.warn(`баланс недоступен (HTTP ${bal.status}) — продолжаем вслепую`);

if (Number.isFinite(perImage)) {
  const estimate = perImage * ids.length;
  console.log(`смета: ${ids.length} x $${perImage.toFixed(6)} = $${estimate.toFixed(4)}`);
  if (Number.isFinite(balance) && estimate > balance) {
    const affordable = Math.floor(balance / perImage);
    fail(`на балансе $${balance.toFixed(4)}, хватит на ${affordable} шт. `
      + `Пополните счёт или ограничьте запуск: --limit=${affordable}`);
  }
} else if (card) {
  console.warn(`модель тарифицируется по токенам (${card.unit}) — смету заранее не посчитать`);
}

// ------------------------------------------------------------------ генерация
// Роутер отдаёт ссылку со сроком жизни ~5 часов, поэтому качаем сразу же,
// а расширение берём из сигнатуры файла: приходит и JPEG, и PNG.
const SIGNATURES = [
  ['png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['jpg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['webp', (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP'],
  ['gif', (b) => b.slice(0, 3).toString('latin1') === 'GIF']
];
const extOf = (buf) => (SIGNATURES.find(([, test]) => test(buf)) || ['bin'])[0];

/** Фактические размеры из заголовка: роутер игнорирует запрошенный size, знать надо. */
function dimensions(buf) {
  if (buf.slice(1, 4).toString('latin1') === 'PNG') return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i + 9 < buf.length;) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return `${buf.readUInt16BE(i + 7)}x${buf.readUInt16BE(i + 5)}`;
      }
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

await mkdir(outDir, { recursive: true });

let done = 0, failed = 0, spent = 0;
const resized = new Set();   // модель может вернуть не тот размер, о котором просили
for (const id of ids) {
  const spec = PROMPTS[id];
  process.stdout.write(`${id} [${spec.size}] ... `);
  try {
    const r = await withRetry(id, () => api('/images/generations', {
      method: 'POST',
      body: JSON.stringify({ model: MODEL, prompt: spec.prompt, size: spec.size, n: 1 })
    }));
    if (!r.ok) {
      console.log(`HTTP ${r.status}: ${scrub(JSON.stringify(r.body)).slice(0, 200)}`);
      failed++;
      continue;
    }
    const item = r.body?.data?.[0];
    let bytes;
    if (item?.b64_json) bytes = Buffer.from(item.b64_json, 'base64');
    else if (item?.url) {
      const dl = await withRetry(`${id}: скачивание`, async () => {
        const res = await fetch(item.url);
        return { ok: res.ok, status: res.status, body: res.ok ? Buffer.from(await res.arrayBuffer()) : null };
      });
      if (!dl.ok) {
        console.log(`ссылка не скачалась: HTTP ${dl.status}`);
        failed++;
        continue;
      }
      bytes = dl.body;
    } else {
      console.log('ответ без изображения:', scrub(JSON.stringify(r.body)).slice(0, 200));
      failed++;
      continue;
    }
    const file = `${id}.${extOf(bytes)}`;
    const actual = dimensions(bytes);
    await writeFile(new URL(file, outDir), bytes);
    manifest[id] = {
      file, model: MODEL, size: spec.size, actual, group: spec.group, prio: spec.prio,
      promptHash: hash(spec.prompt), bytes: bytes.length, createdAt: new Date().toISOString()
    };
    if (actual && actual !== spec.size) resized.add(actual);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    if (Number.isFinite(perImage)) spent += perImage;
    console.log(`${file}, ${actual || '?'}, ${(bytes.length / 1024).toFixed(0)} КБ`);
    done++;
  } catch (e) {
    console.log('сбой:', scrub(e.message));
    failed++;
  }
}

console.log(`\nготово: ${done}, с ошибкой: ${failed}. Файлы в art/raw/`);
if (spent) console.log(`потрачено примерно $${spent.toFixed(4)}`);
if (resized.size) {
  console.log(`внимание: модель вернула ${[...resized].join(', ')} вместо запрошенного размера — `
    + `перед сборкой ассеты нужно уменьшить`);
}
if (failed) process.exitCode = 1;
