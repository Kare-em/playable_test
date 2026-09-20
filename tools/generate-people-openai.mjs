/*
 * Генерация изображений персонажей через OpenAI Images API.
 *
 * Примеры:
 *   OPENAI_API_KEY=... node tools/generate-people-openai.mjs
 *   OPENAI_API_KEY=... node tools/generate-people-openai.mjs --count=6 --style="pixel art" --size=1024x1024
 *   OPENAI_API_KEY=... node tools/generate-people-openai.mjs --out=prototype/assets/people
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ARCHETYPES = [
  'доброжелательная продавщица у дома, 30 лет',
  'студент с рюкзаком, спешит после пар',
  'офисный сотрудник в мятой рубашке после работы',
  'пожилая соседка в ярком платке с корзиной',
  'курьер в ветровке с термосумкой',
  'молодая мама с детской коляской',
  'спортсмен после пробежки в худи',
  'музыкант с наушниками и чехлом для гитары',
  'школьница с косичками и значками на рюкзаке',
  'повар из соседнего кафе в рабочей форме',
  'автомеханик в рабочем комбинезоне',
  'дизайнерка с планшетом и цветными аксессуарами'
];

function getArg(name, fallback) {
  const key = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(key));
  return found ? found.slice(key.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (hasFlag('help')) {
  console.log(`Использование:\n  OPENAI_API_KEY=... node tools/generate-people-openai.mjs [--count=10] [--style="semi-realistic mobile game art"] [--size=1024x1024] [--out=prototype/assets/people] [--theme="магазин у дома"] [--model=gpt-image-1]`);
  process.exit(0);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  fail('Не найден OPENAI_API_KEY. Установи переменную окружения и запусти снова.');
}

const model = getArg('model', 'gpt-image-1');
const style = getArg('style', 'semi-realistic mobile game art, clear silhouette, bright colors');
const theme = getArg('theme', 'персонаж для казуальной мобильной игры про магазин у дома');
const size = getArg('size', '1024x1024');
const count = Number(getArg('count', '10'));
if (!Number.isInteger(count) || count < 1 || count > 20) {
  fail('Параметр --count должен быть целым числом от 1 до 20.');
}

const root = new URL('../', import.meta.url);
const outArg = getArg('out', 'prototype/assets/people');
const outDir = path.isAbsolute(outArg)
  ? outArg
  : path.resolve(new URL('.', root).pathname, outArg);
await mkdir(outDir, { recursive: true });

const selected = Array.from({ length: count }, (_, i) => DEFAULT_ARCHETYPES[i % DEFAULT_ARCHETYPES.length]);

console.log(`Генерируем ${count} изображений в ${outDir}`);

for (let i = 0; i < selected.length; i += 1) {
  const archetype = selected[i];
  const prompt = [
    `${theme}.`,
    `Типаж: ${archetype}.`,
    `Стиль: ${style}.`,
    'Один персонаж по пояс, фронтально, чистый фон, без текста и логотипов.'
  ].join(' ');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      prompt,
      size
    })
  });

  if (!response.ok) {
    const details = await response.text();
    fail(`Ошибка API (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) {
    fail('API не вернул data[0].b64_json.');
  }

  const fileName = `person-${String(i + 1).padStart(2, '0')}.png`;
  const filePath = path.join(outDir, fileName);
  await writeFile(filePath, Buffer.from(b64, 'base64'));
  console.log(`✅ ${fileName} (${archetype})`);
}

console.log('Готово.');
