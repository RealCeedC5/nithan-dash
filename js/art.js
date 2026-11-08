'use strict';
/* =========================================================
   Pixel art, all drawn in code: runners, tiles, decor,
   parallax backgrounds, hazards, items
   ========================================================= */
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
}
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* add a 1px dark outline around every opaque pixel */
function outlined(src, col = '#17121c') {
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

/* ---------- runners ---------- */
const SHOE = '#2a2230';
function drawRunnerFrame(look, pose, k) {
  const c = mk(16, 24), g = c.getContext('2d');
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const skin = look.skin, skinD = shade(skin, -0.22), shirt = look.shirt, shirtD = shade(shirt, -0.3), pants = look.pants, hair = look.hair, hairL = shade(hair, 0.25);
  let bob = 0, legA = { dx: 0, lift: 0 }, legB = { dx: 0, lift: 0 }, armA = 0, armB = 0, armsUp = 0, lean = 0;
  if (pose === 'idle') { bob = k % 2 ? 0 : 0; legA.dx = 1; legB.dx = -1; armA = 0; armB = 0; bob = k === 1 ? 1 : 0; }
  if (pose === 'run') {
    const ph = (k / 6) * Math.PI * 2;
    legA = { dx: Math.round(3 * Math.sin(ph)), lift: Math.max(0, Math.round(2.2 * Math.cos(ph))) };
    legB = { dx: -legA.dx, lift: Math.max(0, Math.round(-2.2 * Math.cos(ph))) };
    armA = -Math.round(2 * Math.sin(ph)); armB = -armA; bob = k % 3 === 1 ? -1 : 0; lean = 1;
  }
  if (pose === 'jump') { legA = { dx: 2, lift: 3 }; legB = { dx: -2, lift: 1 }; armsUp = 1; }
  if (pose === 'fall') { legA = { dx: 2, lift: 0 }; legB = { dx: -1, lift: 1 }; armsUp = 2; }
  if (pose === 'win') { legA.dx = 1; legB.dx = -1; armsUp = k ? 1 : 3; bob = k ? -1 : 0; }
  if (pose === 'stun') { legA.dx = 2; legB.dx = -2; armA = 2; armB = -2; bob = 1; }

  if (pose === 'slide' || pose === 'crouch') {
    const y0 = pose === 'slide' ? 12 : 11;
    if (pose === 'slide') {
      P(9, 20, 6, 2, pants); P(13, 21, 3, 2, SHOE); P(9, 22, 5, 1, pants);
      P(4, 16, 7, 5, shirt); P(4, 19, 7, 2, shirtD); P(2, 19, 3, 2, skin);
      drawHead(g, look, 1, y0 - 1, 'focus');
    } else {
      P(5, 19, 3, 3, pants); P(9, 19, 3, 3, pants); P(4, 22, 4, 2, SHOE); P(9, 22, 4, 2, SHOE);
      P(5, 15, 7, 5, shirt); P(5, 18, 7, 2, shirtD); P(11, 16, 2, 3, skin);
      drawHead(g, look, 4, y0 - 3, 'focus');
    }
    return c;
  }

  const hipY = 16 + bob;
  /* back leg, back arm */
  drawLeg(g, 7 + lean, hipY, legB, shade(pants, -0.18));
  if (armsUp) drawArmUp(g, 5 + lean, 11 + bob, armsUp, shirtD, skinD, -1);
  else drawArm(g, 5 + lean, 11 + bob, armB, shirtD, skinD);
  /* torso */
  P(5 + lean, 10 + bob, 6, 6, shirt); P(5 + lean, 14 + bob, 6, 2, shirtD);
  if (look.acc === 'sash') { for (let i = 0; i < 6; i++) P(5 + lean + i, 14 + bob, 1, 1, i % 2 ? '#f4f1ea' : '#d0393a'); P(10 + lean, 15 + bob, 2, 2, '#d0393a'); }
  /* front leg */
  drawLeg(g, 8 + lean, hipY, legA, pants);
  drawHead(g, look, 4 + lean, 2 + bob, pose === 'stun' ? 'dizzy' : pose === 'win' ? 'happy' : pose === 'run' || pose === 'jump' ? 'focus' : 'calm');
  /* front arm */
  if (armsUp) drawArmUp(g, 9 + lean, 11 + bob, armsUp, shirt, skin, 1);
  else drawArm(g, 9 + lean, 11 + bob, armA, shirt, skin);
  return c;
}
function drawLeg(g, x, hip, leg, col) {
  g.fillStyle = col;
  const fx = x + leg.dx;
  g.fillRect(x, hip, 2, 3);
  g.fillRect(Math.round((x + fx) / 2), hip + 2, 2, 2);
  g.fillRect(fx, hip + 4 - leg.lift, 2, 2);
  g.fillStyle = SHOE; g.fillRect(fx, hip + 6 - leg.lift, 3, 2);
}
function drawArm(g, x, y, swing, col, hand) {
  g.fillStyle = col; g.fillRect(x + Math.round(swing / 2), y, 2, 3);
  g.fillStyle = hand; g.fillRect(x + swing, y + 3, 2, 2);
}
function drawArmUp(g, x, y, mode, col, hand, side) {
  g.fillStyle = col;
  if (mode === 1) { g.fillRect(x, y - 2, 2, 3); g.fillStyle = hand; g.fillRect(x + side, y - 4, 2, 2); }
  else if (mode === 2) { g.fillRect(x + side, y, 3, 2); g.fillStyle = hand; g.fillRect(x + side * 3, y - 1, 2, 2); }
  else { g.fillRect(x, y - 3, 2, 4); g.fillStyle = hand; g.fillRect(x, y - 5, 2, 2); }
}
function drawHead(g, look, x, y, face) {
  const P = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
  const skin = look.skin, hair = look.hair, hairL = shade(hair, 0.22);
  P(0, 1, 8, 7, skin); P(1, 0, 6, 1, skin); P(0, 6, 2, 2, shade(skin, -0.15));
  /* face, looking right */
  if (face === 'happy') { P(4, 4, 1, 1, '#1d1410'); P(6, 4, 1, 1, '#1d1410'); P(5, 6, 2, 1, '#9a3a3a'); }
  else if (face === 'dizzy') { P(4, 3, 1, 1, '#1d1410'); P(5, 4, 1, 1, '#1d1410'); P(6, 3, 1, 1, '#1d1410'); P(5, 6, 1, 1, '#9a3a3a'); }
  else { P(4, 3, 1, 2, '#1d1410'); P(6, 3, 1, 2, '#1d1410'); P(5, 6, 2, 1, face === 'focus' ? '#7a2a2a' : '#b04a4a'); }
  P(7, 5, 1, 1, '#f08a7a');
  switch (look.hairStyle) {
    case 'short': P(0, -1, 8, 3, hair); P(0, 2, 2, 4, hair); P(6, 1, 2, 1, hair); P(2, -1, 3, 1, hairL); break;
    case 'spiky': P(0, -1, 8, 3, hair); P(0, 2, 2, 4, hair); P(1, -3, 1, 2, hair); P(3, -3, 1, 2, hair); P(5, -2, 1, 1, hair); P(7, 1, 1, 2, hair); P(2, -1, 2, 1, hairL); break;
    case 'pony': P(0, -1, 8, 3, hair); P(0, 2, 2, 5, hair); P(-3, 1, 3, 2, hair); P(-3, 3, 2, 4, hair); P(6, 1, 2, 1, hair); P(2, -1, 3, 1, hairL); break;
    case 'bob': P(-1, -1, 9, 3, hair); P(-1, 2, 3, 6, hair); P(6, 1, 2, 2, hair); P(2, -1, 3, 1, hairL); break;
    case 'long': P(0, -1, 8, 3, hair); P(-1, 1, 3, 10, hair); P(6, 1, 2, 1, hair); P(2, -1, 3, 1, hairL); break;
    case 'cap': { const cap = shade(look.shirt, -0.15); P(0, -1, 8, 3, cap); P(6, 1, 4, 1, shade(cap, -0.2)); P(0, 2, 2, 3, hair); P(2, -1, 2, 1, shade(cap, 0.3)); break; }
  }
  if (look.acc === 'band') P(0, 1, 8, 1, '#d0393a');
  if (look.acc === 'flower') { P(0, -2, 2, 2, '#ff8fb8'); P(1, -1, 1, 1, '#ffe14d'); }
}

const RUNNER_CACHE = new Map();
const POSES = { idle: 2, run: 6, jump: 1, fall: 1, win: 2, stun: 1, slide: 1, crouch: 1 };
function runnerSprites(look) {
  const key = JSON.stringify(look);
  if (RUNNER_CACHE.has(key)) return RUNNER_CACHE.get(key);
  const set = {};
  for (const [pose, n] of Object.entries(POSES)) {
    set[pose] = [];
    for (let k = 0; k < n; k++) {
      const base = outlined(drawRunnerFrame(look, pose, k));
      const flip = mk(base.width, base.height), fg = flip.getContext('2d');
      fg.translate(base.width, 0); fg.scale(-1, 1); fg.drawImage(base, 0, 0);
      set[pose].push([base, flip]);
    }
  }
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
  const c = mk(14, 14), g = c.getContext('2d');
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  switch (key) {
    case 'boost': P(2, 3, 9, 2, '#bfeaff'); P(4, 6, 9, 2, '#7fd4ff'); P(1, 9, 8, 2, '#4fb0e8'); P(10, 2, 2, 2, '#ffffff'); break;
    case 'shield': P(3, 1, 8, 11, '#ffd34d'); P(4, 2, 6, 9, '#f0a92a'); P(6, 3, 2, 7, '#c0392b'); P(5, 5, 4, 1, '#c0392b'); P(5, 8, 4, 1, '#c0392b'); P(4, 12, 6, 1, '#e08a1a'); break;
    case 'freeze': P(3, 2, 8, 10, '#b58cff'); P(2, 4, 10, 6, '#b58cff'); P(4, 3, 3, 3, '#e8dcff'); P(5, 7, 5, 3, '#7a4fd0'); break;
    case 'trap': P(5, 2, 3, 3, '#f5d33b'); P(3, 5, 7, 3, '#f5d33b'); P(1, 8, 4, 3, '#e8c020'); P(8, 8, 4, 3, '#e8c020'); P(6, 1, 1, 2, '#6a4a1a'); P(4, 6, 1, 1, '#c8a010'); break;
    case 'cloud': P(2, 4, 10, 5, '#8aa0b8'); P(4, 2, 5, 3, '#a8bcd0'); P(3, 10, 1, 2, '#4fb0e8'); P(7, 10, 1, 3, '#4fb0e8'); P(10, 10, 1, 2, '#4fb0e8'); break;
    case 'wing': P(1, 4, 5, 2, '#ff9a3c'); P(2, 6, 7, 2, '#ffb85c'); P(3, 8, 8, 2, '#ffd27a'); P(6, 2, 2, 3, '#e07a1c'); P(9, 6, 3, 2, '#e07a1c'); break;
  }
  return (ICON_CACHE[key] = outlined(c));
}

/* ---------- tiles ---------- */
function tileSet(th) {
  const S = {};
  const R = rng(th.soil.length * 977 + th.top.charCodeAt(1));
  const mkTile = fn => { const c = mk(TILE, TILE); fn(c.getContext('2d')); return c; };
  const sky = th === THEMES.kaewnama, cave = th === THEMES.kraithong;
  S.soil = [0, 1, 2].map(v => mkTile(g => {
    g.fillStyle = th.soil; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 9; i++) { g.fillStyle = R() < 0.5 ? th.soil2 : shade(th.soil, 0.1); g.fillRect((R() * 15) | 0, (R() * 15) | 0, sky ? 3 : 2, sky ? 2 : 1); }
    if (cave && v === 1) { g.fillStyle = th.spike; g.globalAlpha = 0.5; g.fillRect(6, 7, 2, 2); g.globalAlpha = 1; }
  }));
  S.top = [0, 1].map(v => mkTile(g => {
    g.drawImage(S.soil[v], 0, 0);
    g.fillStyle = th.top2; g.fillRect(0, 0, 16, 6);
    g.fillStyle = th.top; g.fillRect(0, 0, 16, 4);
    for (let x = 0; x < 16; x += 2) { g.fillStyle = th.top; g.fillRect(x, 4, 1, 1 + ((x * 7 + v) % 3)); }
    g.fillStyle = shade(th.top, 0.3); g.fillRect(v * 5 + 2, 0, 3, 1);
    if (sky) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 16, 5); g.fillStyle = th.top2; g.fillRect(0, 5, 16, 1); }
  }));
  S.mud = mkTile(g => {
    g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#6e4826'; g.fillRect(0, 0, 16, 5);
    g.fillStyle = '#8a5e34'; g.fillRect(3, 1, 3, 1); g.fillRect(10, 2, 2, 1); g.fillStyle = '#4a2e16'; g.fillRect(0, 5, 16, 1);
  });
  S.plank = mkTile(g => {
    if (sky) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 1, 16, 5); g.fillRect(2, 0, 12, 1); g.fillStyle = '#dfe8f4'; g.fillRect(0, 5, 16, 2);
    } else {
      g.fillStyle = th.plank; g.fillRect(0, 0, 16, 5); g.fillStyle = shade(th.plank, 0.25); g.fillRect(0, 0, 16, 1);
      g.fillStyle = shade(th.plank, -0.3); g.fillRect(0, 4, 16, 1); g.fillRect(7, 0, 1, 4);
      g.fillStyle = shade(th.plank, -0.2); g.fillRect(3, 5, 2, 4); g.fillRect(11, 5, 2, 4);
    }
  });
  S.wall = mkTile(g => {
    g.fillStyle = th.wall; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 7; i++) { g.fillStyle = R() < 0.5 ? th.wall2 : shade(th.wall, 0.15); const s = cave || sky ? 3 : 4; g.fillRect((R() * 14) | 0, (R() * 14) | 0, s, s - 1); }
  });
  S.spike = mkTile(g => {
    if (sky) { g.fillStyle = '#5a5a7a'; g.fillRect(1, 8, 14, 7); g.fillRect(3, 6, 10, 2); g.fillStyle = '#ffe14d'; g.fillRect(5, 10, 2, 2); g.fillRect(8, 12, 3, 1); return; }
    for (let i = 0; i < 4; i++) {
      const x = i * 4;
      g.fillStyle = th.spike; g.fillRect(x + 1, 12, 3, 4); g.fillRect(x + 2, 9, 1, 3);
      g.fillStyle = shade(th.spike, 0.35); g.fillRect(x + 2, 8, 1, 2);
    }
    if (!cave) { g.fillStyle = shade(th.top2, -0.2); g.fillRect(0, 14, 16, 2); }
  });
  S.spring = mkTile(g => {
    g.fillStyle = '#c0392b'; g.fillRect(1, 6, 14, 3); g.fillStyle = '#ff6a50'; g.fillRect(1, 6, 14, 1);
    g.fillStyle = '#9aa0aa'; for (let y = 9; y < 15; y += 2) g.fillRect(4, y, 8, 1);
    g.fillStyle = '#5a5f6a'; g.fillRect(2, 15, 12, 1);
  });
  return S;
}

/* ---------- level art: decor and tiles pre-drawn into one canvas ---------- */
function buildLevelArt(lv) {
  const th = lv.th, S = tileSet(th);
  lv.tiles = S;
  const c = mk(lv.pxW, lv.pxH), g = c.getContext('2d');
  const R = rng(lv.idx * 7919 + 13);
  /* decor behind the track */
  for (let x = 2; x < lv.W - 2; x++) {
    let sy = -1;
    for (let y = 1; y < lv.H; y++) if (isSolidT(tileAt(lv, x, y)) && tileAt(lv, x, y - 1) === T.EMPTY && tileAt(lv, x, y - 2) === T.EMPTY) { sy = y; break; }
    if (sy < 0) continue;
    if (R() < 0.16) drawDecor(g, lv.theme, x * TILE + 8, sy * TILE, R);
  }
  /* tiles */
  for (let y = 0; y < lv.H; y++) for (let x = 0; x < lv.W; x++) {
    const ct = tileAt(lv, x, y), px = x * TILE, py = y * TILE;
    const v = (x * 7 + y * 13) % 3;
    if (ct === T.SOLID || ct === T.MUD) {
      const exposed = !isSolidT(tileAt(lv, x, y - 1)) && tileAt(lv, x, y - 1) !== T.WATER;
      g.drawImage(ct === T.MUD && exposed ? S.mud : exposed ? S.top[v % 2] : S.soil[v], px, py);
      if (!isSolidT(tileAt(lv, x - 1, y)) && x > 0) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(px, py, 2, 16); }
      if (!isSolidT(tileAt(lv, x + 1, y))) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(px + 14, py, 2, 16); }
      if (!isSolidT(tileAt(lv, x, y + 1)) && y < lv.H - 1) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(px, py + 13, 16, 3); }
    } else if (ct === T.WALL) {
      g.drawImage(S.wall, px, py);
      if (tileAt(lv, x, y + 1) !== T.WALL) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(px, py + 12, 16, 4); drawWallFringe(g, lv.theme, px, py + 16); }
      if (tileAt(lv, x, y - 1) !== T.WALL) { g.fillStyle = shade(th.wall, 0.2); g.fillRect(px, py, 16, 2); }
    } else if (ct === T.ONEWAY) g.drawImage(S.plank, px, py);
    else if (ct === T.SPIKE) g.drawImage(S.spike, px, py);
    else if (ct === T.SPRING) g.drawImage(S.spring, px, py);
  }
  /* start line */
  g.fillStyle = 'rgba(255,255,255,.75)';
  for (let y = lv.startY - 2; y < lv.startY + 2; y++) g.fillRect(lv.startX + 26, y, 3, 1);
  lv.art = c;
}

function drawWallFringe(g, theme, x, y) {
  const col = { sangthong: '#2f6a32', plabuthong: '#557a2c', kraithong: '#8fe0ff', kaewnama: '#ffffff' }[theme];
  g.fillStyle = col;
  if (theme === 'kraithong') { g.fillRect(x + 3, y, 2, 4); g.fillRect(x + 4, y + 4, 1, 2); g.fillRect(x + 11, y, 2, 3); }
  else for (let i = 0; i < 16; i += 3) g.fillRect(x + i, y, 2, 2 + ((i * 5) % 4));
}

function drawDecor(g, theme, x, y, R) {
  const P = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x + a), Math.round(y + b), w, h); };
  const pick = R();
  if (theme === 'sangthong') {
    if (pick < 0.45) { // round tree
      P(-2, -26, 4, 26, '#6a4426'); P(-14, -46, 28, 22, '#3f8a3e'); P(-10, -52, 20, 8, '#4f9a4a'); P(-8, -44, 8, 6, '#5fb058'); P(4, -36, 6, 5, '#2f6a32');
    } else if (pick < 0.7) { // banana plant
      P(-1, -20, 3, 20, '#6a9a3a'); P(-12, -26, 12, 4, '#5fbf4a'); P(1, -28, 12, 4, '#4fae3e'); P(-9, -18, 9, 3, '#4fae3e'); P(2, -16, 4, 6, '#e8c020');
    } else if (pick < 0.85) { // flowers
      for (let i = 0; i < 4; i++) { P(-8 + i * 5, -4, 1, 4, '#3f8a3a'); P(-9 + i * 5, -6, 3, 2, ['#ff8fb8', '#ffe14d', '#ffffff', '#ff6a50'][i]); }
    } else { // golden conch on a stand
      P(-4, -4, 8, 4, '#8a5a32'); P(-5, -11, 10, 7, '#ffd34d'); P(-3, -13, 6, 2, '#ffe88a'); P(-1, -9, 3, 3, '#e0a020');
    }
  } else if (theme === 'plabuthong') {
    if (pick < 0.35) { // palm
      P(-1, -40, 3, 40, '#8a6a3a'); P(-14, -44, 13, 3, '#6a9a2a'); P(1, -44, 13, 3, '#7aaa3a'); P(-10, -48, 9, 3, '#7aaa3a'); P(2, -48, 9, 3, '#6a9a2a'); P(-3, -42, 6, 4, '#5a3a1a');
    } else if (pick < 0.6) { // stilt house
      P(-16, -14, 2, 14, '#5a3a1a'); P(12, -14, 2, 14, '#5a3a1a'); P(-16, -32, 30, 18, '#a8743e'); P(-20, -38, 38, 6, '#7a3a2a'); P(-14, -40, 34, 2, '#9a4a32'); P(-6, -26, 8, 10, '#5a3a1a'); P(6, -28, 5, 5, '#ffd27a');
    } else if (pick < 0.8) { // lotus jar
      P(-6, -10, 12, 10, '#9a5a3a'); P(-7, -12, 14, 2, '#b8744a'); P(-4, -16, 3, 4, '#3f8a3a'); P(-2, -19, 4, 3, '#ff8fb8'); P(2, -15, 4, 3, '#3f8a3a');
    } else { // spirit house
      P(-1, -16, 3, 16, '#8a6a3a'); P(-6, -26, 13, 10, '#e8c060'); P(-8, -28, 17, 3, '#c0392b'); P(-1, -33, 3, 5, '#ffd34d'); P(-2, -22, 5, 5, '#7a3a2a');
    }
  } else if (theme === 'kraithong') {
    if (pick < 0.4) { // stalagmite
      P(-5, -10, 10, 10, '#3a3a4c'); P(-3, -20, 6, 10, '#46465a'); P(-1, -28, 3, 8, '#52526a');
    } else if (pick < 0.7) { // glowing crystals
      P(-6, -10, 4, 10, '#4fc0e0'); P(-1, -16, 4, 16, '#8fe0ff'); P(4, -8, 3, 8, '#4fc0e0'); P(0, -14, 1, 6, '#ffffff');
    } else { // torch
      P(-1, -20, 3, 20, '#5a4a3a'); P(-3, -24, 7, 4, '#ffb03a'); P(-2, -28, 5, 4, '#ffe14d'); P(-1, -30, 3, 2, '#fff6c8');
    }
  } else {
    if (pick < 0.5) { // kite on a string
      P(-1, -40, 1, 40, 'rgba(90,90,122,.6)'); P(-6, -52, 12, 12, '#c0392b'); P(-4, -54, 8, 16, '#c0392b'); P(-1, -50, 2, 8, '#ffd34d'); P(-7, -47, 14, 2, '#ffd34d');
    } else { // little cloud stupa
      P(-6, -8, 12, 8, '#f4e6c8'); P(-4, -14, 8, 6, '#f4e6c8'); P(-1, -22, 3, 8, '#ffd34d');
    }
  }
}

/* ---------- parallax backgrounds ---------- */
function buildBackdrop(themeId) {
  const th = THEMES[themeId], W = 512, H = VH;
  const layers = [];
  const R = rng(themeId.length * 131 + 7);
  const layer = (fn) => { const c = mk(W, H), g = c.getContext('2d'); fn(g); layers.push(c); };
  if (themeId === 'kraithong') {
    layer(g => { // cave wall far
      g.fillStyle = th.far;
      for (let x = 0; x < W; x += 16) { const h = 30 + ((Math.sin(x * 0.05) + 1) * 20 | 0); g.fillRect(x, 0, 16, h); g.fillRect(x + 4, h, 8, 10 + (x % 32 === 0 ? 14 : 0)); }
      for (let x = 0; x < W; x += 24) { const h = 40 + (Math.cos(x * 0.03) * 20 | 0); g.fillRect(x, H - h, 24, h); }
      for (let i = 0; i < 18; i++) { g.fillStyle = R() < 0.5 ? '#4fc0e0' : '#8fe0ff'; g.globalAlpha = 0.5; g.fillRect((R() * W) | 0, (R() * H * 0.7 + 20) | 0, 2, 2); }
      g.globalAlpha = 1;
    });
    layer(g => { // rock pillars
      g.fillStyle = th.mid;
      for (let x = 30; x < W; x += 140) { g.fillRect(x, 0, 26, H); g.fillRect(x - 6, H - 50, 38, 50); g.fillRect(x - 4, 0, 34, 30); }
      g.fillStyle = shade(th.mid, 0.12); for (let x = 30; x < W; x += 140) g.fillRect(x + 4, 30, 4, H - 80);
    });
    layer(g => { // near rocks and drips
      g.fillStyle = th.near;
      for (let x = 0; x < W; x += 8) { const h = 18 + ((Math.sin(x * 0.11) + Math.sin(x * 0.037)) * 8 | 0); g.fillRect(x, H - h, 8, h); }
      for (let x = 10; x < W; x += 46) { g.fillRect(x, 0, 6, 16 + (x % 3) * 6); g.fillRect(x + 2, 16 + (x % 3) * 6, 2, 6); }
    });
  } else if (themeId === 'kaewnama') {
    layer(g => { // far temple roofs below the clouds
      g.fillStyle = th.far;
      for (let x = 0; x < W; x += 90) { g.fillRect(x + 20, H - 70, 40, 70); g.fillRect(x + 14, H - 78, 52, 8); g.fillRect(x + 30, H - 100, 20, 22); g.fillRect(x + 38, H - 120, 4, 20); }
      g.fillStyle = '#ffe8e0'; g.globalAlpha = 0.8; for (let x = 0; x < W; x += 6) g.fillRect(x, H - 50 + Math.sin(x * 0.05) * 6, 6, 50);
      g.globalAlpha = 1;
    });
    layer(g => { // big puffy cloud banks
      for (let i = 0; i < 7; i++) {
        const x = i * 78 + 10, y = H - 48 - (i % 3) * 22;
        for (let k = 0; k < 6; k++) {
          const r = 14 + ((k * 7 + i) % 3) * 6, cx = x + k * 12, cy = y + Math.sin(k * 1.7 + i) * 6;
          g.fillStyle = shade(th.mid, -0.06); g.beginPath(); g.arc(cx + 2, cy + 3, r, 0, 7); g.fill();
          g.fillStyle = th.mid; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
        }
      }
      g.fillStyle = th.mid; g.fillRect(0, H - 30, W, 30);
      g.fillStyle = shade(th.mid, 0.35); for (let x = 0; x < W; x += 9) g.fillRect(x, H - 30 + Math.sin(x * 0.2) * 2, 5, 2);
    });
    layer(g => { // kites in the sky
      for (let i = 0; i < 3; i++) {
        const x = 60 + i * 170, y = 40 + i * 22;
        g.fillStyle = ['#c0392b', '#3f7fd8', '#f0b62e'][i];
        g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 9, y); g.lineTo(x, y + 12); g.lineTo(x - 9, y); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(x, y + 12); g.quadraticCurveTo(x + 20, y + 40, x - 10, y + 80); g.stroke();
      }
    });
  } else {
    layer(g => { // far hills and temple
      g.fillStyle = th.far;
      for (let x = 0; x < W; x++) { const h = 60 + Math.sin(x * 0.012) * 22 + Math.sin(x * 0.031) * 10; g.fillRect(x, H - h - 30, 1, h + 30); }
      const tx = themeId === 'sangthong' ? 300 : 120;
      g.fillStyle = shade(th.far, -0.12);
      g.fillRect(tx, H - 140, 36, 50); g.fillRect(tx + 8, H - 168, 20, 28); g.fillRect(tx + 15, H - 196, 6, 30); g.fillRect(tx - 10, H - 96, 56, 8);
      if (themeId === 'sangthong') { g.fillStyle = '#e8c060'; g.globalAlpha = 0.55; g.fillRect(tx + 15, H - 196, 6, 30); g.fillRect(tx + 8, H - 168, 20, 4); g.globalAlpha = 1; }
    });
    layer(g => { // mid trees / palms
      for (let i = 0; i < 9; i++) {
        const x = (i * 61 + (R() * 20 | 0)) % W, h = 40 + (R() * 30 | 0);
        g.fillStyle = shade(th.mid, -0.25); g.fillRect(x + 7, H - 40 - h * 0.4, 4, h * 0.4 + 40);
        g.fillStyle = th.mid;
        if (themeId === 'plabuthong' && i % 2) { for (let k = -2; k <= 2; k++) g.fillRect(x + 9 + k * 6 - 6, H - 40 - h * 0.4 - 4 + Math.abs(k) * 3, 12, 3); }
        else { g.beginPath(); g.arc(x + 9, H - 50 - h * 0.4, 16 + h * 0.15, 0, 7); g.fill(); }
      }
      g.fillStyle = th.mid; g.fillRect(0, H - 40, W, 40);
    });
    layer(g => { // near bushes / paddy
      g.fillStyle = th.near;
      for (let x = 0; x < W; x += 4) { const h = 16 + Math.sin(x * 0.09) * 6 + Math.sin(x * 0.23) * 3; g.fillRect(x, H - h, 4, h); }
      if (themeId === 'plabuthong') { g.fillStyle = shade(th.near, 0.15); for (let x = 0; x < W; x += 6) g.fillRect(x, H - 12 - (x % 12 ? 2 : 4), 1, 6); }
    });
  }
  return layers;
}
const BACKDROPS = {};
function backdrop(themeId) { return BACKDROPS[themeId] || (BACKDROPS[themeId] = buildBackdrop(themeId)); }

function drawSky(g, th, w, t) {
  const grd = g.createLinearGradient(0, 0, 0, VH);
  grd.addColorStop(0, th.sky[0]); grd.addColorStop(1, th.sky[1]);
  g.fillStyle = grd; g.fillRect(0, 0, w, VH);
  if (th !== THEMES.kraithong) {
    g.fillStyle = th.sun; g.globalAlpha = 0.9;
    g.beginPath(); g.arc(w * 0.78, 46, 18, 0, 7); g.fill();
    g.globalAlpha = 0.25; g.beginPath(); g.arc(w * 0.78, 46, 26, 0, 7); g.fill(); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 157 - t * (4 + i)) % (w + 120) + w + 120) % (w + 120) - 60, y = 22 + i * 17;
      g.fillRect(x, y, 34, 6); g.fillRect(x + 6, y - 4, 18, 4); g.fillRect(x + 4, y + 6, 26, 2);
    }
  }
}

/* ---------- hazards, items, finish ---------- */
function drawHazard(g, h, p, theme) {
  const kind = THEMES[theme].hazards;
  const P = (x, y, w, hh, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, hh); };
  if (h.type === 'pend') {
    g.strokeStyle = theme === 'kraithong' ? '#8a8aa0' : '#6a4a2a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(h.px, h.py); g.lineTo(p.x, p.y); g.stroke();
    P(h.px - 10, h.py - 3, 20, 4, theme === 'kraithong' ? '#4a4a5a' : '#7a5230');
    g.save(); g.translate(p.x, p.y); g.rotate(-p.a);
    const k = kind.L;
    if (k === 'club') { P(-4, -6, 8, 13, '#8a4a2a'); P(-6, -2, 12, 7, '#a85a32'); P(-6, -2, 2, 2, '#e0d0b0'); P(4, 2, 2, 2, '#e0d0b0'); P(-1, 5, 2, 2, '#e0d0b0'); }
    else if (k === 'bell') { P(-6, -4, 12, 10, '#e0a020'); P(-7, 4, 14, 3, '#c08010'); P(-1, 7, 2, 2, '#8a5a10'); P(-3, -6, 6, 2, '#f0c040'); }
    else if (k === 'stalactite') { P(-7, -6, 14, 6, '#5a5a70'); P(-5, 0, 10, 4, '#6a6a80'); P(-3, 4, 6, 3, '#7a7a90'); P(-1, 7, 2, 2, '#8fe0ff'); }
    else { P(-1, -6, 2, 4, '#c0392b'); for (let i = -1; i <= 1; i++) P(i * 4 - 1, -2, 2, 8 + Math.abs(i) * -2, ['#ffd34d', '#ff9a3c', '#ffd34d'][i + 1]); P(-6, -3, 12, 2, '#c0392b'); }
    g.restore();
  } else if (h.type === 'roll') {
    g.save(); g.globalAlpha = p.fade; g.translate(p.x, p.y); g.rotate(p.a);
    const k = kind.R;
    if (k === 'conch') { P(-7, -7, 14, 14, '#ffd34d'); P(-5, -5, 10, 10, '#f0b030'); P(-2, -2, 4, 4, '#ffe88a'); P(-7, -1, 3, 2, '#c08010'); }
    else if (k === 'coconut') { P(-7, -6, 14, 12, '#6a4426'); P(-6, -7, 12, 14, '#6a4426'); P(-3, -4, 2, 2, '#3a2416'); P(1, -4, 2, 2, '#3a2416'); P(-1, 0, 2, 2, '#3a2416'); }
    else if (k === 'boulder') { P(-7, -6, 14, 12, '#6a6a7a'); P(-6, -7, 12, 14, '#6a6a7a'); P(-4, -5, 4, 3, '#8a8a9a'); P(2, 2, 3, 2, '#4a4a5a'); }
    else { P(-7, -6, 14, 12, '#5a5a7a'); P(-6, -7, 12, 14, '#6a6a8a'); P(-2, -2, 4, 4, '#ffe14d'); }
    g.restore();
  } else if (h.type === 'crush') {
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(h.x + h.w / 2, h.yTop - 120); g.lineTo(h.x + h.w / 2, p.y); g.stroke();
    if (kind.K === 'pestle') {
      P(h.x + 6, p.y - 4, h.w - 12, 8, '#9a6a3a'); P(h.x + 2, p.y + 4, h.w - 4, h.h - 4, '#b8844a'); P(h.x + 2, p.y + h.h - 4, h.w - 4, 4, '#7a5230'); P(h.x + 5, p.y + 6, 3, h.h - 12, '#d0a060');
    } else {
      P(h.x, p.y, h.w, h.h, '#6a6a7a'); P(h.x, p.y, h.w, 3, '#8a8a9a'); P(h.x, p.y + h.h - 4, h.w, 4, '#4a4a5a');
      P(h.x + 7, p.y + 9, 4, 3, '#2a2a3a'); P(h.x + h.w - 11, p.y + 9, 4, 3, '#2a2a3a'); P(h.x + 9, p.y + 16, h.w - 18, 2, '#2a2a3a');
    }
  } else if (h.type === 'leap' && p.on) {
    g.save(); g.translate(p.x, p.y); g.rotate((p.p - 0.5) * 2.2);
    if (kind.G === 'croc') {
      P(-6, -2, 12, 16, '#3a7a3a'); P(-5, -12, 10, 12, '#4a8a4a'); P(-4, -16, 8, 4, '#4a8a4a'); P(-3, -12, 2, 2, '#ffe14d'); P(2, -12, 2, 2, '#ffe14d');
      P(-5, -16, 1, 2, '#ffffff'); P(4, -16, 1, 2, '#ffffff'); P(-4, -6, 8, 1, '#ffffff'); P(-4, 2, 8, 6, '#8aba6a');
    } else {
      P(-4, -8, 8, 14, '#ffc23a'); P(-6, -4, 12, 7, '#ffd34d'); P(-3, 6, 6, 4, '#f0a020'); P(-2, -5, 2, 2, '#1d1410');
    }
    g.restore();
  }
}

function drawPlat(g, p, theme) {
  if (p.gone) return;
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  if (p.type === 'sink') {
    const lotus = theme !== 'kraithong';
    P(p.x, p.y, p.w, 5, lotus ? '#4aa04a' : '#7a5a3a'); P(p.x + 2, p.y, p.w - 4, 2, lotus ? '#6ac06a' : '#9a7a5a');
    if (lotus) { P(p.x + 12, p.y - 4, 6, 4, '#ff8fb8'); P(p.x + 14, p.y - 6, 2, 2, '#ffd0e0'); }
    if (p.sink > 0.2) { P(p.x - 2, p.y + 4, 3, 1, 'rgba(255,255,255,.7)'); P(p.x + p.w - 1, p.y + 4, 3, 1, 'rgba(255,255,255,.7)'); }
  } else if (theme === 'kaewnama') {
    const col = p.type === 'v' ? '#c0392b' : '#3f7fd8';
    P(p.x + 4, p.y, p.w - 8, 6, col); P(p.x, p.y + 1, p.w, 4, col); P(p.x + p.w / 2 - 1, p.y - 2, 2, 10, '#ffd34d'); P(p.x + 4, p.y + 2, p.w - 8, 1, shade(col, 0.3));
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(p.x + p.w / 2, p.y + 6); g.lineTo(p.x + p.w / 2 - 6, p.y + 18); g.stroke();
  } else {
    P(p.x, p.y, p.w, 6, '#8a5a32'); P(p.x, p.y, p.w, 2, '#b07a3e'); P(p.x + 4, p.y + 6, 3, 4, '#6a4426'); P(p.x + p.w - 7, p.y + 6, 3, 4, '#6a4426');
    P(p.x - 2, p.y + 1, 2, 4, '#f0c040'); P(p.x + p.w, p.y + 1, 2, 4, '#f0c040');
  }
}

function drawBox(g, b, t, available) {
  const y = b.y + Math.sin(t * 3 + b.id) * 2;
  if (!available) { g.globalAlpha = 0.25; }
  g.fillStyle = '#c08010'; g.fillRect(b.x - 7, y - 7, 14, 14);
  g.fillStyle = '#ffd34d'; g.fillRect(b.x - 6, y - 6, 12, 12);
  g.fillStyle = '#ffe88a'; g.fillRect(b.x - 6, y - 6, 12, 2);
  g.fillStyle = '#c0392b'; g.fillRect(b.x - 2, y - 4, 4, 2); g.fillRect(b.x + 1, y - 3, 2, 3); g.fillRect(b.x - 1, y, 2, 2); g.fillRect(b.x - 1, y + 3, 2, 2);
  if (available) { g.fillStyle = 'rgba(255,255,255,.8)'; const s = (t * 2 + b.id) % 3; if (s < 1) g.fillRect(b.x + 5, y - 9, 2, 2); }
  g.globalAlpha = 1;
}

function drawFlag(g, cp, passed, t) {
  g.fillStyle = '#5a4a3a'; g.fillRect(cp.x - 1, cp.y - 34, 2, 34);
  const w = Math.sin(t * 6) * 1.5;
  g.fillStyle = passed ? '#ffd34d' : '#e0503f';
  g.beginPath(); g.moveTo(cp.x + 1, cp.y - 34); g.lineTo(cp.x + 15 + w, cp.y - 29); g.lineTo(cp.x + 1, cp.y - 24); g.fill();
}

function drawFinish(g, x, y) {
  g.fillStyle = '#c0392b'; g.fillRect(x - 30, y - 64, 4, 64); g.fillRect(x + 26, y - 64, 4, 64);
  for (let i = 0; i < 14; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#1d1410' : '#ffffff'; g.fillRect(x - 28 + i * 4, y - 66 + j * 4, 4, 4); }
  g.fillStyle = '#ffd34d'; g.fillRect(x - 30, y - 70, 60, 3);
  for (let i = 0; i < 6; i++) { g.fillStyle = ['#e0503f', '#ffd34d', '#3f7fd8'][i % 3]; g.fillRect(x - 24 + i * 9, y - 58 + (i % 2), 4, 5); }
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (let yy = y - 16; yy < y; yy += 4) g.fillRect(x - 1, yy, 2, 2);
}

function drawTrap(g, tr) {
  g.fillStyle = '#e8c020'; g.fillRect(tr.x - 6, tr.y - 3, 12, 3); g.fillRect(tr.x - 4, tr.y - 5, 8, 2);
  g.fillStyle = '#f5d33b'; g.fillRect(tr.x - 3, tr.y - 6, 6, 2); g.fillStyle = '#6a4a1a'; g.fillRect(tr.x - 1, tr.y - 8, 2, 2);
}

function drawWater(g, lv, x0, x1, t) {
  const th = lv.th;
  for (let y = 0; y < lv.H; y++) for (let x = x0; x <= x1; x++) {
    if (tileAt(lv, x, y) !== T.WATER) continue;
    const top = tileAt(lv, x, y - 1) !== T.WATER;
    g.fillStyle = top ? th.water : th.water2; g.globalAlpha = 0.88;
    g.fillRect(x * TILE, y * TILE + (top ? 3 : 0), TILE, top ? 13 : 16);
    if (top) {
      g.globalAlpha = 1; g.fillStyle = shade(th.water, 0.45);
      const o = Math.floor(t * 8 + x * 5) % 16;
      g.fillRect(x * TILE + o, y * TILE + 3, 4, 1); g.fillRect(x * TILE + ((o + 9) % 16), y * TILE + 5, 3, 1);
    }
  }
  g.globalAlpha = 1;
}

function drawBoostPads(g, lv, x0, x1, t) {
  for (let y = 0; y < lv.H; y++) for (let x = x0; x <= x1; x++) {
    if (tileAt(lv, x, y) !== T.BOOST) continue;
    const px = x * TILE, py = y * TILE + 12;
    g.fillStyle = '#2a6aa8'; g.fillRect(px, py, 16, 4);
    for (let i = 0; i < 3; i++) {
      const on = Math.floor(t * 10 - i) % 3 === 0;
      g.fillStyle = on ? '#bfeaff' : '#4fb0e8';
      g.fillRect(px + 2 + i * 5, py + 1, 2, 2); g.fillRect(px + 4 + i * 5, py + 2, 1, 1);
    }
  }
}

function drawWind(g, w, t) {
  g.fillStyle = 'rgba(255,255,255,.45)';
  for (let i = 0; i < 8; i++) {
    const y = w.top + ((i * 37 - t * 140) % (ROWS * TILE - w.top) + (ROWS * TILE - w.top)) % (ROWS * TILE - w.top);
    g.fillRect(w.x + 4 + (i % 3) * 9, y, 2, 8);
  }
}
