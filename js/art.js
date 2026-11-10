'use strict';
/* =========================================================
   Pixel art, all drawn in code: helpers, runners, item icons,
   tiles, decor and the pre-drawn level canvas.
   Backdrops, hazards and other moving things are in scene.js.
   ========================================================= */
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
}
function mix(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const f = s => Math.round(((A >> s) & 255) + (((B >> s) & 255) - ((A >> s) & 255)) * t);
  return '#' + ((1 << 24) | (f(16) << 16) | (f(8) << 8) | f(0)).toString(16).slice(1);
}
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const PX = (g, col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };

/* crisp shapes: canvas arcs are anti-aliased, these are not */
function disc(g, col, cx, cy, r) {
  g.fillStyle = col;
  for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); g.fillRect(Math.round(cx) - w, Math.round(cy) + dy, w * 2 + 1, 1); }
}
function oval(g, col, cx, cy, rx, ry) {
  g.fillStyle = col;
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) { const w = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry))); g.fillRect(Math.round(cx) - w, Math.round(cy) + dy, w * 2 + 1, 1); }
}
/* a ball lit from the top left, in up to four tones with a dithered falloff */
function shadeDisc(g, cx, cy, r, tones, lx = -0.55, ly = -0.8, soft = 0.3) {
  cx = Math.round(cx); cy = Math.round(cy);
  const n = tones.length;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + r * 0.4) continue;
    const v = ((dx / r) * lx + (dy / r) * ly + 1) / 2 + (bayer(cx + dx, cy + dy) - 0.5) * soft;
    g.fillStyle = tones[Math.max(0, Math.min(n - 1, Math.floor(v * n)))];
    g.fillRect(cx + dx, cy + dy, 1, 1);
  }
}
function pline(g, col, x0, y0, x1, y1, w = 1) {
  g.fillStyle = col;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; g.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), w, w); }
}
function ditherRect(g, col, x, y, w, h, level) {
  g.fillStyle = col;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bayer(x + i, y + j) < level) g.fillRect(x + i, y + j, 1, 1);
}

/* add a 1px dark outline around every opaque pixel */
function outlined(src, col = '#1c1426') {
  const w = src.width + 2, h = src.height + 2, out = mk(w, h), o = out.getContext('2d');
  const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  o.fillStyle = col;
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    if (d[(y * src.width + x) * 4 + 3] < 10) continue;
    o.fillRect(x, y + 1, 3, 1); o.fillRect(x + 1, y, 1, 3);
  }
  o.drawImage(src, 1, 1);
  return out;
}
/* push a sprite back into the scene: wash it with the air colour */
function tinted(src, col, amt) {
  const c = mk(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = amt; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  return c;
}
/* a flat silhouette of a sprite, for flashes and afterimages */
function silhouette(src, col) { return tinted(src, col, 1); }

/* ---------- runners ---------- */
const SHOE = '#2a2230';
/* foot and knee positions for one leg through an eight-frame run, relative to the hip */
const RUN_LEG = [[2, 3, 4, 5], [2, 3, 3, 6], [1, 3, 0, 6], [0, 3, -2, 6], [-1, 3, -4, 5], [0, 3, -4, 3], [2, 2, -1, 3], [3, 2, 2, 4]];
const RUN_BOB = [0, 1, 0, -1, 0, 1, 0, -1];
const RUN_ARM = [-3, -3, -1, 1, 3, 3, 1, -1];
function drawRunnerFrame(look, pose, k) {
  const c = mk(16, 24), g = c.getContext('2d');
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const skin = look.skin, skinD = shade(skin, -0.2), shirt = look.shirt, shirtD = shade(shirt, -0.28), shirtL = shade(shirt, 0.25);
  const pants = look.pants, pantsD = shade(pants, -0.25), pantsL = shade(pants, 0.16);

  if (pose === 'slide') {
    P(8, 20, 6, 2, pants); P(8, 22, 5, 1, pantsD); P(13, 20, 3, 3, SHOE); P(14, 20, 2, 1, '#4a4058');
    P(3, 16, 7, 5, shirt); P(3, 19, 7, 2, shirtD); P(4, 16, 3, 1, shirtL); P(1, 18, 3, 2, skinD); P(8, 17, 3, 2, skin);
    drawHead(g, look, 1, 10, 'focus', 1);
    return c;
  }
  if (pose === 'crouch') {
    P(5, 19, 3, 3, pants); P(9, 19, 3, 3, pants); P(5, 21, 3, 1, pantsD); P(9, 21, 3, 1, pantsD); P(4, 22, 4, 2, SHOE); P(9, 22, 4, 2, SHOE);
    P(5, 15, 7, 5, shirt); P(5, 18, 7, 2, shirtD); P(6, 15, 3, 1, shirtL); P(11, 16, 2, 3, skin);
    drawHead(g, look, 4, 8, 'focus', 0);
    return c;
  }

  let bob = 0, lean = 0, hlean = 0, legA = [0, 3, 1, 6], legB = [0, 3, -1, 6], armA = 0, armB = 0, armsUp = 0, face = 'calm', sway = 0;
  if (pose === 'idle') { bob = k === 1 ? 1 : 0; face = k === 3 ? 'blink' : 'calm'; }
  if (pose === 'run') { legA = RUN_LEG[k]; legB = RUN_LEG[(k + 4) % 8]; bob = RUN_BOB[k]; armA = RUN_ARM[k]; armB = -armA; lean = 1; hlean = 1; face = 'focus'; sway = k % 4 < 2 ? 0 : 1; }
  if (pose === 'jump') { legA = [2, 2, 1, 4]; legB = [-1, 3, -3, 5]; armsUp = 1; face = 'focus'; lean = 1; sway = 1; }
  if (pose === 'fall') { legA = [1, 3, 2, 6]; legB = [0, 3, -2, 5]; armsUp = 2; face = 'calm'; }
  if (pose === 'win') { legA = [0, 3, 2, 6]; legB = [0, 3, -2, 6]; armsUp = k ? 1 : 3; bob = k ? -1 : 0; face = 'happy'; }
  if (pose === 'stun') { legA = [1, 3, 3, 6]; legB = [-1, 3, -3, 6]; armA = 3; armB = -3; bob = 1; face = 'dizzy'; }

  const hipY = 16 + bob, tx = 5 + lean, sy = 11 + bob;
  const leg = (hx, L, c1, c2) => {
    const fx = hx + L[2], fy = Math.min(22, hipY + L[3]), kx = hx + L[0], ky = Math.min(fy - 2, hipY + L[1]);
    pline(g, c1, hx, hipY, kx, ky, 2); pline(g, c2, kx, ky, fx, fy - 1, 2);
    P(fx, fy, 2, 1, SHOE); P(fx, fy + 1, 3, 1, SHOE); P(fx + 2, fy + 1, 1, 1, '#4a4058');
  };
  const arm = (ax, swing, c1, hand) => { const ex = ax + Math.round(swing / 2), hx2 = ax + swing; P(ax, sy, 2, 2, c1); P(ex, sy + 2, 2, 1, c1); P(hx2, sy + 3 - (Math.abs(swing) > 2 ? 1 : 0), 2, 2, hand); };
  const armUp = (ax, mode, c1, hand, side) => {
    if (mode === 1) { P(ax, sy - 2, 2, 3, c1); P(ax + side, sy - 4, 2, 2, hand); }
    else if (mode === 2) { P(ax + side, sy, 3, 2, c1); P(ax + side * 3, sy - 1, 2, 2, hand); }
    else { P(ax, sy - 3, 2, 4, c1); P(ax, sy - 5, 2, 2, hand); }
  };
  /* back leg and arm */
  leg(7 + lean, legB, pantsD, shade(pants, -0.38));
  if (armsUp) armUp(tx, armsUp, shirtD, skinD, -1); else arm(tx, armB, shirtD, skinD);
  /* torso */
  P(tx, 10 + bob, 6, 6, shirt); P(tx, 14 + bob, 6, 2, shirtD); P(tx + 5, 11 + bob, 1, 3, shirtD); P(tx + 1, 10 + bob, 3, 1, shirtL);
  if (look.acc === 'sash') { for (let i = 0; i < 6; i++) P(tx + i, 14 + bob, 1, 1, i % 2 ? '#f4f1ea' : '#d0393a'); P(tx - 1, 15 + bob, 2, 2 + sway, '#d0393a'); }
  /* front leg, head, front arm */
  leg(8 + lean, legA, pants, pantsL);
  drawHead(g, look, 4 + lean + hlean, 2 + bob, face, sway);
  if (armsUp) armUp(tx + 4, armsUp, shirt, skin, 1); else arm(tx + 4, armA, shirt, skin);
  return c;
}
function drawHead(g, look, x, y, face, sway = 0) {
  const P = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
  const skin = look.skin, hair = look.hair, hairL = shade(hair, 0.28), hairD = shade(hair, -0.25);
  P(0, 1, 8, 7, skin); P(1, 0, 6, 1, skin); P(0, 6, 3, 2, shade(skin, -0.14)); P(1, 8, 5, 1, shade(skin, -0.2));
  /* face, looking right */
  if (face === 'happy') { P(4, 3, 1, 1, '#1d1410'); P(6, 3, 1, 1, '#1d1410'); P(4, 5, 3, 2, '#8a2a2a'); P(4, 5, 3, 1, '#ffffff'); }
  else if (face === 'dizzy') { P(3, 3, 2, 1, '#1d1410'); P(6, 3, 2, 1, '#1d1410'); P(4, 4, 1, 1, '#1d1410'); P(6, 2, 1, 1, '#1d1410'); P(5, 6, 2, 1, '#8a2a2a'); }
  else if (face === 'blink') { P(4, 4, 1, 1, '#3a2418'); P(6, 4, 1, 1, '#3a2418'); P(5, 6, 2, 1, '#b04a4a'); }
  else { P(4, 3, 1, 2, '#1d1410'); P(6, 3, 1, 2, '#1d1410'); P(4, 3, 1, 1, '#3a2c28'); P(5, 6, 2, 1, face === 'focus' ? '#7a2a2a' : '#b04a4a'); }
  P(7, 5, 1, 1, '#f08a7a'); P(3, 5, 1, 1, '#f0a090');
  switch (look.hairStyle) {
    case 'short': P(0, -1, 8, 3, hair); P(0, 2, 2, 4, hair); P(6, 1, 2, 1, hair); P(2, -1, 3, 1, hairL); P(0, 5, 1, 1, hairD); break;
    case 'spiky': P(0, -1, 8, 3, hair); P(0, 2, 2, 4, hair); P(1, -3, 1, 2, hair); P(3, -3, 1, 2, hair); P(5, -2, 1, 1, hair); P(7, 1, 1, 2, hair); P(2, -1, 2, 1, hairL); P(3, -3, 1, 1, hairL); break;
    case 'pony': P(0, -1, 8, 3, hair); P(0, 2, 2, 5, hair); P(-3, 1 - sway, 3, 2, hair); P(-3, 3 - sway, 2, 4, hair); P(-3, 6 - sway, 1, 1, hairD); P(6, 1, 2, 1, hair); P(2, -1, 3, 1, hairL); P(-1, 1 - sway, 1, 2, '#e85a7a'); break;
    case 'bob': P(-1, -1, 9, 3, hair); P(-1, 2, 3, 6, hair); P(6, 1, 2, 2, hair); P(2, -1, 3, 1, hairL); P(-1, 7, 3, 1, hairD); break;
    case 'long': P(0, -1, 8, 3, hair); P(-1, 1, 3, 9 + sway, hair); P(-2, 4, 1, 5 + sway, hair); P(6, 1, 2, 1, hair); P(2, -1, 3, 1, hairL); P(-1, 9 + sway, 2, 1, hairD); break;
    case 'cap': { const cap = shade(look.shirt, -0.15); P(0, -1, 8, 3, cap); P(6, 1, 4, 1, shade(cap, -0.25)); P(0, 2, 2, 3, hair); P(1, -1, 3, 1, shade(cap, 0.35)); P(3, -2, 2, 1, shade(cap, 0.15)); break; }
  }
  if (look.acc === 'band') { P(0, 1, 8, 1, '#d0393a'); P(-2, 1 + sway, 2, 1, '#d0393a'); P(-2, 2 + sway, 1, 2, '#a82a2a'); }
  if (look.acc === 'flower') { P(0, -2, 3, 3, '#ff8fb8'); P(1, -1, 1, 1, '#ffe14d'); P(0, -2, 1, 1, '#ffb8d0'); }
}

const RUNNER_CACHE = new Map();
const POSES = { idle: 4, run: 8, jump: 1, fall: 1, win: 2, stun: 1, slide: 1, crouch: 1 };
function runnerSprites(look) {
  const key = JSON.stringify(look);
  if (RUNNER_CACHE.has(key)) return RUNNER_CACHE.get(key);
  const set = {}, flipOf = base => { const f = mk(base.width, base.height), fg = f.getContext('2d'); fg.translate(base.width, 0); fg.scale(-1, 1); fg.drawImage(base, 0, 0); return f; };
  for (const [pose, n] of Object.entries(POSES)) {
    set[pose] = [];
    for (let k = 0; k < n; k++) { const base = outlined(drawRunnerFrame(look, pose, pose === 'idle' && k === 2 ? 0 : k)); set[pose].push([base, flipOf(base)]); }
  }
  /* a pale copy of the run and jump frames for speed afterimages and hit flashes */
  set.ghost = {};
  for (const pose of ['run', 'jump', 'fall', 'slide']) set.ghost[pose] = set[pose].map(fr => fr.map(c => silhouette(c, '#ffffff')));
  const head = mk(12, 12), hg = head.getContext('2d');
  drawHead(hg, look, 2, 3, 'calm');
  set.head = outlined(head);
  RUNNER_CACHE.set(key, set);
  return set;
}

/* ---------- item icons ---------- */
const ICON_CACHE = {};
function itemIcon(key) {
  if (ICON_CACHE[key]) return ICON_CACHE[key];
  const c = mk(16, 16), g = c.getContext('2d');
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  switch (key) {
    case 'boost': // a curl of wind
      P(2, 4, 9, 2, '#bfeaff'); P(10, 3, 3, 1, '#bfeaff'); P(12, 4, 2, 3, '#7fd4ff'); P(9, 7, 4, 1, '#7fd4ff'); P(1, 8, 11, 2, '#7fd4ff'); P(3, 11, 9, 2, '#4fb0e8'); P(11, 10, 3, 1, '#4fb0e8'); P(13, 11, 1, 2, '#4fb0e8'); P(3, 4, 4, 1, '#ffffff'); P(2, 8, 3, 1, '#e8f8ff'); break;
    case 'shield': // a yantra cloth
      P(3, 1, 10, 13, '#ffd34d'); P(4, 2, 8, 11, '#f6b83a'); P(3, 14, 2, 1, '#e08a1a'); P(7, 14, 2, 1, '#e08a1a'); P(11, 14, 2, 1, '#e08a1a');
      P(7, 3, 2, 9, '#c0392b'); P(5, 5, 6, 1, '#c0392b'); P(5, 9, 6, 1, '#c0392b'); P(6, 7, 4, 1, '#c0392b'); P(4, 2, 8, 1, '#ffe88a'); P(3, 1, 10, 1, '#fff2b0'); break;
    case 'freeze': // a spell orb
      disc(g, '#7a4fd0', 8, 8, 6); disc(g, '#b58cff', 7, 7, 4); P(5, 4, 3, 2, '#e8dcff'); P(5, 6, 1, 1, '#ffffff'); P(10, 10, 2, 2, '#5a35a8'); P(13, 2, 1, 3, '#e8dcff'); P(12, 3, 3, 1, '#e8dcff'); P(2, 12, 1, 1, '#e8dcff'); break;
    case 'trap': // a banana peel
      P(7, 1, 2, 3, '#6a4a1a'); P(6, 4, 4, 3, '#f5d33b'); P(4, 7, 3, 4, '#f5d33b'); P(9, 7, 3, 4, '#f5d33b'); P(2, 10, 3, 3, '#e8c020'); P(11, 10, 3, 3, '#e8c020'); P(7, 7, 2, 5, '#fff2a0'); P(6, 12, 4, 2, '#f5d33b'); P(6, 4, 1, 3, '#fff2a0'); P(2, 12, 2, 1, '#c8a010'); P(12, 12, 2, 1, '#c8a010'); break;
    case 'cloud': // a rain cloud with a bolt
      disc(g, '#8aa0b8', 5, 6, 3); disc(g, '#8aa0b8', 10, 5, 4); P(2, 6, 12, 4, '#8aa0b8'); P(3, 9, 10, 1, '#6a7f98'); P(4, 3, 3, 1, '#b8c8d8'); P(9, 2, 3, 1, '#b8c8d8');
      P(8, 10, 2, 2, '#ffe14d'); P(7, 12, 2, 1, '#ffe14d'); P(8, 13, 1, 2, '#ffe14d'); P(3, 11, 1, 2, '#4fb0e8'); P(12, 11, 1, 3, '#4fb0e8'); P(5, 13, 1, 2, '#4fb0e8'); break;
    case 'wing': // a garuda wing
      P(2, 3, 3, 2, '#e07a1c'); P(3, 5, 5, 2, '#ff9a3c'); P(4, 7, 7, 2, '#ffb85c'); P(5, 9, 8, 2, '#ffd27a'); P(7, 11, 7, 2, '#ffe8a8'); P(1, 2, 2, 2, '#c0392b');
      P(7, 5, 1, 2, '#e07a1c'); P(10, 7, 1, 2, '#e07a1c'); P(12, 9, 1, 2, '#e8a03c'); P(3, 5, 2, 1, '#ffc27a'); P(13, 12, 1, 1, '#ffffff'); break;
  }
  return (ICON_CACHE[key] = outlined(c));
}

/* ---------- colours each tale is drawn with ---------- */
const KITS = {};
function kit(id) {
  if (KITS[id]) return KITS[id];
  const th = THEMES[id];
  const K = { id, th, air: mix(th.sky[0], th.sky[1], 0.6) };
  K.soilT = [shade(th.soil2, -0.18), th.soil2, th.soil, shade(th.soil, 0.14)];
  K.deep = shade(th.soil2, -0.55);
  K.grass = [shade(th.top2, -0.25), th.top2, th.top, shade(th.top, 0.35)];
  if (id === 'sangthong') { K.leaf = ['#255a34', '#2f7a3a', '#48a046', '#7cc85a']; K.trunk = ['#4a2e1c', '#6a4426', '#8a5e34']; }
  else if (id === 'plabuthong') { K.leaf = ['#3a5a24', '#557a2c', '#7aa83a', '#b8d45a']; K.trunk = ['#4a3220', '#7a5632', '#a07a48']; }
  else if (id === 'kraithong') { K.leaf = ['#1c3a44', '#27525a', '#3a7a78', '#6ab8a8']; K.trunk = ['#2a2a3a', '#3a3a4c', '#52526a']; K.rock = ['#262634', '#363646', '#4a4a5c', '#6a6a80']; }
  else { K.leaf = ['#c8a8c8', '#e8c8d8', '#f8e8ec', '#ffffff']; K.trunk = ['#8a5a4a', '#b07a5a', '#d8a078']; K.cloud = ['#c9bfe0', '#e3dcf2', '#f6f2fb', '#ffffff']; }
  return (KITS[id] = K);
}

/* ---------- tiles ---------- */
function tileSet(th) {
  if (th._tiles) return th._tiles;
  const id = Object.keys(THEMES).find(k => THEMES[k] === th), K = kit(id);
  const S = { K }, R = rng(id.length * 977 + 31);
  const mkTile = fn => { const c = mk(TILE, TILE); fn(c.getContext('2d')); return c; };
  const sky = id === 'kaewnama', cave = id === 'kraithong';
  /* body of the ground: earth with pebbles, rock with cracks, or cloud */
  S.soil = [0, 1, 2, 3].map(v => mkTile(g => {
    if (sky) {
      PX(g, K.cloud[2], 0, 0, 16, 16);
      for (let i = 0; i < 5; i++) { const x = (R() * 13) | 0, y = (R() * 13) | 0; PX(g, K.cloud[R() < 0.5 ? 1 : 3], x, y, 3, 1); PX(g, K.cloud[3], x + 1, y - 1, 2, 1); }
      return;
    }
    PX(g, K.soilT[2], 0, 0, 16, 16);
    for (let i = 0; i < 16; i++) { const x = (R() * 15) | 0, y = (R() * 15) | 0, t = R(); PX(g, t < 0.45 ? K.soilT[1] : t < 0.8 ? K.soilT[3] : K.soilT[0], x, y, t < 0.3 ? 2 : 1, 1); }
    if (cave) { // strata and a crack
      for (let x = 0; x < 16; x++) if (R() < 0.75) PX(g, K.soilT[1], x, 5 + ((x * 3 + v) % 2), 1, 1);
      if (v === 1) { pline(g, K.soilT[0], 4, 8, 7, 12); pline(g, K.soilT[0], 7, 12, 6, 15); }
      if (v === 3) { PX(g, th.spike, 9, 9, 2, 2); PX(g, shade(th.spike, 0.5), 9, 9, 1, 1); PX(g, shade(th.spike, -0.35), 10, 11, 2, 1); }
    } else if (v === 1) { // a buried stone
      PX(g, shade(th.soil, 0.32), 4, 8, 5, 3); PX(g, shade(th.soil, 0.5), 5, 8, 3, 1); PX(g, K.soilT[0], 4, 11, 5, 1);
    } else if (v === 3) { PX(g, shade(th.soil, 0.3), 10, 4, 3, 2); PX(g, K.soilT[0], 10, 6, 3, 1); PX(g, K.soilT[0], 2, 12, 2, 1); }
  }));
  S.plankSet = ['L', 'M', 'R', 'S'].map(kind => mkTile(g => {
    if (sky) {
      PX(g, K.cloud[3], kind === 'L' || kind === 'S' ? 2 : 0, 1, kind === 'M' ? 16 : kind === 'S' ? 12 : 14, 4); PX(g, K.cloud[3], 3, 0, 10, 1);
      PX(g, K.cloud[1], kind === 'L' || kind === 'S' ? 3 : 0, 5, kind === 'M' ? 16 : 12, 1); PX(g, K.cloud[0], 5, 6, 6, 1);
      return;
    }
    if (cave) {
      PX(g, '#5a5a70', 0, 0, 16, 5); PX(g, '#7a7a92', 0, 0, 16, 1); PX(g, '#3a3a4c', 0, 4, 16, 2); PX(g, '#46465a', 6, 1, 1, 3); PX(g, '#8fe0ff', 11, 1, 1, 1);
      if (kind === 'L' || kind === 'S') { PX(g, '#3a3a4c', 0, 0, 1, 6); g.clearRect(0, 0, 1, 1); }
      if (kind === 'R' || kind === 'S') { PX(g, '#2e2e3e', 15, 0, 1, 6); g.clearRect(15, 0, 1, 1); }
      return;
    }
    const p = th.plank;
    PX(g, p, 0, 0, 16, 5); PX(g, shade(p, 0.28), 0, 0, 16, 1); PX(g, shade(p, -0.32), 0, 4, 16, 1); PX(g, shade(p, -0.2), 7, 1, 1, 3); PX(g, shade(p, -0.45), 0, 5, 16, 1);
    PX(g, shade(p, 0.12), 2, 2, 3, 1); PX(g, shade(p, -0.12), 10, 3, 4, 1); PX(g, '#3a2a1a', 3, 2, 1, 1); PX(g, '#3a2a1a', 12, 2, 1, 1);
    if (kind === 'L' || kind === 'S') { PX(g, shade(p, -0.3), 1, 5, 2, 6); pline(g, shade(p, -0.3), 2, 10, 7, 6); PX(g, '#e8d8a8', 0, 1, 1, 3); }
    if (kind === 'R' || kind === 'S') { PX(g, shade(p, -0.3), 13, 5, 2, 6); pline(g, shade(p, -0.3), 13, 10, 8, 6); PX(g, '#e8d8a8', 15, 1, 1, 3); }
  }));
  S.plank = S.plankSet[1];
  S.top = [0, 1].map(v => mkTile(g => { g.drawImage(S.soil[v], 0, 0); PX(g, th.top2, 0, 0, 16, 6); PX(g, th.top, 0, 0, 16, 4); }));  // simple caps, for thumbnails
  S.wall = [0, 1].map(v => mkTile(g => {
    if (cave) { PX(g, K.rock[1], 0, 0, 16, 16); for (let i = 0; i < 10; i++) PX(g, K.rock[R() < 0.5 ? 0 : 2], (R() * 14) | 0, (R() * 14) | 0, 2 + ((R() * 2) | 0), 1); if (v) pline(g, K.rock[0], 3, 2, 8, 9); return; }
    if (sky) { PX(g, '#6a6a8e', 0, 0, 16, 16); for (let i = 0; i < 6; i++) { const x = (R() * 12) | 0, y = (R() * 13) | 0; PX(g, R() < 0.5 ? '#585878' : '#8080a4', x, y, 4, 1); } return; }
    PX(g, K.leaf[1], 0, 0, 16, 16);
    for (let i = 0; i < 9; i++) { const x = (R() * 13) | 0, y = (R() * 13) | 0, t = R(); PX(g, K.leaf[t < 0.4 ? 0 : t < 0.8 ? 2 : 3], x, y, 3, 2); PX(g, K.leaf[t < 0.4 ? 0 : 2], x + 1, y - 1, 2, 1); }
  }));
  S.spike = mkTile(g => {
    if (sky) { // a small thundercloud
      disc(g, '#5a5a7a', 4, 11, 3); disc(g, '#5a5a7a', 11, 11, 3); disc(g, '#6a6a8e', 8, 9, 4); PX(g, '#5a5a7a', 2, 11, 12, 4); PX(g, '#44445e', 2, 14, 12, 1); PX(g, '#8a8ab0', 6, 6, 3, 1);
      PX(g, '#ffe14d', 7, 10, 2, 2); PX(g, '#ffe14d', 6, 12, 2, 1); PX(g, '#fff6c8', 7, 13, 1, 2); return;
    }
    for (let i = 0; i < 4; i++) {
      const x = i * 4, h = i % 2 ? 9 : 7, col = cave ? th.spike : i % 2 ? '#d8c890' : '#c2b078';
      PX(g, shade(col, -0.3), x + 1, 16 - h + 3, 3, h - 3); PX(g, col, x + 1, 16 - h + 3, 2, h - 3); PX(g, col, x + 1, 16 - h + 1, 2, 2); PX(g, col, x + 2, 16 - h, 1, 1);
      PX(g, shade(col, 0.45), x + 1, 16 - h + 2, 1, 4); if (!cave) PX(g, shade(col, -0.4), x + 1, 16 - 3, 3, 1);
    }
    if (!cave) PX(g, shade(th.top2, -0.25), 0, 15, 16, 1);
  });
  S.spring = mkTile(g => {
    PX(g, '#5a5f6a', 2, 14, 12, 2); PX(g, '#7a808c', 2, 14, 12, 1);
    for (let y = 9; y < 14; y += 2) { PX(g, '#b8bcc6', 4, y, 8, 1); PX(g, '#7a808c', 5, y + 1, 7, 1); }
    PX(g, '#c0392b', 1, 5, 14, 4); PX(g, '#ff6a50', 1, 5, 14, 2); PX(g, '#ffa08a', 3, 5, 5, 1); PX(g, '#8a2a20', 1, 8, 14, 1); PX(g, '#ffd34d', 7, 6, 2, 2);
  });
  return (th._tiles = S);
}

/* ---------- decor sprites: trees, houses, crystals, kites ---------- */
function bushSprite(K, w, seed) {
  const R = rng(seed), h = Math.round(w * 0.55), c = mk(w, h + 2), g = c.getContext('2d');
  for (let i = 0; i < 4; i++) { const r = Math.round(w * (0.16 + R() * 0.08)); shadeDisc(g, r + R() * (w - 2 * r), h - r * 0.7, r, K.leaf); }
  return c;
}
function treeSprite(K, seed) {
  const R = rng(seed), c = mk(60, 78), g = c.getContext('2d'), [tD, tM, tL] = K.trunk;
  const tx = 28, top = 34;
  for (let y = top; y < 78; y++) { const w = y > 70 ? 6 + (y - 70) : 5; PX(g, tM, tx - (w >> 1), y, w, 1); PX(g, tD, tx + (w >> 1) - 2, y, 2, 1); PX(g, tL, tx - (w >> 1), y, 1, 1); }
  for (let y = top + 6; y < 74; y += 7) PX(g, tD, tx - 1 + ((y * 3) % 3), y, 2, 1);
  pline(g, tM, tx + 2, 50, tx + 9, 43, 2); pline(g, tM, tx - 2, 46, tx - 8, 40, 2);
  const blobs = [[30, 30, 15], [17, 34, 11], [43, 33, 11], [22, 20, 11], [38, 19, 11], [30, 12, 9], [29, 38, 12]];
  const dark = K.leaf.map(c2 => shade(c2, -0.18));
  blobs.forEach(([x, y, r], i) => shadeDisc(g, x + (R() - 0.5) * 3, y + (R() - 0.5) * 3, r + ((R() * 2) | 0), i < 3 ? dark : K.leaf));
  for (let i = 0; i < 9; i++) { const x = 12 + R() * 36, y = 8 + R() * 30; PX(g, K.leaf[3], x, y, 2, 1); PX(g, K.leaf[2], x - 1, y + 1, 2, 1); }
  return c;
}
function palmSprite(K, seed) {
  const R = rng(seed), c = mk(64, 84), g = c.getContext('2d'), [tD, tM, tL] = K.trunk;
  let x = 30;
  for (let y = 83; y > 26; y--) { x += Math.sin((83 - y) * 0.035) * 0.22; PX(g, tM, x - 2, y, 4, 1); PX(g, tD, x + 1, y, 1, 1); PX(g, tL, x - 2, y, 1, 1); if (y % 5 === 0) PX(g, tD, x - 2, y, 4, 1); }
  const cx = Math.round(x), cy = 26;
  const frond = (ang, len, col, col2) => {
    for (let i = 0; i < len; i++) {
      const t = i / len, fx = cx + Math.cos(ang) * i, fy = cy + Math.sin(ang) * i + t * t * len * 0.55;
      PX(g, col, fx, fy, 2, 1);
      const leaf = Math.round(5 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
      for (let k = 1; k <= leaf; k++) PX(g, k > leaf - 1 ? col2 : col, fx - Math.sign(Math.cos(ang)) * k * 0.4, fy + k, 1, 1);
    }
  };
  [[-2.9, 26], [-0.25, 26], [-2.3, 24], [-0.85, 24], [-1.57, 17], [-3.3, 20], [0.15, 20]].forEach(([a, l], i) => frond(a, l, K.leaf[i % 2 ? 1 : 2], K.leaf[i % 2 ? 0 : 1]));
  disc(g, '#5a3a1a', cx - 2, cy + 3, 2); disc(g, '#6a4a22', cx + 3, cy + 4, 2); PX(g, '#8a6a3a', cx - 3, cy + 2, 1, 1);
  if (R() < 0.5) disc(g, '#5a3a1a', cx + 1, cy + 6, 2);
  return c;
}
function bananaSprite(K) {
  const c = mk(40, 44), g = c.getContext('2d');
  PX(g, '#7a9a4a', 18, 16, 4, 28); PX(g, '#5a7a34', 21, 16, 1, 28); PX(g, '#9aba6a', 18, 16, 1, 28); PX(g, '#5a7a34', 18, 26, 4, 1); PX(g, '#5a7a34', 18, 36, 4, 1);
  const leafAt = (x0, y0, dir, len, lift, col, col2) => {      // a broad blade with a midrib and a few tears
    for (let i = 0; i < len; i++) {
      const t = i / len, w = Math.round(6 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08))) + 1, x = Math.round(x0 + dir * i), y = Math.round(y0 - Math.sin(t * 1.9) * lift + t * t * 9);
      if (i % 5 === 4) { PX(g, col2, x, y - (w >> 1), 1, w); continue; }
      PX(g, col, x, y - (w >> 1), 1, w); PX(g, K.leaf[3], x, y - (w >> 1), 1, 1); PX(g, col2, x, y, 1, 1); PX(g, K.leaf[0], x, y + (w >> 1), 1, 1);
    }
  };
  leafAt(20, 17, -1, 17, 9, K.leaf[1], K.leaf[0]); leafAt(20, 16, 1, 17, 10, K.leaf[2], K.leaf[1]); leafAt(20, 12, -0.55, 13, 11, K.leaf[2], K.leaf[1]); leafAt(20, 11, 0.6, 13, 12, K.leaf[1], K.leaf[0]);
  PX(g, '#c8a010', 22, 23, 4, 7); PX(g, '#e8c020', 22, 23, 3, 6); PX(g, '#fff2a0', 22, 23, 1, 4); PX(g, '#6a4a1a', 23, 21, 1, 2);
  return c;
}
function houseSprite(K, seed) {
  const R = rng(seed), c = mk(58, 62), g = c.getContext('2d'), wall = R() < 0.5 ? '#a8743e' : '#9a6a44', roof = R() < 0.5 ? '#7a3a2a' : '#6a5a34';
  for (const x of [8, 22, 34, 48]) { PX(g, '#5a3a1a', x, 38, 2, 24); PX(g, '#3a2410', x + 1, 38, 1, 24); }
  PX(g, '#6a4426', 5, 36, 48, 3); PX(g, '#8a5e34', 5, 36, 48, 1);
  PX(g, wall, 8, 18, 42, 18); for (let x = 8; x < 50; x += 4) PX(g, shade(wall, -0.18), x, 18, 1, 18); PX(g, shade(wall, -0.3), 8, 34, 42, 2);
  PX(g, '#3a2410', 16, 24, 8, 12); PX(g, '#5a3a1a', 17, 25, 6, 11); PX(g, '#ffd27a', 32, 23, 9, 7); PX(g, '#fff0b8', 33, 24, 3, 2); PX(g, '#5a3a1a', 36, 23, 1, 7); PX(g, '#5a3a1a', 32, 26, 9, 1);
  for (let i = 0; i < 16; i++) { const y = 2 + i, half = 5 + i * 1.6; PX(g, i % 3 === 2 ? shade(roof, -0.2) : roof, 29 - half, y, half * 2, 1); PX(g, shade(roof, 0.25), 29 - half, y, 2, 1); }
  PX(g, shade(roof, -0.35), 3, 18, 52, 1); pline(g, '#e8c060', 29, 2, 25, -2 + 4); pline(g, '#e8c060', 29, 2, 33, 2); PX(g, '#e8c060', 28, 0, 2, 3);
  for (let y = 39; y < 62; y += 4) PX(g, '#6a4426', 24, y, 8, 1); PX(g, '#5a3a1a', 24, 38, 1, 24); PX(g, '#5a3a1a', 31, 38, 1, 24);
  return c;
}
function smallDecor(K, kind) {
  const c = mk(24, 30), g = c.getContext('2d'), P = (x, y, w, h, col) => PX(g, col, x, y, w, h);
  switch (kind) {
    case 'flowers': for (let i = 0; i < 4; i++) { const x = 3 + i * 5, h = 5 + (i % 2) * 2; P(x + 1, 30 - h, 1, h, K.grass[1]); P(x, 30 - h - 2, 3, 2, ['#ff8fb8', '#ffe14d', '#ffffff', '#ff6a50'][i]); P(x + 1, 30 - h - 3, 1, 1, ['#ffb8d0', '#fff2a0', '#ffffff', '#ffa08a'][i]); P(x + 1, 30 - h - 1, 1, 1, '#f0a020'); } break;
    case 'fern': for (let i = -3; i <= 3; i++) { const len = 9 - Math.abs(i) * 1.5; for (let k = 0; k < len; k++) P(12 + i * k * 0.42, 29 - k + (k * k * Math.abs(i)) / 26, 1, 1, k > len - 3 ? K.leaf[3] : K.leaf[Math.abs(i) % 2 + 1]); } break;
    case 'conch': P(7, 24, 10, 6, '#8a5a32'); P(7, 24, 10, 1, '#b07a3e'); P(6, 28, 12, 2, '#6a4426'); disc(g, '#f0b030', 12, 18, 6); disc(g, '#ffd34d', 11, 17, 4); P(9, 14, 3, 2, '#fff2b0'); P(15, 21, 3, 2, '#c08010'); P(11, 17, 2, 2, '#e0a020'); P(17, 16, 3, 2, '#ffd34d'); P(19, 15, 1, 1, '#fff2b0'); break;
    case 'mound': shadeDisc(g, 10, 25, 6, ['#5a5a66', '#7a7a86', '#9a9aa6', '#c0c0ca']); shadeDisc(g, 17, 26, 4, ['#5a5a66', '#7a7a86', '#9a9aa6', '#c0c0ca']); P(6, 21, 5, 2, K.leaf[2]); P(8, 20, 3, 1, K.leaf[3]); P(15, 23, 3, 1, K.leaf[2]); g.clearRect(0, 30, 24, 2); break;   // mossy rocks
    case 'jar': oval(g, '#8a4a2e', 12, 22, 8, 8); oval(g, '#a85e3a', 11, 21, 6, 6); P(6, 13, 12, 2, '#b8744a'); P(7, 14, 10, 1, '#6a3a22'); P(8, 18, 2, 5, '#c8845a'); P(8, 10, 2, 4, '#3f8a3a'); P(14, 9, 2, 5, '#3f8a3a'); disc(g, '#ff8fb8', 9, 8, 2); P(9, 7, 1, 1, '#ffd0e0'); oval(g, '#4aa04a', 15, 9, 3, 1); break;
    case 'spirit': P(11, 14, 2, 16, '#8a6a3a'); P(12, 14, 1, 16, '#6a4a22'); P(5, 12, 14, 2, '#b08a4a'); P(7, 5, 10, 7, '#f0e0b8'); P(9, 7, 3, 5, '#7a3a2a'); P(14, 7, 2, 2, '#ffd27a'); for (let i = 0; i < 5; i++) P(5 + i, 4 - i, 14 - i * 2, 1, i % 2 ? '#a82a2a' : '#c0392b'); P(11, -1, 2, 2, '#ffd34d'); P(4, 4, 1, 1, '#ffd34d'); P(19, 4, 1, 1, '#ffd34d'); P(8, 12, 1, 3, '#ffb03a'); P(16, 12, 1, 3, '#ff8fb8'); break;
    case 'hay': oval(g, '#c8a040', 12, 22, 9, 8); oval(g, '#e0c060', 11, 20, 7, 6); P(11, 8, 2, 8, '#8a6a3a'); for (let i = 0; i < 6; i++) P(5 + i * 3, 18 + (i % 2) * 3, 1, 6, '#a88028'); P(8, 16, 4, 1, '#f2dc8a'); break;
    case 'fence': for (let i = 0; i < 3; i++) { P(3 + i * 8, 18, 2, 12, '#8a6a3a'); P(4 + i * 8, 18, 1, 12, '#6a4a22'); P(3 + i * 8, 17, 2, 1, '#b08a4a'); } P(1, 21, 22, 2, '#a07a42'); P(1, 21, 22, 1, '#c09a5a'); P(1, 26, 22, 1, '#8a6a3a'); break;
    case 'stalag': for (let y = 30; y > 4; y--) { const w = Math.max(1, Math.round((y - 4) * 0.34)); P(12 - w, y, w * 2, 1, K.rock[1]); P(12 - w, y, Math.max(1, w >> 1), 1, K.rock[3]); P(12 + w - 1, y, 1, 1, K.rock[0]); } for (let y = 30; y > 16; y--) { const w = Math.max(1, Math.round((y - 16) * 0.3)); P(20 - w, y, w * 2, 1, K.rock[1]); P(20 - w, y, 1, 1, K.rock[2]); } break;
    case 'crystal': { const cr = (x, h, w, a, b) => { for (let i = 0; i < h; i++) { const ww = i < 3 ? Math.max(1, w - (3 - i)) : w; P(x - (ww >> 1), 30 - h + i, ww, 1, a); P(x - (ww >> 1), 30 - h + i, 1, 1, '#ffffff'); P(x + (ww >> 1) - (ww > 1 ? 1 : 0), 30 - h + i, 1, 1, b); } }; cr(7, 11, 4, '#4fc0e0', '#2a8ab0'); cr(13, 19, 5, '#8fe0ff', '#4fa8d0'); cr(19, 9, 3, '#4fc0e0', '#2a8ab0'); break; }
    case 'torch': P(11, 12, 2, 18, '#5a4a3a'); P(12, 12, 1, 18, '#3a2e22'); P(9, 10, 6, 3, '#7a6a52'); P(9, 12, 6, 1, '#3a2e22'); break;
    case 'chest': P(4, 20, 16, 10, '#7a4a22'); P(4, 20, 16, 2, '#a86a32'); P(4, 24, 16, 1, '#3a2410'); P(11, 23, 2, 3, '#ffd34d'); P(3, 19, 18, 1, '#ffd34d'); P(6, 16, 3, 4, '#ffd34d'); P(11, 15, 4, 5, '#ffe88a'); P(15, 17, 3, 3, '#f0b030'); P(7, 16, 1, 1, '#fff6c8'); P(12, 15, 1, 1, '#ffffff'); P(18, 28, 3, 2, '#ffd34d'); P(1, 29, 2, 1, '#f0b030'); break;
    case 'shroom': P(6, 22, 2, 8, '#d8e8e0'); oval(g, '#3ab8a8', 7, 20, 5, 3); P(4, 19, 2, 1, '#aef0e0'); P(16, 25, 2, 5, '#d8e8e0'); oval(g, '#4fd0c0', 17, 24, 4, 2); P(15, 23, 1, 1, '#c8fff0'); P(8, 21, 1, 1, '#c8fff0'); break;
    case 'kite': P(11, 12, 1, 18, 'rgba(110,100,140,.7)'); for (let i = 0; i < 9; i++) { const w = i < 4 ? i * 2 + 1 : (8 - i) * 2 + 1; P(12 - (w >> 1), i, w, 1, i < 4 ? '#e0503f' : '#c0392b'); } P(11, 0, 1, 9, '#ffd34d'); P(8, 4, 8, 1, '#ffd34d'); P(13, 10, 1, 3, '#ffd34d'); P(14, 13, 1, 3, '#3f7fd8'); break;
    case 'stupa': oval(g, K.cloud[1], 12, 27, 11, 3); oval(g, K.cloud[3], 11, 26, 9, 2); P(6, 20, 12, 5, '#f4e6c8'); P(6, 24, 12, 1, '#d8c8a0'); P(8, 15, 8, 5, '#f8ecd0'); oval(g, '#f8ecd0', 12, 13, 3, 3); P(11, 3, 2, 8, '#ffd34d'); P(12, 3, 1, 8, '#e0a020'); P(11, 1, 1, 2, '#fff2b0'); P(7, 20, 1, 5, '#ffffff'); break;
    case 'tung': P(11, 2, 2, 28, '#b07a5a'); P(12, 2, 1, 28, '#8a5a4a'); P(13, 3, 8, 2, '#ffd34d'); for (let i = 0; i < 5; i++) { P(14, 5 + i * 4, 6, 3, i % 2 ? '#3f7fd8' : '#e0503f'); P(14, 5 + i * 4, 6, 1, i % 2 ? '#7fb0f0' : '#ff8a70'); } P(15, 25, 1, 3, '#ffd34d'); P(18, 25, 1, 3, '#ffd34d'); break;
    case 'puff': shadeDisc(g, 8, 24, 6, K.cloud); shadeDisc(g, 16, 23, 7, K.cloud); shadeDisc(g, 12, 20, 6, K.cloud); break;
  }
  return c;
}
const DECOR_CACHE = {};
function decorSet(id) {
  if (DECOR_CACHE[id]) return DECOR_CACHE[id];
  const K = kit(id), T = (c, amt = 0.14) => tinted(c, K.air, amt);
  const big = [], small = [];
  if (id === 'sangthong') {
    for (let i = 0; i < 3; i++) big.push(T(treeSprite(K, 11 + i * 7)));
    big.push(T(bananaSprite(K)));
    ['flowers', 'fern', 'conch', 'mound', 'flowers', 'fern'].forEach(k => small.push(T(smallDecor(K, k), k === 'conch' ? 0.04 : 0.1)));
    small.push(T(bushSprite(K, 26, 5)), T(bushSprite(K, 20, 9)));
  } else if (id === 'plabuthong') {
    for (let i = 0; i < 2; i++) big.push(T(palmSprite(K, 3 + i * 5), 0.16));
    for (let i = 0; i < 2; i++) big.push(T(houseSprite(K, 17 + i * 3), 0.16));
    big.push(T(bananaSprite(K), 0.16));
    ['jar', 'spirit', 'hay', 'fence', 'flowers', 'fence'].forEach(k => small.push(T(smallDecor(K, k), 0.1)));
    small.push(T(bushSprite(K, 24, 4), 0.12));
  } else if (id === 'kraithong') {
    ['stalag', 'crystal', 'torch', 'chest', 'shroom', 'crystal', 'stalag'].forEach(k => small.push(smallDecor(K, k)));
  } else {
    ['kite', 'stupa', 'tung', 'puff', 'kite', 'puff'].forEach(k => small.push(smallDecor(K, k)));
  }
  return (DECOR_CACHE[id] = { big, small });
}

/* ---------- level art: decor and tiles pre-drawn into two canvases ---------- */
function buildLevelArt(lv, x0 = 0, x1 = lv.W) {             // x0..x1: only these tile columns (used for menu thumbnails)
  const th = lv.th, id = lv.theme, S = tileSet(th), K = S.K, D = decorSet(id);
  lv.tiles = S;
  const c = mk((x1 - x0) * TILE, lv.pxH), g = c.getContext('2d');
  const f = mk((x1 - x0) * TILE, lv.pxH), fg = f.getContext('2d');       // bits drawn in front of the runners
  g.translate(-x0 * TILE, 0); fg.translate(-x0 * TILE, 0);
  const R = rng(lv.idx * 7919 + 13);
  const sky = id === 'kaewnama', cave = id === 'kraithong';
  const sol = (x, y) => isSolidT(tileAt(lv, x, y));
  const surf = x => { for (let y = 2; y < lv.H; y++) if (sol(x, y) && tileAt(lv, x, y - 1) === T.EMPTY && tileAt(lv, x, y - 2) === T.EMPTY) return tileAt(lv, x, y) === T.MUD ? -1 : y; return -1; };
  /* keep decor away from things you interact with */
  const busy = new Set();
  const mark = (px, r = 1) => { const tx = Math.floor(px / TILE); for (let i = -r; i <= r; i++) busy.add(tx + i); };
  lv.boxes.forEach(b => mark(b.x)); lv.cps.forEach(cp => mark(cp.x, 2)); mark(lv.finishX, 3);
  lv.haz.forEach(h => mark(h.px ?? h.x ?? h.x0, 1));
  for (let y = 0; y < lv.H; y++) for (let x = 0; x < lv.W; x++) { const ct = tileAt(lv, x, y); if (ct === T.SPIKE || ct === T.SPRING || ct === T.BOOST) busy.add(x); }
  lv.glows = [];

  /* decor behind the track */
  let lastBig = -9;
  for (let x = Math.max(3, x0 - 4); x < Math.min(lv.W - 3, x1 + 4); x++) {
    const sy = surf(x);
    if (sy < 0) continue;
    const roomy = [1, 2, 3, 4].every(k => !sol(x, sy - k) && tileAt(lv, x, sy - k) !== T.ONEWAY) && sol(x - 1, sy) && sol(x + 1, sy);
    if (D.big.length && roomy && x - lastBig > 5 && ![-2, -1, 0, 1, 2].some(k => busy.has(x + k)) && R() < 0.24) {
      const sp = D.big[(R() * D.big.length) | 0];
      g.drawImage(sp, x * TILE + 8 - (sp.width >> 1), sy * TILE - sp.height + 2); lastBig = x; continue;
    }
    if (!busy.has(x) && R() < (cave || sky ? 0.2 : 0.3)) {
      const i = (R() * D.small.length) | 0, sp = D.small[i];
      if (sky && i % 6 === 0 && !roomy) continue;
      const px = x * TILE + 8 - (sp.width >> 1), py = sy * TILE - sp.height + (sky ? 1 : 0);
      g.drawImage(sp, px, py);
      if (cave && (i === 1 || i === 5)) lv.glows.push({ x: x * TILE + 8, y: sy * TILE - 10, r: 22, col: '143,224,255' });
      if (cave && i === 4) lv.glows.push({ x: x * TILE + 6, y: sy * TILE - 8, r: 14, col: '79,208,192' });
      if (cave && i === 2) lv.torches = (lv.torches || []).concat([{ x: x * TILE + 8, y: sy * TILE - 20 }]);
    }
  }

  /* ground */
  for (let y = 0; y < lv.H; y++) for (let x = Math.max(0, x0 - 1); x < Math.min(lv.W, x1 + 1); x++) {
    const ct = tileAt(lv, x, y), px = x * TILE, py = y * TILE;
    if (ct === T.SOLID || ct === T.MUD) {
      const up = sol(x, y - 1), dn = sol(x, y + 1) || y === lv.H - 1, lf = sol(x - 1, y) || x === 0, rt = sol(x + 1, y);
      g.drawImage(S.soil[[0, 2, 0, 1, 2, 0, 3, 2][Math.floor(hash01(x * 12.9898 + y * 78.233) * 8)]], px, py);
      let d = 0; while (d < 7 && sol(x, y - 1 - d)) d++;
      if (d && !sky) { g.globalAlpha = Math.min(0.5, d * 0.085); PX(g, K.deep, px, py, 16, 16); g.globalAlpha = 1; }
      if (sky && d) ditherRect(g, K.cloud[1], px, py, 16, 16, Math.min(0.75, d * 0.28));
      if (!lf) { if (sky) { disc(g, K.cloud[3], px + 1, py + 9, 4); disc(g, K.cloud[2], px, py + 13, 3); } else { PX(g, K.soilT[3], px, py, 1, 16); ditherRect(g, K.soilT[3], px + 1, py, 1, 16, 0.5); } }
      if (!rt) { if (sky) { disc(g, K.cloud[1], px + 15, py + 10, 4); ditherRect(g, K.cloud[0], px + 12, py, 4, 16, 0.4); } else { PX(g, K.soilT[0], px + 15, py, 1, 16); ditherRect(g, K.soilT[0], px + 13, py, 2, 16, 0.5); } }
      if (!dn) {
        if (sky) { ditherRect(g, K.cloud[0], px, py + 9, 16, 7, 0.5); for (let i = 0; i < 3; i++) { const bx = px + 2 + i * 6 + Math.round(hash01(x * 4.1 + i) * 2); disc(g, K.cloud[1], bx, py + 14, 4); disc(g, K.cloud[0], bx + 1, py + 16, 3); } }
        else { PX(g, K.deep, px, py + 14, 16, 2); ditherRect(g, K.deep, px, py + 11, 16, 3, 0.5); }
        if (cave) for (let i = 2; i < 16; i += 5) { const h = 2 + ((x * 3 + i) % 4); PX(g, K.rock[1], px + i, py + 16, 2, h); PX(g, K.rock[3], px + i, py + 16, 1, h - 1); }
        else if (!sky) for (let i = 1; i < 16; i += 4) if (hash01(x * 9.1 + i) > 0.5) PX(g, K.soilT[0], px + i, py + 16, 1, 1 + ((x + i) % 3));
      }
      if (!up && tileAt(lv, x, y - 1) !== T.WATER) capTile(g, fg, lv, x, y, ct === T.MUD, lf, rt, K, busy.has(x));
      else if (!up) { PX(g, shade(th.water2, -0.3), px, py, 16, 2); ditherRect(g, shade(th.water2, -0.3), px, py + 2, 16, 2, 0.5); }
      /* rounded outer corners */
      if (!up && !lf) g.clearRect(px, py, 1, 1);
      if (!up && !rt) g.clearRect(px + 15, py, 1, 1);
      if (!dn && !lf) g.clearRect(px, py + 15, 1, 1);
      if (!dn && !rt) g.clearRect(px + 15, py + 15, 1, 1);
    } else if (ct === T.WALL) {
      g.drawImage(S.wall[(x + y) % 2], px, py);
      const below = tileAt(lv, x, y + 1) === T.WALL, lw = tileAt(lv, x - 1, y) === T.WALL, rw = tileAt(lv, x + 1, y) === T.WALL;
      if (!lw) PX(g, cave ? K.rock[3] : sky ? '#8a8ab0' : K.leaf[3], px, py, 1, 16);
      if (!rw) { PX(g, cave ? K.rock[0] : sky ? '#44445e' : K.leaf[0], px + 14, py, 2, 16); }
      if (!cave && !sky) {                     // a leafy mass: lumpy at the edges
        const lumps = K.leaf.map(c2 => shade(c2, -0.08));
        if (!lw) shadeDisc(g, px + 1, py + 8 + ((y * 5) % 4), 5, lumps);
        if (!rw) shadeDisc(g, px + 14, py + 7 + ((y * 3) % 5), 5, K.leaf.map(c2 => shade(c2, -0.22)));
        if (hash01(x * 3.7 + y * 9.1) > 0.55) shadeDisc(g, px + 8, py + 8, 6, K.leaf);
      }
      if (!below) {
        g.fillStyle = 'rgba(10,8,24,.3)'; g.fillRect(px, py + 11, 16, 5);
        if (cave) for (let i = 1; i < 16; i += 5) { const h = 4 + ((x * 5 + i) % 6); PX(g, K.rock[1], px + i, py + 16, 3, h - 2); PX(g, K.rock[1], px + i + 1, py + 14 + h, 1, 2); PX(g, K.rock[3], px + i, py + 16, 1, h - 2); }
        else if (sky) for (let i = 2; i < 16; i += 6) disc(g, '#585878', px + i + 1, py + 16, 3);
        else for (let i = 0; i < 16; i += 3) { const h = 2 + ((x * 7 + i * 5) % 5); PX(g, K.leaf[i % 2], px + i, py + 16, 2, h); PX(g, K.leaf[3], px + i, py + 16 + h - 1, 1, 1); if ((x + i) % 5 === 0) PX(g, K.leaf[0], px + i + 1, py + 16 + h, 1, 4 + (x % 4)); }
      }
    } else if (ct === T.ONEWAY) {
      const lo = tileAt(lv, x - 1, y) === T.ONEWAY, ro = tileAt(lv, x + 1, y) === T.ONEWAY;
      g.drawImage(S.plankSet[lo && ro ? 1 : lo ? 2 : ro ? 0 : 3], px, py);
    } else if (ct === T.SPIKE) g.drawImage(S.spike, px, py);
    else if (ct === T.SPRING) g.drawImage(S.spring, px, py);
  }
  /* start line */
  g.fillStyle = 'rgba(255,255,255,.8)';
  for (let i = 0; i < 4; i++) g.fillRect(lv.startX + 26 + (i % 2), lv.startY + i, 3, 1);
  if (x0 === 0 && x1 === lv.W) { lv.art = c; lv.fore = f; }
  return { art: c, fore: f };
}

/* the walking surface: grass, mossy rock or cloud */
function capTile(g, fg, lv, x, y, mud, lf, rt, K, busy) {
  const th = lv.th, id = lv.theme, px = x * TILE, py = y * TILE;
  if (mud) {
    PX(g, '#5a3a1e', px, py, 16, 7); PX(g, '#74502c', px, py, 16, 3); PX(g, '#8f6a3e', px, py, 16, 1);
    for (let i = 0; i < 16; i++) { const h = hash01(x * 16 + i + 0.3); if (h > 0.6) PX(g, '#5a3a1e', px + i, py + 7, 1, 1 + ((h * 10) & 1)); if (h < 0.12) PX(g, '#b08a5a', px + i, py + 1, 2, 1); }
    return;
  }
  if (id === 'kaewnama') {
    const C = K.cloud;
    for (let i = 0; i < 3; i++) { const cx = px + 2 + i * 6 + Math.round(hash01(x * 3.3 + i) * 2), r = 4 + Math.round(hash01(x * 5.7 + i) * 2); disc(g, C[3], cx, py + 1, r); PX(g, C[2], cx - r + 1, py + 3, r * 2 - 1, 2); }
    PX(g, C[3], px, py, 16, 4); ditherRect(g, C[2], px, py + 4, 16, 3, 0.5);
    if (!lf) disc(g, C[3], px + 1, py + 4, 4);
    if (!rt) { disc(g, C[2], px + 14, py + 5, 4); disc(g, C[3], px + 13, py + 3, 3); }
    return;
  }
  if (id === 'kraithong') {
    const R3 = K.rock;
    PX(g, shade(th.top, -0.1), px, py, 16, 4); PX(g, th.top, px, py, 16, 2); PX(g, shade(th.top, 0.3), px, py, 16, 1); ditherRect(g, th.top2, px, py + 4, 16, 2, 0.5);
    for (let i = 0; i < 16; i++) { const h = hash01(x * 16 + i + 0.7); if (h > 0.82) PX(g, '#3a8a7a', px + i, py + 1, 2, 1); if (h < 0.1) PX(g, R3[0], px + i, py + 1, 1, 3); }
    if (!busy && hash01(x * 2.9) > 0.86) { PX(fg, th.spike, px + 6, py - 3, 2, 3); PX(fg, '#ffffff', px + 6, py - 3, 1, 1); PX(fg, shade(th.spike, -0.35), px + 7, py - 1, 1, 1); }
    if (!busy && hash01(x * 4.3) > 0.8) { PX(fg, R3[2], px + 11, py - 2, 3, 2); PX(fg, R3[3], px + 11, py - 2, 2, 1); }
    return;
  }
  const [gD, gM, gL, gH] = K.grass;
  PX(g, gM, px, py, 16, 5); PX(g, gL, px, py, 16, 2); ditherRect(g, gL, px, py + 2, 16, 1, 0.5);
  for (let i = 0; i < 16; i++) {
    const wx = x * 16 + i, h = hash01(wx * 1.7), len = 1 + Math.floor(h * 3);
    PX(g, gM, px + i, py + 5, 1, len); if (h > 0.55) PX(g, gD, px + i, py + 5 + len - 1, 1, 1);
    if (hash01(wx * 3.3) > 0.72) PX(g, gH, px + i, py, 1, 1);
    const b = hash01(wx * 5.1);
    if (b > 0.7) PX(g, b > 0.9 ? gL : gM, px + i, py - 1 - (b > 0.93 ? 1 : 0), 1, 1 + (b > 0.93 ? 1 : 0));
  }
  if (!lf) { PX(g, gM, px, py + 1, 1, 8); PX(g, gL, px, py + 1, 1, 3); PX(g, gD, px, py + 9, 1, 1); }
  if (!rt) { PX(g, gD, px + 15, py + 1, 1, 7); PX(g, gM, px + 15, py + 1, 1, 2); }
  /* a few tufts and flowers in front of the runners */
  if (busy) return;
  const t = hash01(x * 7.7 + lv.idx);
  if (t > 0.72) { const ox = px + 2 + Math.round(hash01(x * 1.3) * 9); PX(fg, gD, ox, py - 3, 1, 3); PX(fg, gM, ox + 1, py - 5, 1, 5); PX(fg, gL, ox + 2, py - 4, 1, 4); PX(fg, gM, ox + 3, py - 2, 1, 2); PX(fg, gH, ox + 1, py - 5, 1, 1); }
  else if (t < 0.07) { const ox = px + 6; PX(fg, gM, ox, py - 4, 1, 4); PX(fg, t < 0.035 ? '#ffe14d' : '#ff8fb8', ox - 1, py - 6, 3, 2); PX(fg, '#ffffff', ox, py - 6, 1, 1); }
}
