/*
 * Промпты для генерации растрового арта — исходник, как и векторные иконки.
 * Правится диффом, а не перезаливкой бинарей. Список ассетов: docs/art-assets.md
 *
 * Стиль задаётся один раз в STYLE и подмешивается в каждый промпт: генераторы
 * плохо держат единый вид на серии, общая преамбула — главная защита от разъезда.
 */

// Полуреалистичный стиль «уютного казуала»: объём и настоящие материалы при
// дружелюбных, чуть утрированных пропорциях. Палитра по-прежнему держится за
// кремовый фон из art/products.mjs, иначе растр не сядет рядом с вектором.
// Общая часть: чем и как нарисовано. Не говорит ни слова о композиции,
// потому что у предмета и у фона она противоположная.
const RENDER = [
  'semi-realistic stylised illustration for a premium cosy casual mobile game',
  'soft three-dimensional volume: painterly shading, gentle gradients, believable materials — '
    + 'glass, tin, paper, fabric, worn wood',
  'slightly cartoonish proportions: friendly and a touch exaggerated, warm and appealing, never photographic'
];

const NO_TEXT = 'NO text, NO letters, NO numbers, NO logos, NO watermark, NO UI elements';

// Композиция предмета: один объект в центре, чистый силуэт, кремовое поле.
export const STYLE = [
  ...RENDER,
  'instantly recognisable subject with true-to-life details and honest colours, '
    + 'so it reads at a glance at small size',
  'warm soft lighting from the upper left, gentle contact shadow grounding the subject',
  // Хекс-код из промпта убран намеренно: на interior-shop3-s0 модель
  // напечатала «#F3E7D3» прямо в кадре как подпись. Цвет описан словами.
  'warm palette on a plain pale cream background, the soft warm off-white of unbleached paper',
  'crisp readable silhouette, centred subject, clean edges without a drawn ink outline',
  'no harsh specular glare, no lens flare, no depth-of-field blur on the subject',
  NO_TEXT
].join(', ');

// Композиция фона — ровно обратная, и раньше её не было вовсе: фоны собирались
// на STYLE и модель послушно рисовала «центрированный субъект с читаемым
// силуэтом», то есть стеллаж посреди кремового поля вместо фона во весь кадр.
export const STYLE_BACKDROP = [
  ...RENDER,
  'this is a BACKGROUND PLATE, not an object study: there is no single subject and nothing is centred',
  'the artwork bleeds to all four edges and fills the entire frame — no framed panel, no rounded corners, '
    + 'no border, no vignette, no margin and no empty field around the artwork',
  'everything is softly out of focus, reduced to gentle shapes and warm colour, so that interface panels '
    + 'placed on top stay readable',
  'warm soft ambient light, low contrast, muted warm palette',
  NO_TEXT
].join(', ');

const CUTOUT = 'isolated subject on plain flat background, wide empty margin around the subject';

// Интерфейсные знаки — пузырь эмоции и реакции в нём. Рисуются тем же
// материалом, что и остальной арт (RENDER), но композиция другая: это не
// предмет на полке, а значок, который живёт размером с ноготь. Поэтому
// силуэт грубее, контур толще, деталей меньше — иначе на 30 пикселях
// превращается в кашу.
export const STYLE_UI = [
  ...RENDER,
  'this is a chunky game UI symbol, not an object study: one bold simple shape, '
    + 'thick soft dark outline, strong flat colour with a single soft highlight',
  'must stay readable at the size of a thumbnail, so no fine detail, no thin lines, no texture noise',
  'warm soft lighting from the upper left',
  'plain pale cream background, the soft warm off-white of unbleached paper',
  'no drop shadow and no contact shadow on the background',
  // из общего запрета убран «NO UI elements»: здесь знак интерфейса и есть
  // предмет заказа, и запрет спорил бы сам с собой
  NO_TEXT.replace(', NO UI elements', '')
].join(', ');

// Порядок важен: нарезка отдаёт предметы слева направо, и по нему же
// раскладываются id. Пузырь идёт первым и остаётся пустым — реакции
// вкладываются в него уже на сборке, по измеренной полости.
export const BUBBLE_PARTS = [
  ['bubble', 'an EMPTY rounded speech balloon, almost circular, with a short tail at the bottom. '
    + 'Its inside is a single flat creamy white field and is COMPLETELY EMPTY — absolutely nothing is '
    + 'drawn, written or placed inside the balloon. Thick warm dark brown outline around it'],
  ['cheer', 'a single glossy red heart, plump and rounded, one soft white highlight'],
  ['angry', 'a bright red anger vein symbol: one connected cross-shaped mark of four thick joined '
    + 'strokes, the classic comic anger sign, drawn as a single solid shape'],
  ['worry', 'a single glossy light blue sweat drop, rounded at the bottom and pointed at the top, '
    + 'one soft white highlight']
];

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
const addBackdrop = (id, prompt, size, group, prio) => {
  PROMPTS[id] = { prompt: `${STYLE_BACKDROP}. ${prompt}`, size, group, prio };
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
  addBackdrop(`bg-${sid}`,
    `the out-of-focus interior of a ${shop}: shelves, walls and warm lamp light dissolved into soft shapes, `
    + `no people, no readable packaging. Tall vertical composition for a phone screen, `
    + `filling the whole frame from edge to edge.`,
    '1024x1536', 'background', 'P1');
}
// ------------------------------------------------------------------- товары
// A1: иконки товара на полке. Живут на сетке ~100x100, поэтому предмет строго
// один, анфас и с запасом по краям — иначе в слоте стеллажа выйдет пятно.
// Тень на фоне запрещена отдельно: фон потом выбивается в прозрачность,
// и лежащая на нём тень оставила бы грязный ореол по контуру.
export const GOODS = {
  milk: 'tall gable-top paper carton of milk, white with a blue band',
  cheese: 'wedge of firm yellow cheese with a few round holes and a natural rind',
  yogurt: 'small plastic yogurt cup with a foil lid and a berry-coloured wrapper',
  butter: 'rectangular block of butter, half wrapped in printed foil paper',
  curd: 'brick of Russian tvorog curd in a simple folded paper wrapper',
  sourcream: 'small round plastic tub of sour cream with a green lid, completely blank unbranded packaging with no writing, no lettering and no logo anywhere on it',
  kefir: 'plastic bottle of kefir, white drink behind a paper label, green cap',
  icecream: 'ice cream in a waffle cup with a paper sleeve, soft white swirl on top',
  bread: 'loaf of bread with a glossy golden crust and slashed top',
  grain: 'paper bag of buckwheat groats with a clear window showing the grain',
  cookie: 'round butter biscuit with chocolate chips and a crumbly edge',
  can: 'tin can of preserves with a plain paper label and a ring pull',
  pasta: 'clear plastic packet of pasta with the dry penne visible through it',
  tea: 'small cardboard box of black tea with a modest leaf motif',
  coffee: 'glass jar of instant coffee with a metal screw lid',
  sugar: 'paper bag of sugar with a folded top and a few crystals spilled at the base',
  apple: 'glossy red apple with a short stem and one green leaf',
  carrot: 'fresh orange carrot with bright green tops',
  tomato: 'ripe red tomato with a green calyx and a soft highlight',
  grape: 'bunch of dark purple grapes with one green leaf',
  banana: 'bunch of three ripe yellow bananas joined at the stem',
  cucumber: 'fresh green cucumber with slightly bumpy skin',
  potato: 'raw potato with earthy brown skin and shallow eyes',
  lemon: 'bright yellow lemon with a textured peel and one green leaf',
  sausage: 'stick of smoked sausage with a tied end and a paper band',
  chicken: 'plump whole raw chicken with pale skin',
  steak: 'thick raw beef steak with visible marbling',
  wieners: 'pair of pink wieners linked at one end',
  mince: 'portion of raw minced meat on a small foam tray under clear film',
  fish: 'whole fresh fish with silver scales and a single fin raised',
  soap: 'bar of soap with a pressed pattern, partly in a paper wrapper',
  powder: 'cardboard box of laundry powder with a simple colour band',
  spray: 'plastic spray bottle of cleaner with a trigger head',
  sponge: 'kitchen sponge, yellow with a green scouring side',
  paper: 'roll of toilet paper, white, with the end slightly unrolled',
  gloves: 'pair of yellow rubber household gloves'
};
for (const [id, what] of Object.entries(GOODS)) {
  add(`product-${id}`,
    `a single ${what}, one object only, upright, straight-on front view, filling most of the frame. `
    + `${CUTOUT}. The background is a perfectly uniform flat cream field with no gradient, no vignette `
    + `and no pattern. NO drop shadow and NO contact shadow anywhere on the background — the object does `
    + `not touch or darken the background.`,
    '1024x1024', 'product', 'P0');
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
