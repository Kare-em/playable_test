/*
 * Генерация растрового арта через image-API (OpenAI-совместимый эндпоинт).
 *
 *   IMAGE_API_KEY=sk-...  \
 *   IMAGE_API_BASE=https://europe-api.nordrouter.com/v1 \
 *   IMAGE_MODEL=<id из --list-models> \
 *   node tools/gen-art.mjs --prio=P0
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
 * Результат: art/raw/<id>.png + art/raw/manifest.json (промпт, модель, хэш).
 * Ключ берётся только из окружения и никогда не пишется в файлы и логи.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PROMPTS, ORDER } from '../art/prompts.mjs';

const BASE = (process.env.IMAGE_API_BASE || '').replace(/\/+$/, '');
const KEY = process.env.IMAGE_API_KEY || '';
const MODEL = process.env.IMAGE_MODEL || '';

const flag = (name, def = null) => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
};

const dryRun = !!flag('dry-run');
const outDir = new URL('../art/raw/', import.meta.url);
const manifestPath = new URL('manifest.json', outDir);

if (!BASE && !dryRun) fail('не задан IMAGE_API_BASE');
if (!KEY && !dryRun) fail('не задан IMAGE_API_KEY');

function fail(msg) {
  console.error('ОШИБКА:', msg);
  process.exit(1);
}

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

const manifest = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => ({}));
const force = !!flag('force');
const exists = async (p) => access(p).then(() => true, () => false);

if (!force) {
  const kept = [];
  for (const id of ids) {
    if (await exists(new URL(id + '.png', outDir))) {
      const same = manifest[id]?.promptHash === hash(PROMPTS[id].prompt);
      if (same) continue;                       // уже сгенерировано тем же промптом
      console.log(`~ ${id}: промпт изменился с прошлой генерации`);
    }
    kept.push(id);
  }
  ids = kept;
}

const limit = Number(flag('limit', 0)) || 0;
if (limit > 0) ids = ids.slice(0, limit);

function hash(s) { return createHash('sha256').update(s).digest('hex').slice(0, 16); }

if (!ids.length) {
  console.log('нечего генерировать: всё на месте (или фильтры отсекли всё)');
  process.exit(0);
}

console.log(`к генерации: ${ids.length} шт.`);
if (dryRun) {
  for (const id of ids) {
    const p = PROMPTS[id];
    console.log(`\n--- ${id}  [${p.group}/${p.prio}]  ${p.size}\n${p.prompt}`);
  }
  console.log(`\n--dry-run: ничего не вызывалось.`);
  process.exit(0);
}

if (!MODEL) fail('не задан IMAGE_MODEL (посмотрите список: node tools/gen-art.mjs --list-models)');

// ------------------------------------------------- предполётная проверка денег
const bal = await api('/account/balance');
if (bal.ok) console.log('баланс:', JSON.stringify(bal.body));
else console.warn(`баланс недоступен (HTTP ${bal.status}) — продолжаем`);

await mkdir(outDir, { recursive: true });

let done = 0, failed = 0;
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
    else if (item?.url) bytes = Buffer.from(await (await fetch(item.url)).arrayBuffer());
    else {
      console.log('ответ без изображения:', scrub(JSON.stringify(r.body)).slice(0, 200));
      failed++;
      continue;
    }
    await writeFile(new URL(id + '.png', outDir), bytes);
    manifest[id] = {
      model: MODEL, size: spec.size, group: spec.group, prio: spec.prio,
      promptHash: hash(spec.prompt), bytes: bytes.length, createdAt: new Date().toISOString()
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`${(bytes.length / 1024).toFixed(0)} КБ`);
    done++;
  } catch (e) {
    console.log('сбой:', scrub(e.message));
    failed++;
  }
}

console.log(`\nготово: ${done}, с ошибкой: ${failed}. Файлы в art/raw/`);
if (failed) process.exitCode = 1;
