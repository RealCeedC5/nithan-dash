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

/* ---------- input ---------- */
const IN = { left: false, right: false, down: false, jumpHeld: false, jumpQueued: false, itemQueued: false, respawnQueued: false };
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyK: 'jump',
  KeyE: 'item', ShiftLeft: 'item', ShiftRight: 'item', KeyX: 'item', KeyJ: 'item', KeyR: 'respawn',
};
function press(act, on) {
  if (act === 'jump') { if (on && !IN.jumpHeld) IN.jumpQueued = true; IN.jumpHeld = on; }
  else if (act === 'item') { if (on) IN.itemQueued = true; }
  else if (act === 'respawn') { if (on) IN.respawnQueued = true; }
  else IN[act] = on;
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
  const on = e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } b.classList.add('on'); press(act, true); };
  const off = e => { e.preventDefault(); b.classList.remove('on'); press(act, false); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
$('itemSlot').addEventListener('click', () => press('item', true));
$('pauseBtn').addEventListener('click', () => togglePause());

/* ---------- particles and messages ---------- */
const PARTS = [];
function burst(x, y, col, n, spd, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = opts.up ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.8);
    PARTS.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: opts.life || 0.5 + Math.random() * 0.4, t: 0, col: Array.isArray(col) ? col[i % col.length] : col, s: opts.size || 2, g: opts.g ?? 300 });
  }
}
function stepParts(dt) {
  for (let i = PARTS.length - 1; i >= 0; i--) {
    const p = PARTS[i]; p.t += dt;
    if (p.t >= p.life) { PARTS.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
let toastTimer = 0;
function toast(msg, ms = 1400) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms); }
let bigText = '';
function setBig(s, pop) { const el = $('big'); if (s === bigText) return; bigText = s; el.textContent = s; if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } }

function handleFx(r) {
  if (!r.fx.length) return;
  const isMe = r === RACE.me && !RACE.demo;
  const near = Math.abs(r.x - (CAM.x + VW / 2)) < VW;
  for (const f of r.fx) {
    const fx = r.x, fy = r.y;
    if (near) {
      if (f === 'jump' || f === 'land') burst(fx, fy - 1, '#e8dcc8', 4, 50, { up: true, life: 0.3, g: 100 });
      else if (f === 'djump') burst(fx, fy - 4, '#ffffff', 8, 70, { life: 0.35, g: 0 });
      else if (f === 'step' && Math.random() < 0.4) burst(fx - r.face * 4, fy - 1, '#d8ccb8', 1, 20, { up: true, life: 0.25, g: 60 });
      else if (f === 'hit' || f === 'crush') burst(fx, fy - 18, ['#ffe14d', '#ffffff'], 10, 110, { g: 0, life: 0.45 });
      else if (f === 'slip') burst(fx, fy - 4, ['#f5d33b', '#ffffff'], 10, 90, { up: true });
      else if (f === 'splash') burst(fx, fy - 4, [RACE.lv.th.water, '#ffffff'], 16, 140, { up: true, life: 0.7 });
      else if (f === 'fall') burst(fx, Math.min(fy, RACE.lv.pxH - 8), '#ffffff', 10, 80, { up: true });
      else if (f === 'respawn') burst(fx, fy - 12, ['#ffd34d', '#ffffff'], 14, 90, { g: 0, life: 0.4 });
      else if (f === 'box') burst(fx, fy - 26, ['#ffd34d', '#ffe88a', '#ff6a50'], 12, 100, { g: 120 });
      else if (f === 'block') burst(fx, fy - 12, '#ffd34d', 14, 120, { g: 0, life: 0.35 });
      else if (f === 'frozen') burst(fx, fy - 12, ['#bfeaff', '#ffffff'], 14, 100, { g: 50 });
      else if (f === 'spring') burst(fx, fy, '#ffffff', 8, 90, { up: true, life: 0.3 });
      else if (f === 'boost') burst(fx - 8, fy - 10, '#bfeaff', 6, 60, { g: 0, life: 0.3 });
      else if (f === 'finish') burst(fx, fy - 30, ['#ffd34d', '#ff6a50', '#3f7fd8', '#3fae6a', '#ffffff'], 40, 180, { up: true, life: 1.2 });
      else if (f.startsWith('use:')) burst(fx, fy - 14, ITEMS[f.slice(4)].col, 12, 90, { g: 0, life: 0.4 });
    }
    if (isMe) {
      const snd = f.startsWith('use:') ? 'use' : f === 'crush' ? 'hit' : f;
      sfx(snd);
      if (f === 'box') toast(L10(ITEMS[r.item]?.name || {}), 1200);
      if (f === 'checkpoint') toast('✓ ' + t('checkpoint'), 900);
      if (f === 'finish') { setBig(t('finish'), true); }
    } else if (!RACE.demo && near && (f === 'hit' || f === 'splash' || f === 'box')) sfx(f);
  }
  r.fx.length = 0;
}

/* ---------- camera ---------- */
const CAM = { x: 0, y: 0, snap: true };
function focusRunner() {
  if (RACE.demo) return ranking()[0];
  return RACE.me;
}
function updateCamera(dt) {
  const lv = RACE.lv, r = focusRunner();
  if (!r) return;
  const tx = clamp(r.x - VW * 0.36, 0, lv.pxW - VW), ty = clamp(r.y - VH * 0.66, 0, lv.pxH - VH - 22);
  if (CAM.snap) { CAM.x = tx; CAM.y = ty; CAM.snap = false; return; }
  CAM.x += (tx - CAM.x) * Math.min(1, dt * 9);
  CAM.y += (ty - CAM.y) * Math.min(1, dt * 5);
}

/* ---------- rendering ---------- */
function drawRunner(r, now, isMe) {
  if (r.dead) return;
  const S = runnerSprites(r.look);
  let pose = r.anim, k = 0, rot = 0;
  if (pose === 'run') k = ((Math.floor(r.x / 9) % 6) + 6) % 6;
  else if (pose === 'idle' || pose === 'frozen') { k = Math.floor(now / 450) % 2; pose = 'idle'; }
  else if (pose === 'win') k = Math.floor(now / 220) % 2;
  else if (pose === 'spin') { pose = 'jump'; rot = (r.face || 1) * (1 - Math.max(0, r.spin) / 0.35) * Math.PI * 2; }
  else if (pose === 'fly') pose = 'jump';
  const frames = S[pose] || S.idle;
  const fr = frames[Math.min(k, frames.length - 1)][r.face < 0 ? 1 : 0];
  const x = Math.round(r.x), y = Math.round(r.y);
  g.save();
  g.globalAlpha = isMe ? 1 : 0.88;
  if (r.invT > 0 && r.frozenT <= 0 && Math.floor(now / 70) % 2) g.globalAlpha *= 0.45;
  if (r.wingT > 0) {
    const flap = Math.sin(now / 60) * 3;
    g.fillStyle = '#ff9a3c'; g.fillRect(x - 13 * r.face, y - 20 - flap, 9, 3); g.fillRect(x - 15 * r.face, y - 17 - flap, 9, 3);
    g.fillStyle = '#ffd27a'; g.fillRect(x - 12 * r.face, y - 14 - flap / 2, 7, 2);
  }
  if (rot) { g.translate(x, y - 12); g.rotate(rot); g.drawImage(fr, -9, -13); g.setTransform(1, 0, 0, 1, -Math.round(CAM.x), -Math.round(CAM.y)); }
  else g.drawImage(fr, x - 9, y - 25);
  g.globalAlpha = 1;
  if (r.boostT > 0 && Math.abs(r.vx) > 100) {
    g.fillStyle = 'rgba(191,234,255,.8)';
    for (let i = 0; i < 3; i++) g.fillRect(x - r.face * (12 + i * 6) - 3, y - 18 + i * 5 + ((now / 40 + i) % 3), 6, 1);
  }
  if (r.shieldT > 0) {
    g.strokeStyle = `rgba(255,211,77,${0.55 + Math.sin(now / 120) * 0.25})`; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y - r.h / 2 - 1, r.h > 14 ? 15 : 11, 0, 7); g.stroke();
  }
  if (r.frozenT > 0) {
    g.fillStyle = 'rgba(191,234,255,.6)'; g.fillRect(x - 9, y - 26, 18, 26);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x - 7, y - 24, 3, 8); g.fillRect(x + 3, y - 10, 2, 5);
  }
  if (r.stunT > 0 || (r.remote && r.anim === 'stun')) {
    for (let i = 0; i < 3; i++) { const a = now / 160 + i * 2.1; g.fillStyle = '#ffe14d'; g.fillRect(Math.round(x + Math.cos(a) * 8), Math.round(y - 28 + Math.sin(a) * 2), 2, 2); }
  }
  if (r.slowT > 0) {
    g.fillStyle = '#8aa0b8'; g.fillRect(x - 8, y - 38, 16, 5); g.fillRect(x - 5, y - 40, 9, 2);
    g.fillStyle = '#4fb0e8'; for (let i = 0; i < 3; i++) g.fillRect(x - 6 + i * 5, y - 32 + ((now / 50 + i * 3) % 6), 1, 2);
  }
  g.restore();
}

function render(now) {
  const lv = RACE.lv, th = lv.th, t = RACE.simT, tt = now / 1000;
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawSky(g, th, VW, tt);
  const layers = backdrop(lv.theme), f = [0.12, 0.3, 0.55];
  layers.forEach((L, i) => {
    const off = -((CAM.x * f[i]) % 512), yo = Math.round((lv.pxH - VH - CAM.y) * f[i] * 0.5);
    for (let x = off; x < VW; x += 512) g.drawImage(L, Math.round(x), yo);
  });
  const cx = Math.round(CAM.x), cy = Math.round(CAM.y);
  g.setTransform(1, 0, 0, 1, -cx, -cy);
  const vis = (x, m = 48) => x > cx - m && x < cx + VW + m;
  const x0 = Math.max(0, Math.floor(cx / TILE) - 1), x1 = Math.min(lv.W - 1, x0 + Math.ceil(VW / TILE) + 2);
  for (const w of lv.winds) if (vis(w.x)) drawWind(g, w, tt);
  g.drawImage(lv.art, cx, cy, VW, VH, cx, cy, VW, VH);
  drawWater(g, lv, x0, x1, tt);
  drawBoostPads(g, lv, x0, x1, tt);
  for (const p of lv.plats) if (vis(p.x, 64)) drawPlat(g, p, lv.theme);
  const me = RACE.me;
  lv.cps.forEach((cp, i) => { if (i > 0 && vis(cp.x)) drawFlag(g, cp, me && me.cp >= i, tt); });
  if (vis(lv.finishX, 60)) drawFinish(g, lv.finishX, lv.finishY);
  for (const b of lv.boxes) if (vis(b.x)) drawBox(g, b, tt, !me || RACE.demo || (me.boxT[b.id] ?? -9) <= t - 2.5);
  for (const h of lv.haz) {
    const hx = h.px ?? h.x ?? h.x0;
    if (h.type === 'roll' ? (hx > cx - 20 && hx - h.dist < cx + VW + 20) : vis(hx, 90)) drawHazard(g, h, hazPos(h, t), lv.theme);
  }
  for (const tr of RACE.traps) if (vis(tr.x)) drawTrap(g, tr);
  for (const r of RACE.runners) if (r !== me && vis(r.x)) drawRunner(r, now, false);
  if (me && !RACE.demo) drawRunner(me, now, true); else if (me) drawRunner(me, now, false);
  /* spell orbs */
  for (let i = RACE.orbs.length - 1; i >= 0; i--) {
    const o = RACE.orbs[i], to = runnerById(o.to), p = (t - o.t0) / o.dur;
    if (!to || p >= 1) { if (to) burst(to.x, to.y - 12, '#b58cff', 10, 80, { g: 0, life: 0.35 }); RACE.orbs.splice(i, 1); continue; }
    const ox = o.x + (to.x - o.x) * p, oy = o.y + (to.y - 14 - o.y) * p - Math.sin(Math.PI * p) * 30;
    g.fillStyle = '#7a4fd0'; g.fillRect(ox - 4, oy - 4, 8, 8); g.fillStyle = '#e8dcff'; g.fillRect(ox - 2, oy - 3, 3, 3);
    if (Math.random() < 0.5) burst(ox, oy, '#b58cff', 1, 20, { g: 0, life: 0.3 });
  }
  RACE.rains = RACE.rains.filter(rn => t < rn.t0 + rn.dur);
  for (const p of PARTS) { g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.col; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
  g.globalAlpha = 1;
  g.setTransform(1, 0, 0, 1, 0, 0);
}

/* crisp overlay: name tags, progress bar, off-screen markers */
function renderOverlay() {
  og.setTransform(1, 0, 0, 1, 0, 0);
  og.clearRect(0, 0, ov.width, ov.height);
  if (!RACE.on || RACE.demo) return;
  const S = ov.width / VW, lv = RACE.lv, me = RACE.me;
  og.textAlign = 'center'; og.textBaseline = 'middle';
  og.font = `600 ${Math.round(11 * DPR)}px Kanit, system-ui, sans-serif`;
  for (const r of RACE.runners) {
    if (r === me || r.dead) continue;
    const sx = (r.x - CAM.x) * S, sy = (r.y - CAM.y - 30) * S;
    if (sx < -20 || sx > ov.width + 20) continue;
    const w = og.measureText(r.name).width + 10 * DPR;
    og.fillStyle = r.bot ? 'rgba(27,20,48,.7)' : 'rgba(63,127,216,.85)';
    og.fillRect(sx - w / 2, sy - 8 * DPR, w, 16 * DPR);
    og.fillStyle = '#fff8e8'; og.fillText(r.name, sx, sy);
  }
  /* progress bar */
  const bw = Math.min(ov.width * 0.46, 480 * DPR), bx = (ov.width - bw) / 2, by = 22 * DPR;
  og.fillStyle = 'rgba(27,20,48,.8)'; og.fillRect(bx - 8 * DPR, by - 6 * DPR, bw + 16 * DPR, 12 * DPR);
  og.fillStyle = '#4a3f78'; og.fillRect(bx, by - 2 * DPR, bw, 4 * DPR);
  for (let i = 0; i < 6; i++) { og.fillStyle = i % 2 ? '#1d1410' : '#ffffff'; og.fillRect(bx + bw - 2 * DPR, by - 6 * DPR + i * 2 * DPR, 4 * DPR, 2 * DPR); }
  const span = lv.finishX - lv.startX;
  const order = RACE.runners.slice().sort((a, b) => (a === me) - (b === me));
  for (const r of order) {
    const f = clamp((r.fin ? span : r.x - lv.startX) / span, 0, 1);
    const head = runnerSprites(r.look).head, hs = (r === me ? 22 : 16) * DPR;
    const hx = bx + f * bw - hs / 2, hy = by - hs / 2 + (r === me ? 0 : 1);
    og.imageSmoothingEnabled = false;
    if (r === me) { og.fillStyle = '#ffd34d'; og.fillRect(hx - 2 * DPR, hy - 2 * DPR, hs + 4 * DPR, hs + 4 * DPR); }
    og.drawImage(head, hx, hy, hs, hs);
  }
  /* runners just off screen */
  for (const r of RACE.runners) {
    if (r === me || r.dead || r.fin) continue;
    const sx = (r.x - CAM.x) * S;
    if (sx > -4 && sx < ov.width + 4) continue;
    if (Math.abs(r.x - me.x) > 700) continue;
    const left = sx < 0, ex = left ? 18 * DPR : ov.width - 18 * DPR;
    const ey = clamp((r.y - CAM.y - 12) * S, 60 * DPR, ov.height - 60 * DPR);
    og.fillStyle = 'rgba(27,20,48,.75)'; og.beginPath(); og.arc(ex, ey, 14 * DPR, 0, 7); og.fill();
    og.drawImage(runnerSprites(r.look).head, ex - 9 * DPR, ey - 9 * DPR, 18 * DPR, 18 * DPR);
    og.fillStyle = '#ffd34d'; og.beginPath();
    const d = left ? -1 : 1;
    og.moveTo(ex + d * 20 * DPR, ey); og.lineTo(ex + d * 14 * DPR, ey - 5 * DPR); og.lineTo(ex + d * 14 * DPR, ey + 5 * DPR); og.fill();
  }
}

/* ---------- HUD ---------- */
const ICON_URL = {};
const iconUrl = k => ICON_URL[k] || (ICON_URL[k] = itemIcon(k).toDataURL());
let hudItem = '#', hudRank = '', hudTime = '';
function updateHud() {
  const me = RACE.me;
  if (!me) return;
  const order = ranking(), k = order.indexOf(me);
  const rank = (LANG === 'th' ? t('rank')[k] : t('rank')[k]) + '|' + order.length;
  if (rank !== hudRank) { hudRank = rank; $('hRank').innerHTML = esc(t('rank')[k]) + '<small>/' + order.length + '</small>'; }
  const time = fmtTime(Math.max(0, me.fin ? me.finT : RACE.simT));
  if (time !== hudTime) { hudTime = time; $('hTime').textContent = '⏱ ' + time; }
  const it = me.item || '';
  if (it !== hudItem) {
    hudItem = it;
    $('itemSlot').innerHTML = it ? `<img src="${iconUrl(it)}" alt="">` : '';
    $('itemSlot').classList.toggle('has', !!it);
    $('itemName').textContent = it ? L10(ITEMS[it].name) : '';
    $('tItem').innerHTML = it ? `<img src="${iconUrl(it)}" alt="">` : '?';
  }
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
    for (const r of RACE.runners) handleFx(r);
    stepParts(dt);
    updateCamera(dt);
    render(now);
    renderOverlay();
    if (!RACE.demo) { updateHud(); updateCountdown(); netTick(); }
    musicTick(RACE.lv.theme, !RACE.demo && RACE.simT > -3.5);
  }
  if (SCREEN === 'title') drawPreview(now);
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
  CAM.snap = true;
}

function enterRaceUI() {
  RACE.demo = false; paused = false; CAM.snap = true;
  lastCount = 99; introHidden = false; hudItem = '#'; hudRank = ''; hudTime = '';
  PARTS.length = 0;
  UI.innerHTML = ''; SCREEN = 'race';
  document.body.classList.add('racing');
  setBig('', false);
  const th = THEMES[RACE.lv.theme];
  $('intro').innerHTML = `<h2>${esc(L10(th.name))}</h2><p>${esc(L10(th.story))}</p>`;
  $('intro').classList.remove('off');
  if (document.body.classList.contains('touch') && innerHeight > innerWidth) setTimeout(() => toast(t('rotate'), 2600), 600);
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
  paused = false; UI.innerHTML = ''; SCREEN = 'race';
}
document.addEventListener('visibilitychange', () => { if (document.hidden && RACE.on && !RACE.demo && RACE.mode === 'solo' && SCREEN === 'race') togglePause(); });

function onRaceEnded(list) {
  if (RACE.demo) { const next = (RACE.levelIdx + 1) % LEVELS.length; setTimeout(() => { if (RACE.demo) startDemo(next); }, 1200); return; }
  const me = RACE.me, mine = list.find(e => e.id === me.id);
  let newBest = false;
  if (mine && mine.fin) {
    const id = LEVELS[RACE.levelIdx].id;
    if (!BEST[id] || mine.time < BEST[id]) { BEST[id] = mine.time; saveBest(); newBest = true; }
  }
  setTimeout(() => { if (RACE.on && RACE.ended && !RACE.demo) show('results', list, newBest); }, 1300);
}

/* online callbacks from net.js */
function onLobby() { if (SCREEN === 'lobby') show('lobby'); }
function onNetRaceStart() { enterRaceUI(); }
function onToLobby() { RACE.on = false; leaveRaceUI(); startDemo(NET.lobby ? NET.lobby.level : 0); show('lobby'); }
function onHostLeft() { leaveRaceUI(); startDemo(0); show('title'); setTimeout(() => toast(t('host_left'), 2500), 50); }
function leaveRaceUI() { document.body.classList.remove('racing'); setBig('', false); $('intro').classList.add('off'); paused = false; }

/* ---------- menus ---------- */
let SCREEN = 'title';
const SCREENS = {};
const ACT = {};
function show(name, ...args) {
  SCREEN = name;
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
const soundBtn = () => `<button class="btn alt small" data-act="sound">🔊 ${t('sound')}: ${AUD.sfx ? t('on') : t('off')}</button>`;

SCREENS.title = () => {
  const r = RUNNERS[PROFILE.r], look = myLook();
  return `<div class="card">
    <div class="logo"><h1>Nithan Dash</h1><span class="th">วิ่งแดนนิทาน</span></div>
    <p class="tag">${esc(t('tagline'))}</p>
    <div class="menu-grid">
      <div class="chooser">
        <div class="arrows"><button data-act="rprev" aria-label="Previous runner">‹</button><div class="who">${esc(L10(r.name))}</div><button data-act="rnext" aria-label="Next runner">›</button></div>
        <canvas id="prev" width="20" height="28" style="width:80px;height:112px"></canvas>
        <div class="sw" aria-label="${esc(t('shirt'))}">${SHIRTS.map((c, i) => `<button data-act="shirt" data-arg="${i}" style="background:${c}" aria-pressed="${look.shirt === c}" aria-label="${esc(t('shirt'))} ${i + 1}"></button>`).join('')}</div>
        <div class="sw" aria-label="${esc(t('hair'))}">${HAIRS.map((c, i) => `<button data-act="hair" data-arg="${i}" style="background:${c}" aria-pressed="${look.hair === c}" aria-label="${esc(t('hair'))} ${i + 1}"></button>`).join('')}</div>
        <label class="lbl" for="nameIn">${esc(t('name'))}</label>
        <input class="txt" id="nameIn" maxlength="14" value="${esc(PROFILE.name || '')}" placeholder="${esc(L10(r.name))}" autocomplete="off">
      </div>
      <div class="stack">
        <button class="btn" data-act="solo">🏃 ${esc(t('play_bots'))}</button>
        <button class="btn alt" data-act="host">🏠 ${esc(t('host'))}</button>
        <button class="btn alt" data-act="joinScreen">🔑 ${esc(t('join'))}</button>
        <button class="btn alt" data-act="how">❓ ${esc(t('how'))}</button>
        <div class="foot">${langSeg()}${soundBtn()}</div>
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
  const pg = c.getContext('2d'), S = runnerSprites(myLook());
  pg.clearRect(0, 0, c.width, c.height);
  pg.drawImage(S.run[Math.floor(now / 90) % 6][0], 1, 1);
}

SCREENS.levels = () => `<div class="card">
  <h2 class="t">${esc(t('pick_level'))}</h2>
  <div class="levels">${LEVELS.map((L, i) => `<button class="lvl" data-act="pickLevel" data-arg="${i}" aria-pressed="${SOLO.level === i}">
      <canvas width="160" height="80" data-thumb="${i}"></canvas>
      <div><b>${i + 1}. ${esc(L10(THEMES[L.theme].name))}</b><small>${esc(t('best'))}: ${BEST[L.id] ? fmtTime(BEST[L.id]) : t('none')}</small></div>
    </button>`).join('')}</div>
  <div class="row" style="margin-top:14px">
    <span>${esc(t('bots'))}</span>
    <div class="seg">${['easy', 'normal', 'hard'].map((k, i) => `<button data-act="skill" data-arg="${i}" aria-pressed="${SOLO.skill === i}">${esc(t(k))}</button>`).join('')}</div>
    <span class="grow"></span>
    <button class="btn alt" data-act="title">${esc(t('back'))}</button>
    <button class="btn" data-act="go">${esc(t('start'))} ▶</button>
  </div>
</div>`;
SCREENS.levelsAfter = () => document.querySelectorAll('[data-thumb]').forEach(c => drawThumb(c, +c.dataset.thumb));

const THUMB_LV = {};
function drawThumb(c, i) {
  const tg = c.getContext('2d'), L = LEVELS[i], th = THEMES[L.theme];
  tg.imageSmoothingEnabled = false;
  const grd = tg.createLinearGradient(0, 0, 0, 80); grd.addColorStop(0, th.sky[0]); grd.addColorStop(1, th.sky[1]);
  tg.fillStyle = grd; tg.fillRect(0, 0, 160, 80);
  backdrop(L.theme).forEach((layer, k) => tg.drawImage(layer, k * 40, 0, 320, VH, 0, -10, 160, VH / 2));
  const lv = THUMB_LV[i] || (THUMB_LV[i] = buildLevel(i));
  const S = tileSet(th), sx = [264, 44, 120, 68][i];
  for (let y = 6; y < ROWS; y++) for (let x = 0; x < 20; x++) {
    const ct = tileAt(lv, sx + x, y), px = x * 8, py = (y - 8) * 8;
    if (isSolidT(ct)) tg.drawImage(!isSolidT(tileAt(lv, sx + x, y - 1)) ? S.top[0] : S.soil[0], px, py, 8, 8);
    else if (ct === T.ONEWAY) tg.drawImage(S.plank, px, py, 8, 8);
    else if (ct === T.WATER) { tg.fillStyle = th.water; tg.fillRect(px, py, 8, 8); }
  }
  for (const b of lv.boxes) if (b.x / TILE >= sx && b.x / TILE < sx + 20) drawBox(tg, { id: 0, x: (b.x / TILE - sx) * 8, y: (b.y / TILE - 8) * 8 }, 0, true);
  tg.drawImage(runnerSprites(makeLook(i + 1)).run[1][0], 18, (lv.startY / TILE - 8) * 8 - 26, 18, 26);
}

SCREENS.how = () => `<div class="card how">
  <h2 class="t">${esc(t('how_title'))}</h2>
  <p>${esc(t('how_keys'))}</p><p>${esc(t('how_touch'))}</p><p>${esc(t('how_tips'))}</p>
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
SCREENS.lobbyAfter = () => {
  document.querySelectorAll('[data-head]').forEach(c => {
    try { const cg = c.getContext('2d'); cg.imageSmoothingEnabled = false; cg.drawImage(runnerSprites(sanitizeLook(JSON.parse(c.dataset.head))).head, -1, -1); } catch (e) { /* ignore */ }
  });
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
  <div class="foot">${langSeg()}${soundBtn()}</div>
</div>`;

SCREENS.results = (list, newBest) => {
  const me = RACE.me;
  const rows = list.map((e, i) => `<tr class="${e.id === me.id ? 'me' : ''}"><td class="pos">${esc(t('rank')[i] || i + 1)}</td>
      <td><canvas width="12" height="12" data-head='${esc(JSON.stringify(e.look))}'></canvas> ${esc(e.name)} ${e.bot ? `<span class="pill">${esc(t('bot_tag'))}</span>` : ''}</td>
      <td class="tm">${fmtTime(e.time)}</td></tr>`).join('');
  let buttons;
  if (RACE.mode === 'solo') buttons = `<button class="btn alt" data-act="title">${esc(t('menu'))}</button><button class="btn alt" data-act="restart">${esc(t('again'))}</button><button class="btn" data-act="nextLevel">${esc(t('next'))} ▶</button>`;
  else if (NET.isHost) buttons = `<button class="btn alt" data-act="leave">${esc(t('leave'))}</button><button class="btn" data-act="toLobby">${esc(t('again'))} ▶</button>`;
  else buttons = `<button class="btn alt" data-act="leave">${esc(t('leave'))}</button>`;
  return `<div class="card narrow">
    <h2 class="t">🏁 ${esc(t('results'))}</h2>
    <p class="note" style="margin:0 0 6px">${esc(L10(THEMES[RACE.lv.theme].name))}</p>
    <table class="res">${rows}</table>
    ${newBest ? `<p class="status">★ ${esc(t('new_best'))}</p>` : ''}
    ${RACE.mode === 'online' && !NET.isHost ? `<p class="note">${esc(t('waiting'))}</p>` : ''}
    <div class="foot">${buttons}</div>
  </div>`;
};
SCREENS.resultsAfter = SCREENS.lobbyAfter;

/* ---------- menu actions ---------- */
Object.assign(ACT, {
  title: () => { if (RACE.on && !RACE.demo) { RACE.on = false; leaveRaceUI(); startDemo(RACE.levelIdx); } show('title'); },
  rprev: () => { PROFILE.r = (PROFILE.r + RUNNERS.length - 1) % RUNNERS.length; PROFILE.shirt = null; PROFILE.hair = null; saveProfile(); show('title'); },
  rnext: () => { PROFILE.r = (PROFILE.r + 1) % RUNNERS.length; PROFILE.shirt = null; PROFILE.hair = null; saveProfile(); show('title'); },
  shirt: (b, i) => { PROFILE.shirt = +i; saveProfile(); show('title'); },
  hair: (b, i) => { PROFILE.hair = +i; saveProfile(); show('title'); },
  lang: (b, l) => { setLang(l); hudRank = ''; hudItem = '#'; if (SCREEN === 'pause') show('pause'); else if (SCREEN === 'lobby') show('lobby'); else show(SCREEN === 'race' ? 'title' : SCREEN in SCREENS ? SCREEN : 'title'); },
  sound: () => { AUD.sfx = !AUD.sfx; AUD.music = AUD.sfx; saveAudio(); show(SCREEN); },
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
