/*
 * Иконки товаров как векторные примитивы: пишутся кодом, рендерятся в PNG.
 * Единая сетка 128×128, объёмная подача — градиентная заливка, собственная
 * тень и блик, — но силуэт остаётся читаемым на экране 100×100.
 * Растеризуются вдвое крупнее сетки: на телефоне с DPR 2 текстура не мылится.
 */

export const PALETTE = {
  ink: '#2E2117',
  shadow: 'rgba(46,33,23,0.20)',
  hi: 'rgba(255,255,255,0.55)'
};

const RENDER = 256;                       // во сколько пикселей растеризуем сетку 128

// градиенты: направление задаётся парой точек, по умолчанию сверху вниз
const lin = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
  stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('') +
  `</linearGradient>`;

// радиальный со смещённым центром — это и есть источник света на объёмных формах
const rad = (id, stops, cx = 0.36, cy = 0.28, r = 0.78) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">` +
  stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('') +
  `</radialGradient>`;

const frame = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${RENDER}" height="${RENDER}">
     <defs>
       <radialGradient id="ground" cx="0.5" cy="0.5" r="0.5">
         <stop offset="0" stop-color="#2E2117" stop-opacity="0.30"/>
         <stop offset="0.65" stop-color="#2E2117" stop-opacity="0.12"/>
         <stop offset="1" stop-color="#2E2117" stop-opacity="0"/>
       </radialGradient>
       ${defs}
     </defs>
     <ellipse cx="64" cy="115" rx="37" ry="9" fill="url(#ground)"/>
     ${body}
   </svg>`;

// у всех иконок общий контур-обводка, чтобы набор выглядел одной семьёй
const S = (d, fill, w = 4) =>
  `<path d="${d}" fill="${fill}" stroke="${PALETTE.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;

// собственная тень и блик кладутся поверх заливки, но внутри силуэта
const dark = (d, a = 0.14) => `<path d="${d}" fill="rgba(46,33,23,${a})"/>`;
const glow = (d, a = 0.55, w = 6) =>
  `<path d="${d}" fill="none" stroke="rgba(255,255,255,${a})" stroke-width="${w}" stroke-linecap="round"/>`;

export const ICONS = {
  // ---------------------------------------------------------- молочка
  milk: frame(
    lin('milkBody', [[0, '#FFFFFF'], [0.42, '#E8F2FD'], [1, '#B9D5F0']]) +
    lin('milkTop', [[0, '#E6F1FC'], [1, '#A9C8E8']]) +
    lin('milkLabel', [[0, '#4FA3F5'], [1, '#155FB8']]), `
    ${S('M40 44 L64 24 L88 44 L88 104 Q88 110 82 110 L46 110 Q40 110 40 104 Z', 'url(#milkBody)')}
    ${dark('M76 46 L88 46 L88 104 Q88 110 82 110 L76 110 Z', 0.12)}
    ${S('M40 44 L64 34 L88 44 L64 54 Z', 'url(#milkTop)')}
    <path d="M64 24 L64 54" stroke="${PALETTE.ink}" stroke-width="2.5" opacity="0.45" fill="none"/>
    <rect x="40" y="66" width="48" height="23" fill="url(#milkLabel)"/>
    <path d="M40 66 h48 v23 h-48 z" fill="none" stroke="${PALETTE.ink}" stroke-width="4"/>
    <rect x="47" y="72" width="34" height="9" rx="4.5" fill="#F2F8FE" opacity="0.92"/>
    ${glow('M48 52 q-3 26 -1 52', 0.7, 6)}
  `),

  cheese: frame(
    lin('cheeseFace', [[0, '#FFDA6B'], [1, '#EFA004']]) +
    lin('cheeseTop', [[0, '#FFEFB0'], [1, '#FFC93C']]), `
    ${S('M26 92 L26 66 L100 42 L100 86 Q100 92 94 92 Z', 'url(#cheeseFace)')}
    ${dark('M86 88 L86 46 L100 42 L100 86 Q100 92 94 92 Z', 0.1)}
    ${S('M26 66 L100 42 L100 54 L26 78 Z', 'url(#cheeseTop)')}
    <ellipse cx="48" cy="81" rx="7.5" ry="6.5" fill="#D98A00"/>
    <ellipse cx="48" cy="79.5" rx="5.5" ry="3.6" fill="#A96700" opacity="0.5"/>
    <ellipse cx="73" cy="72" rx="5.5" ry="4.8" fill="#D98A00"/>
    <ellipse cx="73" cy="70.8" rx="4" ry="2.6" fill="#A96700" opacity="0.5"/>
    <ellipse cx="89" cy="80" rx="4.2" ry="3.8" fill="#D98A00"/>
    ${glow('M32 72 L92 52', 0.3, 4)}
  `),

  yogurt: frame(
    lin('yoBody', [[0, '#FFFFFF'], [0.55, '#FBF4E6'], [1, '#DDCFB4']]) +
    lin('yoLid', [[0, '#F6F9FC'], [0.45, '#BFCAD4'], [1, '#EEF3F8']], 0, 0, 1, 0) +
    lin('yoLabel', [[0, '#FF8FBC'], [1, '#D42E6E']]), `
    ${S('M44 44 L84 44 L79 104 Q78 110 72 110 L56 110 Q50 110 49 104 Z', 'url(#yoBody)')}
    ${dark('M72 45 L84 44 L79 104 Q78 110 72 110 L68 110 Z', 0.12)}
    ${S('M40 34 h48 v10 h-48 z', 'url(#yoLid)')}
    <path d="M40 39 h48" stroke="${PALETTE.ink}" stroke-width="2" opacity="0.3" fill="none"/>
    <path d="M52 62 h26 l-2 26 h-22 z" fill="url(#yoLabel)"/>
    <path d="M52 62 h26 l-2 26 h-22 z" fill="none" stroke="${PALETTE.ink}" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="65" cy="75" r="6" fill="#FFF0F5"/>
    <circle cx="65" cy="75" r="3" fill="#E0457C"/>
    ${glow('M53 52 q-2 25 -1 50', 0.6, 5)}
  `),

  butter: frame(
    lin('butFront', [[0, '#FFDC77'], [1, '#EFA713']]) +
    lin('butTop', [[0, '#FFF0B8'], [1, '#FFCE52']]) +
    lin('butSide', [[0, '#E9A520'], [1, '#C77F05']]) +
    lin('butPaper', [[0, '#FFFFFF'], [1, '#E4DCC8']]), `
    ${S('M30 62 L50 46 h56 L86 62 z', 'url(#butTop)')}
    ${S('M86 62 L106 46 v30 q0 4 -4 6 L86 98 z', 'url(#butSide)')}
    ${S('M30 62 h56 v36 q0 4 -4 4 H34 q-4 0 -4 -4 z', 'url(#butFront)')}
    <rect x="30" y="70" width="56" height="18" fill="url(#butPaper)"/>
    <path d="M30 70 h56 M30 88 h56" stroke="${PALETTE.ink}" stroke-width="3.5" fill="none"/>
    <rect x="30" y="76" width="56" height="6" fill="#4FA3F5"/>
    <rect x="30" y="76" width="56" height="2.5" fill="#8CC6FF" opacity="0.85"/>
    ${glow('M37 66 L37 96', 0.35, 4)}
  `),

  // ---------------------------------------------------------- бакалея
  bread: frame(
    lin('breadCrust', [[0, '#E89A45'], [0.55, '#CE7A22'], [1, '#A25811']]) +
    lin('breadTop', [[0, '#FFD79B'], [1, '#EDA957']]), `
    ${S('M26 92 q-4 -46 38 -46 q42 0 38 46 q0 6 -6 6 h-64 q-6 0 -6 -6 z', 'url(#breadCrust)')}
    ${dark('M84 56 q14 12 12 36 q0 6 -6 6 h-12 q10 -24 6 -42 z', 0.12)}
    ${S('M34 66 q10 -14 30 -14 q20 0 30 14', 'url(#breadTop)')}
    <path d="M46 62 l8 12 M64 58 l8 12 M82 62 l6 10" stroke="${PALETTE.ink}" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M48 60 l8 12 M66 56 l8 12" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-linecap="round" fill="none"/>
    ${glow('M40 78 q-2 10 0 18', 0.3, 5)}
  `),

  grain: frame(
    lin('grainBag', [[0, '#F6E3B6'], [0.6, '#E7CE92'], [1, '#C9A85F']]) +
    lin('grainFold', [[0, '#E2C48A'], [1, '#BC9A55']]) +
    lin('grainWin', [[0, '#FFF9EA'], [1, '#F0DFB8']]), `
    ${S('M36 44 h56 v52 q0 6 -6 6 h-44 q-6 0 -6 -6 z', 'url(#grainBag)')}
    ${dark('M78 46 h14 v50 q0 6 -6 6 h-10 z', 0.12)}
    ${S('M36 44 l12 -14 h32 l12 14 z', 'url(#grainFold)')}
    <path d="M48 30 l-4 14 M80 30 l4 14" stroke="${PALETTE.ink}" stroke-width="2.5" opacity="0.4" fill="none"/>
    <rect x="48" y="60" width="32" height="28" rx="6" fill="url(#grainWin)"/>
    <path d="M48 60 h32 v28 h-32 z" fill="none" stroke="${PALETTE.ink}" stroke-width="3.5"/>
    <ellipse cx="58" cy="72" rx="4" ry="2.8" fill="#D9B96E" transform="rotate(-18 58 72)"/>
    <ellipse cx="70" cy="70" rx="4" ry="2.8" fill="#D9B96E" transform="rotate(14 70 70)"/>
    <ellipse cx="64" cy="81" rx="4" ry="2.8" fill="#C9A655" transform="rotate(-6 64 81)"/>
    ${glow('M42 58 q-2 18 0 34', 0.3, 4)}
  `),

  cookie: frame(
    rad('cookieDough', [[0, '#F0B76A'], [0.6, '#D9902F'], [1, '#A8641A']]) , `
    ${S('M64 26 a38 38 0 1 1 -0.1 0 z', 'url(#cookieDough)')}
    ${dark('M64 102 a38 38 0 0 0 36 -50 q6 34 -20 46 z', 0.12)}
    <circle cx="50" cy="52" r="6.5" fill="#5A3212"/>
    <circle cx="48.5" cy="50" r="2.6" fill="#8A5326" opacity="0.9"/>
    <circle cx="78" cy="46" r="5.5" fill="#5A3212"/>
    <circle cx="76.8" cy="44.5" r="2.2" fill="#8A5326" opacity="0.9"/>
    <circle cx="64" cy="72" r="6.5" fill="#5A3212"/>
    <circle cx="62.6" cy="70" r="2.6" fill="#8A5326" opacity="0.9"/>
    <circle cx="44" cy="76" r="5.5" fill="#5A3212"/>
    <circle cx="84" cy="74" r="6" fill="#5A3212"/>
    <circle cx="58" cy="38" r="2" fill="#B07B36" opacity="0.8"/>
    <circle cx="90" cy="60" r="2" fill="#B07B36" opacity="0.8"/>
    <circle cx="52" cy="90" r="2.2" fill="#B07B36" opacity="0.8"/>
    ${glow('M40 46 q6 -10 16 -14', 0.4, 5)}
  `),

  can: frame(
    lin('canMetal', [[0, '#F4F7F9'], [0.28, '#C3CCD3'], [0.52, '#9BA6AE'], [0.78, '#D2DAE0'], [1, '#8E999F']], 0, 0, 1, 0) +
    lin('canLid', [[0, '#EFF3F6'], [0.5, '#B9C3CA'], [1, '#E6ECF0']], 0, 0, 1, 0) +
    lin('canLabel', [[0, '#F0644A'], [0.5, '#D02E18'], [1, '#9C1B0C']], 0, 0, 1, 0), `
    ${S('M36 42 h56 v54 q0 6 -6 6 h-44 q-6 0 -6 -6 z', 'url(#canMetal)')}
    ${S('M36 42 a28 10 0 0 1 56 0 a28 10 0 0 1 -56 0 z', 'url(#canLid)')}
    <ellipse cx="64" cy="42" rx="19" ry="6" fill="none" stroke="${PALETTE.ink}" stroke-width="2.5" opacity="0.35"/>
    <rect x="36" y="58" width="56" height="28" fill="url(#canLabel)"/>
    <path d="M36 58 h56 v28 h-56 z" fill="none" stroke="${PALETTE.ink}" stroke-width="4"/>
    <rect x="46" y="64" width="36" height="8" rx="4" fill="#FFF0E6" opacity="0.92"/>
    <rect x="50" y="76" width="28" height="4" rx="2" fill="#FFD9C8" opacity="0.7"/>
    ${glow('M44 48 L44 96', 0.45, 5)}
  `),

  // ---------------------------------------------------------- овощи
  apple: frame(
    rad('appleBody', [[0, '#FF7A5C'], [0.45, '#E03A22'], [1, '#97180E']], 0.34, 0.26, 0.82) +
    lin('appleLeaf', [[0, '#8FD06A'], [1, '#3F8B33']]) +
    lin('appleStem', [[0, '#8C6239'], [1, '#5A3B1E']]), `
    ${S('M64 40 q-26 -6 -30 22 q-4 26 18 42 q12 8 24 0 q22 -16 18 -42 q-4 -28 -30 -22 z', 'url(#appleBody)')}
    ${dark('M84 52 q10 24 -8 44 q-6 5 -12 6 q22 -18 20 -50 z', 0.16)}
    ${S('M64 40 q-6 -14 4 -20', 'url(#appleStem)', 4)}
    ${S('M66 26 q14 -10 22 0 q-12 10 -22 0 z', 'url(#appleLeaf)')}
    <path d="M70 27 q8 -3 14 1" stroke="rgba(255,255,255,0.4)" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${glow('M48 62 q-6 10 -2 22', 0.6, 7)}
    <ellipse cx="52" cy="54" rx="6" ry="4" fill="rgba(255,255,255,0.5)" transform="rotate(-32 52 54)"/>
  `),

  carrot: frame(
    lin('carrotBody', [[0, '#FFA83A'], [0.55, '#EE7B12'], [1, '#C25405']]) +
    lin('carrotTopA', [[0, '#8AD063'], [1, '#3E8B34']]) +
    lin('carrotTopB', [[0, '#A6DE7E'], [1, '#54A03F']]), `
    ${S('M64 110 L44 52 q20 -12 40 0 z', 'url(#carrotBody)')}
    ${dark('M72 56 q8 26 -8 54 L64 110 q14 -30 8 -54 z', 0.16)}
    <path d="M55 70 h14 M59 84 h12 M62 96 h6" stroke="${PALETTE.ink}" stroke-width="3.5" stroke-linecap="round" fill="none" opacity="0.75"/>
    ${S('M64 50 q-4 -22 -20 -26 q6 18 20 26 z', 'url(#carrotTopA)')}
    ${S('M64 50 q4 -24 22 -26 q-6 18 -22 26 z', 'url(#carrotTopB)')}
    ${S('M64 50 q-2 -18 2 -26 q6 16 -2 26 z', 'url(#carrotTopA)', 3)}
    ${glow('M52 60 q-2 12 2 22', 0.4, 4)}
  `),

  tomato: frame(
    rad('tomatoBody', [[0, '#FF7050'], [0.45, '#DE2E1F'], [1, '#941308']], 0.34, 0.3, 0.8) +
    lin('tomatoLeaf', [[0, '#7CC45E'], [1, '#347D2C']]) +
    lin('tomatoStem', [[0, '#8C6239'], [1, '#5A3B1E']]), `
    ${S('M64 44 q30 0 30 30 q0 30 -30 30 q-30 0 -30 -30 q0 -30 30 -30 z', 'url(#tomatoBody)')}
    ${dark('M86 54 q8 10 8 20 q0 30 -30 30 q-6 0 -11 -2 q33 -6 33 -48 z', 0.16)}
    ${S('M64 46 l-16 -10 l6 12 l-14 2 l16 8 M64 46 l16 -10 l-6 12 l14 2 l-16 8', 'url(#tomatoLeaf)')}
    ${S('M64 30 v14', 'url(#tomatoStem)', 4)}
    ${glow('M48 66 q-5 9 -2 18', 0.6, 7)}
    <ellipse cx="52" cy="60" rx="6" ry="4" fill="rgba(255,255,255,0.45)" transform="rotate(-30 52 60)"/>
  `),

  // ---------------------------------------------------------- мясной отдел
  sausage: frame(
    lin('sausBody', [[0, '#D9705E'], [0.5, '#B8422F'], [1, '#8A2A1C']]) +
    lin('sausCut', [[0, '#F0B2A2'], [1, '#D07B67']]), `
    ${S('M28 78 q0 -22 22 -22 h34 q22 0 22 22 q0 22 -22 22 h-34 q-22 0 -22 -22 z', 'url(#sausBody)')}
    ${dark('M74 56 h10 q22 0 22 22 q0 22 -22 22 h-10 q18 -6 18 -22 q0 -16 -18 -22 z', 0.14)}
    <ellipse cx="36" cy="78" rx="9" ry="19" fill="url(#sausCut)"/>
    <ellipse cx="36" cy="78" rx="9" ry="19" fill="none" stroke="${PALETTE.ink}" stroke-width="4"/>
    <ellipse cx="36" cy="78" rx="4.5" ry="10" fill="#F6CFC3" opacity="0.8"/>
    <circle cx="62" cy="70" r="3" fill="#F3D9CE" opacity="0.85"/>
    <circle cx="78" cy="84" r="2.6" fill="#F3D9CE" opacity="0.8"/>
    <circle cx="68" cy="88" r="2.2" fill="#F3D9CE" opacity="0.7"/>
    <path d="M96 60 l10 -8 M96 96 l10 8" stroke="${PALETTE.ink}" stroke-width="4" stroke-linecap="round" fill="none"/>
    ${glow('M40 62 q16 -4 30 0', 0.35, 5)}
  `),

  chicken: frame(
    rad('chickBody', [[0, '#F7CE84'], [0.5, '#D9963C'], [1, '#93590F']], 0.36, 0.28, 0.82) +
    lin('chickLeg', [[0, '#E9B76E'], [1, '#B3742A']]) +
    lin('chickBone', [[0, '#FFFCF3'], [1, '#E3D8C2']]), `
    ${S('M34 76 q2 -30 30 -30 q28 0 30 30 q2 20 -12 26 q-18 8 -36 0 q-14 -6 -12 -26 z', 'url(#chickBody)')}
    ${dark('M80 52 q16 10 14 30 q-2 20 -16 26 q-8 4 -18 4 q26 -10 26 -34 q0 -16 -6 -26 z', 0.15)}
    ${S('M44 98 q-10 12 -22 8 q-4 -12 10 -18 z', 'url(#chickLeg)')}
    ${S('M84 98 q10 12 22 8 q4 -12 -10 -18 z', 'url(#chickLeg)')}
    ${S('M22 106 a7 7 0 1 1 0.1 0 z', 'url(#chickBone)', 3)}
    ${S('M106 106 a7 7 0 1 1 0.1 0 z', 'url(#chickBone)', 3)}
    <path d="M50 62 q14 -8 28 0" stroke="#7A4A12" stroke-width="3.5" fill="none" stroke-linecap="round" opacity="0.55"/>
    <path d="M46 78 q18 -6 36 0" stroke="#7A4A12" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.4"/>
    <path d="M60 88 q8 4 16 0" stroke="#7A4A12" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.35"/>
    ${glow('M46 60 q8 -10 18 -12', 0.5, 6)}
  `),

  steak: frame(
    rad('steakMeat', [[0, '#DE6D57'], [0.5, '#AE362A'], [1, '#6F170E']], 0.34, 0.3, 0.84) +
    lin('steakFat', [[0, '#FFF7E8'], [1, '#E7D5B8']]), `
    ${S('M24 66 q6 -26 34 -26 q28 0 42 16 q16 18 2 36 q-16 20 -46 16 q-32 -4 -32 -42 z', 'url(#steakMeat)')}
    ${dark('M86 58 q16 18 2 34 q-16 18 -44 18 q36 -8 44 -28 q6 -14 -2 -24 z', 0.16)}
    <path d="M28 88 q26 16 58 2 q10 -4 14 -12 q2 14 -10 22 q-20 12 -44 6 q-16 -6 -18 -18 z"
          fill="url(#steakFat)" stroke="${PALETTE.ink}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M40 54 l30 -6 M38 68 l40 -8 M46 80 l38 -8" stroke="#5E1409" stroke-width="5"
          fill="none" stroke-linecap="round" opacity="0.45"/>
    <path d="M52 58 q10 6 8 16 M76 62 q8 6 4 14" stroke="#F2CCB7" stroke-width="3"
          fill="none" stroke-linecap="round" opacity="0.75"/>
    ${glow('M42 50 q12 -6 22 -4', 0.35, 5)}
  `),

  grape: frame(
    rad('grapeA', [[0, '#B48BE0'], [0.55, '#7D4FB5'], [1, '#4A2A78']], 0.33, 0.28, 0.85) +
    rad('grapeB', [[0, '#A379D6'], [0.55, '#6B3FA3'], [1, '#3F2268']], 0.33, 0.28, 0.85) +
    lin('grapeLeaf', [[0, '#8AD063'], [1, '#3E8B34']]) +
    lin('grapeStem', [[0, '#8C6239'], [1, '#5A3B1E']]), `
    ${S('M64 32 v10', 'url(#grapeStem)', 4)}
    ${S('M66 34 q16 -10 24 -2 q-12 10 -24 2 z', 'url(#grapeLeaf)')}
    <g stroke="${PALETTE.ink}" stroke-width="3.5">
      <circle cx="50" cy="56" r="11" fill="url(#grapeA)"/>
      <circle cx="74" cy="54" r="11" fill="url(#grapeB)"/>
      <circle cx="62" cy="72" r="11" fill="url(#grapeA)"/>
      <circle cx="40" cy="76" r="10" fill="url(#grapeB)"/>
      <circle cx="84" cy="74" r="10" fill="url(#grapeB)"/>
      <circle cx="52" cy="92" r="10" fill="url(#grapeA)"/>
      <circle cx="74" cy="92" r="9" fill="url(#grapeB)"/>
    </g>
    <circle cx="46" cy="52" r="3" fill="rgba(255,255,255,0.55)"/>
    <circle cx="70" cy="50" r="2.6" fill="rgba(255,255,255,0.5)"/>
    <circle cx="58" cy="68" r="2.6" fill="rgba(255,255,255,0.45)"/>
  `),

  // ------------------------------------------------------- бытовая химия
  soap: frame(
    lin('soapBar', [[0, '#FFF3C4'], [0.5, '#F6D667'], [1, '#D9A72C']]) +
    lin('soapWrap', [[0, '#8BD9F2'], [1, '#2E8FC4']]), `
    ${S('M28 62 q0 -12 12 -12 h48 q12 0 12 12 v30 q0 12 -12 12 h-48 q-12 0 -12 -12 z', 'url(#soapBar)')}
    ${dark('M76 50 h12 q12 0 12 12 v30 q0 12 -12 12 h-12 q10 -8 10 -27 z', 0.13)}
    <path d="M28 70 h72 v16 h-72 z" fill="url(#soapWrap)"/>
    <path d="M28 70 h72 v16 h-72 z" fill="none" stroke="${PALETTE.ink}" stroke-width="3.5"/>
    <ellipse cx="64" cy="78" rx="13" ry="6" fill="#EAF8FF" opacity="0.9"/>
    <circle cx="44" cy="44" r="7" fill="#DFF3FC" opacity="0.85"/>
    <circle cx="44" cy="44" r="7" fill="none" stroke="${PALETTE.ink}" stroke-width="3"/>
    <circle cx="58" cy="34" r="5" fill="#DFF3FC" opacity="0.8"/>
    <circle cx="58" cy="34" r="5" fill="none" stroke="${PALETTE.ink}" stroke-width="3"/>
    ${glow('M36 60 q10 -4 20 -2', 0.4, 5)}
  `),

  powder: frame(
    lin('powBox', [[0, '#8FD0F5'], [0.55, '#4F9FD8'], [1, '#2C6FA8']]) +
    lin('powTop', [[0, '#BFE6FA'], [1, '#6FB3E0']]) +
    lin('powWin', [[0, '#FFFFFF'], [1, '#E4F2FB']]), `
    ${S('M34 42 h60 v58 q0 6 -6 6 h-48 q-6 0 -6 -6 z', 'url(#powBox)')}
    ${dark('M78 44 h16 v56 q0 6 -6 6 h-12 z', 0.14)}
    ${S('M34 42 l10 -12 h48 l10 12 z', 'url(#powTop)')}
    <rect x="44" y="58" width="40" height="30" rx="5" fill="url(#powWin)"/>
    <path d="M44 58 h40 v30 h-40 z" fill="none" stroke="${PALETTE.ink}" stroke-width="3.5"/>
    <circle cx="56" cy="70" r="4" fill="#7FC4EC"/>
    <circle cx="70" cy="76" r="3.4" fill="#7FC4EC"/>
    <circle cx="64" cy="66" r="2.6" fill="#7FC4EC"/>
    ${glow('M40 56 q-2 20 0 40', 0.35, 4)}
  `),

  spray: frame(
    lin('sprayBody', [[0, '#B6F0D4'], [0.5, '#4FBE92'], [1, '#1E8460']]) +
    lin('sprayCap', [[0, '#F2F6F8'], [1, '#B9C6CE']]) +
    lin('sprayLabel', [[0, '#FFFFFF'], [1, '#DCEAE4']]), `
    ${S('M44 56 h40 v44 q0 6 -6 6 h-28 q-6 0 -6 -6 z', 'url(#sprayBody)')}
    ${dark('M72 56 h12 v44 q0 6 -6 6 h-10 q6 -8 6 -24 z', 0.14)}
    ${S('M52 40 h24 v16 h-24 z', 'url(#sprayCap)')}
    ${S('M52 44 h-18 q-6 0 -6 6 v6 q0 6 6 6 h10', 'none', 4)}
    <path d="M28 40 h14 v10 h-14 z" fill="url(#sprayCap)" stroke="${PALETTE.ink}" stroke-width="3.5"/>
    <rect x="50" y="70" width="28" height="22" rx="4" fill="url(#sprayLabel)"/>
    <path d="M50 70 h28 v22 h-28 z" fill="none" stroke="${PALETTE.ink}" stroke-width="3.5"/>
    <path d="M56 78 h16 M56 85 h10" stroke="#5E6B73" stroke-width="3" stroke-linecap="round"/>
    <circle cx="24" cy="32" r="3" fill="#8EE0BE"/>
    <circle cx="18" cy="42" r="2.4" fill="#8EE0BE"/>
    ${glow('M50 62 q-2 18 0 34', 0.4, 5)}
  `)
};

export const ORDER = ['milk','cheese','yogurt','butter','bread','grain','cookie','can','apple','carrot','tomato','grape','sausage','chicken','steak','soap','powder','spray'];
