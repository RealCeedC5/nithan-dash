'use strict';
/* =========================================================
   World: level building, tiles, clock-driven hazards, physics
   Every moving hazard is a pure function of the race clock,
   so every player in an online room sees the same thing.
   ========================================================= */
const T = { EMPTY: 0, SOLID: 1, ONEWAY: 2, SPIKE: 3, WATER: 4, BOOST: 5, SPRING: 6, MUD: 7, WALL: 8 };
const TILE_OF = { '#': T.SOLID, '=': T.ONEWAY, '^': T.SPIKE, '~': T.WATER, B: T.BOOST, S: T.SPRING, m: T.MUD, h: T.WALL };
const isSolidT = c => c === T.SOLID || c === T.MUD || c === T.WALL;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const approach = (v, to, d) => v < to ? Math.min(v + d, to) : Math.max(v - d, to);
const mod1 = v => ((v % 1) + 1) % 1;
const hash01 = n => mod1(Math.sin(n * 127.1 + 311.7) * 43758.5453);

/* physics tuning (pixels, seconds) */
const PH = {
  run: 150, accG: 1100, accA: 750, decG: 1400, decA: 250,
  jump: 380, djump: 330, gHold: 1150, gUp: 2600, gDown: 1700, maxFall: 480,
  slide: 178, slideMin: 96, crawl: 55, boost: 255, spring: 600,
  coyote: 0.1, buffer: 0.13, halfW: 5, hStand: 22, hLow: 12,
};

function buildLevel(idx) {
  const def = LEVELS[idx];
  const theme = THEMES[def.theme];
  const rows = Array.from({ length: 12 }, () => '');
  for (const name of def.seq) {
    const c = CHUNKS[name];
    const w = Math.max(...c.map(r => r.length));
    for (let i = 0; i < 12; i++) rows[i] += (c[i] || '').padEnd(w, '.');
  }
  const W = rows[0].length, top = ROWS - 12;
  const lv = {
    idx, id: def.id, theme: def.theme, th: theme, W, H: ROWS, pxW: W * TILE, pxH: ROWS * TILE,
    grid: new Uint8Array(W * ROWS), boxes: [], cps: [], haz: [], plats: [], winds: [],
    startX: 4 * TILE, startY: (top + 8) * TILE, finishX: 0,
  };
  const ents = [];
  for (let r = 0; r < 12; r++) {
    for (let x = 0; x < W; x++) {
      const ch = rows[r][x], y = top + r;
      if (TILE_OF[ch] !== undefined) lv.grid[y * W + x] = TILE_OF[ch];
      else if (ch !== '.') ents.push({ ch, x, y });
    }
  }
  /* water fills down to the first solid tile */
  for (let x = 0; x < W; x++) {
    let wet = false;
    for (let y = 0; y < ROWS; y++) {
      const c = lv.grid[y * W + x];
      if (c === T.WATER) wet = true;
      else if (wet && c === T.EMPTY) lv.grid[y * W + x] = T.WATER;
      else if (wet) break;
    }
  }
  const groundBelow = (tx, ty) => {
    for (let y = ty; y < ROWS; y++) if (isSolidT(tileAt(lv, tx, y)) || tileAt(lv, tx, y) === T.ONEWAY) return y * TILE;
    return lv.startY;
  };
  let n = 0;
  for (const e of ents) {
    const px = e.x * TILE, py = e.y * TILE, ph = hash01(e.x * 3.1 + e.y), id = n++;
    switch (e.ch) {
      case '?': lv.boxes.push({ id, x: px + 8, y: py + 8 }); break;
      case 'C': lv.cps.push({ x: px + 8, y: groundBelow(e.x, e.y) }); break;
      case 'F': lv.finishX = px + 8; lv.finishY = groundBelow(e.x, e.y); break;
      case 'L': lv.haz.push({ id, type: 'pend', px: px + 8, py: py + 8, len: 4.2 * TILE, amp: 1.05, per: 2.3, ph }); break;
      case 'R': lv.haz.push({ id, type: 'roll', x0: px + 8, y: py + TILE - 7, rad: 7, speed: 82, dist: 19 * TILE, per: 19 * TILE / 82 + 1.1, ph }); break;
      case 'K': lv.haz.push({ id, type: 'crush', x: px, w: 30, h: 26, yTop: py, yBot: groundBelow(e.x, e.y + 1) - 26, per: 2.9, ph }); break;
      case 'G': lv.haz.push({ id, type: 'leap', x: px + 8, base: py + 10, h: 3.4 * TILE, per: 3.1, dur: 1.05, ph }); break;
      case 'P': lv.plats.push({ id, type: 'h', x0: px, y0: py + 4, w: 48, amp: 3 * TILE, per: 3.8, ph }); break;
      case 'V': lv.plats.push({ id, type: 'v', x0: px, y0: py + 4, w: 48, amp: 2.6 * TILE, per: 3.4, ph }); break;
      case 'O': lv.plats.push({ id, type: 'sink', x0: px, y0: py, w: 32, ph: 0 }); break;
      case 'W': lv.winds.push({ x: px, w: 2 * TILE, top: py - 9 * TILE }); break;
    }
  }
  for (const p of lv.plats) { p.x = p.x0; p.y = p.y0; p.px = p.x; p.py = p.y; p.dx = 0; p.dy = 0; p.sink = 0; p.load = 0; p.gone = false; }
  lv.cps.sort((a, b) => a.x - b.x);
  lv.cps.unshift({ x: lv.startX, y: lv.startY });
  return lv;
}

function tileAt(lv, tx, ty) {
  if (tx < 0) return T.SOLID;
  if (tx >= lv.W) return ty >= lv.H - 6 ? T.SOLID : T.EMPTY;
  if (ty < 0 || ty >= lv.H) return T.EMPTY;
  return lv.grid[ty * lv.W + tx];
}
const solidAt = (lv, tx, ty) => isSolidT(tileAt(lv, tx, ty));

/* ---------- moving things, from the race clock ---------- */
function hazPos(h, t) {
  switch (h.type) {
    case 'pend': {
      const a = h.amp * Math.sin(Math.PI * 2 * (t / h.per + h.ph));
      return { on: true, x: h.px + Math.sin(a) * h.len, y: h.py + Math.cos(a) * h.len, a, rad: 7 };
    }
    case 'roll': {
      const c = mod1(t / h.per + h.ph) * h.per, travel = h.dist / h.speed;
      if (c > travel) return { on: false };
      const x = h.x0 - c * h.speed;
      return { on: true, x, y: h.y, a: -(h.x0 - x) / h.rad, rad: h.rad, fade: c > travel - 0.25 ? (travel - c) / 0.25 : 1 };
    }
    case 'crush': {
      const c = mod1(t / h.per + h.ph) * h.per, up = h.per - 1.25;
      let f;
      if (c < up) f = 0;
      else if (c < up + 0.18) f = (c - up) / 0.18;
      else if (c < up + 0.73) f = 1;
      else f = 1 - (c - up - 0.73) / 0.52;
      return { on: true, x: h.x, y: h.yTop + (h.yBot - h.yTop) * f, f, falling: c >= up && c < up + 0.73, untilDrop: c < up ? up - c : h.per - c + up };
    }
    case 'leap': {
      const c = mod1(t / h.per + h.ph) * h.per;
      if (c > h.dur) return { on: false, until: h.per - c };
      const p = c / h.dur;
      return { on: true, x: h.x, y: h.base - Math.sin(Math.PI * p) * h.h, p, rad: 8 };
    }
  }
  return { on: false };
}

function updatePlats(lv, t, dt) {
  for (const p of lv.plats) {
    p.px = p.x; p.py = p.y;
    if (p.type === 'h') p.x = p.x0 + p.amp * Math.sin(Math.PI * 2 * (t / p.per + p.ph));
    else if (p.type === 'v') p.y = p.y0 + p.amp * Math.sin(Math.PI * 2 * (t / p.per + p.ph));
    else if (p.type === 'sink') {
      if (p.load > 0) p.sink += dt; else if (p.sink > 0) p.sink = Math.max(0, p.sink - dt * 0.6);
      p.y = p.y0 + Math.max(0, p.sink - 0.35) * 46;
      p.gone = p.y > p.y0 + 20;
      if (p.gone && p.load <= 0) { p.sink = Math.max(p.sink - dt * 2, 0); }
      p.load = 0;
    }
    p.dx = p.x - p.px; p.dy = p.y - p.py;
  }
}

/* ---------- runners ---------- */
function newRunner(id, name, look, opts = {}) {
  return {
    id, name, look, bot: !!opts.bot, local: !!opts.local, skill: opts.skill || 1,
    x: 0, y: 0, vx: 0, vy: 0, h: PH.hStand, face: 1, ground: false, onPlat: null,
    coyote: 0, jbuf: 0, jumps: 1, holdJump: false, sliding: false, slideT: 0, crouch: false,
    stunT: 0, frozenT: 0, slowT: 0, boostT: 0, wingT: 0, shieldT: 0, invT: 0, springT: 0, slipT: 0,
    dead: false, respawnT: 0, cp: 0, item: null, rolling: 0, fin: false, finT: 0, boxT: {},
    anim: 'idle', animT: 0, spin: 0, speedMul: 1, mud: false, lastStep: 0, prog: 0, ai: {}, landV: 0, draft: 0, draftOn: false,
    fx: [], // events for sound / particles, drained by the renderer
  };
}

function placeAtStart(r, lv, slot) {
  r.x = lv.startX - slot * 3; r.y = lv.startY; r.vx = 0; r.vy = 0; r.ground = true;
  r.cp = 0; r.fin = false; r.finT = 0; r.dead = false; r.respawnT = 0; r.item = null; r.boxT = {};
  r.stunT = r.frozenT = r.slowT = r.boostT = r.wingT = r.shieldT = r.invT = r.slipT = 0;
}

function standBlocked(lv, r) {
  const top = r.y - PH.hStand, l = r.x - PH.halfW + 0.5, rt = r.x + PH.halfW - 0.5;
  for (let tx = Math.floor(l / TILE); tx <= Math.floor(rt / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((r.y - 1) / TILE); ty++)
      if (solidAt(lv, tx, ty)) return true;
  return false;
}

function moveX(lv, r, dx) {
  r.x += dx;
  const top = r.y - r.h + 0.5, bot = r.y - 0.5;
  if (dx > 0) {
    const tx = Math.floor((r.x + PH.halfW) / TILE);
    for (let ty = Math.floor(top / TILE); ty <= Math.floor(bot / TILE); ty++)
      if (solidAt(lv, tx, ty)) { r.x = tx * TILE - PH.halfW - 0.01; r.vx = Math.min(r.vx, 0); r.bonk = true; break; }
  } else if (dx < 0) {
    const tx = Math.floor((r.x - PH.halfW) / TILE);
    for (let ty = Math.floor(top / TILE); ty <= Math.floor(bot / TILE); ty++)
      if (solidAt(lv, tx, ty)) { r.x = (tx + 1) * TILE + PH.halfW + 0.01; r.vx = Math.max(r.vx, 0); break; }
  }
}

function moveY(lv, r, dy) {
  const prevBottom = r.y;
  r.y += dy;
  const was = r.ground;
  r.ground = false;
  const l = r.x - PH.halfW + 0.5, rt = r.x + PH.halfW - 0.5;
  if (dy >= 0) {
    const ty = Math.floor(r.y / TILE);
    for (let tx = Math.floor(l / TILE); tx <= Math.floor(rt / TILE); tx++) {
      const c = tileAt(lv, tx, ty);
      if (isSolidT(c) || (c === T.ONEWAY && prevBottom <= ty * TILE + 0.5)) {
        r.landV = r.vy; r.y = ty * TILE; r.vy = 0; r.ground = true; r.onPlat = null; r.mud = c === T.MUD; break;
      }
    }
    if (!r.ground) {
      for (const p of lv.plats) {
        if (p.gone || rt < p.x || l > p.x + p.w) continue;
        if (prevBottom <= p.py + 1.5 && r.y >= p.y) { r.landV = r.vy; r.y = p.y; r.vy = 0; r.ground = true; r.onPlat = p; r.mud = false; break; }
      }
    }
    if (r.ground && !was && dy > 2) r.fx.push('land');
  } else {
    const ty = Math.floor((r.y - r.h) / TILE);
    for (let tx = Math.floor(l / TILE); tx <= Math.floor(rt / TILE); tx++)
      if (solidAt(lv, tx, ty)) { r.y = (ty + 1) * TILE + r.h; r.vy = 0; break; }
  }
}

function hitBy(r, cx, cy, rad) {
  const bx = clamp(cx, r.x - PH.halfW, r.x + PH.halfW), by = clamp(cy, r.y - r.h, r.y);
  return (cx - bx) ** 2 + (cy - by) ** 2 < rad * rad;
}

function hurt(r, kind) {
  if (r.invT > 0 || r.dead || r.fin) return false;
  if (r.shieldT > 0) { r.shieldT = 0; r.invT = 0.8; r.fx.push('block'); return false; }
  r.stunT = kind === 'slip' ? 0.95 : 0.75;
  r.vx = kind === 'slip' ? r.vx * 0.3 : -(r.face || 1) * 125;
  r.vy = kind === 'slip' ? -120 : -220;
  r.ground = false; r.onPlat = null; r.sliding = false; r.invT = 1.6;
  r.fx.push(kind === 'slip' ? 'slip' : 'hit');
  return true;
}

function killRunner(r, why) {
  if (r.dead) return;
  r.dead = true; r.respawnT = 0.75; r.vx = 0; r.vy = 0; r.sliding = false; r.onPlat = null;
  r.fx.push(why === 'water' ? 'splash' : 'fall');
}

function respawn(lv, r) {
  const cp = lv.cps[r.cp] || lv.cps[0];
  r.x = cp.x; r.y = cp.y; r.vx = 0; r.vy = 0; r.dead = false; r.invT = 1.2; r.ground = true;
  r.stunT = 0; r.frozenT = 0; r.wingT = 0; r.fx.push('respawn');
}

function inWind(lv, r) {
  for (const w of lv.winds) if (r.x > w.x - 2 && r.x < w.x + w.w + 2 && r.y - 6 > w.top) return w;
  return null;
}

/* one fixed physics step. inp: {left,right,down,jump,jumpHeld} with jump = pressed this step */
function stepRunner(lv, r, inp, dt, t) {
  r.animT += dt;
  for (const k of ['stunT', 'frozenT', 'slowT', 'boostT', 'wingT', 'shieldT', 'invT', 'springT', 'jbuf', 'coyote'])
    if (r[k] > 0) r[k] = Math.max(0, r[k] - dt);
  if (r.dead) { r.respawnT -= dt; if (r.respawnT <= 0) respawn(lv, r); return; }
  const control = r.stunT <= 0 && r.frozenT <= 0 && !r.fin && t >= 0;
  const dir = control ? (inp.right ? 1 : 0) - (inp.left ? 1 : 0) : 0;

  /* ride moving platforms */
  if (r.onPlat) {
    const p = r.onPlat;
    if (p.gone || r.x + PH.halfW < p.x || r.x - PH.halfW > p.x + p.w) r.onPlat = null;
    else { r.x += p.dx; r.y = p.y; if (p.type === 'sink') p.load = 1; }
  }

  /* slide and crouch */
  const blocked = standBlocked(lv, r);
  const wantDown = control && inp.down;
  if (r.ground && wantDown && !r.sliding && Math.abs(r.vx) > 60) {
    r.sliding = true; r.slideT = 0.62; r.vx = Math.sign(r.vx) * Math.max(Math.abs(r.vx), PH.slide); r.fx.push('slide');
  }
  if (r.sliding) {
    r.slideT -= dt;
    const done = (r.slideT <= 0 || (!wantDown && r.slideT < 0.42)) && !blocked;
    if (done || !control) r.sliding = false;
  }
  r.crouch = !r.sliding && ((r.ground && wantDown) || blocked);
  r.h = r.sliding || r.crouch ? PH.hLow : PH.hStand;

  /* run */
  let maxV = PH.run * r.speedMul;
  if (r.mud && r.ground) maxV *= 0.55;
  if (r.slowT > 0) maxV *= 0.6;
  if (r.draft > 0.6 && r.ground) maxV *= 1.07;                       // slipstream: tucked in behind another runner
  if (r.wingT > 0) maxV = Math.max(maxV, 195);
  if (r.boostT > 0) maxV = PH.boost;
  if (r.crouch) maxV = Math.min(maxV, PH.crawl);
  if (r.sliding) {
    const floor = blocked ? PH.slideMin : 40;
    const s = Math.max(Math.abs(r.vx) - 210 * dt, floor);
    r.vx = (Math.sign(r.vx) || r.face) * Math.min(s, Math.max(Math.abs(r.vx), floor));
  } else if (dir) {
    const acc = r.ground ? PH.accG : PH.accA, before = Math.abs(r.vx);
    r.vx += dir * acc * (r.vx * dir < 0 ? 1.7 : 1) * dt;
    if (Math.abs(r.vx) > maxV) r.vx = Math.sign(r.vx) * (before > maxV ? Math.max(maxV, before - 600 * dt) : maxV);
    r.face = dir;
  } else {
    r.vx = approach(r.vx, 0, (r.ground ? PH.decG : PH.decA) * dt);
  }
  if (r.boostT > 0 && control && dir >= 0) r.vx = Math.max(r.vx, 235);
  if (r.slipT > 0) r.slipT -= dt;

  /* jump */
  if (r.ground) { r.coyote = PH.coyote; r.jumps = 1; }
  if (control && inp.jump) r.jbuf = PH.buffer;
  if (r.jbuf > 0 && control && !(r.sliding && blocked) && !r.crouch) {
    if (r.coyote > 0) {
      r.vy = -PH.jump; r.ground = false; r.coyote = 0; r.jbuf = 0; r.onPlat = null; r.sliding = false; r.fx.push('jump');
    } else if (r.jumps > 0 && r.wingT <= 0) {
      r.vy = -PH.djump; r.jumps = 0; r.jbuf = 0; r.spin = 0.35; r.fx.push('djump');
    }
  }
  if (r.spin > 0) r.spin -= dt;

  /* gravity, wings and wind */
  let g;
  if (r.wingT > 0) {
    g = 520;
    if (control && inp.jumpHeld) r.vy = Math.max(r.vy - 1500 * dt, -175);
  } else if (r.vy < 0) g = (inp.jumpHeld && control) || r.springT > 0 ? PH.gHold : PH.gUp;
  else g = PH.gDown;
  r.vy = Math.min(r.vy + g * dt, r.wingT > 0 ? 110 : PH.maxFall);
  if (inWind(lv, r)) { r.vy = approach(r.vy, -235, 3300 * dt); r.jumps = 1; r.inWind = true; } else r.inWind = false;

  r.bonk = false;
  moveX(lv, r, r.vx * dt);
  if (r.x < 8) { r.x = 8; r.vx = Math.max(0, r.vx); }
  moveY(lv, r, r.vy * dt);

  /* tiles the runner is touching */
  const l = r.x - PH.halfW, rt = r.x + PH.halfW, top = r.y - r.h;
  for (let tx = Math.floor(l / TILE); tx <= Math.floor((rt - 0.01) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((r.y - 0.01) / TILE); ty++) {
      const c = tileAt(lv, tx, ty);
      if (c === T.WATER) { killRunner(r, 'water'); return; }
      if (c === T.SPIKE && r.y > ty * TILE + 8 && rt > tx * TILE + 2 && l < tx * TILE + 14) hurt(r, 'spike');
      if (c === T.SPRING && r.vy >= 0 && r.y >= ty * TILE + 10) {
        r.vy = -PH.spring; r.springT = 0.55; r.ground = false; r.jumps = 1; r.onPlat = null; r.sliding = false; r.fx.push('spring');
      }
      if (c === T.BOOST && r.boostT < 0.6) { r.boostT = 0.9; r.fx.push('boost'); }
    }
  }
  if (r.y > lv.pxH + 40) {
    if (r.wingT > 0) { r.y = lv.pxH + 30; r.vy = -320; }
    else { killRunner(r, 'fall'); return; }
  }

  /* hazards */
  if (r.invT <= 0) {
    for (const h of lv.haz) {
      if (Math.abs(r.x - (h.px ?? h.x0 ?? h.x)) > 90 && h.type !== 'roll') continue;
      const p = hazPos(h, t);
      if (!p.on) continue;
      if (h.type === 'crush') {
        if (p.f > 0.25 && rt > p.x + 2 && l < p.x + h.w - 2 && top < p.y + h.h && r.y > p.y) {
          hurt(r, 'crush'); if (r.x < p.x + h.w / 2) r.vx = -150; else r.vx = 150;
        }
      } else if (hitBy(r, p.x, p.y, p.rad)) hurt(r, h.type);
      if (r.invT > 0) break;
    }
  }

  /* checkpoints and finish */
  while (r.cp + 1 < lv.cps.length && r.x >= lv.cps[r.cp + 1].x) { r.cp++; if (r.local) r.fx.push('checkpoint'); }
  if (!r.fin && r.x >= lv.finishX) { r.fin = true; r.finT = t; r.fx.push('finish'); }

  /* animation state */
  if (r.frozenT > 0) r.anim = 'frozen';
  else if (r.stunT > 0) r.anim = 'stun';
  else if (r.fin && r.ground && Math.abs(r.vx) < 30) r.anim = 'win';
  else if (r.sliding) r.anim = 'slide';
  else if (r.crouch) r.anim = 'crouch';
  else if (!r.ground) r.anim = r.wingT > 0 ? 'fly' : r.spin > 0 ? 'spin' : r.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(r.vx) > 12) r.anim = 'run';
  else r.anim = 'idle';
  if (r.anim === 'run') {
    r.lastStep += Math.abs(r.vx) * dt;
    if (r.lastStep > 34) { r.lastStep = 0; r.fx.push('step'); }
  }
  r.prog = r.fin ? 1e7 - r.finT * 1000 : r.x;
}
