'use strict';
/* =========================================================
   Online rooms over WebRTC (PeerJS). The host's game owns the
   lobby, the bots and the results; every player simulates
   their own runner and shares its state 15 times a second.
   ========================================================= */
const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const PEER_PREFIX = 'nithandash-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const NET = {
  role: null, isHost: false, peer: null, conns: new Map(), host: null, code: '', myId: '',
  offset: 0, bestRtt: 1e9, lobby: null, nextGuest: 1, lastSend: 0, pingTimer: null, onStatus: null,
  now() { return performance.now() + this.offset; },
};

function loadPeer() {
  return new Promise((res, rej) => {
    if (window.Peer) return res();
    const s = document.createElement('script');
    s.src = PEER_SRC; s.onload = () => (window.Peer ? res() : rej()); s.onerror = rej;
    document.head.appendChild(s);
  });
}
const peerOpts = () => Object.assign({ debug: 0 }, window.PEER_OPTS || {});
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');

/* ---------- hosting ---------- */
async function hostRoom(me, onReady, onFail) {
  netReset();
  try { await loadPeer(); } catch (e) { onFail(t('net_fail')); return; }
  const attempt = (tries) => {
    const code = newCode();
    let peer;
    try { peer = new Peer(PEER_PREFIX + code.toLowerCase(), peerOpts()); } catch (e) { onFail(t('net_fail')); return; }
    peer.on('open', () => {
      Object.assign(NET, { role: 'host', isHost: true, peer, code, myId: 'h', offset: 0 });
      NET.lobby = { code, level: 0, fill: true, skill: 1, inRace: false, players: [{ id: 'h', name: me.name, look: me.look, host: true }] };
      onReady(code);
    });
    peer.on('connection', conn => hostAccept(conn));
    peer.on('error', err => {
      if (err && err.type === 'unavailable-id' && tries < 4) { peer.destroy(); attempt(tries + 1); }
      else if (!NET.role) onFail(t('net_fail'));
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
  };
  attempt(0);
}

function hostAccept(conn) {
  conn.on('data', msg => hostData(conn, msg));
  conn.on('close', () => hostDrop(conn));
  conn.on('error', () => hostDrop(conn));
}

function hostData(conn, m) {
  if (!m || typeof m !== 'object') return;
  switch (m.type) {
    case 'hello': {
      const humans = NET.lobby.players.length;
      if (NET.lobby.inRace) { conn.send({ type: 'deny', why: 'race' }); return; }
      if (humans >= MAX_HUMANS) { conn.send({ type: 'deny', why: 'full' }); return; }
      const id = 'g' + NET.nextGuest++;
      conn.netId = id;
      NET.conns.set(id, conn);
      NET.lobby.players.push({ id, name: String(m.name || 'Runner').slice(0, 14), look: sanitizeLook(m.look) });
      conn.send({ type: 'welcome', id, code: NET.code });
      broadcastLobby();
      break;
    }
    case 'ping': conn.send({ type: 'pong', c: m.c, h: performance.now() }); break;
    case 'look': {
      const p = NET.lobby.players.find(p => p.id === conn.netId);
      if (p) { p.name = String(m.name || p.name).slice(0, 14); p.look = sanitizeLook(m.look); broadcastLobby(); }
      break;
    }
    case 'st': if (conn.netId && m.s && m.s.id === conn.netId) applyState(m.s); break;
    case 'ev': if (m.ev) { applyEffect(m.ev); relay(m, conn.netId); } break;
  }
}

function hostDrop(conn) {
  const id = conn.netId;
  if (!id || !NET.conns.has(id)) return;
  NET.conns.delete(id);
  NET.lobby.players = NET.lobby.players.filter(p => p.id !== id);
  broadcast({ type: 'left', id });
  if (RACE.on) RACE.runners = RACE.runners.filter(r => r.id !== id);
  broadcastLobby();
}

function sanitizeLook(l) {
  const base = makeLook(0);
  if (!l || typeof l !== 'object') return base;
  const ok = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  return {
    r: Number(l.r) || 0,
    skin: ok(l.skin) ? l.skin : base.skin, hair: ok(l.hair) ? l.hair : base.hair, shirt: ok(l.shirt) ? l.shirt : base.shirt,
    pants: ok(l.pants) ? l.pants : base.pants,
    hairStyle: ['short', 'spiky', 'pony', 'bob', 'long', 'cap'].includes(l.hairStyle) ? l.hairStyle : 'short',
    acc: ['none', 'band', 'flower', 'sash'].includes(l.acc) ? l.acc : 'none',
  };
}

function broadcast(m) { for (const c of NET.conns.values()) { try { c.send(m); } catch (e) { /* closed */ } } }
function relay(m, exceptId) { for (const [id, c] of NET.conns) if (id !== exceptId) { try { c.send(m); } catch (e) { /* closed */ } } }
function broadcastLobby() { broadcast({ type: 'lobby', lobby: NET.lobby }); if (typeof onLobby === 'function') onLobby(NET.lobby); }

function hostSetOption(k, v) { NET.lobby[k] = v; broadcastLobby(); }

/* host builds the runner list and a start time a few seconds ahead */
function hostStart() {
  const L = NET.lobby;
  const entries = L.players.map(p => ({ id: p.id, name: p.name, look: p.look, bot: false }));
  if (L.fill) {
    const used = new Set(L.players.map(p => p.look.r));
    let b = 1;
    for (let i = 0; entries.length < MAX_RUNNERS && i < 12; i++) {
      const ri = i % RUNNERS.length;
      if (used.has(ri) && i < RUNNERS.length) continue;
      entries.push({ id: 'b' + b++, name: L10(RUNNERS[ri].name), look: makeLook(ri), bot: true, skill: L.skill });
    }
  }
  const startAt = performance.now() + 4000;
  L.inRace = true;
  broadcast({ type: 'start', level: L.level, startAt, entries });
  broadcastLobby();
  beginNetRace(L.level, entries, startAt);
}

function hostBackToLobby() {
  NET.lobby.inRace = false;
  broadcast({ type: 'tolobby' });
  broadcastLobby();
}

/* ---------- joining ---------- */
async function joinRoom(code, me, onJoined, onFail) {
  netReset();
  code = String(code || '').trim().toUpperCase();
  if (code.length !== 5) { onFail(t('no_room')); return; }
  try { await loadPeer(); } catch (e) { onFail(t('net_fail')); return; }
  let peer;
  try { peer = new Peer(peerOpts()); } catch (e) { onFail(t('net_fail')); return; }
  let done = false;
  const fail = msg => { if (done) return; done = true; try { peer.destroy(); } catch (e) { /* ignore */ } onFail(msg); };
  const timer = setTimeout(() => fail(t('no_room')), 15000);
  peer.on('error', err => fail(err && err.type === 'peer-unavailable' ? t('no_room') : t('net_fail')));
  peer.on('open', () => {
    const conn = peer.connect(PEER_PREFIX + code.toLowerCase(), { reliable: true });
    conn.on('open', () => { conn.send({ type: 'hello', name: me.name, look: me.look }); });
    conn.on('data', m => {
      if (m && m.type === 'welcome') {
        clearTimeout(timer); done = true;
        Object.assign(NET, { role: 'guest', isHost: false, peer, host: conn, code, myId: m.id });
        startPings();
        onJoined();
      } else if (m && m.type === 'deny') { clearTimeout(timer); fail(m.why === 'full' ? t('room_full') : t('in_race')); }
      else guestData(m);
    });
    conn.on('close', () => { if (NET.role === 'guest') { netReset(); if (typeof onHostLeft === 'function') onHostLeft(); } });
  });
}

function startPings() {
  let n = 0;
  const ping = () => { if (NET.host) { try { NET.host.send({ type: 'ping', c: performance.now() }); } catch (e) { /* closed */ } } };
  ping();
  NET.pingTimer = setInterval(() => { ping(); n++; }, 700);
}

function guestData(m) {
  if (!m || typeof m !== 'object') return;
  switch (m.type) {
    case 'pong': {
      const now = performance.now(), rtt = now - m.c;
      if (rtt < NET.bestRtt * 1.2 || rtt < 60) {
        NET.bestRtt = Math.min(NET.bestRtt, rtt);
        NET.offset = m.h - (m.c + now) / 2;
      }
      break;
    }
    case 'lobby': NET.lobby = m.lobby; if (typeof onLobby === 'function') onLobby(m.lobby); break;
    case 'start': beginNetRace(m.level, m.entries, m.startAt); break;
    case 'st': for (const s of m.list) if (s.id !== NET.myId) applyState(s); break;
    case 'ev': applyEffect(m.ev); break;
    case 'results': receiveResults(m.list); break;
    case 'tolobby': if (typeof onToLobby === 'function') onToLobby(); break;
    case 'left': if (RACE.on) RACE.runners = RACE.runners.filter(r => r.id !== m.id); break;
    case 'bye': netReset(); if (typeof onHostLeft === 'function') onHostLeft(); break;
  }
}

function beginNetRace(level, entries, startAt) {
  const list = entries.map(e => Object.assign({}, e, { local: e.id === NET.myId }));
  startRace(level, list, 'online', startAt);
  if (typeof onNetRaceStart === 'function') onNetRaceStart();
}

/* ---------- in-race traffic ---------- */
function packState(r) {
  return {
    id: r.id, x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, vx: Math.round(r.vx), vy: Math.round(r.vy),
    a: r.anim, f: r.face, h: r.h, it: r.item, sp: r.spin > 0 ? 1 : 0,
    fl: (r.shieldT > 0 ? 1 : 0) | (r.boostT > 0 ? 2 : 0) | (r.wingT > 0 ? 4 : 0) | (r.slowT > 0 ? 8 : 0) | (r.frozenT > 0 ? 16 : 0) | (r.dead ? 32 : 0) | (r.invT > 0 ? 64 : 0),
    fin: r.fin ? 1 : 0, ft: r.finT, cp: r.cp,
  };
}

function applyState(s) {
  const r = runnerById(s.id);
  if (!r || !r.remote) return;
  r.net = { x: s.x, y: s.y, vx: s.vx, vy: s.vy, at: performance.now() };
  r.anim = s.a; r.face = s.f; r.h = s.h; r.item = s.it; r.spin = s.sp ? 0.2 : 0;
  r.shieldT = s.fl & 1 ? 1 : 0; r.boostT = s.fl & 2 ? 1 : 0; r.wingT = s.fl & 4 ? 1 : 0; r.slowT = s.fl & 8 ? 1 : 0;
  r.frozenT = s.fl & 16 ? 1 : 0; r.dead = !!(s.fl & 32); r.invT = s.fl & 64 ? 1 : 0;
  r.fin = !!s.fin; r.finT = s.ft; r.cp = s.cp;
  r.prog = r.fin ? 1e7 - r.finT * 1000 : s.x;
}

function netTick() {
  if (!NET.role || !RACE.on || RACE.mode !== 'online') return;
  const now = performance.now();
  if (now - NET.lastSend < 66) return;
  NET.lastSend = now;
  if (NET.isHost) {
    const list = RACE.runners.filter(r => !r.remote || r.net).map(r => r.remote ? Object.assign(packState(r), { x: r.net.x, y: r.net.y }) : packState(r));
    broadcast({ type: 'st', list });
  } else if (NET.host && RACE.me) {
    try { NET.host.send({ type: 'st', s: packState(RACE.me) }); } catch (e) { /* closed */ }
  }
}

NET.sendEvent = ev => {
  if (NET.isHost) broadcast({ type: 'ev', ev });
  else if (NET.host) { try { NET.host.send({ type: 'ev', ev }); } catch (e) { /* closed */ } }
};
NET.sendResults = list => { if (NET.isHost) broadcast({ type: 'results', list }); };
NET.sendLook = me => { if (NET.host) { try { NET.host.send({ type: 'look', name: me.name, look: me.look }); } catch (e) { /* closed */ } } };

function netReset() {
  if (NET.pingTimer) clearInterval(NET.pingTimer);
  if (NET.isHost) broadcast({ type: 'bye' });
  try { if (NET.peer) NET.peer.destroy(); } catch (e) { /* ignore */ }
  Object.assign(NET, { role: null, isHost: false, peer: null, conns: new Map(), host: null, code: '', myId: '', offset: 0, bestRtt: 1e9, lobby: null, nextGuest: 1, pingTimer: null });
}
