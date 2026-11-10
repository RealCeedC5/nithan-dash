'use strict';
/* =========================================================
   Race: clock, runners, items, bots, ranking, results
   ========================================================= */
const STEP = 1 / 120;
const COUNTDOWN = 3;

const RACE = {
  on: false, mode: 'solo', lv: null, levelIdx: 0, runners: [], me: null,
  simT: -COUNTDOWN, t0: 0, startAt: 0, botSkill: 1,
  traps: [], orbs: [], rains: [], pops: [], ended: false, results: null,
  firstFinishAt: null, endAt: null, nextTrap: 1,
};

/* race clock in seconds; negative during the countdown */
function raceClock() {
  if (RACE.mode === 'online' && typeof NET !== 'undefined') return (NET.now() - RACE.startAt) / 1000;
  return (performance.now() - RACE.t0) / 1000 - COUNTDOWN;
}

/* entries: [{id,name,look,bot,local,skill}] */
function startRace(levelIdx, entries, mode, startAt) {
  RACE.on = true; RACE.mode = mode; RACE.levelIdx = levelIdx; RACE.lv = buildLevel(levelIdx);
  RACE.traps = []; RACE.orbs = []; RACE.rains = []; RACE.pops = [];
  RACE.ended = false; RACE.results = null; RACE.firstFinishAt = null; RACE.endAt = null; RACE.go = false;
  RACE.runners = entries.map((e, i) => {
    const r = newRunner(e.id, e.name, e.look, { bot: e.bot, local: e.local, skill: e.skill ?? RACE.botSkill });
    placeAtStart(r, RACE.lv, i);
    r.remote = !simulatedHere(r);
    r.speedMul = r.bot ? [0.86, 0.94, 1.0][r.skill] : 1;
    return r;
  });
  RACE.me = RACE.runners.find(r => r.local && !r.bot) || RACE.runners[0];
  RACE.t0 = performance.now();
  RACE.startAt = startAt || 0;
  RACE.simT = Math.min(raceClock(), -0.01);
  buildLevelArt(RACE.lv);
}

function simulatedHere(r) {
  if (r.local) return true;
  if (!r.bot) return false;
  return RACE.mode === 'solo' || (typeof NET !== 'undefined' && NET.isHost);
}

function runnerById(id) { return RACE.runners.find(r => r.id === id); }

function ranking() {
  return RACE.runners.slice().sort((a, b) => b.prog - a.prog);
}
function rankOf(r) { return ranking().indexOf(r); }

/* ---------- items ---------- */
function rollItem(r) {
  const order = ranking(), n = order.length, k = order.indexOf(r);
  const table = k === 0 ? ITEM_ODDS.front : (n > 2 && k >= n - Math.ceil(n / 3)) ? ITEM_ODDS.back : ITEM_ODDS.middle;
  let sum = 0; for (const v of Object.values(table)) sum += v;
  let roll = Math.random() * sum;
  for (const [key, v] of Object.entries(table)) { roll -= v; if (roll <= 0) return key; }
  return 'boost';
}

function useItem(r) {
  if (!r.item || r.dead || r.fin || r.frozenT > 0) return;
  const it = r.item; r.item = null;
  r.fx.push('use:' + it);
  const t = RACE.simT;
  switch (it) {
    case 'boost': r.boostT = 1.35; break;
    case 'shield': r.shieldT = 9; break;
    case 'wing': r.wingT = 2.3; r.jumps = 1; break;
    case 'freeze': {
      const order = ranking().filter(o => !o.fin && !o.dead);
      const k = order.indexOf(r);
      const target = k > 0 ? order[k - 1] : order[k + 1];
      if (!target) break;
      const delay = clamp(Math.abs(target.x - r.x) / 520, 0.25, 0.9);
      sendEffect({ k: 'freeze', from: r.id, to: target.id, delay });
      break;
    }
    case 'cloud': {
      const ids = RACE.runners.filter(o => o !== r && !o.fin && o.prog > r.prog).map(o => o.id);
      sendEffect({ k: 'cloud', from: r.id, ids });
      break;
    }
    case 'trap': {
      const id = r.id + ':' + (RACE.nextTrap++);
      sendEffect({ k: 'trap', id, x: r.x - r.face * 14, y: r.ground ? r.y : r.y, owner: r.id, t });
      break;
    }
  }
}

/* an effect happens here and is sent to everyone else */
function sendEffect(ev) {
  applyEffect(ev);
  if (RACE.mode === 'online' && typeof NET !== 'undefined') NET.sendEvent(ev);
}

function applyEffect(ev) {
  const t = RACE.simT;
  switch (ev.k) {
    case 'freeze': {
      const from = runnerById(ev.from), to = runnerById(ev.to);
      if (!from || !to) return;
      RACE.orbs.push({ from: from.id, to: to.id, x: from.x, y: from.y - 14, t0: t, dur: ev.delay });
      if (simulatedHere(to)) setTimeout(() => { if (RACE.on) hitByEffect(to, 'freeze'); }, ev.delay * 1000);
      break;
    }
    case 'cloud':
      for (const id of ev.ids) {
        const o = runnerById(id); if (!o) continue;
        RACE.rains.push({ id, t0: t, dur: 2.4 });
        if (simulatedHere(o)) hitByEffect(o, 'slow');
      }
      break;
    case 'trap': {
      let y = ev.y;
      const tx = Math.floor(ev.x / TILE);
      for (let ty = Math.floor((y - 2) / TILE); ty < ROWS; ty++) {
        const c = tileAt(RACE.lv, tx, ty);
        if (isSolidT(c) || c === T.ONEWAY) { y = ty * TILE; break; }
      }
      RACE.traps.push({ id: ev.id, x: ev.x, y, owner: ev.owner, t0: t });
      break;
    }
    case 'untrap': RACE.traps = RACE.traps.filter(tr => tr.id !== ev.id); break;
  }
}

function hitByEffect(r, kind) {
  if (r.fin || r.dead) return;
  if (r.shieldT > 0) { r.shieldT = 0; r.fx.push('block'); return; }
  if (kind === 'freeze') { r.frozenT = 1.4; r.vx *= 0.2; r.sliding = false; r.fx.push('frozen'); }
  if (kind === 'slow') { r.slowT = 2.4; r.fx.push('rained'); }
}

/* ---------- bots ---------- */
function platAt(p, t) {
  if (p.type === 'h') return { x: p.x0 + p.amp * Math.sin(Math.PI * 2 * (t / p.per + p.ph)), y: p.y0 };
  if (p.type === 'v') return { x: p.x0, y: p.y0 + p.amp * Math.sin(Math.PI * 2 * (t / p.per + p.ph)) };
  return { x: p.x, y: p.y, gone: p.gone };
}

/* fly a jump forward and report where it lands */
function predictLanding(lv, x, y, vx, vy, hold, t, target) {
  const dt = 1 / 60;
  let time = 0;
  for (let i = 0; i < 100; i++) {
    const g = vy < 0 ? (time < hold ? PH.gHold : PH.gUp) : PH.gDown;
    vy = Math.min(vy + g * dt, PH.maxFall);
    if (target !== undefined) vx = approach(vx, target, (vx < target ? PH.accA : PH.accA * 1.7) * dt);
    const prevB = y;
    let nx = x + vx * dt;
    const fx = Math.floor((nx + PH.halfW * Math.sign(vx)) / TILE);
    let wall = false;
    for (let ty = Math.floor((y - PH.hStand + 1) / TILE); ty <= Math.floor((y - 1) / TILE); ty++) if (solidAt(lv, fx, ty)) wall = true;
    if (!wall) x = nx;
    y += vy * dt; time += dt;
    if (vy < 0) {
      const ty = Math.floor((y - PH.hStand) / TILE);
      if (solidAt(lv, Math.floor(x / TILE), ty)) { y = (ty + 1) * TILE + PH.hStand; vy = 0; }
    }
    if (vy > 0) {
      const ty = Math.floor(y / TILE);
      for (let tx = Math.floor((x - PH.halfW + 0.5) / TILE); tx <= Math.floor((x + PH.halfW - 0.5) / TILE); tx++) {
        const c = tileAt(lv, tx, ty);
        if (c === T.WATER) return { ok: false, x, y, time };
        if (isSolidT(c) || (c === T.ONEWAY && prevB <= ty * TILE + 0.5)) {
          const above = tileAt(lv, tx, ty - 1);
          return { ok: above !== T.SPIKE && above !== T.WATER, x, y: ty * TILE, time };
        }
      }
      for (const p of lv.plats) {
        const q = platAt(p, t + time);
        if (q.gone) continue;
        if (x + PH.halfW > q.x + 2 && x - PH.halfW < q.x + p.w - 2 && prevB <= q.y + 2 && y >= q.y) return { ok: true, x, y: q.y, time, plat: p };
      }
    }
    if (y > lv.pxH) return { ok: false, x, y, time };
  }
  return { ok: false, x, y, time };
}

function supportAt(lv, px, feetY, t) {
  const tx = Math.floor(px / TILE), ty = Math.floor((feetY + 2) / TILE);
  const c = tileAt(lv, tx, ty);
  if (isSolidT(c) || c === T.ONEWAY) return true;
  for (const p of lv.plats) {
    const q = platAt(p, t);
    if (!q.gone && px >= q.x && px <= q.x + p.w && Math.abs(q.y - feetY) < 6) return true;
  }
  return false;
}

/* try a few jump lengths and keep the one that lands furthest on safe, solid footing */
function planJump(lv, r, t, vy) {
  let best = null;
  const top = PH.run * r.speedMul;
  for (const target of [top, 125, 100, 78, 55, 30]) {
    for (const hold of [0.4, 0.16]) {
      const land = predictLanding(lv, r.x, r.y, r.vx, vy, hold, t, target);
      if (!land.ok || land.x < r.x + 10) continue;
      const solid = supportAt(lv, land.x - 6, land.y, t + land.time) && supportAt(lv, land.x + 6, land.y, t + land.time);
      const score = land.x + (solid ? 40 : 0);
      if (!best || score > best.score) best = { target, hold, x: land.x, score };
    }
  }
  return best;
}

function botInput(lv, r, t, dt) {
  const ai = r.ai;
  const inp = { left: false, right: true, down: false, jump: false, jumpHeld: false };
  if (!ai.init) Object.assign(ai, { init: 1, hold: 0, waitT: 0, lastX: r.x, stuckT: 0, itemAt: t + 1.5 + Math.random() * 3, late: 0 });
  if (r.dead || r.fin || t < 0) { inp.right = false; return inp; }
  const look = r.x + PH.halfW;
  const v = Math.max(80, Math.abs(r.vx));

  if (ai.hold > 0) { ai.hold -= dt; inp.jumpHeld = true; }

  /* stuck? */
  if (Math.abs(r.x - ai.lastX) > 10 || r.respawnT > 0) { ai.lastX = r.x; ai.stuckT = 0; }
  else if (r.frozenT <= 0 && r.stunT <= 0 && !ai.waiting) ai.stuckT += dt;
  ai.waiting = false;
  if (ai.stuckT > 1.6 && ai.stuckT - dt <= 1.6 && r.ground) { inp.jump = true; ai.hold = 0.4; }
  if (ai.stuckT > 5) { killRunner(r, 'fall'); ai.stuckT = 0; return inp; }

  /* items */
  if (r.item && t > ai.itemAt) {
    const order = ranking(), k = order.indexOf(r);
    let go = true;
    if (r.item === 'boost') go = r.ground && supportAt(lv, r.x + 70, r.y, t) && supportAt(lv, r.x + 140, r.y, t);
    if ((r.item === 'freeze' || r.item === 'cloud') && k === 0) go = r.item === 'freeze';
    if (r.item === 'trap') go = order.slice(k + 1).some(o => r.x - o.x < 160 && r.x > o.x) || Math.random() < 0.01;
    if (go) { useItem(r); ai.itemAt = t + 1.2 + Math.random() * 2.5; }
  }

  if (r.inWind) return inp;

  /* in the air: second jump when the landing looks bad, or to clear a wall */
  if (!r.ground) {
    if (ai.plan) { inp.right = r.vx < ai.plan.target - 6; inp.left = r.vx > ai.plan.target + 30; }
    if (r.jumps > 0 && r.wingT <= 0) {
      const wallX = Math.floor((look + 10) / TILE);
      let wall = false;
      for (let ty = Math.floor((r.y - PH.hStand) / TILE); ty <= Math.floor((r.y - 1) / TILE); ty++) if (solidAt(lv, wallX, ty)) wall = true;
      if (wall && r.vy > -90) { inp.jump = true; ai.hold = 0.35; inp.jumpHeld = true; ai.plan = null; inp.right = true; inp.left = false; }
      else if (r.vy > 20) {
        const target = ai.plan ? ai.plan.target : r.vx;
        const land = predictLanding(lv, r.x, r.y, r.vx, r.vy, 0, t, target);
        if (!land.ok) {
          const save = planJump(lv, r, t, -PH.djump);
          if (save || r.y > lv.pxH - 50) { inp.jump = true; ai.hold = save ? save.hold : 0.35; inp.jumpHeld = true; ai.plan = save; }
        }
      }
    }
    if (r.wingT > 0) { inp.jumpHeld = r.y > lv.startY - 40; inp.right = true; inp.left = false; }
    return inp;
  }
  ai.plan = null;

  const groundRow = Math.floor((r.y + 1) / TILE);
  const feetRow = groundRow - 1;

  /* hazards ahead */
  for (const h of lv.haz) {
    if (h.type === 'pend') {
      const d = h.px - r.x;
      if (d > -42 && d < 58) inp.down = true;
    } else if (h.type === 'roll') {
      const p = hazPos(h, t);
      if (p.on && p.x > r.x && p.x - r.x < 40 + v * 0.12 && Math.abs(p.y - (r.y - 8)) < 20) { inp.jump = true; ai.hold = 0.2; }
    } else if (h.type === 'crush') {
      const p = hazPos(h, t);
      const d = h.x - look;
      const under = r.x + PH.halfW > h.x && r.x - PH.halfW < h.x + h.w;
      if (!under && d > -2 && d < 64 && Math.abs(h.yBot + h.h - r.y) < 8) {
        const pass = (h.x + h.w + 8 - (r.x - PH.halfW)) / v + 0.12;
        const safe = p.f === 0 && p.untilDrop > pass;
        if (!safe) { inp.right = false; ai.waiting = true; if (d < 6) inp.left = true; }
      }
    }
  }

  /* low ceiling: slide under */
  const aheadX = Math.floor((look + 12) / TILE);
  if (solidAt(lv, aheadX, feetRow - 1) && !solidAt(lv, aheadX, feetRow)) inp.down = true;
  if (standBlocked(lv, r)) inp.down = true;

  /* wall: jump */
  const wallX = Math.floor((look + 6 + v * 0.03) / TILE);
  if (solidAt(lv, wallX, feetRow) && !inp.down) { inp.jump = true; ai.hold = 0.4; }

  /* spikes */
  for (let d = 4; d < 26 + v * 0.06; d += 6) {
    if (tileAt(lv, Math.floor((look + d) / TILE), feetRow) === T.SPIKE) { inp.jump = true; ai.hold = 0.4; break; }
  }

  /* gap ahead */
  if (!inp.jump && !inp.down) {
    const windAhead = lv.winds.some(w => w.x > r.x && w.x - r.x < 7 * TILE);
    let edge = -1;
    for (let d = 0; d <= 14; d += 2) if (!supportAt(lv, look + d, r.y, t)) { edge = d; break; }
    if (edge >= 0 && !windAhead) {
      const plan = planJump(lv, r, t, -PH.jump);
      if (plan && plan.x > r.x + 20) { inp.jump = true; ai.hold = plan.hold; ai.plan = plan; ai.waitT = 0; }
      else if (edge < 8) {
        ai.waitT += dt; ai.waiting = true;
        if (ai.waitT < 4) { inp.right = false; if (r.vx > 20) inp.left = true; }
        else { inp.jump = true; ai.hold = 0.4; ai.waitT = 0; }
      }
    }
  }
  if (inp.jump) inp.jumpHeld = true;
  return inp;
}

/* keep bots near the humans so races stay close */
function botRubberBand() {
  const humans = RACE.runners.filter(r => !r.bot);
  if (!humans.length) return;
  const best = Math.max(...humans.map(h => h.x));
  const worst = Math.min(...humans.map(h => h.x));
  for (const b of RACE.runners) {
    if (!b.bot || !simulatedHere(b)) continue;
    const base = [0.86, 0.94, 1.0][b.skill];
    let m = base;
    if (b.x < worst - 260) m += 0.08;
    else if (b.x > best + 320) m -= 0.07;
    b.speedMul = m;
  }
}

/* tucking in close behind another runner builds a slipstream */
function updateDraft(dt) {
  for (const r of RACE.runners) {
    if (r.remote) continue;
    let on = false;
    if (r.ground && !r.fin && !r.dead && Math.abs(r.vx) > 110)
      for (const o of RACE.runners) { const dx = (o.x - r.x) * (r.face || 1); if (o !== r && !o.dead && !o.fin && dx > 12 && dx < 64 && Math.abs(o.y - r.y) < 12 && Math.abs(o.vx) > 90) { on = true; break; } }
    r.draftOn = on;
    r.draft = on ? Math.min(1.3, r.draft + dt) : Math.max(0, r.draft - dt * 2.5);
  }
}

/* a boost for pressing forward just before GO; bots get lucky now and then */
function perfectStart(input) {
  for (const r of RACE.runners) {
    if (r.remote) continue;
    const ok = r.bot || window.AUTOPILOT ? Math.random() < [0.12, 0.3, 0.5][r.skill] : input.right && input.rightAt > -0.32 && input.rightAt <= 0.03;
    if (ok) { r.boostT = r.bot ? 0.7 : 1.0; r.fx.push('perfect'); }
  }
}

/* ---------- per-frame update ---------- */
function updateRace(input) {
  if (!RACE.on) return;
  const lv = RACE.lv;
  const target = raceClock();
  let steps = Math.floor((target - RACE.simT) / STEP);
  if (steps > 60) { RACE.simT = target - 60 * STEP; steps = 60; }
  for (let i = 0; i < steps; i++) {
    const t = RACE.simT + STEP;
    updatePlats(lv, t, STEP);
    if ((i & 7) === 0) { botRubberBand(); updateDraft(STEP * 8); }
    if (!RACE.go && t >= 0) { RACE.go = true; perfectStart(input); }
    for (const r of RACE.runners) {
      if (r.remote) continue;
      let inp;
      if (r.bot || window.AUTOPILOT) inp = botInput(lv, r, t, STEP);   // AUTOPILOT: lets tests and demos drive the player
      else inp = { left: input.left, right: input.right, down: input.down, jump: input.jumpQueued, jumpHeld: input.jumpHeld };
      if (!r.bot) {
        input.jumpQueued = false;
        if (input.itemQueued) { input.itemQueued = false; useItem(r); }
        if (input.respawnQueued) { input.respawnQueued = false; if (!r.fin && t > 0) killRunner(r, 'fall'); }
      }
      stepRunner(lv, r, inp, STEP, t);
      pickBoxes(lv, r, t);
      checkTraps(r, t);
    }
    RACE.simT = t;
  }
  for (const r of RACE.runners) if (r.remote) netRunnerTick(r);
  updateEnd();
}

function pickBoxes(lv, r, t) {
  if (r.item || r.dead) return;
  for (const b of lv.boxes) {
    if ((r.boxT[b.id] || -9) > t - 2.5) continue;
    if (Math.abs(b.x - r.x) < 13 && b.y > r.y - r.h - 8 && b.y < r.y + 8) {
      r.boxT[b.id] = t; r.item = rollItem(r); r.fx.push('box');
      if (r.bot) r.ai.itemAt = Math.max(r.ai.itemAt || 0, t + 0.8 + Math.random() * 2);
      break;
    }
  }
}

function checkTraps(r, t) {
  if (r.dead || r.fin) return;
  for (const tr of RACE.traps) {
    if (tr.owner === r.id && t - tr.t0 < 1) continue;
    if (Math.abs(tr.x - r.x) < 9 && Math.abs(tr.y - r.y) < 10) {
      const id = tr.id;
      if (hurt(r, 'slip') || r.fx.includes('block')) sendEffect({ k: 'untrap', id });
      break;
    }
  }
}

/* ---------- ending ---------- */
function updateEnd() {
  if (RACE.ended) return;
  const authority = RACE.mode === 'solo' || (typeof NET !== 'undefined' && NET.isHost);
  if (!authority) return;
  const t = RACE.simT;
  const humans = RACE.runners.filter(r => !r.bot);
  const watch = humans.length ? humans : RACE.runners;
  if (RACE.firstFinishAt === null && watch.some(r => r.fin)) RACE.firstFinishAt = t;
  const allHumans = watch.every(r => r.fin) || (!humans.length && RACE.firstFinishAt !== null && t - RACE.firstFinishAt > 6);
  const timeout = RACE.firstFinishAt !== null && t - RACE.firstFinishAt > 25;
  if (allHumans || timeout || t > 300) {
    if (RACE.endAt === null) RACE.endAt = t + (allHumans ? 1.6 : 0);
    if (t >= RACE.endAt) finishRace();
  }
}

function finishRace() {
  const list = ranking().map(r => ({ id: r.id, name: r.name, look: r.look, bot: r.bot, fin: r.fin, time: r.fin ? r.finT : null }));
  RACE.ended = true;
  RACE.results = list;
  if (RACE.mode === 'online' && typeof NET !== 'undefined') NET.sendResults(list);
  if (typeof onRaceEnded === 'function') onRaceEnded(list);
}

function receiveResults(list) {
  RACE.ended = true;
  RACE.results = list;
  if (typeof onRaceEnded === 'function') onRaceEnded(list);
}

/* remote runners move toward the latest network state */
function netRunnerTick(r) {
  const s = r.net;
  if (!s) return;
  const age = Math.min((performance.now() - s.at) / 1000, 0.25);
  const tx = s.x + s.vx * age, ty = s.y + Math.min(s.vy * age, 40);
  const far = Math.abs(tx - r.x) > 80 || Math.abs(ty - r.y) > 80;
  r.x = far ? tx : r.x + (tx - r.x) * 0.35;
  r.y = far ? ty : r.y + (ty - r.y) * 0.35;
  r.vx = s.vx; r.vy = s.vy;
}
