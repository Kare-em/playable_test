/*
 * Иконки товаров как векторные примитивы: пишутся кодом, рендерятся в PNG.
 * Единая сетка 128×128, плоский стиль, одна мягкая тень, без градиентов —
 * читается на экране 100×100 и легко перекрашивается под сезонные ивенты.
 */

export const PALETTE = {
  ink: '#2E2117',
  shadow: 'rgba(46,33,23,0.20)',
  hi: 'rgba(255,255,255,0.55)'
};

const frame = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
     <ellipse cx="64" cy="114" rx="34" ry="7" fill="${PALETTE.shadow}"/>
     ${body}
   </svg>`;

// у всех иконок общий контур-обводка, чтобы набор выглядел одной семьёй
const S = (d, fill, w = 4) =>
  `<path d="${d}" fill="${fill}" stroke="${PALETTE.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;

export const ICONS = {
  // ---------------------------------------------------------- молочка
  milk: frame(`
    ${S('M40 44 L64 24 L88 44 L88 104 Q88 110 82 110 L46 110 Q40 110 40 104 Z', '#E2EFFC')}
    ${S('M40 44 L64 34 L88 44 L64 54 Z', '#C7E1F8')}
    <rect x="40" y="66" width="48" height="20" fill="#2982E2"/>
    <path d="M40 66 h48 v20 h-48 z" fill="none" stroke="${PALETTE.ink}" stroke-width="4"/>
    <rect x="48" y="72" width="32" height="8" rx="4" fill="#E2EFFC" opacity="0.9"/>
  `),
  cheese: frame(`
    ${S('M26 92 L26 66 L100 42 L100 86 Q100 92 94 92 Z', '#FFC224')}
    ${S('M26 66 L100 42 L100 54 L26 78 Z', '#FFD763')}
    <circle cx="48" cy="80" r="7" fill="#E49C00"/>
    <circle cx="72" cy="72" r="5" fill="#E49C00"/>
    <circle cx="88" cy="82" r="4" fill="#E49C00"/>
  `),
  yogurt: frame(`
    ${S('M54 22 h20 v14 q14 8 14 24 v44 q0 6 -6 6 h-36 q-6 0 -6 -6 v-44 q0 -16 14 -24 z', '#FDF6E4')}
    ${S('M52 26 h24 v-8 h-24 z', '#61B8FF')}
    <rect x="44" y="72" width="40" height="24" rx="6" fill="#EF9EBA"/>
    <path d="M44 72 h40 v24 h-40 z" fill="none" stroke="${PALETTE.ink}" stroke-width="4"/>
    <circle cx="64" cy="84" r="6" fill="#FDF6E4"/>
  `),
  butter: frame(`
    ${S('M30 62 L50 46 h56 L86 62 z', '#FFDF81')}
    ${S('M86 62 L106 46 v30 q0 4 -4 6 L86 98 z', '#FFBA1F')}
    ${S('M30 62 h56 v36 q0 4 -4 4 H34 q-4 0 -4 -4 z', '#FFCB43')}
    <rect x="30" y="72" width="56" height="16" fill="#FDF6E4"/>
    <path d="M30 72 h56 M30 88 h56" stroke="${PALETTE.ink}" stroke-width="4"/>
    <rect x="30" y="78" width="56" height="5" fill="#61B8FF"/>
  `),

  // ---------------------------------------------------------- бакалея
  bread: frame(`
    ${S('M26 92 q-4 -46 38 -46 q42 0 38 46 q0 6 -6 6 h-64 q-6 0 -6 -6 z', '#E07C1E')}
    ${S('M34 66 q10 -14 30 -14 q20 0 30 14', '#F7AE45')}
    <path d="M46 62 l8 12 M64 58 l8 12 M82 62 l6 10" stroke="${PALETTE.ink}" stroke-width="4" stroke-linecap="round" fill="none"/>
  `),
  grain: frame(`
    ${S('M36 44 h56 v52 q0 6 -6 6 h-44 q-6 0 -6 -6 z', '#EDD39B')}
    ${S('M36 44 l12 -14 h32 l12 14 z', '#DDB668')}
    <rect x="48" y="60" width="32" height="26" rx="6" fill="#FFF3D6"/>
    <path d="M48 60 h32 v26 h-32 z" fill="none" stroke="${PALETTE.ink}" stroke-width="4"/>
    <circle cx="58" cy="72" r="3.5" fill="#ECC060"/><circle cx="70" cy="70" r="3.5" fill="#ECC060"/>
    <circle cx="64" cy="80" r="3.5" fill="#ECC060"/>
  `),
  cookie: frame(`
    ${S('M64 26 a38 38 0 1 1 -0.1 0 z', '#D98A2B')}
    <circle cx="50" cy="52" r="6" fill="#764318"/><circle cx="78" cy="46" r="5" fill="#764318"/>
    <circle cx="64" cy="72" r="6" fill="#764318"/><circle cx="44" cy="76" r="5" fill="#764318"/>
    <circle cx="84" cy="74" r="5.5" fill="#764318"/>
  `),
  can: frame(`
    ${S('M36 42 h56 v54 q0 6 -6 6 h-44 q-6 0 -6 -6 z', '#BDC4CC')}
    ${S('M36 42 a28 10 0 0 1 56 0 a28 10 0 0 1 -56 0 z', '#D6DEE6')}
    <rect x="36" y="58" width="56" height="26" fill="#D9371C"/>
    <path d="M36 58 h56 v26 h-56 z" fill="none" stroke="${PALETTE.ink}" stroke-width="4"/>
    <rect x="46" y="66" width="36" height="9" rx="4.5" fill="#FCDDC3" opacity="0.9"/>
  `),

  // ---------------------------------------------------------- овощи-фрукты
  apple: frame(`
    ${S('M64 40 q-26 -6 -30 22 q-4 26 18 42 q12 8 24 0 q22 -16 18 -42 q-4 -28 -30 -22 z', '#FF1E02')}
    ${S('M64 40 q-6 -14 4 -20', '#7A5023', 4)}
    ${S('M66 26 q14 -10 22 0 q-12 10 -22 0 z', '#59AF41')}
    <path d="M48 62 q-6 10 -2 22" stroke="${PALETTE.hi}" stroke-width="6" stroke-linecap="round" fill="none"/>
  `),
  carrot: frame(`
    ${S('M64 110 L44 52 q20 -12 40 0 z', '#FF7D04')}
    <path d="M56 70 h14 M60 84 h12" stroke="${PALETTE.ink}" stroke-width="4" stroke-linecap="round" fill="none"/>
    ${S('M64 50 q-4 -22 -20 -26 q6 18 20 26 z', '#59AF41')}
    ${S('M64 50 q4 -24 22 -26 q-6 18 -22 26 z', '#6FCE4B')}
  `),
  tomato: frame(`
    ${S('M64 44 q30 0 30 30 q0 30 -30 30 q-30 0 -30 -30 q0 -30 30 -30 z', '#F81500')}
    ${S('M64 46 l-16 -10 l6 12 l-14 2 l16 8 M64 46 l16 -10 l-6 12 l14 2 l-16 8', '#49A237', 3)}
    ${S('M64 30 v14', '#7A5023', 4)}
    <path d="M48 66 q-5 9 -2 18" stroke="${PALETTE.hi}" stroke-width="6" stroke-linecap="round" fill="none"/>
  `),
  grape: frame(`
    ${S('M64 32 v10', '#7A5023', 4)}
    ${S('M66 34 q16 -10 24 -2 q-12 10 -24 2 z', '#59AF41')}
    <g stroke="${PALETTE.ink}" stroke-width="4">
      <circle cx="50" cy="56" r="11" fill="#8145C4"/><circle cx="74" cy="54" r="11" fill="#8145C4"/>
      <circle cx="62" cy="72" r="11" fill="#9359D5"/><circle cx="40" cy="76" r="10" fill="#7141AB"/>
      <circle cx="84" cy="74" r="10" fill="#7141AB"/><circle cx="52" cy="92" r="10" fill="#8145C4"/>
      <circle cx="74" cy="92" r="9" fill="#7141AB"/>
    </g>
  `)
};

export const ORDER = ['milk','cheese','yogurt','butter','bread','grain','cookie','can','apple','carrot','tomato','grape'];
