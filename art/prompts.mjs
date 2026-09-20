/*
 * Промпты для генерации растрового арта — исходник, как и векторные иконки.
 * Правится диффом, а не перезаливкой бинарей. Список ассетов: docs/art-assets.md
 *
 * Стиль задаётся один раз в STYLE и подмешивается в каждый промпт: генераторы
 * плохо держат единый вид на серии, общая преамбула — главная защита от разъезда.
 */

// палитра совпадает с art/products.mjs, иначе растр не сядет на вектор
export const STYLE = [
  'flat 2D cartoon vector illustration for a cozy mobile casual game',
  'warm palette: cream background #F3E7D3, dark brown ink outline #4A3B2A',
  'uniform bold outline on every shape, one soft elliptical ground shadow',
  'no gradients, no photorealism, no 3D render, no lens effects',
  'clean readable silhouette, centered subject',
  'NO text, NO letters, NO numbers, NO logos, NO watermark, NO UI elements'
].join(', ');

const CUTOUT = 'isolated subject on plain flat background, wide empty margin around the subject';

// ---------------------------------------------------------------- персонажи
// 10 постоянных покупателей из концепта (docs/game-concept-shop-sort.md, §5)
const CUSTOMERS = {
  granny: 'elderly Russian grandmother in a headscarf with a string shopping bag, kind wrinkled face',
  courier: 'young delivery courier with a large square thermal backpack, cap, cheerful',
  schoolboy: 'schoolboy about ten years old with a backpack, counting coins in his palm',
  mom: 'young mother in a light coat pushing a stroller, tired but warm smile',
  taxi: 'middle-aged taxi driver in a windbreaker holding car keys, stocky build',
  dacha: 'sturdy man in a bucket hat and rubber boots with a bucket of vegetables',
  student: 'female student with headphones and a tote bag, hoodie, energetic',
  pensioner: 'retired man in a flat cap and cardigan, reading glasses, patient look',
  handyman: 'repairman in work overalls with a toolbox, dusty and friendly',
  neighbor: 'chatty middle-aged neighbour woman in a home cardigan, expressive hands'
};

// ------------------------------------------------------------------ магазин
const SHOPS = {
  shop1: 'tiny corner grocery shop in a Russian apartment block',
  shop2: 'small kiosk next to a railway station',
  shop3: 'mini-market with several aisles',
  shop4: 'bright modern supermarket'
};
const STAGES = [
  'shabby and run down, peeling paint, dim light, empty shelves',
  'half renovated, fresh paint on one wall, new fridge, shelves partly stocked',
  'fully renovated, warm light, full shelves, neat signage area left blank'
];

const UPGRADES = {
  fridge: 'glass-door refrigerator display case',
  display: 'counter display showcase',
  register: 'cash register desk',
  sign: 'blank shop signboard bracket, sign plate left empty'
};
const LEVELS = ['old and worn', 'refurbished mid tier', 'modern premium'];

// ------------------------------------------------------------------- сборка
/** @type {Record<string,{prompt:string,size:string,group:string,prio:string}>} */
export const PROMPTS = {};

const add = (id, prompt, size, group, prio) => {
  PROMPTS[id] = { prompt: `${STYLE}. ${prompt}`, size, group, prio };
};

// B1 — бюсты покупателей для баббла заказа
for (const [id, who] of Object.entries(CUSTOMERS)) {
  add(`bust-${id}`, `head and shoulders portrait of ${who}, facing the viewer. ${CUTOUT}`,
    '1024x1024', 'character', ['granny', 'courier', 'schoolboy'].includes(id) ? 'P0' : 'P1');
}
// B2 — полный рост для очереди
for (const [id, who] of Object.entries(CUSTOMERS)) {
  add(`full-${id}`, `full body standing pose of ${who}, waiting in a queue, slight three-quarter view. ${CUTOUT}`,
    '1024x1536', 'character', 'P1');
}
// C1 — интерьеры точек по стадиям ремонта
for (const [sid, shop] of Object.entries(SHOPS)) {
  STAGES.forEach((stage, i) => {
    add(`interior-${sid}-s${i}`,
      `interior of a ${shop}, ${stage}, viewed straight on from the customer side, shelves and counter visible, no people`,
      '1024x1024', 'interior', sid === 'shop1' && i === 0 ? 'P0' : 'P1');
  });
}
// C2 — апгрейды поверх интерьера
for (const [uid, thing] of Object.entries(UPGRADES)) {
  LEVELS.forEach((lvl, i) => {
    add(`upgrade-${uid}-l${i}`, `single ${thing}, ${lvl}, three-quarter view, standalone object. ${CUTOUT}`,
      '1024x1024', 'interior', 'P1');
  });
}
// A9 — фоны игрового экрана
for (const [sid, shop] of Object.entries(SHOPS)) {
  add(`bg-${sid}`, `blurred cozy background of a ${shop} seen behind a shelf, soft depth, no people, vertical composition`,
    '1024x1536', 'background', 'P1');
}
// D5 — иконки IAP-паков
add('iap-starter', 'gift box overflowing with coins and three booster jars, celebratory', '1024x1024', 'ui', 'P1');
add('iap-noads', 'crossed-out television screen icon on a shield, friendly not aggressive', '1024x1024', 'ui', 'P1');
add('iap-pass', 'seasonal pass ticket with a delivery truck motif', '1024x1024', 'ui', 'P1');
add('iap-coins', 'pile of golden coins spilling from a paper shopping bag', '1024x1024', 'ui', 'P1');
// D6 / E — промо
add('loading-screen', 'cozy corner shop storefront at golden hour, vertical composition, empty space at the top for a logo', '1024x1536', 'promo', 'P1');
add('game-icon', 'friendly corner shop storefront with an awning, bold simple shapes, square composition readable at small size', '1024x1024', 'promo', 'P1');
add('cover', 'corner shop storefront with a few happy customers, wide composition', '1536x1024', 'promo', 'P1');

export const ORDER = Object.keys(PROMPTS);
