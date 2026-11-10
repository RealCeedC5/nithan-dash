'use strict';
/* =========================================================
   The scene around the track: sky, parallax backdrops, water,
   hazards, platforms, item boxes, flags and the finish gate.
   ========================================================= */

/* ---------- sky ---------- */
const SKY3 = {
  sangthong: ['#3f9be0', '#8fd0f4', '#e4f6ff'],
  plabuthong: ['#6a5aa0', '#f08a5a', '#ffe0a0'],
  kraithong: ['#0d1320', '#18243a', '#2a4058'],
  kaewnama: ['#f06a6a', '#ff9a78', '#ffe2b4'],
};
const CLOUD_TONES = {
  sangthong: ['#b4d6f0', '#d8ecfa', '#f2faff', '#ffffff'],
  plabuthong: ['#c8787a', '#f0a686', '#ffd0a6', '#fff0d2'],
  kaewnama: ['#e8989e', '#ffbeae', '#ffe0d0', '#fff6ec'],
};
const SKY_CACHE = {};
function skyCanvas(id, w) {
  const key = id + ':' + w;
  if (SKY_CACHE[key]) return SKY_CACHE[key];
  const c = mk(w, VH), g = c.getContext('2d'), im = g.createImageData(w, VH), d = im.data, cols = SKY3[id], N = 14, band = [];
  for (let i = 0; i < N; i++) { const f = i / (N - 1), hex = f < 0.55 ? mix(cols[0], cols[1], f / 0.55) : mix(cols[1], cols[2], (f - 0.55) / 0.45), n = parseInt(hex.slice(1), 16); band.push([n >> 16, (n >> 8) & 255, n & 255]); }
  for (let y = 0; y < VH; y++) {
    const f = Math.min(N - 1.001, (y / (VH * 0.84)) * (N - 1)), i = Math.floor(f), fr = f - i;
    const lvl = fr < 0.34 ? 0 : fr > 0.66 ? 1 : (fr - 0.34) / 0.32;           // flat bands with a short dithered step between them
    for (let x = 0; x < w; x++) { const b = band[Math.min(N - 1, lvl > bayer(x, y) ? i + 1 : i)], p = (y * w + x) * 4; d[p] = b[0]; d[p + 1] = b[1]; d[p + 2] = b[2]; d[p + 3] = 255; }
  }
  g.putImageData(im, 0, 0);
  const sun = (cx, cy, r, core, rim, halo, reach) => {
    for (let dy = -r - reach; dy <= r + reach; dy++) for (let dx = -r - reach; dx <= r + reach; dx++) {
      const dd = Math.hypot(dx, dy), k = (dd - r) / reach;
      if (dd <= r) PX(g, dd > r - 2 ? rim : core, cx + dx, cy + dy);
      else if (k < 0.3 || (k < 0.62 && bayer(cx + dx, cy + dy) < 0.5) || (k < 1 && bayer(cx + dx, cy + dy) < 0.2)) { g.globalAlpha = k < 0.3 ? 0.55 : 0.4; PX(g, halo, cx + dx, cy + dy); g.globalAlpha = 1; }
    }
  };
  const sx = Math.round(w * 0.78);
  if (id === 'sangthong') sun(sx, 42, 14, '#fffbe0', '#fff0a8', '#f4fbff', 16);
  else if (id === 'plabuthong') sun(sx, 104, 24, '#fff2c0', '#ffd890', '#ffd0a0', 22);
  else if (id === 'kaewnama') sun(sx, 64, 26, '#fff8e0', '#ffe8c0', '#ffd8b8', 24);
  else { // far glow and glow-worms in the cave
    for (let dy = -60; dy <= 60; dy++) for (let dx = -150; dx <= 150; dx++) { const dd = Math.hypot(dx / 2.5, dy); if (dd < 60 && bayer(dx + 200, dy + 100) < (1 - dd / 60) * 0.55) PX(g, '#2f4c68', (w >> 1) + dx, 130 + dy); }
    const R = rng(77); for (let i = 0; i < 46; i++) { const x = (R() * w) | 0, y = (R() * 150) | 0; PX(g, R() < 0.5 ? '#4fc0e0' : '#8fe0ff', x, y); if (R() < 0.3) PX(g, '#2a6a88', x - 1, y, 3, 1); }
  }
  return (SKY_CACHE[key] = c);
}
const CLOUD_CACHE = {};
function cloudSprites(id) {
  if (CLOUD_CACHE[id]) return CLOUD_CACHE[id];
  const tones = CLOUD_TONES[id], out = [];
  for (const [w, n, seed] of [[52, 5, 3], [36, 4, 8], [70, 7, 5], [26, 3, 12]]) {
    const c = mk(w, 26), g = c.getContext('2d'), R = rng(seed);
    for (let i = 0; i < n; i++) { const r = 5 + ((R() * 5) | 0), x = r + (i / (n - 1)) * (w - 2 * r); shadeDisc(g, x, 17 - R() * 3 - Math.sin(i / (n - 1) * Math.PI) * 5, r, tones, -0.4, -0.9, 0.35); }
    g.clearRect(0, 20, w, 6); PX(g, tones[0], 3, 19, w - 6, 1); ditherRect(g, tones[1], 2, 18, w - 4, 1, 0.5);
    out.push(c);
  }
  return (CLOUD_CACHE[id] = out);
}
function drawSky(g, id, w, t, camX = 0) {
  g.drawImage(skyCanvas(id, w), 0, 0);
  if (id === 'kraithong') return;
  const cl = cloudSprites(id);
  for (let i = 0; i < 6; i++) {
    const sp = cl[i % cl.length], span = w + 160;
    const x = (((i * 173 - t * (2.5 + i * 0.9) - camX * 0.04) % span) + span) % span - 80, y = 12 + ((i * 37) % 70);
    g.globalAlpha = id === 'sangthong' ? 0.95 : 0.8; g.drawImage(sp, Math.round(x), y);
  }
  g.globalAlpha = 1;
}

/* ---------- parallax backdrops ---------- */
const BD_W = 512;
const bwave = (x, s, a, b, c) => Math.sin(x / BD_W * 6.2832 * a + s) + 0.5 * Math.sin(x / BD_W * 6.2832 * b + s * 2.3) + 0.25 * Math.sin(x / BD_W * 6.2832 * c + s * 4.1);
function ridge(g, base, amp, seed, ks, tones) {
  let prev = base + amp * bwave(-1, seed, ...ks);
  for (let x = 0; x < BD_W; x++) {
    const h = Math.round(base + amp * bwave(x, seed, ...ks)), top = VH - h, lit = h >= prev;
    PX(g, tones[1], x, top, 1, h);
    PX(g, lit ? tones[2] : tones[0], x, top, 1, lit ? 2 : 1);
    for (let j = 2; j < 12; j++) if (bayer(x, top + j) < (lit ? 0.55 : 0.4) * (1 - j / 12)) PX(g, lit ? tones[2] : tones[0], x, top + j);
    prev = h;
  }
}
function mist(g, col, h, max = 0.85) { for (let j = 0; j < h; j++) { g.fillStyle = col; const lv = (j / h) * max, y = VH - h + j; for (let x = 0; x < BD_W; x++) if (bayer(x, y) < lv) g.fillRect(x, y, 1, 1); } }
function canopyRow(g, baseY, rMin, rMax, step, seed, tones) {
  const R = rng(seed);
  PX(g, tones[1], 0, baseY, BD_W, VH - baseY);
  for (let y = baseY + 6; y < VH; y++) { const lv = Math.min(0.9, (y - baseY - 6) / 60); g.fillStyle = tones[0]; for (let x = 0; x < BD_W; x++) if (bayer(x, y) < lv) g.fillRect(x, y, 1, 1); }   // deeper shade lower down, seen through pits
  for (let x = -10; x < BD_W + 10; x += step * (0.7 + R() * 0.6)) {
    const r = Math.round(rMin + R() * (rMax - rMin)), y = baseY - r * 0.3 - R() * r * 0.6;
    for (const ox of [0, -BD_W, BD_W]) if (x + ox > -r - 2 && x + ox < BD_W + r + 2) shadeDisc(g, x + ox, y, r, tones);
  }
}
function chedi(g, x, y, s, a, b, gold) {            // bell-shaped stupa, base at y
  PX(g, b, x - 9 * s, y - 4 * s, 18 * s, 4 * s); PX(g, a, x - 7 * s, y - 7 * s, 14 * s, 3 * s);
  for (let i = 0; i < 9 * s; i++) { const w = Math.round(6 * s * Math.cos(i / (9 * s) * 1.35)); PX(g, a, x - w, y - 7 * s - i, w * 2, 1); PX(g, b, x + w - Math.max(1, s), y - 7 * s - i, Math.max(1, s), 1); }
  for (let i = 0; i < 14 * s; i++) { const w = Math.max(1, Math.round(2 * s * (1 - i / (14 * s)))); PX(g, gold, x - w + 1, y - 16 * s - i, w * 2 - 1, 1); }
  PX(g, gold, x - 3 * s, y - 16 * s, 6 * s, s);
}
function roofs(g, x, y, w, a, b, gold) {            // a hall with tiered Thai gables
  PX(g, b, x - w / 2, y - 14, w, 14);
  for (let k = 0; k < 3; k++) { const ww = w * (1.15 - k * 0.3), yy = y - 14 - k * 9; for (let i = 0; i < 10; i++) PX(g, k % 2 ? b : a, x - ww / 2 * (1 - i / 11), yy - i, ww * (1 - i / 11), 1); PX(g, gold, x - ww / 2 - 2, yy - 2, 3, 2); PX(g, gold, x + ww / 2 - 1, yy - 2, 3, 2); }
  PX(g, gold, x, y - 46, 1, 6);
}
function buildBackdrop(id) {
  const K = kit(id), air = K.air, H = VH, layers = [];
  const L = (f, fn) => { const c = mk(BD_W, H), g = c.getContext('2d'); fn(g); layers.push({ c, f }); };
  const fade = (cols, amt) => cols.map(c => mix(c, air, amt));
  if (id === 'sangthong') {
    L(0.07, g => {
      ridge(g, 104, 22, 1.3, [2, 5, 9], fade(['#3f7f86', '#4f9692', '#7abfae'], 0.5));
      const far = mix('#d8b860', air, 0.5); chedi(g, 356, H - 104, 2, far, mix('#b89a50', air, 0.5), mix('#fff0a8', air, 0.3));
      roofs(g, 300, H - 96, 44, mix('#c8a060', air, 0.55), mix('#a87a50', air, 0.55), mix('#ffe8a0', air, 0.4));
      ridge(g, 80, 14, 4.1, [3, 7, 13], fade(['#3a7a66', '#4a9070', '#74b888'], 0.38));
      mist(g, air, 46, 0.7);
    });
    L(0.18, g => { canopyRow(g, H - 62, 12, 20, 15, 21, fade(K.leaf, 0.42)); mist(g, air, 30, 0.5); });
    L(0.34, g => {
      const tones = fade(K.leaf, 0.2), tr = tinted(treeSprite(K, 5), air, 0.22), tr2 = tinted(treeSprite(K, 23), air, 0.22);
      [[40, tr], [190, tr2], [330, tr], [455, tr2]].forEach(([x, sp]) => g.drawImage(sp, x, H - 118));
      canopyRow(g, H - 44, 10, 17, 14, 41, tones);
    });
  } else if (id === 'plabuthong') {
    L(0.07, g => {
      ridge(g, 92, 18, 2.2, [2, 4, 9], fade(['#7a4a6a', '#955a6c', '#c88a6e'], 0.42));
      const a = mix('#7a4a5a', air, 0.4), b = mix('#5a3a4e', air, 0.4);
      chedi(g, 150, H - 92, 2, a, b, mix('#ffd890', air, 0.3)); roofs(g, 210, H - 88, 40, a, b, mix('#ffd890', air, 0.3));
      ridge(g, 70, 10, 5.5, [3, 8, 12], fade(['#6a4a5a', '#84566a', '#b07a6a'], 0.3));
      mist(g, mix(air, '#ffe8b0', 0.5), 40, 0.75);
    });
    L(0.18, g => {
      const a = mix('#5a3a44', air, 0.28), b = mix('#40283a', air, 0.25), R = rng(9);
      PX(g, b, 0, H - 56, BD_W, 56);
      for (let i = 0; i < 6; i++) { // paddy fields catching the light
        PX(g, mix('#ffd8a0', air, 0.3), 0, H - 50 + i * 7, BD_W, 1); ditherRect(g, mix('#c8785a', air, 0.3), 0, H - 49 + i * 7, BD_W, 2, 0.5);
      }
      for (let x = 20; x < BD_W; x += 84 + ((R() * 30) | 0)) { // stilt houses
        const w = 34 + ((R() * 12) | 0), y = H - 58;
        PX(g, b, x + 3, y - 6, 2, 8); PX(g, b, x + w - 5, y - 6, 2, 8); PX(g, a, x, y - 22, w, 16);
        for (let i = 0; i < 14; i++) PX(g, b, x - 4 + i * 1.4, y - 23 - i, w + 8 - i * 2.8, 1);
        PX(g, '#ffd27a', x + 6, y - 17, 5, 5); PX(g, '#fff0b8', x + 7, y - 16, 2, 2); if (w > 38) PX(g, '#ffc060', x + w - 12, y - 16, 4, 4);
      }
      for (let x = 60; x < BD_W; x += 96) { // palms
        const px = x + ((R() * 24) | 0), top = H - 100 - ((R() * 18) | 0);
        for (let y = top; y < H - 56; y++) PX(g, b, px + Math.round(Math.sin((y - top) * 0.05) * 3), y, 2, 1);
        for (let k = 0; k < 7; k++) { const an = -3.2 + k * 0.55; for (let i = 0; i < 16; i++) PX(g, b, px + Math.cos(an) * i, top + Math.sin(an) * i + i * i * 0.035, 2, 2); }
      }
    });
    L(0.34, g => {
      const pal = tinted(palmSprite(K, 3), mix(air, '#5a3040', 0.5), 0.45), ban = tinted(bananaSprite(K), mix(air, '#5a3040', 0.5), 0.4);
      g.drawImage(pal, 80, H - 122); g.drawImage(pal, 340, H - 116); g.drawImage(ban, 220, H - 78); g.drawImage(ban, 470, H - 78);
      canopyRow(g, H - 40, 7, 12, 11, 61, fade(K.leaf.map(c => mix(c, '#6a3a3a', 0.35)), 0.18));
    });
  } else if (id === 'kraithong') {
    L(0.05, g => {      // the back wall: shelves of rock, darker the higher they go
      const R = rng(5);
      PX(g, '#121a2a', 0, 0, BD_W, H);
      for (let b = 0; b < 6; b++) { const k = b / 5, tone = ['#141c2c', '#18233a', '#1f2e46'].map(c => mix(c, '#2a4058', k * 0.45)); ridge(g, H - 14 - b * 36, 9 + b * 2, b * 1.7 + 0.5, [2 + b, 5 + b * 2, 11 + b], tone); }
      for (let x = 0; x < BD_W; x++) { const h = 16 + Math.round(7 * bwave(x, 4, 3, 8, 15)); PX(g, '#0f1624', x, 0, 1, h); if (bayer(x, h) < 0.5) PX(g, '#0f1624', x, h, 1, 2); }
      g.fillStyle = 'rgba(120,190,230,.06)';
      for (const sx of [90, 330]) { g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx + 34, 0); g.lineTo(sx - 30, H); g.lineTo(sx - 90, H); g.fill(); }
      for (let i = 0; i < 9; i++) { const x = (R() * BD_W) | 0, y = 40 + ((R() * 150) | 0); for (let dy = -6; dy <= 7; dy++) for (let dx = -6; dx <= 7; dx++) if (dx * dx + dy * dy < 40 && bayer(x + dx, y + dy) < 0.3) PX(g, '#254e6c', x + dx, y + 2 + dy); PX(g, '#3a8aa8', x, y, 2, 5); PX(g, '#8fe0ff', x, y, 1, 3); PX(g, '#3a8aa8', x + 3, y + 2, 2, 3); }
    });
    L(0.16, g => {
      const R = rng(12), T1 = ['#1a2434', '#243246', '#32465e', '#46627e'];
      for (let x = 30; x < BD_W; x += 60 + ((R() * 50) | 0)) {
        const len = 40 + ((R() * 70) | 0), w = 8 + ((R() * 8) | 0);
        for (let y = 0; y < len; y++) { const ww = Math.max(1, Math.round(w * (1 - y / len) ** 0.7)); PX(g, T1[1], x - ww, y, ww * 2, 1); PX(g, T1[3], x - ww, y, Math.max(1, ww >> 2), 1); PX(g, T1[0], x + ww - Math.max(1, ww >> 2), y, Math.max(1, ww >> 2), 1); }
        const len2 = 30 + ((R() * 50) | 0), x2 = x + 22 + ((R() * 14) | 0);
        for (let y = 0; y < len2; y++) { const ww = Math.max(1, Math.round((w + 3) * (y / len2) ** 0.8)); PX(g, T1[1], x2 - ww, H - len2 + y, ww * 2, 1); PX(g, T1[3], x2 - ww, H - len2 + y, Math.max(1, ww >> 2), 1); PX(g, T1[0], x2 + ww - 1, H - len2 + y, 1, 1); }
      }
      for (let x = 0; x < BD_W; x++) { const h = 10 + Math.round(4 * bwave(x, 3, 3, 7, 12)); PX(g, T1[1], x, 0, 1, h); PX(g, T1[0], x, h - 2, 1, 2); const h2 = 16 + Math.round(5 * bwave(x, 8, 2, 9, 14)); PX(g, T1[1], x, H - h2, 1, h2); PX(g, T1[3], x, H - h2, 1, 1); }
    });
    L(0.34, g => {
      const R = rng(31), T2 = ['#0e1420', '#141c2a', '#1c2838', '#283a50'];
      for (let x = 0; x < BD_W; x++) { const h = 22 + Math.round(9 * bwave(x, 6, 4, 9, 17)); PX(g, T2[1], x, H - h, 1, h); PX(g, T2[3], x, H - h, 1, 1); if (bayer(x, H - h + 2) < 0.4) PX(g, T2[2], x, H - h + 1, 1, 2); }
      for (let x = 14; x < BD_W; x += 38 + ((R() * 30) | 0)) { const len = 14 + ((R() * 26) | 0); for (let y = 0; y < len; y++) { const ww = Math.max(1, Math.round(5 * (1 - y / len))); PX(g, T2[1], x - ww, y, ww * 2, 1); PX(g, T2[3], x - ww, y, 1, 1); } }
      for (let i = 0; i < 6; i++) { const x = 30 + i * 84 + ((R() * 20) | 0), y = H - 26 - Math.round(9 * bwave(x, 6, 4, 9, 17)); PX(g, '#d8e8e0', x, y + 1, 1, 4); oval(g, '#3ab8a8', x, y, 3, 2); PX(g, '#c8fff0', x - 1, y - 1, 1, 1); ditherRect(g, '#1f5a5a', x - 5, y - 4, 11, 9, 0.2); }
    });
  } else {
    L(0.05, g => {
      const a = mix('#e88a9a', air, 0.5), b = mix('#d87a90', air, 0.5), gold = mix('#fff0c0', air, 0.4);
      for (const [x, y] of [[90, H - 96], [300, H - 110], [440, H - 88]]) { roofs(g, x, y, 34, a, b, gold); chedi(g, x + 34, y, 1, a, b, gold); oval(g, mix('#ffe8e0', air, 0.4), x + 10, y + 3, 40, 6); }
      for (let x = 0; x < BD_W; x++) { const h = 70 + Math.round(5 * bwave(x, 2, 3, 8, 14)); PX(g, mix('#ffd8c8', air, 0.45), x, H - h, 1, h); }
      mist(g, mix('#fff0e0', air, 0.3), 50, 0.6);
    });
    L(0.15, g => canopyRow(g, H - 64, 14, 26, 20, 17, ['#d89aa8', '#f0b8b0', '#ffd8c8', '#fff0e4']));
    L(0.32, g => {
      canopyRow(g, H - 36, 10, 20, 16, 29, ['#d8b0c8', '#f2d0d4', '#fff0ec', '#ffffff']);
      for (let i = 0; i < 3; i++) {
        const x = 70 + i * 170, y = 46 + i * 24, col = ['#c0392b', '#3f7fd8', '#f0b62e'][i];
        for (let k = 0; k < 13; k++) { const w = k < 6 ? k * 2 + 1 : (12 - k) * 2 + 1; PX(g, k < 6 ? shade(col, 0.2) : col, x - (w >> 1), y - 6 + k, w, 1); }
        PX(g, '#fff2b0', x, y - 6, 1, 13); PX(g, '#fff2b0', x - 5, y, 11, 1);
        for (let k = 0; k < 40; k++) PX(g, 'rgba(255,255,255,.55)', x + Math.sin(k * 0.16) * 7, y + 7 + k);
        for (let k = 0; k < 4; k++) PX(g, k % 2 ? '#ffd34d' : col, x + Math.sin((14 + k * 8) * 0.16) * 7 - 1, y + 20 + k * 8, 3, 2);
      }
    });
  }
  return layers;
}
const BACKDROPS = {};
function backdrop(id) { return BACKDROPS[id] || (BACKDROPS[id] = buildBackdrop(id)); }
function drawBackdrop(g, id, camX, camLift, w) {
  for (const L of backdrop(id)) {
    const off = -((camX * L.f) % BD_W), yo = Math.round(camLift * L.f * 0.5);
    for (let x = off; x < w; x += BD_W) g.drawImage(L.c, Math.round(x), yo);
  }
}

/* ---------- water ---------- */
function drawWater(g, lv, x0, x1, t) {
  const th = lv.th, gold = lv.theme === 'sangthong', hi = shade(th.water, 0.5), mid = th.water, deep = th.water2, dk = shade(th.water2, -0.25);
  for (let x = x0; x <= x1; x++) {
    let depth = 0;
    for (let y = 0; y < lv.H; y++) {
      if (tileAt(lv, x, y) !== T.WATER) { depth = 0; continue; }
      const px = x * TILE, py = y * TILE;
      if (depth === 0) {
        for (let i = 0; i < 16; i += 2) { const wv = Math.round(Math.sin(t * 2.2 + (px + i) * 0.19) * 1.2); PX(g, mid, px + i, py + 4 + wv, 2, 12 - wv); PX(g, hi, px + i, py + 3 + wv, 2, 1); }
        const o = Math.floor(t * 9 + x * 5) % 16; PX(g, '#ffffff', px + o, py + 5, 3, 1); PX(g, hi, px + ((o + 9) % 16), py + 8, 4, 1);
        if (gold && (Math.floor(t * 5 + x * 3) % 7) === 0) { PX(g, '#ffffff', px + 7, py + 6, 1, 3); PX(g, '#ffffff', px + 6, py + 7, 3, 1); }
      } else {
        PX(g, depth > 1 ? dk : deep, px, py, 16, 16);
        if (depth === 1) ditherRect(g, mid, px, py, 16, 4, 0.5);
        const o = Math.floor(t * 4 + x * 7 + y * 3) % 24; if (o < 16) PX(g, deep === dk ? mid : shade(deep, 0.2), px + o, py + 6 + ((x + y) % 5), 3, 1);
      }
      depth++;
    }
  }
}

function drawBoostPads(g, lv, x0, x1, t) {
  for (let y = 0; y < lv.H; y++) for (let x = x0; x <= x1; x++) {
    if (tileAt(lv, x, y) !== T.BOOST) continue;
    const px = x * TILE, py = y * TILE + 11;
    PX(g, '#1c3a6a', px, py, 16, 5); PX(g, '#2a6aa8', px, py, 16, 4); PX(g, '#7fd4ff', px, py, 16, 1);
    for (let i = 0; i < 3; i++) {
      const on = (Math.floor(t * 12) + 3 - i) % 3 === 0, cx = px + 2 + i * 5;
      PX(g, on ? '#ffffff' : '#4fb0e8', cx, py + 1, 1, 3); PX(g, on ? '#ffffff' : '#4fb0e8', cx + 1, py + 2, 1, 1); PX(g, on ? '#bfeaff' : '#3a8ac8', cx + 2, py + 2, 1, 1);
    }
    g.globalAlpha = 0.16 + 0.08 * Math.sin(t * 8 + x); PX(g, '#bfeaff', px + 1, py - 10, 14, 10); g.globalAlpha = 1;
  }
}

function drawWind(g, w, t) {
  const h = ROWS * TILE - w.top;
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(w.x + 2, w.top, w.w - 4, h);
  for (let i = 0; i < 10; i++) {
    const y = w.top + (((i * 37 - t * 150) % h) + h) % h, sx = w.x + 5 + (i % 3) * 9 + Math.sin(t * 3 + i) * 2;
    g.fillStyle = `rgba(255,255,255,${0.3 + (i % 3) * 0.15})`; g.fillRect(Math.round(sx), Math.round(y), 1, 9); g.fillRect(Math.round(sx) + (i % 2 ? 1 : -1), Math.round(y) + 9, 1, 3);
  }
}

/* soft lights in the cave: crystals, mushrooms, torches */
function drawGlows(g, lv, cx, w, t) {
  if (!(lv.glows && lv.glows.length) && !lv.torches) return;
  g.globalCompositeOperation = 'lighter';
  for (const gl of lv.glows || []) {
    if (gl.x < cx - 40 || gl.x > cx + w + 40) continue;
    const r = gl.r * (1 + Math.sin(t * 2 + gl.x) * 0.08), gr = g.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, r);
    gr.addColorStop(0, `rgba(${gl.col},.34)`); gr.addColorStop(1, `rgba(${gl.col},0)`); g.fillStyle = gr; g.fillRect(gl.x - r, gl.y - r, r * 2, r * 2);
  }
  for (const tc of lv.torches || []) {
    if (tc.x < cx - 50 || tc.x > cx + w + 50) continue;
    const r = 34 + Math.sin(t * 13 + tc.x) * 3, gr = g.createRadialGradient(tc.x, tc.y, 0, tc.x, tc.y, r);
    gr.addColorStop(0, 'rgba(255,176,58,.42)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(tc.x - r, tc.y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = 'source-over';
  for (const tc of lv.torches || []) {
    if (tc.x < cx - 20 || tc.x > cx + w + 20) continue;
    const f = Math.floor(t * 10 + tc.x) % 3, x = tc.x, y = tc.y;
    PX(g, '#ff7a2a', x - 3, y - 4, 6, 5); PX(g, '#ffb03a', x - 2, y - 7 - (f === 1 ? 1 : 0), 4, 6); PX(g, '#ffe14d', x - 1, y - 6, 2, 5); PX(g, '#fff6c8', x - 1 + (f === 2 ? 1 : 0), y - 3, 1, 2);
    PX(g, '#ffb03a', x - 2 + f, y - 10, 1, 2);
  }
}

/* ---------- hazards ---------- */
const HZ_CACHE = {};
function hazSprites(theme) {
  if (HZ_CACHE[theme]) return HZ_CACHE[theme];
  const kind = THEMES[theme].hazards, S = {};
  const art = (w, h, fn) => { const c = mk(w, h), g = c.getContext('2d'); fn(g, (x, y, ww, hh, col) => PX(g, col, x, y, ww, hh)); return outlined(c); };
  S.bob = art(16, 20, (g, P) => {
    if (kind.L === 'club') { // the giant's club
      P(7, 0, 2, 5, '#6a4426'); for (let y = 4; y < 19; y++) { const w = y < 8 ? 3 + (y - 4) : y > 15 ? 7 - (y - 15) : 7; P(8 - w, y, w * 2, 1, '#9a5a30'); P(8 - w, y, 2, 1, '#c07a44'); P(8 + w - 2, y, 2, 1, '#6a3a1c'); }
      P(2, 8, 12, 2, '#ffd34d'); P(2, 8, 12, 1, '#fff2b0'); P(2, 14, 12, 1, '#e0a020'); for (const [x, y] of [[4, 11], [8, 12], [11, 11], [6, 16], [10, 16]]) { P(x, y, 2, 2, '#f4e6c8'); P(x + 1, y + 1, 1, 1, '#b8a880'); }
    } else if (kind.L === 'bell') { // a temple bell
      P(7, 0, 2, 3, '#8a5a10'); P(6, 2, 4, 2, '#c08010'); for (let y = 4; y < 16; y++) { const w = 3 + Math.round((y - 4) * 0.36) + (y > 13 ? 1 : 0); P(8 - w, y, w * 2, 1, '#e0a020'); P(8 - w, y, 2, 1, '#ffd870'); P(8 + w - 2, y, 2, 1, '#a86a10'); }
      P(1, 16, 14, 2, '#c08010'); P(1, 16, 14, 1, '#f0c040'); P(3, 9, 10, 1, '#a86a10'); P(7, 18, 2, 2, '#6a4410');
    } else if (kind.L === 'stalactite') {
      for (let y = 0; y < 20; y++) { const w = Math.max(1, Math.round(7 * (1 - y / 20) ** 0.8)); P(8 - w, y, w * 2, 1, '#5a5a72'); P(8 - w, y, Math.max(1, w >> 1), 1, '#8a8aa6'); P(8 + w - 1, y, 1, 1, '#3a3a4c'); }
      P(7, 15, 2, 4, '#8fe0ff'); P(7, 15, 1, 2, '#ffffff'); P(3, 3, 3, 1, '#3a3a4c'); P(9, 7, 3, 1, '#3a3a4c');
    } else { // a brass wind bell with a paper leaf
      P(7, 0, 2, 2, '#8a5a10'); for (let y = 2; y < 9; y++) { const w = 2 + Math.round((y - 2) * 0.5); P(8 - w, y, w * 2, 1, '#e8b030'); P(8 - w, y, 1, 1, '#fff2b0'); P(8 + w - 1, y, 1, 1, '#a87010'); }
      P(2, 9, 12, 1, '#c08010'); P(7, 10, 1, 3, '#6a4410'); for (let y = 13; y < 20; y++) { const w = y < 16 ? y - 12 : 20 - y; P(8 - w, y, w * 2, 1, '#e0503f'); } P(7, 13, 1, 6, '#ffd34d');
    }
  });
  S.ball = art(16, 16, (g, P) => {
    if (kind.R === 'conch') { shadeDisc(g, 8, 8, 7, ['#c08010', '#f0b030', '#ffd34d', '#fff2b0']); P(5, 5, 6, 1, '#c08010'); P(10, 6, 1, 4, '#c08010'); P(6, 10, 5, 1, '#c08010'); P(6, 7, 1, 3, '#c08010'); P(7, 7, 2, 1, '#c08010'); P(1, 7, 2, 3, '#ffe88a'); P(0, 8, 1, 1, '#fff2b0'); }
    else if (kind.R === 'coconut') { shadeDisc(g, 8, 8, 7, ['#3a2416', '#5a3a1e', '#7a5230', '#9a7044']); P(5, 5, 2, 2, '#2a1a0e'); P(9, 5, 2, 2, '#2a1a0e'); P(7, 8, 2, 2, '#2a1a0e'); for (const [x, y] of [[3, 10], [11, 11], [6, 12], [12, 4]]) P(x, y, 2, 1, '#9a7044'); }
    else if (kind.R === 'boulder') { shadeDisc(g, 8, 8, 7, ['#3a3a4c', '#52526a', '#6e6e86', '#9a9ab2']); pline(g, '#2e2e3e', 5, 3, 8, 8); pline(g, '#2e2e3e', 8, 8, 12, 9); P(4, 11, 3, 1, '#2e2e3e'); P(10, 4, 2, 1, '#b8b8cc'); }
    else { shadeDisc(g, 8, 8, 7, ['#3a3a56', '#52527a', '#6e6e98', '#9a9ac0']); P(8, 4, 2, 3, '#ffe14d'); P(6, 7, 3, 1, '#ffe14d'); P(7, 8, 2, 3, '#ffe14d'); P(6, 11, 1, 2, '#fff6c8'); }
  });
  S.block = art(30, 26, (g, P) => {
    if (kind.K === 'pestle') { // a rice pounder: a big wooden mallet
      P(0, 2, 30, 22, '#a8743e'); for (let y = 4; y < 23; y += 4) P(0, y, 30, 1, '#8a5a2e'); P(0, 2, 30, 2, '#d09a5a'); P(0, 22, 30, 2, '#6a4422'); P(0, 2, 2, 22, '#c08a4e'); P(28, 2, 2, 22, '#7a5230');
      P(0, 6, 30, 3, '#5a5a66'); P(0, 6, 30, 1, '#9a9aa8'); P(0, 17, 30, 3, '#5a5a66'); P(0, 17, 30, 1, '#9a9aa8'); for (const x of [3, 14, 25]) { P(x, 7, 2, 1, '#d8d8e0'); P(x, 18, 2, 1, '#d8d8e0'); }
      P(11, 0, 8, 3, '#7a5230'); P(0, 24, 30, 2, '#4a2e16');
    } else { // a stone block with a giant's face
      P(0, 0, 30, 26, '#6a6a7c'); P(0, 0, 30, 3, '#9a9aae'); P(0, 0, 2, 26, '#8a8a9e'); P(28, 0, 2, 26, '#4a4a5a'); P(0, 22, 30, 4, '#46465a');
      P(5, 7, 7, 4, '#2a2a38'); P(18, 7, 7, 4, '#2a2a38'); P(7, 8, 3, 2, '#ffe14d'); P(20, 8, 3, 2, '#ffe14d'); P(4, 5, 8, 2, '#3a3a4a'); P(18, 5, 8, 2, '#3a3a4a');
      P(13, 10, 4, 4, '#52526a'); P(7, 16, 16, 3, '#2a2a38'); P(8, 16, 2, 4, '#f4f1ea'); P(20, 16, 2, 4, '#f4f1ea'); P(12, 16, 2, 2, '#f4f1ea'); P(16, 16, 2, 2, '#f4f1ea');
      P(3, 13, 2, 2, '#52526a'); P(24, 3, 3, 1, '#52526a'); pline(g, '#4a4a5a', 22, 12, 26, 19);
    }
  });
  S.leaper = art(16, 28, (g, P) => {
    if (kind.G === 'croc') {
      P(4, 9, 8, 15, '#3a7a3a'); P(5, 2, 6, 8, '#4a8a4a'); P(5, 0, 6, 3, '#4a8a4a'); P(4, 9, 2, 15, '#5aa052'); P(10, 9, 2, 15, '#2a5a2a'); P(6, 12, 4, 11, '#b8d48a'); for (let y = 13; y < 23; y += 2) P(6, y, 4, 1, '#98b86a');
      P(4, 6, 2, 2, '#ffe14d'); P(10, 6, 2, 2, '#ffe14d'); P(5, 6, 1, 2, '#1d1410'); P(10, 6, 1, 2, '#1d1410'); P(4, 5, 2, 1, '#2a5a2a'); P(10, 5, 2, 1, '#2a5a2a');
      P(5, 0, 1, 2, '#ffffff'); P(7, 0, 1, 1, '#ffffff'); P(10, 0, 1, 2, '#ffffff'); P(6, 3, 4, 1, '#8a2a2a'); P(6, 1, 1, 1, '#1d1410'); P(9, 1, 1, 1, '#1d1410');
      P(1, 12, 3, 2, '#3a7a3a'); P(12, 12, 3, 2, '#3a7a3a'); P(0, 13, 1, 2, '#f4f1ea'); P(15, 13, 1, 2, '#f4f1ea'); P(6, 24, 4, 3, '#3a7a3a'); P(7, 27, 2, 1, '#2a5a2a'); for (const y of [10, 14, 18]) P(11, y, 2, 2, '#2a5a2a');
    } else { // the golden goby
      for (let y = 2; y < 20; y++) { const w = Math.round(5 * Math.sin(Math.PI * (y - 1) / 20)) + 1; P(8 - w, y, w * 2, 1, '#ffc23a'); P(8 - w, y, 2, 1, '#ffe88a'); P(8 + w - 2, y, 2, 1, '#e08a1a'); }
      P(5, 4, 2, 2, '#ffffff'); P(6, 5, 1, 1, '#1d1410'); P(9, 4, 2, 2, '#ffffff'); P(9, 5, 1, 1, '#1d1410'); P(7, 2, 2, 1, '#c0392b');
      for (const [x, y] of [[6, 9], [9, 11], [6, 13], [9, 15]]) P(x, y, 2, 1, '#fff2b0');
      P(1, 9, 3, 4, '#f0a020'); P(12, 9, 3, 4, '#f0a020'); P(5, 20, 6, 2, '#f0a020'); P(3, 22, 4, 4, '#ffb030'); P(9, 22, 4, 4, '#ffb030'); P(3, 25, 2, 2, '#e08a1a'); P(11, 25, 2, 2, '#e08a1a');
    }
  });
  return (HZ_CACHE[theme] = S);
}
function groundUnder(lv, px, py) {
  const tx = Math.floor(px / TILE);
  for (let ty = Math.max(0, Math.floor(py / TILE)); ty < lv.H; ty++) { const c = tileAt(lv, tx, ty); if (isSolidT(c) || c === T.ONEWAY) return ty * TILE; if (c === T.WATER) return ty * TILE + 4; }
  return -1;
}
function dropShadow(g, x, gy, w, a) { if (gy < 0 || a <= 0.02) return; g.fillStyle = `rgba(12,8,28,${a})`; const hw = Math.round(w / 2); g.fillRect(Math.round(x) - hw, gy, hw * 2, 1); g.fillRect(Math.round(x) - hw + 1, gy + 1, hw * 2 - 2, 1); }

function drawHazard(g, lv, h, p, t) {
  const theme = lv.theme, S = hazSprites(theme), cave = theme === 'kraithong';
  const spr = (c, x, y, a) => { g.save(); g.translate(Math.round(x), Math.round(y)); if (a) g.rotate(a); g.drawImage(c, -(c.width >> 1), -(c.height >> 1)); g.restore(); };
  if (h.type === 'pend') {
    if (h.gy === undefined) h.gy = groundUnder(lv, h.px, h.py);
    dropShadow(g, p.x, h.gy, 12, 0.26 * Math.cos(p.a) ** 4);
    const n = Math.floor(h.len / 4);
    for (let i = 0; i <= n; i++) { const f = i / n; PX(g, i % 2 ? (cave ? '#6a6a80' : '#5a3e24') : (cave ? '#9a9ab2' : '#8a6238'), h.px + (p.x - h.px) * f - 1, h.py + (p.y - h.py) * f - 1, 2, 2); }
    PX(g, cave ? '#3a3a4c' : '#5a3a1e', h.px - 11, h.py - 4, 22, 5); PX(g, cave ? '#6a6a80' : '#8a6238', h.px - 11, h.py - 4, 22, 1); PX(g, '#d8d0c0', h.px - 9, h.py - 2, 2, 2); PX(g, '#d8d0c0', h.px + 7, h.py - 2, 2, 2); PX(g, '#2a1c10', h.px - 2, h.py - 1, 4, 3);
    g.save(); g.translate(Math.round(p.x), Math.round(p.y)); g.rotate(-p.a); g.drawImage(S.bob, -9, -8); g.restore();
  } else if (h.type === 'roll') {
    if (!p.on) return;
    g.globalAlpha = p.fade; dropShadow(g, p.x, h.y + h.rad, 14, 0.3 * p.fade);
    spr(S.ball, p.x, p.y, p.a); g.globalAlpha = 1;
  } else if (h.type === 'crush') {
    const shake = p.f === 0 && p.untilDrop < 0.4 ? Math.round(Math.sin(t * 70)) : 0, cx = h.x + h.w / 2 + shake;
    dropShadow(g, h.x + h.w / 2, h.yBot + h.h, h.w * (0.5 + 0.5 * p.f), 0.14 + 0.2 * p.f);
    for (let y = p.y - 3; y > h.yTop - 130; y -= 4) PX(g, ((y / 4) | 0) % 2 ? '#3a2a1a' : '#6a5238', cx - 1, y, 2, 3);
    g.drawImage(S.block, Math.round(h.x + shake) - 1, Math.round(p.y) - 1);
    if (p.f === 0 && p.untilDrop < 0.4 && Math.floor(t * 12) % 2) { PX(g, '#ffe14d', cx - 1, h.yBot + h.h - 12, 2, 5); PX(g, '#ffe14d', cx - 1, h.yBot + h.h - 5, 2, 2); }
  } else if (h.type === 'leap') {
    const sy = h.base - 7;
    if (!p.on) {
      if (p.until < 0.75) { const k = 1 - p.until / 0.75; g.fillStyle = `rgba(255,255,255,${0.35 + k * 0.5})`; for (let i = 0; i < 3; i++) { const bx = h.x - 6 + i * 6 + Math.sin(t * 9 + i * 2) * 1.5, by = sy - ((t * 26 + i * 5) % 9) * k; g.fillRect(Math.round(bx), Math.round(by), 2, 2); } g.fillRect(h.x - 8 - k * 3, sy, 4, 1); g.fillRect(h.x + 4 + k * 3, sy, 4, 1); }
      return;
    }
    spr(S.leaper, p.x, p.y - 4, p.p > 0.5 ? Math.PI * Math.min(1, (p.p - 0.5) * 3.2) : 0);
  }
}

function drawPlat(g, p, theme, t) {
  if (p.gone) return;
  const P = (x, y, w, h, col) => PX(g, col, x, y, w, h), x = Math.round(p.x), y = Math.round(p.y);
  if (p.type !== 'sink') { // the rail it travels along
    g.fillStyle = theme === 'kraithong' ? 'rgba(143,224,255,.22)' : 'rgba(255,255,255,.3)';
    if (p.type === 'h') for (let i = -p.amp; i <= p.amp + p.w; i += 6) g.fillRect(Math.round(p.x0 + i), p.y0 + 2, 2, 1);
    else for (let i = -p.amp; i <= p.amp; i += 6) g.fillRect(p.x0 + (p.w >> 1), Math.round(p.y0 + i), 1, 2);
  }
  if (p.type === 'sink') {
    if (theme === 'kraithong') { P(x, y, p.w, 6, '#6a4a2e'); P(x, y, p.w, 2, '#9a7448'); P(x, y + 5, p.w, 1, '#3a2614'); for (let i = 5; i < p.w; i += 9) P(x + i, y + 1, 1, 4, '#4a321c'); P(x + 2, y + 2, 2, 2, '#c8c8d4'); P(x + p.w - 4, y + 2, 2, 2, '#c8c8d4'); }
    else {
      P(x + 2, y, p.w - 4, 5, '#3f9a48'); P(x, y + 1, p.w, 3, '#3f9a48'); P(x + 3, y, p.w - 8, 2, '#6cc46a'); P(x + 1, y + 4, p.w - 2, 1, '#2a7034'); P(x + p.w - 9, y, 4, 3, shade(THEMES[theme].water, -0.1));
      for (let i = 6; i < p.w - 10; i += 7) P(x + i, y + 1, 1, 3, '#2f8038');
      P(x + 9, y - 3, 7, 3, '#ff8fb8'); P(x + 10, y - 5, 5, 2, '#ffb8d0'); P(x + 11, y - 6, 3, 1, '#ffe0ec'); P(x + 12, y - 3, 1, 2, '#ffe14d');
    }
    if (p.sink > 0.15) { g.fillStyle = 'rgba(255,255,255,.75)'; const k = Math.round(Math.sin(t * 16) * 1.5); g.fillRect(x - 3 - k, y + 4, 4, 1); g.fillRect(x + p.w - 1 + k, y + 4, 4, 1); }
  } else if (theme === 'kaewnama') { // a broad kite
    const col = p.type === 'v' ? '#c0392b' : '#3f7fd8', hi = shade(col, 0.3), mid = x + (p.w >> 1);
    for (let i = 0; i < 7; i++) { const w = p.w - Math.abs(i - 2) * 8; if (w > 0) P(mid - (w >> 1), y - 2 + i, w, 1, i < 2 ? hi : i > 4 ? shade(col, -0.25) : col); }
    P(x, y, p.w, 2, hi); P(mid - 1, y - 3, 2, 9, '#ffd34d'); P(x + 4, y + 1, p.w - 8, 1, '#ffd34d');
    for (let i = 0; i < 12; i++) P(mid + Math.round(Math.sin(t * 5 + i * 0.6) * (i * 0.3)), y + 6 + i, 1, 1, i % 4 < 2 ? '#ffffff' : '#ffd34d');
  } else {
    const wood = theme === 'kraithong' ? '#5a5a70' : '#8a5a32', top = theme === 'kraithong' ? '#8a8aa6' : '#c08a4a';
    P(x, y, p.w, 6, wood); P(x, y, p.w, 2, top); P(x, y + 5, p.w, 1, shade(wood, -0.4)); for (let i = 8; i < p.w; i += 10) P(x + i, y + 2, 1, 3, shade(wood, -0.25));
    P(x - 2, y, 3, 5, '#f0c040'); P(x + p.w - 1, y, 3, 5, '#f0c040'); P(x - 2, y, 3, 1, '#fff2b0'); P(x + p.w - 1, y, 3, 1, '#fff2b0');
    P(x + 5, y + 6, 2, 3, shade(wood, -0.3)); P(x + p.w - 7, y + 6, 2, 3, shade(wood, -0.3));
  }
}

/* ---------- item boxes, flags, finish, traps ---------- */
let BOX_SPR = null;
function drawBox(g, b, t, available) {
  if (!BOX_SPR) {
    const c = mk(14, 14), q = c.getContext('2d'), P = (x, y, w, h, col) => PX(q, col, x, y, w, h);
    P(0, 0, 14, 14, '#c07a10'); P(1, 1, 12, 12, '#ffcf3a'); P(1, 1, 12, 2, '#fff2a8'); P(1, 11, 12, 2, '#e89a1a'); P(1, 1, 2, 12, '#ffe070'); P(11, 1, 2, 12, '#e8a020');
    q.clearRect(0, 0, 1, 1); q.clearRect(13, 0, 1, 1); q.clearRect(0, 13, 1, 1); q.clearRect(13, 13, 1, 1);
    P(5, 3, 4, 2, '#c0392b'); P(8, 4, 2, 3, '#c0392b'); P(6, 6, 3, 2, '#c0392b'); P(6, 8, 2, 1, '#c0392b'); P(6, 10, 2, 2, '#c0392b'); P(4, 4, 2, 2, '#c0392b'); P(5, 3, 3, 1, '#ff7a60');
    BOX_SPR = outlined(c, '#5a3208');
  }
  const y = Math.round(b.y + Math.sin(t * 3 + b.id) * 2), x = Math.round(b.x);
  if (!available) { g.globalAlpha = 0.22; g.drawImage(BOX_SPR, x - 8, y - 8); g.globalAlpha = 1; return; }
  g.fillStyle = 'rgba(255,220,100,.16)'; g.fillRect(x - 10, y - 10, 20, 20);
  g.drawImage(BOX_SPR, x - 8, y - 8);
  const s = ((t * 0.9 + b.id * 0.37) % 1.6) * 18;
  if (s < 16) { g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 12; i++) { const sx = x - 6 + s - i; if (sx >= x - 6 && sx < x + 6) g.fillRect(sx, y - 6 + i, 1, 1); } }
  const tw = (t * 2 + b.id) % 3; if (tw < 0.5) { PX(g, '#ffffff', x + 7, y - 10, 1, 3); PX(g, '#ffffff', x + 6, y - 9, 3, 1); }
}

function drawFlag(g, cp, passed, t) {
  const x = Math.round(cp.x), y = cp.y;
  PX(g, '#3a2e22', x - 3, y - 2, 7, 2); PX(g, '#6a5a48', x - 3, y - 2, 7, 1);
  PX(g, '#7a6652', x - 1, y - 38, 2, 36); PX(g, '#4a3e30', x, y - 38, 1, 36); PX(g, '#ffd34d', x - 1, y - 40, 2, 2);
  const col = passed ? '#ffd34d' : '#e0503f', hi = passed ? '#fff2a8' : '#ff8a70', dk = passed ? '#e0a020' : '#a83228';
  for (let i = 0; i < 15; i++) {
    const wv = Math.round(Math.sin(t * 7 + i * 0.55) * (i / 7)), h = Math.max(1, 11 - Math.round(i * 0.7));
    PX(g, col, x + 1 + i, y - 37 + wv + ((11 - h) >> 1), 1, h); PX(g, hi, x + 1 + i, y - 37 + wv + ((11 - h) >> 1), 1, 1); if (i % 5 === 4) PX(g, dk, x + 1 + i, y - 36 + wv + ((11 - h) >> 1), 1, h - 1);
  }
  if (passed) { const k = (t * 1.5) % 1; g.fillStyle = `rgba(255,243,168,${1 - k})`; g.fillRect(x - 1 - Math.round(k * 5), y - 41, 1, 1); g.fillRect(x + 1 + Math.round(k * 5), y - 39, 1, 1); g.fillRect(x, y - 42 - Math.round(k * 4), 1, 1); }
}

let FIN_SPR = null;
function drawFinish(g, x, y, t) {
  if (!FIN_SPR) {
    const c = mk(76, 92), q = c.getContext('2d'), P = (a, b, w, h, col) => PX(q, col, a, b, w, h);
    for (const px of [6, 64]) { P(px, 30, 6, 62, '#b8322a'); P(px, 30, 2, 62, '#e0503f'); P(px + 5, 30, 1, 62, '#7a1e1a'); P(px - 2, 86, 10, 6, '#e0a020'); P(px - 2, 86, 10, 2, '#fff2a8'); P(px - 1, 28, 8, 3, '#ffd34d'); for (let k = 40; k < 84; k += 12) P(px, k, 6, 2, '#ffd34d'); }
    for (let k = 0; k < 3; k++) { const w = 74 - k * 16, yy = 22 - k * 9; for (let i = 0; i < 9; i++) { const ww = Math.round(w * (1 - i / 12)); P(38 - (ww >> 1), yy - i, ww, 1, i === 0 ? '#ffd34d' : k % 2 ? '#3f8a5a' : '#c0392b'); if (i > 0) P(38 - (ww >> 1), yy - i, 3, 1, k % 2 ? '#6cc48a' : '#ff8a70'); } P(38 - (w >> 1) - 3, yy - 3, 4, 2, '#ffd34d'); P(38 + (w >> 1) - 1, yy - 3, 4, 2, '#ffd34d'); P(38 - (w >> 1) - 4, yy - 5, 2, 2, '#fff2a8'); P(38 + (w >> 1) + 2, yy - 5, 2, 2, '#fff2a8'); }
    P(37, 0, 2, 6, '#ffd34d'); P(37, 0, 1, 3, '#fff2a8');
    P(4, 23, 68, 6, '#7a1e1a'); for (let i = 0; i < 17; i++) for (let j = 0; j < 2; j++) P(4 + i * 4, 30 + j * 4, 4, 4, (i + j) % 2 ? '#1d1410' : '#ffffff');
    FIN_SPR = c;
  }
  g.drawImage(FIN_SPR, x - 38, y - 92);
  for (let i = 0; i < 7; i++) { const sw = Math.round(Math.sin(t * 4 + i) * 1), col = ['#e0503f', '#ffd34d', '#3f7fd8', '#3fae6a'][i % 4]; PX(g, col, x - 26 + i * 8 + sw, y - 53, 5, 3); PX(g, col, x - 25 + i * 8 + sw, y - 50, 3, 2); PX(g, col, x - 24 + i * 8 + sw, y - 48, 1, 1); }
  g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) g.fillRect(x - 2 + j * 2, y - 8 + i * 2, 2, 2);
}

let TRAP_SPR = null;
function drawTrap(g, tr) {
  if (!TRAP_SPR) { const c = mk(14, 9), q = c.getContext('2d'), P = (x, y, w, h, col) => PX(q, col, x, y, w, h); P(6, 0, 2, 2, '#6a4a1a'); P(5, 2, 4, 3, '#f5d33b'); P(2, 5, 4, 3, '#f5d33b'); P(8, 5, 4, 3, '#f5d33b'); P(0, 7, 3, 2, '#e8c020'); P(11, 7, 3, 2, '#e8c020'); P(6, 4, 2, 4, '#fff2a0'); P(5, 2, 1, 2, '#fff2a0'); TRAP_SPR = outlined(c); }
  g.drawImage(TRAP_SPR, Math.round(tr.x) - 8, tr.y - 10);
}
