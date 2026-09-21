/*
 * Нарезка листа: фон в прозрачность, предметы — как связные области.
 *   sliceSheet(page, dataUri, cell) -> [{ uri, w, h }, ...] в порядке чтения
 *
 * Вынесено из tools/gen-products-atlas.mjs, когда за тем же понадобился второй
 * инструмент (пузырь и реакции): алгоритм один, и расходиться двум копиям
 * нельзя — они обе кормят art/ready.
 *
 * Лист не режется по сетке: модель сама выбирает раскладку под свой холст, и
 * жёсткая сетка резала мимо. Работает в странице Chromium — других растровых
 * движков в окружении нет.
 */

export const sliceSheet = (page, dataUri, cell) => page.evaluate(async ({ dataUri, cell }) => {
  const img = new Image();
  img.src = dataUri;
  await img.decode();
  const w = img.width, h = img.height;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  // 1. фон в прозрачность заливкой от краёв
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  const at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const bg = [0, 1, 2].map((c) => {
    const v = corners.map((p) => p[c]).sort((a, b) => a - b);
    return (v[1] + v[2]) / 2;
  });
  const TOL = 34, SOFT = 58;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    stack[sp++] = p;
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (sp > 0) {
    const p = stack[--sp];
    const i = p * 4;
    const dd = Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
    if (dd > SOFT) continue;
    d[i + 3] = dd <= TOL ? 0 : Math.round(255 * (dd - TOL) / (SOFT - TOL));
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  ctx.putImageData(im, 0, 0);

  // 2. предметы как связные области непрозрачного — раскладка модели больше не важна
  const solid = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) solid[p] = d[p * 4 + 3] > 24 ? 1 : 0;
  const label = new Int32Array(w * h).fill(-1);
  const boxes = [];
  const q = new Int32Array(w * h);
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!solid[p0] || label[p0] >= 0) continue;
    const id = boxes.length;
    let qs = 0, qe = 0;
    q[qe++] = p0; label[p0] = id;
    let minX = w, minY = h, maxX = -1, maxY = -1, area = 0;
    while (qs < qe) {
      const p = q[qs++];
      const x = p % w, y = (p / w) | 0;
      area++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (solid[np] && label[np] < 0) { label[np] = id; q[qe++] = np; }
        }
      }
    }
    boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }

  // 3. мусор долой, близкие куски склеить: лист у винограда или крышка могут
  //    отделиться от тела и без склейки уедут отдельной «иконкой»
  const minArea = w * h * 0.0015;
  let parts = boxes.filter((b) => b.area >= minArea);
  const near = Math.round(w * 0.012);
  let merged = true;
  while (merged) {
    merged = false;
    outer:
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i], b = parts[j];
        const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
        const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
        if (gapX <= near && gapY <= near) {
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
          const x2 = Math.max(a.x + a.w, b.x + b.w), y2 = Math.max(a.y + a.h, b.y + b.h);
          parts.splice(j, 1);
          parts[i] = { x, y, w: x2 - x, h: y2 - y, area: a.area + b.area };
          merged = true;
          break outer;
        }
      }
    }
  }

  // 4. порядок чтения: сперва по рядам, внутри ряда слева направо
  const band = h * 0.25;
  parts.sort((a, b) => {
    const ay = a.y + a.h / 2, by = b.y + b.h / 2;
    if (Math.abs(ay - by) > band) return ay - by;
    return a.x - b.x;
  });

  // 5. каждый предмет кадрируется и ужимается половинными шагами
  const out = parts.map((box) => {
    const k = Math.min(cell / box.w, cell / box.h, 1);
    const trimmed = document.createElement('canvas');
    trimmed.width = box.w; trimmed.height = box.h;
    trimmed.getContext('2d').drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    let cur = trimmed, cw = box.w, ch = box.h;
    while (cw * 0.5 > box.w * k) {
      cw = Math.max(Math.round(cw * 0.5), Math.round(box.w * k));
      ch = Math.max(Math.round(ch * 0.5), Math.round(box.h * k));
      const step = document.createElement('canvas');
      step.width = cw; step.height = ch;
      const sc = step.getContext('2d');
      sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = 'high';
      sc.drawImage(cur, 0, 0, cw, ch);
      cur = step;
    }
    const fin = document.createElement('canvas');
    fin.width = Math.max(1, Math.round(box.w * k));
    fin.height = Math.max(1, Math.round(box.h * k));
    const fc = fin.getContext('2d');
    fc.imageSmoothingEnabled = true; fc.imageSmoothingQuality = 'high';
    fc.drawImage(cur, 0, 0, fin.width, fin.height);
    return { uri: fin.toDataURL('image/webp', 0.9), w: fin.width, h: fin.height };
  });
  return out;
}, { dataUri, cell });
