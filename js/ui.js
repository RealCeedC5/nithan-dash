'use strict';
/* =========================================================
   Screen, camera, rendering, input, HUD and menus
   ========================================================= */
const cv = document.getElementById('game'), g = cv.getContext('2d');
const ov = document.getElementById('over'), og = ov.getContext('2d');
const UI = document.getElementById('ui');
const $ = id => document.getElementById(id);
let VW = 427, SCALE = 3, DPR = 1;

function resize() {
  const w = innerWidth, h = innerHeight;
  VW = clamp(Math.round(VH * w / h), 300, 620);
  cv.width = VW; cv.height = VH;
  SCALE = Math.min(w / VW, h / VH);
  const cw = Math.round(VW * SCALE), ch = Math.round(VH * SCALE);
  for (const c of [cv, ov]) {
    c.style.width = cw + 'px'; c.style.height = ch + 'px';
    c.style.left = Math.round((w - cw) / 2) + 'px'; c.style.top = Math.round((h - ch) / 2) + 'px';
  }
  DPR = Math.min(devicePixelRatio || 1, 2);
  ov.width = Math.round(cw * DPR); ov.height = Math.round(ch * DPR);
  g.imageSmoothingEnabled = false;
  VIG = null;
}
addEventListener('resize', resize);

/* ---------- saved profile and best times ---------- */
const PROFILE = { name: '', r: 0, shirt: null, hair: null };
let BEST = {};
try { Object.assign(PROFILE, JSON.parse(localStorage.getItem('nithan-profile') || '{}')); } catch (e) { /* defaults */ }
try { BEST = JSON.parse(localStorage.getItem('nithan-best') || '{}') || {}; } catch (e) { BEST = {}; }
const saveProfile = () => { try { localStorage.setItem('nithan-profile', JSON.stringify(PROFILE)); } catch (e) { /* blocked */ } };
const saveBest = () => { try { localStorage.setItem('nithan-best', JSON.stringify(BEST)); } catch (e) { /* blocked */ } };
const myLook = () => makeLook(PROFILE.r, PROFILE.shirt, PROFILE.hair);
const myName = () => (PROFILE.name || '').trim() || L10(RUNNERS[PROFILE.r].name);
const fmtTime = s => { if (s == null) return t('dnf'); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SOLO = { level: 0, skill: 1 };
const MEDAL_COL = ['', '#c8834a', '#c9d2dc', '#ffd34d'];
const medalDot = (m, big) => m ? `<i class="medal m${m}${big ? ' big' : ''}" title="${esc(t('medal_' + m))}"></i>` : '';

/* ---------- input ---------- */
const IN = { left: false, right: false, down: false, jumpHeld: false, jumpQueued: false, itemQueued: false, respawnQueued: false, rightAt: -99 };
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyK: 'jump',
  KeyE: 'item', ShiftLeft: 'item', ShiftRight: 'item', KeyX: 'item', KeyJ: 'item', KeyR: 'respawn',
};
function press(act, on) {
  if (act === 'jump') { if (on && !IN.jumpHeld) IN.jumpQueued = true; IN.jumpHeld = on; }
  else if (act === 'item') { if (on) IN.itemQueued = true; }
  else if (act === 'respawn') { if (on) IN.respawnQueued = true; }
  else { if (act === 'right' && on && !IN.right && RACE.on) IN.rightAt = raceClock(); IN[act] = on; }
}
addEventListener('keydown', e => {
  ensureAudio();
  if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter') e.target.blur(); return; }
  if ((e.code === 'Escape' || e.code === 'KeyP') && RACE.on && !RACE.demo && !RACE.ended) { togglePause(); e.preventDefault(); return; }
  const act = KEYMAP[e.code];
  if (act && RACE.on && !RACE.demo) { if (!e.repeat) press(act, true); e.preventDefault(); }
});
addEventListener('keyup', e => { const act = KEYMAP[e.code]; if (act) press(act, false); });
addEventListener('blur', () => { IN.left = IN.right = IN.down = IN.jumpHeld = false; });
addEventListener('pointerdown', e => { ensureAudio(); if (e.pointerType === 'touch') document.body.classList.add('touch'); }, { capture: true });
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

for (const [id, act] of [['tLeft', 'left'], ['tRight', 'right'], ['tSlide', 'down'], ['tJump', 'jump'], ['tItem', 'item']]) {
  const b = $(id);
  const on = e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } b.classList.add('on'); press(act, true); buzz(8); };
  const off = e => { e.preventDefault(); b.classList.remove('on'); press(act, false); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
$('itemSlot').addEventListener('click', () => press('item', true));
$('pauseBtn').addEventListener('click', () => togglePause());

/* ---------- messages ---------- */
let toastTimer = 0;
function toast(msg, ms = 1400) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms); }
let bigText = '';
function setBig(s, pop) { const el = $('big'); if (s === bigText) return; bigText = s; el.textContent = s; if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } }

/* ---------- camera ---------- */
const CAM = { x: 0, y: 0, snap: true, look: 0 };
function focusRunner() { return RACE.demo ? ranking()[0] : RACE.me; }
function updateCamera(dt) {
  const lv = RACE.lv, r = focusRunner();
  if (!r) return;
  CAM.look += (clamp(r.vx * 0.2, -26, 44) - CAM.look) * Math.min(1, dt * 2.5);      // look a little ahead of where you are heading
  const tx = clamp(r.x - VW * 0.37 + CAM.look, 0, lv.pxW - VW), ty = clamp(r.y - VH * 0.66 + (r.vy > 320 ? 14 : 0), 0, lv.pxH - VH - 22);
  if (CAM.snap) { CAM.x = tx; CAM.y = ty; CAM.snap = false; CAM.look = 0; return; }
  CAM.x += (tx - CAM.x) * Math.min(1, dt * 9);
  CAM.y += (ty - CAM.y) * Math.min(1, dt * (Math.abs(ty - CAM.y) > 40 ? 7 : 4));
}

/* ---------- runners ---------- */
function drawRunner(r, now, isMe, dt) {
  if (r.dead) return;
  const S = runnerSprites(r.look), V = vis(r), lv = RACE.lv;
  let pose = r.anim, k = 0, rot = 0;
  if (pose === 'run') k = ((Math.floor(r.x / 6.5) % 8) + 8) % 8;
  else if (pose === 'idle' || pose === 'frozen') { k = Math.floor(now / 420 + (r.id.charCodeAt(r.id.length - 1) % 4)) % 4; pose = 'idle'; }
  else if (pose === 'win') k = Math.floor(now / 200) % 2;
  else if (pose === 'spin') { pose = 'jump'; rot = (r.face || 1) * (1 - Math.max(0, r.spin) / 0.35) * Math.PI * 2; }
  else if (pose === 'fly') pose = 'jump';
  const frames = S[pose] || S.idle, fi = Math.min(k, frames.length - 1), side = r.face < 0 ? 1 : 0, fr = frames[fi][side];
  const x = Math.round(r.x), y = Math.round(r.y);
  /* shadow on whatever is below */
  const gy = r.ground ? y : groundUnder(lv, r.x, r.y - 2);
  if (gy >= 0 && gy - y < 96) { const k2 = 1 - (gy - y) / 96; dropShadow(g, x, gy, 6 + 8 * k2, 0.3 * k2); }
  /* afterimages at speed */
  const fast = (r.boostT > 0 && Math.abs(r.vx) > 150) || Math.abs(r.vx) > 225;
  if (fast && S.ghost[pose] && now - V.trailT > 42) { V.trailT = now; V.trail.push({ x, y, pose, fi, side, at: now }); }
  while (V.trail.length && now - V.trail[0].at > 230) V.trail.shift();
  for (const tr of V.trail) { g.globalAlpha = 0.42 * (1 - (now - tr.at) / 230); g.drawImage(S.ghost[tr.pose][tr.fi][tr.side], tr.x - 9, tr.y - 25); }
  g.globalAlpha = isMe ? 1 : 0.92;
  if (r.invT > 0 && r.frozenT <= 0 && Math.floor(now / 70) % 2) g.globalAlpha *= 0.4;
  if (r.wingT > 0) {
    const flap = Math.round(Math.sin(now / 55) * 3), f = r.face;
    for (let i = 0; i < 4; i++) { PX(g, ['#e07a1c', '#ff9a3c', '#ffb85c', '#ffd27a'][i], x - f * (8 + i * 3) - (f > 0 ? 4 : 0), y - 21 + i * 2 - flap * (i / 3), 5 + i, 2); }
    PX(g, '#ffe8a8', x - f * 18 - (f > 0 ? 3 : 0), y - 14 - flap, 4, 1);
  }
  /* squash on landing, stretch on take-off */
  let sx = 1, sy = 1;
  if (V.sq > 0) { V.sq -= dt; const p = clamp(V.sq / 0.14, 0, 1); if (V.kind < 0) { sx = 1 + 0.22 * p; sy = 1 - 0.2 * p; } else { sx = 1 - 0.15 * p; sy = 1 + 0.2 * p; } }
  if (rot || sx !== 1) {
    g.save(); g.translate(x, rot ? y - 12 : y); if (rot) g.rotate(rot); else g.scale(sx, sy);
    g.drawImage(fr, -9, rot ? -13 : -25); g.restore();
  } else g.drawImage(fr, x - 9, y - 25);
  if (V.hitT > 0) { V.hitT -= dt; if (S.ghost[pose]) { g.globalAlpha = 0.85; g.drawImage(S.ghost[pose][fi][side], x - 9, y - 25); } else { g.globalAlpha = 0.6; PX(g, '#ffffff', x - 6, y - 23, 12, 22); } }
  g.globalAlpha = 1;
  if (r.boostT > 0 && Math.abs(r.vx) > 100) for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(191,234,255,${0.85 - i * 0.15})`; g.fillRect(x - r.face * (12 + i * 7) - 4, y - 20 + i * 5 + Math.floor((now / 40 + i) % 3), 8, 1); }
  if (r.draft > 0.6 && r.ground) for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + r.face * (10 + ((now / 30 + i * 9) % 14)) - 2, y - 19 + i * 6, 5, 1); }
  if (r.shieldT > 0) {       // the yantra cloth: a turning ring of gold marks
    const rad = r.h > 14 ? 15 : 11, cy = y - r.h / 2 - 1, a = 0.7 + Math.sin(now / 120) * 0.25;
    g.fillStyle = `rgba(255,243,168,${a * 0.14})`; for (let dy = -rad; dy <= rad; dy++) { const w = Math.floor(Math.sqrt(rad * rad - dy * dy)); g.fillRect(x - w, Math.round(cy) + dy, w * 2 + 1, 1); }
    for (let i = 0; i < 28; i++) { const an = i / 28 * 6.2832 + now / 700, big = i % 7 === 0; g.fillStyle = big ? `rgba(255,255,255,${a})` : `rgba(255,211,77,${a})`; g.fillRect(Math.round(x + Math.cos(an) * rad) - (big ? 1 : 0), Math.round(cy + Math.sin(an) * rad) - (big ? 1 : 0), big ? 2 : 1, big ? 2 : 1); }
  }
  if (r.frozenT > 0) {
    g.fillStyle = 'rgba(160,214,255,.55)'; g.fillRect(x - 10, y - 27, 20, 27);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(x - 10, y - 27, 20, 1); g.fillRect(x - 10, y - 27, 1, 27); g.fillRect(x - 7, y - 24, 3, 8); g.fillRect(x + 3, y - 10, 2, 5);
    g.fillStyle = 'rgba(90,150,220,.8)'; g.fillRect(x + 9, y - 27, 1, 27); g.fillRect(x - 10, y - 1, 20, 1);
  }
  if (r.stunT > 0 || (r.remote && r.anim === 'stun')) {
    for (let i = 0; i < 3; i++) { const a = now / 150 + i * 2.1, sx2 = Math.round(x + Math.cos(a) * 9), sy2 = Math.round(y - 29 + Math.sin(a) * 2.5); PX(g, '#ffe14d', sx2 - 1, sy2, 3, 1); PX(g, '#ffe14d', sx2, sy2 - 1, 1, 3); }
  }
  if (r.slowT > 0) {
    PX(g, '#6a7f98', x - 9, y - 38, 18, 5); PX(g, '#8aa0b8', x - 9, y - 39, 18, 4); PX(g, '#8aa0b8', x - 6, y - 42, 6, 3); PX(g, '#a8bcd0', x - 1, y - 43, 7, 4); PX(g, '#c8d8e8', x, y - 43, 4, 1);
    g.fillStyle = '#6ac0f0'; for (let i = 0; i < 4; i++) g.fillRect(x - 7 + i * 4, y - 33 + Math.floor((now / 45 + i * 3) % 7), 1, 2);
  }
}

/* ---------- world ---------- */
/* copy the visible part of a level-sized canvas, never reading outside it */
function blit(img, cx, cy) {
  const sx = Math.max(0, cx), sy = Math.max(0, cy), w = Math.min(cx + VW, img.width) - sx, h = Math.min(cy + VH, img.height) - sy;
  if (w > 0 && h > 0) g.drawImage(img, sx, sy, w, h, sx, sy, w, h);
}
function render(now, dt) {
  const lv = RACE.lv, t = RACE.simT, tt = now / 1000;
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawSky(g, lv.theme, VW, tt, CAM.x);
  drawBackdrop(g, lv.theme, CAM.x, lv.pxH - VH - CAM.y, VW);
  const sh = shakeOffset(dt);
  const cx = Math.round(CAM.x) + sh[0], cy = Math.round(CAM.y) + sh[1];
  g.setTransform(1, 0, 0, 1, -cx, -cy);
  const seen = (x, m = 48) => x > cx - m && x < cx + VW + m;
  const x0 = Math.max(0, Math.floor(cx / TILE) - 1), x1 = Math.min(lv.W - 1, x0 + Math.ceil(VW / TILE) + 2);
  for (const w of lv.winds) if (seen(w.x)) drawWind(g, w, tt);
  blit(lv.art, cx, cy);
  drawGlows(g, lv, cx, VW, tt);
  drawWater(g, lv, x0, x1, tt);
  drawBoostPads(g, lv, x0, x1, tt);
  for (const p of lv.plats) if (seen(p.x, 110)) drawPlat(g, p, lv.theme, tt);
  const me = RACE.me;
  lv.cps.forEach((cp, i) => { if (i > 0 && seen(cp.x)) drawFlag(g, cp, me && me.cp >= i, tt); });
  if (seen(lv.finishX, 70)) drawFinish(g, lv.finishX, lv.finishY, tt);
  for (const b of lv.boxes) if (seen(b.x)) drawBox(g, b, tt, !me || RACE.demo || (me.boxT[b.id] ?? -9) <= t - 2.5);
  for (const h of lv.haz) {
    const hx = h.px ?? h.x ?? h.x0;
    if (h.type === 'roll' ? (hx > cx - 20 && hx - h.dist < cx + VW + 20) : seen(hx, 90)) drawHazard(g, lv, h, hazPos(h, t), tt);
  }
  for (const tr of RACE.traps) if (seen(tr.x)) drawTrap(g, tr);
  for (const r of RACE.runners) if (r !== me && seen(r.x, 80)) drawRunner(r, now, false, dt);
  if (me) drawRunner(me, now, !RACE.demo, dt);
  blit(lv.fore, cx, cy);
  /* spell orbs */
  for (let i = RACE.orbs.length - 1; i >= 0; i--) {
    const o = RACE.orbs[i], to = runnerById(o.to), p = (t - o.t0) / o.dur;
    if (!to || p >= 1) { if (to) { burst(to.x, to.y - 12, ['#b58cff', '#ffffff'], 12, 90, { g: 0, life: 0.35 }); ring(to.x, to.y - 12, '#b58cff', 18, 0.3); } RACE.orbs.splice(i, 1); continue; }
    const ox = Math.round(o.x + (to.x - o.x) * p), oy = Math.round(o.y + (to.y - 14 - o.y) * p - Math.sin(Math.PI * p) * 30);
    disc(g, '#7a4fd0', ox, oy, 4); disc(g, '#b58cff', ox - 1, oy - 1, 2); PX(g, '#ffffff', ox - 2, oy - 2, 1, 1);
    if (Math.random() < 0.6) burst(ox, oy, ['#b58cff', '#e8dcff'], 1, 24, { g: 0, life: 0.3, size: 1 });
  }
  RACE.rains = RACE.rains.filter(rn => t < rn.t0 + rn.dur);
  drawAmbient(g);
  drawParts(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
}

/* ---------- crisp overlay: name tags, progress bar, markers, flashes ---------- */
let VIG = null;
function vignette() {
  if (VIG && VIG.width === ov.width && VIG.height === ov.height) return VIG;
  VIG = mk(ov.width, ov.height); const q = VIG.getContext('2d'), W = ov.width, H = ov.height;
  const gr = q.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.56);
  gr.addColorStop(0, 'rgba(14,8,30,0)'); gr.addColorStop(1, 'rgba(14,8,30,.42)'); q.fillStyle = gr; q.fillRect(0, 0, W, H);
  return VIG;
}
function pill(x, y, w, h, col) { og.fillStyle = col; const r = h / 2; og.beginPath(); og.moveTo(x + r, y); og.arcTo(x + w, y, x + w, y + h, r); og.arcTo(x + w, y + h, x, y + h, r); og.arcTo(x, y + h, x, y, r); og.arcTo(x, y, x + w, y, r); og.fill(); }
function renderOverlay(now) {
  og.setTransform(1, 0, 0, 1, 0, 0);
  og.clearRect(0, 0, ov.width, ov.height);
  if (!RACE.on) return;
  og.drawImage(vignette(), 0, 0);
  if (RACE.lv.theme === 'kraithong') { og.globalAlpha = 0.5; og.drawImage(vignette(), 0, 0); og.globalAlpha = 1; }
  if (RACE.demo) return;
  const S = ov.width / VW, lv = RACE.lv, me = RACE.me, D = DPR;
  if (FLASH.v > 0.01) { og.fillStyle = `rgba(${FLASH.col},${FLASH.v * 0.7})`; og.fillRect(0, 0, ov.width, ov.height); }
  /* speed lines while boosting */
  if (me && me.boostT > 0 && !me.dead) {
    og.strokeStyle = 'rgba(255,255,255,.5)'; og.lineWidth = 2 * D; og.beginPath();
    for (let i = 0; i < 14; i++) { const y = ((i * 97 + Math.floor(now / 50) * 53) % 100) / 100 * ov.height, len = (40 + (i * 37) % 80) * D, x = i % 2 ? ov.width - len - ((now / 3 + i * 40) % 60) * D : ((now / 3 + i * 40) % 60) * D; og.moveTo(x, y); og.lineTo(x + len, y); }
    og.stroke();
  }
  og.textAlign = 'center'; og.textBaseline = 'middle';
  og.font = `600 ${Math.round(11 * D)}px Kanit, system-ui, sans-serif`;
  const order = ranking();
  for (const r of RACE.runners) {
    if (r === me || r.dead) continue;
    const sx = (r.x - CAM.x) * S, sy = (r.y - CAM.y - 31) * S;
    if (sx < -30 || sx > ov.width + 30) continue;
    const label = (order.indexOf(r) + 1) + ' ' + r.name, w = og.measureText(label).width + 12 * D;
    pill(sx - w / 2, sy - 8 * D, w, 16 * D, r.bot ? 'rgba(27,20,48,.72)' : 'rgba(47,110,200,.9)');
    og.fillStyle = '#fff8e8'; og.fillText(label, sx, sy + D * 0.5);
  }
  /* progress along the course */
  const bw = Math.min(ov.width * 0.44, 460 * D), bx = (ov.width - bw) / 2, by = 24 * D, span = lv.finishX - lv.startX;
  pill(bx - 12 * D, by - 8 * D, bw + 24 * D, 16 * D, 'rgba(27,20,48,.82)');
  pill(bx, by - 2.5 * D, bw, 5 * D, '#3a2f66');
  if (me) pill(bx, by - 2.5 * D, Math.max(5 * D, clamp((me.x - lv.startX) / span, 0, 1) * bw), 5 * D, '#ffd34d');
  for (let i = 1; i < lv.cps.length; i++) { const fx = bx + clamp((lv.cps[i].x - lv.startX) / span, 0, 1) * bw; og.fillStyle = me && me.cp >= i ? '#ffd34d' : '#e0503f'; og.fillRect(fx - D, by - 7 * D, 2 * D, 6 * D); og.beginPath(); og.moveTo(fx + D, by - 7 * D); og.lineTo(fx + 6 * D, by - 5 * D); og.lineTo(fx + D, by - 3 * D); og.fill(); }
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { og.fillStyle = (i + j) % 2 ? '#1d1410' : '#ffffff'; og.fillRect(bx + bw - 2 * D + j * 2 * D, by - 6 * D + i * 2 * D, 2 * D, 2 * D); }
  og.imageSmoothingEnabled = false;
  for (const r of RACE.runners.slice().sort((a, b) => (a === me) - (b === me))) {
    const f = clamp((r.fin ? span : r.x - lv.startX) / span, 0, 1), hs = (r === me ? 22 : 15) * D, hx = bx + f * bw - hs / 2, hy = by - hs / 2;
    if (r === me) { og.fillStyle = '#ffd34d'; og.fillRect(hx - 2 * D, hy - 2 * D, hs + 4 * D, hs + 4 * D); og.fillStyle = '#1b1430'; og.fillRect(hx - D, hy - D, hs + 2 * D, hs + 2 * D); }
    og.drawImage(runnerSprites(r.look).head, hx, hy, hs, hs);
  }
  /* runners just off screen */
  for (const r of RACE.runners) {
    if (r === me || r.dead || r.fin || !me) continue;
    const sx = (r.x - CAM.x) * S;
    if (sx > -4 && sx < ov.width + 4) continue;
    if (Math.abs(r.x - me.x) > 700) continue;
    const left = sx < 0, ex = left ? 20 * D : ov.width - 20 * D, ey = clamp((r.y - CAM.y - 12) * S, 70 * D, ov.height - 70 * D), d = left ? -1 : 1;
    og.fillStyle = 'rgba(27,20,48,.8)'; og.beginPath(); og.arc(ex, ey, 15 * D, 0, 7); og.fill();
    og.strokeStyle = left ? '#ff8a70' : '#ffd34d'; og.lineWidth = 2 * D; og.beginPath(); og.arc(ex, ey, 15 * D, 0, 7); og.stroke();
    og.drawImage(runnerSprites(r.look).head, ex - 10 * D, ey - 10 * D, 20 * D, 20 * D);
    og.fillStyle = left ? '#ff8a70' : '#ffd34d'; og.beginPath(); og.moveTo(ex + d * 23 * D, ey); og.lineTo(ex + d * 17 * D, ey - 5 * D); og.lineTo(ex + d * 17 * D, ey + 5 * D); og.fill();
    og.fillStyle = '#fff8e8'; og.font = `600 ${Math.round(10 * D)}px Kanit, system-ui, sans-serif`; og.fillText(Math.round(Math.abs(r.x - me.x) / 16) + 'm', ex, ey + 24 * D); og.font = `600 ${Math.round(11 * D)}px Kanit, system-ui, sans-serif`;
  }
}

/* ---------- HUD ---------- */
const ICON_URL = {};
const iconUrl = k => ICON_URL[k] || (ICON_URL[k] = itemIcon(k).toDataURL());
const HUD = { item: '#', rank: '', time: '', spinUntil: 0, spinShown: '', rankAt: -1, rankT: 0, end: '' };
function updateHud(now) {
  const me = RACE.me;
  if (!me) return;
  const order = ranking(), k = order.indexOf(me);
  const rank = t('rank')[k] + '|' + order.length;
  if (rank !== HUD.rank) { HUD.rank = rank; $('hRank').innerHTML = esc(t('rank')[k]) + '<small>/' + order.length + '</small>'; }
  /* overtakes */
  if (RACE.simT > 1.5 && !me.fin && !me.dead) {
    if (HUD.rankAt >= 0 && k !== HUD.rankAt && now - HUD.rankT > 500) {
      const up = k < HUD.rankAt, el = $('rankPop');
      el.textContent = (up ? '▲ ' : '▼ ') + t('rank')[k]; el.className = up ? 'up' : 'down'; void el.offsetWidth; el.classList.add('go');
      const hr = $('hRank'); hr.classList.remove('bump'); void hr.offsetWidth; hr.classList.add('bump');
      sfx(up ? 'pass' : 'passed'); HUD.rankT = now;
    }
    if (now - HUD.rankT > 500 || HUD.rankAt < 0) HUD.rankAt = k;
  }
  const time = fmtTime(Math.max(0, me.fin ? me.finT : RACE.simT));
  if (time !== HUD.time) { HUD.time = time; $('hTime').textContent = time; }
  /* item slot, with a quick roulette when a box is opened */
  const it = me.item || '', spinning = it && now < HUD.spinUntil;
  const show = spinning ? ITEM_KEYS[Math.floor(now / 70) % ITEM_KEYS.length] : it;
  if (show !== HUD.spinShown || it !== HUD.item) {
    if (spinning && show !== HUD.spinShown) sfx('tick');
    if (!spinning && it && HUD.spinShown !== it && HUD.item === it) { sfx('box'); toast(L10(ITEMS[it].name), 1100); }
    HUD.spinShown = show; HUD.item = it;
    const img = show ? `<img src="${iconUrl(show)}" alt="">` : '';
    $('itemSlot').innerHTML = img + (show ? `<kbd>E</kbd>` : '');
    $('itemSlot').classList.toggle('has', !!it && !spinning); $('itemSlot').classList.toggle('spin', !!spinning);
    $('itemName').textContent = it && !spinning ? L10(ITEMS[it].name) : '';
    $('tItem').innerHTML = show ? img : '<span>?</span>';
  }
  /* the race closes a while after the first finisher */
  let end = '';
  if (me.fin) end = t('spectate');
  else if (RACE.firstFinishAt != null) end = t('ends_in', Math.max(0, Math.ceil(25 - (RACE.simT - RACE.firstFinishAt))));
  else if (RACE.mode === 'online' && RACE.runners.some(r => r.fin)) end = t('hurry');
  if (end !== HUD.end) { HUD.end = end; $('endNote').textContent = end; $('endNote').classList.toggle('on', !!end); }
}

let lastCount = 99, introHidden = false;
function updateCountdown() {
  const t0 = RACE.simT;
  if (t0 < 0) {
    const n = Math.ceil(-t0);
    if (n <= 3 && n !== lastCount) { lastCount = n; setBig(String(n), true); sfx('count'); }
    if (n > 3) setBig('', false);
  } else if (t0 < 0.9) {
    if (lastCount !== 0) { lastCount = 0; setBig(t('go'), true); sfx('go'); }
    if (!introHidden) { introHidden = true; $('intro').classList.add('off'); }
  } else {
    if (!introHidden) { introHidden = true; $('intro').classList.add('off'); }
    if (bigText && bigText !== t('finish')) setBig('', false);
  }
}

/* ---------- main loop ---------- */
let lastNow = performance.now(), paused = false, pauseAt = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (RACE.on) {
    if (!paused) updateRace(IN);
    else { IN.jumpQueued = false; IN.itemQueued = false; }
    for (const r of RACE.runners) handleFx(r, now);
    if (!paused) { watchHazards(RACE.lv, RACE.simT); stepAmbient(dt, RACE.lv, RACE.simT); stepParts(dt); }
    updateCamera(dt);
    render(now, paused ? 0 : dt);
    renderOverlay(now);
    if (!RACE.demo) { updateHud(now); updateCountdown(); netTick(); }
    const me = RACE.me, rush = !RACE.demo && me && !me.fin && me.x > RACE.lv.startX + (RACE.lv.finishX - RACE.lv.startX) * 0.8;
    musicTick(RACE.lv.theme, !RACE.demo && RACE.simT > -3.5, rush);
  }
  if (SCREEN === 'title') drawPreview(now);
  if (SCREEN === 'results') drawPodium(now);
  requestAnimationFrame(frame);
}

/* ---------- races ---------- */
function botEntries(count, avoid, skill) {
  const out = [];
  for (let i = 0, b = 1; out.length < count && i < RUNNERS.length * 2; i++) {
    const ri = i % RUNNERS.length;
    if (i < RUNNERS.length && ri === avoid) continue;
    out.push({ id: 'b' + b++, name: L10(RUNNERS[ri].name), look: makeLook(ri), bot: true, skill });
  }
  return out;
}

function startDemo(level) {
  RACE.demo = true;
  document.body.classList.remove('racing');
  startRace(level % LEVELS.length, botEntries(6, -1, 2), 'solo');
  RACE.demo = true;
  CAM.snap = true; PARTS.length = 0;
}

function enterRaceUI() {
  RACE.demo = false; paused = false; CAM.snap = true;
  lastCount = 99; introHidden = false;
  Object.assign(HUD, { item: '#', rank: '', time: '', spinUntil: 0, spinShown: '', rankAt: -1, rankT: 0, end: '#' });
  PARTS.length = 0; SHAKE.v = 0; FLASH.v = 0; IN.rightAt = -99;
  UI.innerHTML = ''; SCREEN = 'race';
  document.body.classList.add('racing'); document.body.classList.remove('menu');
  setBig('', false);
  const th = THEMES[RACE.lv.theme], touch = document.body.classList.contains('touch');
  $('intro').innerHTML = `<h2>${esc(L10(th.name))}</h2><p>${esc(L10(th.story))}</p><p class="keys">${esc(t(touch ? 'hint_touch' : 'hint_keys'))}</p>`;
  $('intro').classList.remove('off');
  if (touch && innerHeight > innerWidth) setTimeout(() => toast(t('rotate'), 2600), 600);
}

function startSolo(level) {
  SOLO.level = level;
  const me = { id: 'me', name: myName(), look: myLook(), bot: false, local: true };
  startRace(level, [me, ...botEntries(5, PROFILE.r, SOLO.skill)], 'solo');
  enterRaceUI();
}

function togglePause() {
  if (!RACE.on || RACE.demo || RACE.ended) return;
  if (SCREEN === 'pause') { resumeRace(); return; }
  if (RACE.mode === 'solo') { paused = true; pauseAt = performance.now(); }
  show('pause');
}
function resumeRace() {
  if (paused && RACE.mode === 'solo') RACE.t0 += performance.now() - pauseAt;
  paused = false; UI.innerHTML = ''; SCREEN = 'race'; document.body.classList.remove('menu');
}
document.addEventListener('visibilitychange', () => { if (document.hidden && RACE.on && !RACE.demo && RACE.mode === 'solo' && SCREEN === 'race') togglePause(); });

function onRaceEnded(list) {
  if (RACE.demo) { const next = (RACE.levelIdx + 1) % LEVELS.length; setTimeout(() => { if (RACE.demo) startDemo(next); }, 1200); return; }
  const me = RACE.me, mine = list.find(e => e.id === me.id), id = LEVELS[RACE.levelIdx].id;
  const info = { newBest: false, medal: 0, newMedal: false, place: list.findIndex(e => e.id === me.id) };
  if (mine && mine.fin) {
    const before = medalFor(id, BEST[id]);
    info.medal = medalFor(id, mine.time);
    if (!BEST[id] || mine.time < BEST[id]) { BEST[id] = mine.time; saveBest(); info.newBest = true; }
    info.newMedal = info.medal > before;
  }
  setTimeout(() => { if (RACE.on && RACE.ended && !RACE.demo) { show('results', list, info); sfx(info.newMedal ? 'medal' : info.place === 0 ? 'cheer' : info.place > 2 ? 'lose' : 'checkpoint'); } }, 1300);
}

/* online callbacks from net.js */
function onLobby() { if (SCREEN === 'lobby') show('lobby'); }
function onNetRaceStart() { enterRaceUI(); }
function onToLobby() { RACE.on = false; leaveRaceUI(); startDemo(NET.lobby ? NET.lobby.level : 0); show('lobby'); }
function onHostLeft() { leaveRaceUI(); startDemo(0); show('title'); setTimeout(() => toast(t('host_left'), 2500), 50); }
function leaveRaceUI() { document.body.classList.remove('racing'); setBig('', false); $('intro').classList.add('off'); $('endNote').classList.remove('on'); paused = false; }

/* ---------- menus ---------- */
let SCREEN = 'title';
const SCREENS = {};
const ACT = {};
function show(name, ...args) {
  SCREEN = name; document.body.classList.add('menu');
  UI.innerHTML = SCREENS[name](...args);
  const after = SCREENS[name + 'After'];
  if (after) after(...args);
}
UI.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || !UI.contains(b)) return;
  ensureAudio(); sfx('click');
  ACT[b.dataset.act] && ACT[b.dataset.act](b, b.dataset.arg);
});

const langSeg = () => `<div class="seg" role="group" aria-label="Language"><button data-act="lang" data-arg="th" aria-pressed="${LANG === 'th'}">ไทย</button><button data-act="lang" data-arg="en" aria-pressed="${LANG === 'en'}">EN</button></div>`;
const settingsBlock = () => `<div class="sets">
    <label class="set"><span>${esc(t('music'))}</span><input type="range" min="0" max="100" step="5" value="${Math.round(AUD.music * 100)}" data-vol="music" aria-label="${esc(t('music'))}"></label>
    <label class="set"><span>${esc(t('sound'))}</span><input type="range" min="0" max="100" step="5" value="${Math.round(AUD.sfx * 100)}" data-vol="sfx" aria-label="${esc(t('sound'))}"></label>
    <div class="set"><span>${esc(t('shake'))}</span><div class="seg"><button data-act="shake" data-arg="1" aria-pressed="${!!SET.shake}">${esc(t('on'))}</button><button data-act="shake" data-arg="0" aria-pressed="${!SET.shake}">${esc(t('off'))}</button></div></div>
    <div class="set"><span>${esc(t('language'))}</span>${langSeg()}</div>
    ${document.documentElement.requestFullscreen ? `<div class="set"><span>${esc(t('fullscreen'))}</span><button class="btn alt small" data-act="full">${esc(t(document.fullscreenElement ? 'off' : 'on'))}</button></div>` : ''}
  </div>`;
function bindSettings() {
  UI.querySelectorAll('[data-vol]').forEach(el => el.addEventListener('input', () => {
    ensureAudio(); AUD[el.dataset.vol] = +el.value / 100; applyVolume(); saveAudio();
    if (el.dataset.vol === 'sfx') sfx('pass');
  }));
}

SCREENS.title = () => {
  const r = RUNNERS[PROFILE.r], look = myLook();
  return `<div class="card">
    <div class="logo"><h1>Nithan Dash</h1><span class="th">วิ่งแดนนิทาน</span></div>
    <p class="tag">${esc(t('tagline'))}</p>
    <div class="menu-grid">
      <div class="chooser">
        <div class="arrows"><button data-act="rprev" aria-label="Previous runner">‹</button><div class="who">${esc(L10(r.name))}</div><button data-act="rnext" aria-label="Next runner">›</button></div>
        <canvas id="prev" width="44" height="34"></canvas>
        <div class="sw" aria-label="${esc(t('shirt'))}">${SHIRTS.map((c, i) => `<button data-act="shirt" data-arg="${i}" style="background:${c}" aria-pressed="${look.shirt === c}" aria-label="${esc(t('shirt'))} ${i + 1}"></button>`).join('')}</div>
        <div class="sw" aria-label="${esc(t('hair'))}">${HAIRS.map((c, i) => `<button data-act="hair" data-arg="${i}" style="background:${c}" aria-pressed="${look.hair === c}" aria-label="${esc(t('hair'))} ${i + 1}"></button>`).join('')}</div>
        <label class="lbl" for="nameIn">${esc(t('name'))}</label>
        <input class="txt" id="nameIn" maxlength="14" value="${esc(PROFILE.name || '')}" placeholder="${esc(L10(r.name))}" autocomplete="off">
      </div>
      <div class="stack">
        <button class="btn" data-act="solo">${esc(t('play_bots'))} ▶</button>
        <button class="btn alt" data-act="host">${esc(t('host'))}</button>
        <button class="btn alt" data-act="joinScreen">${esc(t('join'))}</button>
        <div class="row2"><button class="btn alt" data-act="how">${esc(t('how'))}</button><button class="btn alt" data-act="settings">${esc(t('settings'))}</button></div>
        <div class="foot">${langSeg()}<span class="ver">v2.0</span></div>
      </div>
    </div>
  </div>`;
};
SCREENS.titleAfter = () => {
  const inp = $('nameIn');
  inp.addEventListener('input', () => { PROFILE.name = inp.value.slice(0, 14); saveProfile(); });
};
function drawPreview(now) {
  const c = $('prev');
  if (!c) return;
  const pg = c.getContext('2d'), S = runnerSprites(myLook()), th = THEMES[RACE.lv ? RACE.lv.theme : 'sangthong'];
  pg.clearRect(0, 0, c.width, c.height);
  pg.fillStyle = 'rgba(12,8,28,.35)'; pg.fillRect(15, 30, 14, 2); pg.fillRect(16, 32, 12, 1);
  pg.fillStyle = th.top; pg.fillRect(0, 31, 44, 1); pg.fillStyle = th.top2; pg.fillRect(0, 32, 44, 2);
  for (let i = 0; i < 6; i++) { pg.fillStyle = 'rgba(255,255,255,.35)'; pg.fillRect(44 - ((now / 12 + i * 9) % 50), 28 - (i % 3), 3, 1); }
  pg.drawImage(S.run[Math.floor(now / 75) % 8][0], 13, 5);
}

SCREENS.settings = () => `<div class="card narrow"><h2 class="t">${esc(t('settings'))}</h2>${settingsBlock()}<div class="foot"><button class="btn" data-act="title">${esc(t('back'))}</button></div></div>`;
SCREENS.settingsAfter = bindSettings;

SCREENS.levels = () => `<div class="card">
  <h2 class="t">${esc(t('pick_level'))}</h2>
  <div class="levels">${LEVELS.map((L, i) => { const m = medalFor(L.id, BEST[L.id]), p = PAR[L.id]; return `<button class="lvl" data-act="pickLevel" data-arg="${i}" aria-pressed="${SOLO.level === i}">
      <canvas width="160" height="80" data-thumb="${i}"></canvas>
      <div><b>${i + 1}. ${esc(L10(THEMES[L.theme].name))}</b>
      <small>${medalDot(m)}${esc(t('best'))}: ${BEST[L.id] ? fmtTime(BEST[L.id]) : t('none')}${m < 3 ? ` · ${esc(t('next_medal'))} ${fmtTime(p[2 - m])}` : ''}</small></div>
    </button>`; }).join('')}</div>
  <p class="note story">${esc(L10(THEMES[LEVELS[SOLO.level].theme].story))}</p>
  <div class="row" style="margin-top:12px">
    <span>${esc(t('bots'))}</span>
    <div class="seg">${['easy', 'normal', 'hard'].map((k, i) => `<button data-act="skill" data-arg="${i}" aria-pressed="${SOLO.skill === i}">${esc(t(k))}</button>`).join('')}</div>
    <span class="grow"></span>
    <button class="btn alt" data-act="title">${esc(t('back'))}</button>
    <button class="btn" data-act="go">${esc(t('start'))} ▶</button>
  </div>
</div>`;
SCREENS.levelsAfter = () => document.querySelectorAll('[data-thumb]').forEach(c => drawThumb(c, +c.dataset.thumb));

const THUMB = {};
function drawThumb(c, i) {
  const tg = c.getContext('2d'), L = LEVELS[i];
  tg.imageSmoothingEnabled = false;
  if (!THUMB[i]) {
    const lv = buildLevel(i), sx = [264, 44, 120, 68][i], art = buildLevelArt(lv, sx, sx + 20);
    const full = mk(320, 160), fgx = full.getContext('2d');
    fgx.drawImage(skyCanvas(L.theme, 320), 0, -40);
    for (const B of backdrop(L.theme)) fgx.drawImage(B.c, Math.round(-60 * B.f * 4) % BD_W, -72);
    fgx.drawImage(art.art, 0, -(lv.pxH - 160 - 22)); fgx.drawImage(art.fore, 0, -(lv.pxH - 160 - 22));
    for (const b of lv.boxes) if (b.x / TILE >= sx && b.x / TILE < sx + 20) drawBox(fgx, { id: 0, x: b.x - sx * TILE, y: b.y - (lv.pxH - 160 - 22) }, 0, true);
    fgx.drawImage(runnerSprites(makeLook(i + 1)).run[1][0], 40, lv.startY - (lv.pxH - 160 - 22) - 25);
    THUMB[i] = full;
  }
  tg.drawImage(THUMB[i], 0, 0, 320, 160, 0, 0, 160, 80);
}

SCREENS.how = () => `<div class="card how">
  <h2 class="t">${esc(t('how_title'))}</h2>
  <p>${esc(t('how_keys'))}</p><p>${esc(t('how_touch'))}</p><p>${esc(t('how_tips'))}</p><p>${esc(t('how_tips2'))}</p>
  <h2 class="t" style="font-size:20px;margin-top:14px">${esc(t('items_title'))}</h2>
  <div class="items">${ITEM_KEYS.map(k => `<div><img src="${iconUrl(k)}" alt=""><span><b>${esc(L10(ITEMS[k].name))}</b><small>${esc(L10(ITEMS[k].desc))}</small></span></div>`).join('')}</div>
  <div class="foot"><button class="btn" data-act="title">${esc(t('back'))}</button></div>
</div>`;

SCREENS.join = (status = '') => `<div class="card narrow">
  <h2 class="t">${esc(t('join_title'))}</h2>
  <label class="lbl" for="codeIn">${esc(t('join_code'))}</label>
  <input class="txt code" id="codeIn" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false">
  <div class="status" id="netStatus">${esc(status)}</div>
  <div class="foot"><button class="btn alt" data-act="title">${esc(t('back'))}</button><button class="btn" data-act="connect">${esc(t('connect'))} ▶</button></div>
</div>`;
SCREENS.wait = (status = '') => `<div class="card narrow">
  <h2 class="t">${esc(t('room'))}</h2>
  <div class="status" id="netStatus">${esc(status)}</div>
  <div class="foot"><button class="btn alt" data-act="leave">${esc(t('back'))}</button></div>
</div>`;
SCREENS.joinAfter = () => { const i = $('codeIn'); i.focus(); i.addEventListener('keydown', e => { if (e.key === 'Enter') ACT.connect(); }); };

SCREENS.lobby = () => {
  const L = NET.lobby;
  if (!L) return SCREENS.title();
  const host = NET.isHost;
  const rows = L.players.map(p => `<div class="pl"><canvas width="12" height="12" data-head='${esc(JSON.stringify(p.look))}'></canvas>
      <span class="grow">${esc(p.name)}</span>${p.host ? `<span class="pill gold">${esc(t('host_tag'))}</span>` : ''}${p.id === NET.myId ? `<span class="pill">${esc(t('you'))}</span>` : ''}</div>`).join('');
  const bots = L.fill ? Math.max(0, MAX_RUNNERS - L.players.length) : 0;
  return `<div class="card narrow">
    <h2 class="t">${esc(t('room'))}</h2>
    <div class="code-big">${esc(L.code)}</div>
    <p class="note">${esc(t('share_code'))}</p>
    <div class="foot" style="margin-top:6px"><button class="btn alt small" data-act="copyCode">${esc(t('copy'))}</button></div>
    <div class="players">${rows}${bots ? `<div class="pl"><span class="grow">+ ${bots} ${esc(t('bot_tag'))}</span></div>` : ''}</div>
    <label class="lbl">${esc(t('pick_level'))}</label>
    <div class="seg" style="flex-wrap:wrap">${LEVELS.map((lv, i) => `<button data-act="${host ? 'lobLevel' : ''}" data-arg="${i}" aria-pressed="${L.level === i}" ${host ? '' : 'disabled'}>${i + 1}. ${esc(L10(THEMES[lv.theme].name).split(' · ')[0])}</button>`).join('')}</div>
    ${host ? `<div class="row" style="margin-top:12px">
        <label class="row" style="gap:8px"><input type="checkbox" id="fillIn" ${L.fill ? 'checked' : ''}> ${esc(t('fill_bots'))}</label>
        <div class="seg">${['easy', 'normal', 'hard'].map((k, i) => `<button data-act="lobSkill" data-arg="${i}" aria-pressed="${L.skill === i}">${esc(t(k))}</button>`).join('')}</div>
      </div>
      <div class="foot"><button class="btn alt" data-act="leave">${esc(t('leave'))}</button><button class="btn" data-act="hostGo">${esc(t('start'))} ▶</button></div>`
    : `<p class="note">${esc(t('waiting'))}</p><div class="foot"><button class="btn alt" data-act="leave">${esc(t('leave'))}</button></div>`}
  </div>`;
};
const drawHeads = () => document.querySelectorAll('[data-head]').forEach(c => {
  try { const cg = c.getContext('2d'); cg.imageSmoothingEnabled = false; cg.drawImage(runnerSprites(sanitizeLook(JSON.parse(c.dataset.head))).head, -1, -1); } catch (e) { /* ignore */ }
});
SCREENS.lobbyAfter = () => {
  drawHeads();
  const f = $('fillIn');
  if (f) f.addEventListener('change', () => hostSetOption('fill', f.checked));
};

SCREENS.pause = () => `<div class="card narrow">
  <h2 class="t">${esc(t('paused'))}</h2>
  <div class="stack">
    <button class="btn" data-act="resume">▶ ${esc(t('resume'))}</button>
    <button class="btn alt" data-act="respawn">↺ ${esc(t('respawn'))}</button>
    ${RACE.mode === 'solo' ? `<button class="btn alt" data-act="restart">⟲ ${esc(t('restart'))}</button>` : ''}
    <button class="btn red" data-act="quit">✕ ${esc(t('quit'))}</button>
  </div>
  ${settingsBlock()}
</div>`;
SCREENS.pauseAfter = bindSettings;

/* results: a podium for the top three, then everyone's times */
let PODIUM = null;
const DIGITS = { 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '011', '001', '111'] };
SCREENS.results = (list, info = {}) => {
  const me = RACE.me, first = list[0] && list[0].time;
  PODIUM = { list: list.slice(0, 3), t0: performance.now(), theme: RACE.lv.theme, meId: me.id };
  const rows = list.map((e, i) => `<tr class="${e.id === me.id ? 'me' : ''}"><td class="pos">${esc(t('rank')[i] || i + 1)}</td>
      <td><canvas width="12" height="12" data-head='${esc(JSON.stringify(e.look))}'></canvas> ${esc(e.name)} ${e.bot ? `<span class="pill">${esc(t('bot_tag'))}</span>` : ''}</td>
      <td class="tm">${fmtTime(e.time)}${i > 0 && e.time != null && first != null ? `<small>+${(e.time - first).toFixed(2)}</small>` : ''}</td></tr>`).join('');
  let buttons;
  if (RACE.mode === 'solo') buttons = `<button class="btn alt" data-act="title">${esc(t('menu'))}</button><button class="btn alt" data-act="restart">${esc(t('again'))}</button><button class="btn" data-act="nextLevel">${esc(t('next'))} ▶</button>`;
  else if (NET.isHost) buttons = `<button class="btn alt" data-act="leave">${esc(t('leave'))}</button><button class="btn" data-act="toLobby">${esc(t('again'))} ▶</button>`;
  else buttons = `<button class="btn alt" data-act="leave">${esc(t('leave'))}</button>`;
  const id = LEVELS[RACE.levelIdx].id, p = PAR[id];
  const badge = info.medal ? `<p class="status">${medalDot(info.medal, true)} ${esc(t('medal_' + info.medal))}${info.newBest ? ' · ★ ' + esc(t('new_best')) : ''}</p>`
    : info.newBest ? `<p class="status">★ ${esc(t('new_best'))}</p>` : '';
  const target = RACE.mode === 'solo' && info.medal < 3 ? `<p class="note">${esc(t('next_medal'))} ${medalDot(info.medal + 1)} ${fmtTime(p[2 - info.medal])}</p>` : '';
  return `<div class="card narrow results">
    <h2 class="t">${esc(t('results'))} <small>${esc(L10(THEMES[RACE.lv.theme].name))}</small></h2>
    <canvas id="podium" width="220" height="92"></canvas>
    ${badge}
    <table class="res">${rows}</table>
    ${target}
    ${RACE.mode === 'online' && !NET.isHost ? `<p class="note">${esc(t('waiting'))}</p>` : ''}
    <div class="foot">${buttons}</div>
  </div>`;
};
SCREENS.resultsAfter = drawHeads;
function drawPodium(now) {
  const c = $('podium');
  if (!c || !PODIUM) return;
  const q = c.getContext('2d'), W = c.width, H = c.height, tt = (now - PODIUM.t0) / 1000, th = THEMES[PODIUM.theme];
  q.imageSmoothingEnabled = false;
  q.drawImage(skyCanvas(PODIUM.theme, 320), 50, 60, 220, 92, 0, 0, W, H);
  for (const B of backdrop(PODIUM.theme)) q.drawImage(B.c, 40, 120, 220, 92, 0, 0, W, H);
  q.fillStyle = th.top2; q.fillRect(0, H - 8, W, 8); q.fillStyle = th.top; q.fillRect(0, H - 8, W, 2);
  const slots = [[110, 34, 1], [62, 24, 2], [158, 17, 3]];
  PODIUM.list.forEach((e, i) => {
    const [x, h, n] = slots[i], rise = Math.min(1, Math.max(0, tt * 2.2 - i * 0.25)), top = H - 8 - Math.round(h * rise);
    q.fillStyle = '#2a2148'; q.fillRect(x - 21, top, 42, H - 8 - top); q.fillStyle = '#4a3f78'; q.fillRect(x - 21, top, 42, 3); q.fillStyle = '#1b1430'; q.fillRect(x + 17, top + 3, 4, H - 11 - top);
    q.fillStyle = MEDAL_COL[4 - n]; q.fillRect(x - 5, top + 6, 10, 11); q.fillStyle = 'rgba(255,255,255,.45)'; q.fillRect(x - 5, top + 6, 10, 1); q.fillStyle = '#1b1430';
    DIGITS[n].forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '1') q.fillRect(x - 3 + i * 2, top + 7 + j * 2 - (j > 3 ? 1 : 0), 2, j > 3 ? 1 : 2); });
    const S = runnerSprites(sanitizeLook(e.look)), win = i === 0, hop = win ? Math.round(Math.abs(Math.sin(tt * 5)) * 5) : 0;
    const fr = win ? S.win[Math.floor(tt * 5) % 2][0] : i === 1 ? S.win[1][0] : S.idle[Math.floor(tt * 2.4) % 4][0];
    q.fillStyle = 'rgba(12,8,28,.3)'; q.fillRect(x - 6, top - 1, 12, 1);
    q.drawImage(fr, x - 9, top - 25 - hop);
    if (e.id === PODIUM.meId) { q.fillStyle = '#ffd34d'; const ay = top - 34 - hop + Math.round(Math.sin(tt * 6)); q.fillRect(x - 3, ay, 6, 2); q.fillRect(x - 2, ay + 2, 4, 1); q.fillRect(x - 1, ay + 3, 2, 1); }
  });
  for (let i = 0; i < 26; i++) { const sp = 18 + (i % 5) * 7, x = (i * 53 + Math.sin(tt * 2 + i) * 6) % W, y = ((tt * sp + i * 37) % (H + 10)) - 6; q.fillStyle = ['#ffd34d', '#ff6a50', '#3f7fd8', '#3fae6a', '#ffffff', '#ff8fb8'][i % 6]; q.fillRect(Math.round(x), Math.round(y), Math.sin(tt * 8 + i) > 0 ? 2 : 1, 2); }
}

/* ---------- menu actions ---------- */
Object.assign(ACT, {
  title: () => { if (RACE.on && !RACE.demo) { RACE.on = false; leaveRaceUI(); startDemo(RACE.levelIdx); } show('title'); },
  rprev: () => { PROFILE.r = (PROFILE.r + RUNNERS.length - 1) % RUNNERS.length; PROFILE.shirt = null; PROFILE.hair = null; saveProfile(); show('title'); },
  rnext: () => { PROFILE.r = (PROFILE.r + 1) % RUNNERS.length; PROFILE.shirt = null; PROFILE.hair = null; saveProfile(); show('title'); },
  shirt: (b, i) => { PROFILE.shirt = +i; saveProfile(); show('title'); },
  hair: (b, i) => { PROFILE.hair = +i; saveProfile(); show('title'); },
  lang: (b, l) => { setLang(l); HUD.rank = ''; HUD.item = '#'; HUD.end = '#'; show(SCREEN in SCREENS && SCREEN !== 'results' && SCREEN !== 'wait' ? SCREEN : 'title'); },
  shake: (b, v) => { SET.shake = v === '1'; saveSet(); if (SET.shake) { SHAKE.v = 0.6; } show(SCREEN); },
  full: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* not allowed */ } setTimeout(() => { if (SCREEN === 'settings' || SCREEN === 'pause') show(SCREEN); }, 250); },
  settings: () => show('settings'),
  solo: () => show('levels'),
  pickLevel: (b, i) => { SOLO.level = +i; show('levels'); },
  skill: (b, i) => { SOLO.skill = +i; show('levels'); },
  go: () => startSolo(SOLO.level),
  how: () => show('how'),
  joinScreen: () => { if (window.PREVIEW) return show('wait', t('preview_online')); show('join'); },
  connect: () => {
    const code = ($('codeIn').value || '').trim().toUpperCase();
    $('netStatus').textContent = t('connecting');
    joinRoom(code, { name: myName(), look: myLook() }, () => show('lobby'), msg => { if (SCREEN === 'join') $('netStatus').textContent = msg; });
  },
  host: () => {
    if (window.PREVIEW) return show('wait', t('preview_online'));
    show('wait', t('opening'));
    hostRoom({ name: myName(), look: myLook() }, () => { if (SCREEN === 'wait') show('lobby'); }, msg => { if (SCREEN === 'wait') $('netStatus').textContent = msg; });
  },
  copyCode: b => { const code = NET.lobby && NET.lobby.code; if (!code) return; const done = () => { b.textContent = t('copied'); }; if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => {}); },
  lobLevel: (b, i) => hostSetOption('level', +i),
  lobSkill: (b, i) => hostSetOption('skill', +i),
  hostGo: () => hostStart(),
  leave: () => { netReset(); RACE.on = false; leaveRaceUI(); startDemo(0); show('title'); },
  toLobby: () => { RACE.on = false; leaveRaceUI(); hostBackToLobby(); startDemo(NET.lobby.level); show('lobby'); },
  resume: () => resumeRace(),
  respawn: () => { IN.respawnQueued = true; resumeRace(); },
  restart: () => { paused = false; startSolo(RACE.levelIdx); },
  nextLevel: () => startSolo((RACE.levelIdx + 1) % LEVELS.length),
  quit: () => { if (RACE.mode === 'online') ACT.leave(); else { paused = false; RACE.on = false; leaveRaceUI(); startDemo(RACE.levelIdx); show('title'); } },
});

/* ---------- boot ---------- */
resize();
startDemo(0);
show('title');
requestAnimationFrame(frame);
