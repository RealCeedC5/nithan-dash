'use strict';
/* =========================================================
   Game feel: particles, screen shake, flashes, ambient life,
   hazard warnings and the reactions to what runners do.
   ========================================================= */
const SET = { shake: true };
try { Object.assign(SET, JSON.parse(localStorage.getItem('nithan-set') || '{}')); } catch (e) { /* defaults */ }
const saveSet = () => { try { localStorage.setItem('nithan-set', JSON.stringify(SET)); } catch (e) { /* blocked */ } };

/* ---------- particles ---------- */
const PARTS = [];
function burst(x, y, col, n, spd, opts = {}) {
  if (PARTS.length > 500) return;
  for (let i = 0; i < n; i++) {
    const a = opts.up ? -Math.PI / 2 + (Math.random() - 0.5) * (opts.spread ?? 2.2) : opts.dir != null ? opts.dir + (Math.random() - 0.5) * (opts.spread ?? 0.8) : Math.random() * Math.PI * 2;
    const v = spd * (0.4 + Math.random() * 0.8);
    PARTS.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: (opts.life || 0.5) * (0.7 + Math.random() * 0.6), t: 0, col: Array.isArray(col) ? col[(Math.random() * col.length) | 0] : col, s: opts.size || 2, g: opts.g ?? 300, kind: opts.kind || 'dot', drag: opts.drag || 0 });
  }
}
function ring(x, y, col, r1, life = 0.3) { PARTS.push({ x, y, vx: 0, vy: 0, life, t: 0, col, s: r1, g: 0, kind: 'ring', drag: 0 }); }
function dust(x, y, n = 3, col = '#e8dcc8') { burst(x, y, col, n, 34, { up: true, spread: 2.6, life: 0.34, g: 40, kind: 'puff', size: 3, drag: 3 }); }
function stepParts(dt) {
  for (let i = PARTS.length - 1; i >= 0; i--) {
    const p = PARTS[i]; p.t += dt;
    if (p.t >= p.life) { PARTS.splice(i, 1); continue; }
    if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
function drawParts(g) {
  for (const p of PARTS) {
    const k = p.t / p.life;
    g.fillStyle = p.col;
    if (p.kind === 'ring') {
      g.globalAlpha = 1 - k; const r = 2 + p.s * k;
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832; g.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r * 0.6), 2, 1); }
    } else if (p.kind === 'puff') { g.globalAlpha = 0.7 * (1 - k); const s = Math.max(1, Math.round(p.s * (0.5 + k))); g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s); }
    else if (p.kind === 'leaf') { g.globalAlpha = Math.min(1, (1 - k) * 3); const f = Math.sin(p.t * 9 + p.x) > 0; g.fillRect(Math.round(p.x), Math.round(p.y), f ? 2 : 1, f ? 1 : 2); }
    else if (p.kind === 'streak') { g.globalAlpha = 0.6 * (1 - k); g.fillRect(Math.round(p.x), Math.round(p.y), p.s, 1); }
    else { g.globalAlpha = k < 0.6 ? 1 : (1 - k) / 0.4; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
  }
  g.globalAlpha = 1;
}

/* ---------- shake and flash ---------- */
const SHAKE = { v: 0 }, FLASH = { v: 0, col: '255,255,255' };
function addShake(a) { if (SET.shake) SHAKE.v = Math.min(1, SHAKE.v + a); }
function flash(col, a) { FLASH.col = col; FLASH.v = Math.max(FLASH.v, a); }
function shakeOffset(dt) {
  SHAKE.v = Math.max(0, SHAKE.v - dt * 2.6); FLASH.v = Math.max(0, FLASH.v - dt * 2.2);
  const s = SHAKE.v * SHAKE.v * 6;
  return s < 0.3 ? [0, 0] : [Math.round((Math.random() * 2 - 1) * s), Math.round((Math.random() * 2 - 1) * s * 0.7)];
}
const buzz = ms => { try { if (SET.shake && navigator.vibrate && document.body.classList.contains('touch')) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

/* loudness by distance from the middle of the screen */
function nearVol(x) { return clamp(1.15 - Math.abs(x - (CAM.x + VW / 2)) / (VW * 0.75), 0, 1); }
function sfxAt(name, x) { const v = nearVol(x); if (v > 0.06) sfx(name, v); }

/* ---------- ambient life, different in every tale ---------- */
const AMB = [];
let ambTheme = '';
function stepAmbient(dt, lv, t) {
  if (ambTheme !== lv.theme + lv.idx) { ambTheme = lv.theme + lv.idx; AMB.length = 0; }
  const want = { sangthong: 14, plabuthong: 18, kraithong: 16, kaewnama: 16 }[lv.theme] || 0;
  while (AMB.length < want) AMB.push(newAmb(lv, AMB.length, true));
  for (let i = 0; i < AMB.length; i++) {
    const a = AMB[i]; a.t += dt;
    if (a.kind === 'leaf') { a.x += (a.vx + Math.sin(a.t * 2 + a.ph) * 14) * dt; a.y += a.vy * dt; }
    else if (a.kind === 'mote') { a.x += Math.sin(a.t * 0.8 + a.ph) * 6 * dt; a.y += Math.cos(a.t * 0.6 + a.ph * 2) * 4 * dt - 1.5 * dt; }
    else if (a.kind === 'drip') { a.vy += 500 * dt; a.y += a.vy * dt; const gy = a.gy; if (a.y >= gy) { burst(a.x, gy - 1, '#9fd8f0', 3, 30, { up: true, life: 0.25, size: 1, g: 200 }); AMB[i] = newAmb(lv, i, false); continue; } }
    else if (a.kind === 'wind') { a.x += a.vx * dt; a.y += Math.sin(a.t * 3 + a.ph) * 5 * dt; }
    else if (a.kind === 'glow') { a.x += Math.sin(a.t * 0.5 + a.ph) * 5 * dt; a.y -= 5 * dt; }
    if (a.x < CAM.x - 40 || a.x > CAM.x + VW + 40 || a.y > CAM.y + VH + 20 || a.y < CAM.y - 30 || a.t > a.life) AMB[i] = newAmb(lv, i, false);
  }
}
function newAmb(lv, i, anywhere) {
  const rx = CAM.x + Math.random() * (VW + 60) - 30, ry = CAM.y + Math.random() * VH;
  const a = { x: rx, y: ry, t: 0, ph: Math.random() * 7, life: 99, vx: 0, vy: 0 };
  if (lv.theme === 'sangthong') { a.kind = i % 4 === 0 ? 'mote' : 'leaf'; a.vx = -8 - Math.random() * 10; a.vy = 12 + Math.random() * 12; a.col = ['#7cc85a', '#48a046', '#d8c84a', '#a8d86a'][i % 4]; if (!anywhere && a.kind === 'leaf') a.y = CAM.y - 10; }
  else if (lv.theme === 'plabuthong') { a.kind = 'mote'; a.col = i % 3 ? '#fff2a8' : '#ffd060'; a.life = 6 + Math.random() * 6; }
  else if (lv.theme === 'kraithong') {
    if (i % 3 === 0) { a.kind = 'drip'; a.y = CAM.y - 8; a.vy = 40; a.gy = Math.max(a.y + 30, groundUnder(lv, a.x, a.y + 40)); if (a.gy < 0) a.gy = CAM.y + VH + 30; a.col = '#9fd8f0'; if (anywhere) a.y = CAM.y + Math.random() * 80; }
    else { a.kind = 'glow'; a.col = i % 2 ? '#8fe0ff' : '#4fd0c0'; a.life = 5 + Math.random() * 6; }
  } else { a.kind = i % 4 === 0 ? 'leaf' : 'wind'; a.vx = a.kind === 'wind' ? 90 + Math.random() * 80 : 30; a.vy = 6; a.col = a.kind === 'wind' ? '#ffffff' : '#ffb8c8'; a.w = 6 + ((Math.random() * 10) | 0); if (!anywhere) a.x = CAM.x - 20; }
  return a;
}
function drawAmbient(g) {
  for (const a of AMB) {
    const x = Math.round(a.x), y = Math.round(a.y);
    g.fillStyle = a.col;
    if (a.kind === 'leaf') { const f = Math.sin(a.t * 7 + a.ph) > 0; g.globalAlpha = 0.9; g.fillRect(x, y, f ? 3 : 2, f ? 1 : 2); }
    else if (a.kind === 'mote') { g.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(a.t * 2.4 + a.ph)); g.fillRect(x, y, 1, 1); if (a.col === '#ffd060') { g.globalAlpha *= 0.4; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } }
    else if (a.kind === 'drip') { g.globalAlpha = 0.8; g.fillRect(x, y, 1, 3); }
    else if (a.kind === 'wind') { g.globalAlpha = 0.28; g.fillRect(x, y, a.w, 1); }
    else if (a.kind === 'glow') { g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(a.t * 1.7 + a.ph)); g.fillRect(x, y, 1, 1); g.globalAlpha *= 0.3; g.fillRect(x - 1, y - 1, 3, 3); }
  }
  g.globalAlpha = 1;
}

/* ---------- hazards announce themselves ---------- */
function watchHazards(lv, t) {
  const cx = CAM.x;
  for (const h of lv.haz) {
    const hx = h.px ?? h.x ?? h.x0;
    if (h.type !== 'roll' && (hx < cx - 120 || hx > cx + VW + 120)) { h._s = null; continue; }
    const p = hazPos(h, t), s = h._s || (h._s = {});
    if (h.type === 'crush') {
      if (p.f >= 1 && s.f < 1) { const bx = h.x + h.w / 2, by = h.yBot + h.h; dust(bx - 12, by, 4); dust(bx + 12, by, 4); burst(bx, by - 2, '#d8ccb8', 6, 70, { up: true, life: 0.3, size: 1 }); sfxAt('slam', bx); addShake(0.5 * nearVol(bx)); }
      s.f = p.f;
    } else if (h.type === 'leap') {
      const surf = h.base - 7;
      if (p.on !== s.on && s.on !== undefined) { burst(h.x, surf, [lv.th.water, '#ffffff', shade(lv.th.water, 0.5)], 12, 110, { up: true, life: 0.55, spread: 1.6 }); ring(h.x, surf + 1, '#ffffff', 12, 0.4); sfxAt(p.on ? 'snap' : 'splash', h.x); }
      s.on = p.on;
    } else if (h.type === 'roll') {
      if (p.on && p.x > cx - 20 && p.x < cx + VW + 20) {
        if (!s.on) sfxAt('rumble', p.x);
        if (Math.random() < 0.3) dust(p.x + 6, h.y + h.rad, 1, lv.theme === 'kaewnama' ? '#ffffff' : '#d8ccb8');
      }
      s.on = p.on && p.x > cx - 20 && p.x < cx + VW + 20;
    } else if (h.type === 'pend') {
      const side = Math.sin(p.a) > 0;
      if (s.side !== undefined && side !== s.side) sfxAt('whoosh', h.px);
      s.side = side;
    }
  }
}

/* ---------- what runners do: sounds, particles, squash and stretch ---------- */
function vis(r) { return r.vis || (r.vis = { sq: 0, kind: 0, trail: [], trailT: 0, hitT: 0 }); }
function handleFx(r, now) {
  if (!r.fx.length) return;
  const isMe = r === RACE.me && !RACE.demo, V = vis(r), lv = RACE.lv;
  const near = Math.abs(r.x - (CAM.x + VW / 2)) < VW;
  const ground = lv.theme === 'kaewnama' ? '#ffffff' : lv.theme === 'kraithong' ? '#aab4c8' : '#e8dcc8';
  for (const f of r.fx) {
    const fx = r.x, fy = r.y;
    if (near) {
      if (f === 'jump') { dust(fx, fy - 1, 3, ground); V.sq = 0.14; V.kind = 1; }
      else if (f === 'land') { dust(fx - 4, fy - 1, 2, ground); dust(fx + 4, fy - 1, 2, ground); V.sq = 0.12; V.kind = -1; }
      else if (f === 'djump') { ring(fx, fy - 6, '#ffffff', 11, 0.28); burst(fx, fy - 6, ['#ffffff', '#bfeaff'], 6, 60, { life: 0.3, g: 0, size: 1 }); V.sq = 0.14; V.kind = 1; }
      else if (f === 'step') { if (Math.abs(r.vx) > 120 && Math.random() < 0.6) dust(fx - r.face * 5, fy - 1, 1, ground); }
      else if (f === 'slide') burst(fx - r.face * 6, fy - 2, ground, 6, 60, { dir: r.face > 0 ? Math.PI * 1.15 : -0.15 * Math.PI, life: 0.3, g: 60, kind: 'puff', size: 3 });
      else if (f === 'hit' || f === 'crush') { burst(fx, fy - 14, ['#ffe14d', '#ffffff', '#ff8a50'], 14, 130, { g: 80, life: 0.5 }); ring(fx, fy - 12, '#ffffff', 16, 0.25); V.hitT = 0.14; }
      else if (f === 'slip') { burst(fx, fy - 4, ['#f5d33b', '#ffffff'], 10, 100, { up: true, life: 0.5 }); V.hitT = 0.1; }
      else if (f === 'splash') { burst(fx, fy - 4, [lv.th.water, '#ffffff', shade(lv.th.water, 0.5)], 20, 150, { up: true, life: 0.7, spread: 1.8 }); ring(fx, fy - 2, '#ffffff', 16, 0.45); }
      else if (f === 'fall') burst(fx, Math.min(fy, lv.pxH - 8), ['#ffffff', '#bfeaff'], 10, 90, { up: true, life: 0.5 });
      else if (f === 'respawn') { ring(fx, fy - 12, '#ffd34d', 18, 0.4); burst(fx, fy - 12, ['#ffd34d', '#ffffff'], 12, 80, { g: -40, life: 0.45, size: 1 }); }
      else if (f === 'box') { burst(fx, fy - 26, ['#ffd34d', '#ffe88a', '#ff6a50', '#ffffff'], 14, 110, { g: 160, life: 0.5 }); ring(fx, fy - 22, '#ffe88a', 14, 0.3); }
      else if (f === 'block') { ring(fx, fy - 12, '#ffd34d', 20, 0.35); burst(fx, fy - 12, ['#ffd34d', '#fff2a8'], 14, 130, { g: 0, life: 0.35 }); }
      else if (f === 'frozen') burst(fx, fy - 12, ['#bfeaff', '#ffffff', '#b58cff'], 16, 100, { g: 60, life: 0.5 });
      else if (f === 'spring') { dust(fx, fy, 4, ground); ring(fx, fy - 2, '#ffffff', 12, 0.25); V.sq = 0.2; V.kind = 1; }
      else if (f === 'boost') burst(fx - r.face * 8, fy - 10, ['#bfeaff', '#ffffff'], 8, 80, { dir: r.face > 0 ? Math.PI : 0, life: 0.3, g: 0, kind: 'streak', size: 5 });
      else if (f === 'perfect') { ring(fx, fy - 10, '#ffd34d', 22, 0.4); burst(fx - 6, fy - 8, ['#ffd34d', '#ffffff', '#ff8a50'], 16, 120, { dir: Math.PI, spread: 1.2, life: 0.45, g: 60 }); }
      else if (f === 'finish') { for (let i = 0; i < 3; i++) burst(fx + (i - 1) * 16, fy - 40 - i * 6, ['#ffd34d', '#ff6a50', '#3f7fd8', '#3fae6a', '#ffffff', '#ff8fb8'], 22, 190, { up: true, life: 1.3, g: 220, kind: 'leaf' }); }
      else if (f === 'checkpoint') { burst(fx, fy - 36, ['#ffd34d', '#fff2a8'], 10, 70, { g: 60, life: 0.5, size: 1 }); }
      else if (f.startsWith('use:')) { const col = ITEMS[f.slice(4)].col; ring(fx, fy - 12, col, 18, 0.32); burst(fx, fy - 14, [col, '#ffffff'], 12, 100, { g: 0, life: 0.4 }); }
    }
    if (isMe) {
      const snd = f.startsWith('use:') ? 'use_' + f.slice(4) : f === 'crush' ? 'hit' : f === 'step' || f === 'box' ? null : f;
      if (f === 'step') sfx('step', lv.theme === 'kaewnama' ? 0.5 : 1); else if (snd) sfx(snd);
      if (f === 'hit' || f === 'crush' || f === 'slip') { addShake(0.6); flash('255,90,70', 0.3); buzz(60); }
      if (f === 'land' && r.landV > 380) addShake(0.18);
      if (f === 'splash' || f === 'fall') { addShake(0.4); flash('255,255,255', 0.25); buzz(40); }
      if (f === 'frozen') flash('160,200,255', 0.35);
      if (f === 'block') flash('255,220,90', 0.22);
      if (f === 'box') HUD.spinUntil = now + 520;
      if (f === 'perfect') toast('⚡ ' + t('perfect_start'), 1300);
      if (f === 'checkpoint') toast('✓ ' + t('checkpoint'), 900);
      if (f === 'finish') { setBig(t('finish'), true); flash('255,240,180', 0.4); }
    } else if (!RACE.demo && near) {
      if (f === 'hit' || f === 'splash' || f === 'box' || f === 'jump' || f === 'land' || f === 'finish') sfx(f, nearVol(r.x) * (f === 'jump' || f === 'land' ? 0.3 : 0.6));
    }
  }
  r.fx.length = 0;
}
