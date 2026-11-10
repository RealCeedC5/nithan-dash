'use strict';
/* =========================================================
   Sound effects and music, synthesised with the Web Audio API.
   The music is a small Thai ensemble: ranat (xylophone), khim
   (dulcimer), khlui (flute), a bass, ching cymbals and drums.
   ========================================================= */
const AUD = { sfx: 0.8, music: 0.6 };
try {
  const saved = JSON.parse(localStorage.getItem('nithan-audio') || '{}');
  for (const k of ['sfx', 'music']) if (k in saved) AUD[k] = typeof saved[k] === 'boolean' ? (saved[k] ? AUD[k] : 0) : clamp(+saved[k] || 0, 0, 1);
} catch (e) { /* defaults */ }
function saveAudio() { try { localStorage.setItem('nithan-audio', JSON.stringify(AUD)); } catch (e) { /* storage blocked */ } }

let AC = null, master = null, sfxGain = null, musicGain = null, noiseBuf = null;
function ensureAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(AC.destination);
      master = AC.createGain(); master.gain.value = 0.9; master.connect(comp);
      sfxGain = AC.createGain(); sfxGain.connect(master);
      musicGain = AC.createGain(); musicGain.connect(master);
      const len = Math.floor(AC.sampleRate * 0.6);
      noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      applyVolume();
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { AC = null; }
}
function applyVolume() { if (!AC) return; sfxGain.gain.value = AUD.sfx; musicGain.gain.value = AUD.music * 0.85; }

function tone(f, dur, type, vol, slide, delay, dest) {
  if (!AC) return;
  const tt = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, tt);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), tt + dur);
  g.gain.setValueAtTime(vol || 0.04, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
  o.connect(g).connect(dest || sfxGain); o.start(tt); o.stop(tt + dur + 0.02);
}
function noise(dur, freq, vol, delay, dest, type, q) {
  if (!AC || !noiseBuf) return;
  const tt = AC.currentTime + (delay || 0);
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = AC.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; if (q) f.Q.value = q;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
  s.connect(f).connect(g).connect(dest || sfxGain); s.start(tt, Math.random() * 0.3); s.stop(tt + dur);
}

/* ---------- sound effects: (k) is loudness from 0 to 1 ---------- */
const SFX = {
  jump: k => { tone(330, 0.13, 'square', 0.03 * k, 300); tone(660, 0.06, 'triangle', 0.02 * k, 200); },
  djump: k => { tone(520, 0.1, 'square', 0.028 * k, 340); tone(880, 0.1, 'triangle', 0.03 * k, 260, 0.05); noise(0.12, 3000, 0.02 * k, 0, null, 'highpass'); },
  land: k => { noise(0.07, 420, 0.1 * k, 0, null, 'lowpass'); tone(120, 0.06, 'sine', 0.05 * k, -40); },
  step: k => noise(0.03, 1100, 0.022 * k),
  slide: k => noise(0.28, 1700, 0.05 * k, 0, null, 'highpass'),
  spring: k => { tone(180, 0.32, 'square', 0.035 * k, 700); tone(360, 0.2, 'triangle', 0.03 * k, 500, 0.02); },
  boost: k => { noise(0.4, 1800, 0.07 * k, 0, null, 'highpass'); tone(260, 0.35, 'sawtooth', 0.02 * k, 620); },
  box: k => [660, 880, 990, 1320].forEach((f, i) => tone(f, 0.07, 'square', 0.026 * k, 0, i * 0.045)),
  tick: k => tone(1500, 0.025, 'square', 0.014 * k),
  hit: k => { noise(0.12, 360, 0.2 * k, 0, null, 'lowpass'); tone(190, 0.22, 'square', 0.045 * k, -130); noise(0.05, 2600, 0.06 * k); },
  slip: k => { tone(760, 0.32, 'triangle', 0.05 * k, -560); noise(0.1, 900, 0.05 * k, 0.2); },
  splash: k => { noise(0.45, 1300, 0.13 * k); noise(0.25, 4200, 0.05 * k, 0.04, null, 'highpass'); },
  fall: k => tone(520, 0.5, 'triangle', 0.05 * k, -400),
  respawn: k => { tone(392, 0.1, 'triangle', 0.04 * k); tone(587, 0.14, 'triangle', 0.04 * k, 0, 0.07); },
  checkpoint: k => { tone(784, 0.1, 'triangle', 0.05 * k); tone(988, 0.1, 'triangle', 0.05 * k, 0, 0.08); tone(1175, 0.2, 'triangle', 0.05 * k, 0, 0.16); },
  block: k => { tone(1320, 0.09, 'square', 0.03 * k); tone(990, 0.14, 'triangle', 0.04 * k, 0, 0.05); noise(0.08, 5200, 0.04 * k, 0, null, 'highpass'); },
  frozen: k => { tone(1700, 0.34, 'sine', 0.04 * k, -900); noise(0.22, 3400, 0.05 * k, 0, null, 'highpass'); tone(2400, 0.08, 'triangle', 0.02 * k, 0, 0.12); },
  rained: k => { noise(0.6, 2400, 0.06 * k); noise(0.5, 90, 0.16 * k, 0.05, null, 'lowpass'); },
  use: k => tone(880, 0.08, 'square', 0.03 * k, 220),
  use_boost: k => SFX.boost(k),
  use_shield: k => [1175, 1568, 2093].forEach((f, i) => tone(f, 0.22, 'sine', 0.035 * k, 0, i * 0.05)),
  use_freeze: k => { tone(900, 0.2, 'sawtooth', 0.025 * k, 900); tone(1800, 0.18, 'sine', 0.03 * k, -600, 0.1); },
  use_trap: k => { tone(420, 0.08, 'triangle', 0.05 * k, -200); noise(0.06, 700, 0.06 * k, 0.05); },
  use_cloud: k => { noise(0.7, 110, 0.22 * k, 0, null, 'lowpass'); noise(0.3, 2000, 0.04 * k, 0.1); },
  use_wing: k => { for (let i = 0; i < 3; i++) noise(0.1, 900 + i * 300, 0.06 * k, i * 0.11, null, 'bandpass', 2); tone(520, 0.3, 'triangle', 0.03 * k, 400); },
  slam: k => { noise(0.22, 140, 0.34 * k, 0, null, 'lowpass'); tone(70, 0.2, 'sine', 0.12 * k, -30); noise(0.06, 2200, 0.05 * k); },
  rumble: k => noise(0.5, 180, 0.12 * k, 0, null, 'lowpass'),
  snap: k => { noise(0.05, 1800, 0.12 * k); tone(300, 0.08, 'square', 0.03 * k, -150, 0.03); },
  whoosh: k => noise(0.22, 900, 0.05 * k, 0, null, 'bandpass', 0.8),
  pass: k => { tone(784, 0.07, 'square', 0.028 * k); tone(1175, 0.12, 'square', 0.028 * k, 0, 0.06); },
  passed: k => { tone(440, 0.08, 'square', 0.025 * k); tone(330, 0.14, 'square', 0.025 * k, 0, 0.07); },
  perfect: k => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.09, 'square', 0.03 * k, 0, i * 0.04)); noise(0.4, 2400, 0.06 * k, 0, null, 'highpass'); },
  count: k => { tone(523, 0.16, 'square', 0.045 * k); noise(0.04, 6000, 0.03 * k, 0, null, 'highpass'); },
  go: k => { tone(1046, 0.3, 'square', 0.05 * k); tone(784, 0.3, 'triangle', 0.045 * k); tone(1568, 0.25, 'triangle', 0.03 * k, 0, 0.02); noise(0.3, 5000, 0.04 * k, 0, null, 'highpass'); },
  finish: k => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06 * k, 0, i * 0.085)); SFX.cheer(k); },
  cheer: k => { for (let i = 0; i < 4; i++) noise(0.7, 1200 + i * 500, 0.05 * k, i * 0.12, null, 'bandpass', 0.6); },
  medal: k => { [659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, 'triangle', 0.05 * k, 0, i * 0.11)); tone(1568, 0.5, 'sine', 0.04 * k, 0, 0.44); },
  lose: k => [392, 349, 294].forEach((f, i) => tone(f, 0.22, 'triangle', 0.045 * k, 0, i * 0.16)),
  click: k => tone(620, 0.04, 'square', 0.02 * k),
};
function sfx(n, vol = 1) {
  if (AUD.sfx <= 0 || !AC || vol < 0.06) return;
  try { SFX[n] && SFX[n](Math.min(1, vol)); } catch (e) { /* ignore */ }
}

/* ---------- instruments (scheduled at an absolute audio time) ---------- */
function voice(when, dur, vol, build) {
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, when);
  build(g, when);
  g.connect(musicGain);
  return g;
}
const INST = {
  ranat(f, when, vol) { // wooden bars: bright, quick
    const g = voice(when, 0.3, vol, () => {});
    g.gain.exponentialRampToValueAtTime(vol, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.32);
    for (const [m, v, type] of [[1, 1, 'triangle'], [4, 0.28, 'sine'], [2, 0.2, 'sine']]) { const o = AC.createOscillator(), og = AC.createGain(); o.type = type; o.frequency.value = f * m; og.gain.value = v; o.connect(og).connect(g); o.start(when); o.stop(when + 0.36); }
    noise(0.012, 3200, vol * 0.5, when - AC.currentTime, musicGain, 'bandpass', 1.5);
  },
  khim(f, when, vol) { // struck strings: two detuned voices that ring
    const g = voice(when, 0.7, vol, () => {});
    g.gain.exponentialRampToValueAtTime(vol * 0.8, when + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.7);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 7, when); lp.frequency.exponentialRampToValueAtTime(f * 2, when + 0.5); lp.connect(g);
    for (const det of [-5, 6]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(when); o.stop(when + 0.74); }
  },
  khlui(f, when, vol, dur = 0.4) { // bamboo flute: soft attack, a little vibrato and breath
    const g = voice(when, dur, vol, () => {});
    g.gain.linearRampToValueAtTime(vol, when + 0.05); g.gain.setValueAtTime(vol, when + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, when + dur);
    const o = AC.createOscillator(), lfo = AC.createOscillator(), lg = AC.createGain();
    o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 5.5; lg.gain.value = f * 0.008; lfo.connect(lg).connect(o.frequency);
    const o2 = AC.createOscillator(), g2 = AC.createGain(); o2.type = 'triangle'; o2.frequency.value = f * 2; g2.gain.value = 0.12; o2.connect(g2).connect(g);
    o.connect(g); for (const n of [o, lfo, o2]) { n.start(when); n.stop(when + dur + 0.03); }
    noise(dur * 0.6, f * 2, vol * 0.18, when - AC.currentTime, musicGain, 'bandpass', 3);
  },
  bass(f, when, vol) {
    const g = voice(when, 0.3, vol, () => {});
    g.gain.exponentialRampToValueAtTime(vol, when + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
    const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(g); o.start(when); o.stop(when + 0.36);
  },
  ching(when, vol) { noise(0.22, 7600, vol, when - AC.currentTime, musicGain, 'highpass'); tone(3100, 0.2, 'sine', vol * 0.25, 0, when - AC.currentTime, musicGain); },
  chap(when, vol) { noise(0.045, 6200, vol, when - AC.currentTime, musicGain, 'highpass'); },
  thon(when, vol, hi) { // goblet drum: low "thon" and higher "pa"
    const g = voice(when, 0.2, vol, () => {});
    g.gain.exponentialRampToValueAtTime(vol, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, when + (hi ? 0.1 : 0.22));
    const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(hi ? 330 : 150, when); o.frequency.exponentialRampToValueAtTime(hi ? 220 : 82, when + 0.12); o.connect(g); o.start(when); o.stop(when + 0.26);
    if (hi) noise(0.03, 1800, vol * 0.5, when - AC.currentTime, musicGain);
  },
};

/* ---------- tunes: a seeded melody in a pentatonic mode, AABA ---------- */
const MODES = { bright: [0, 2, 4, 7, 9], gentle: [0, 2, 5, 7, 9], deep: [0, 3, 5, 7, 10], airy: [0, 2, 4, 7, 9] };
const TUNE_STYLE = {
  sangthong:  { mode: 'bright', lead: 'ranat', second: 'khim' },
  plabuthong: { mode: 'gentle', lead: 'khim', second: 'khlui' },
  kraithong:  { mode: 'deep', lead: 'khlui', second: 'khim' },
  kaewnama:   { mode: 'airy', lead: 'ranat', second: 'khlui' },
};
function genTune(seed) {
  const r = rng(seed * 7 + 3);
  const phrase = (start) => { // sixteen eighth-notes that rise and fall around a centre
    const out = []; let deg = start;
    for (let i = 0; i < 16; i++) {
      if (i % 4 !== 0 && r() < 0.24) { out.push(null); continue; }
      const stepv = r() < 0.7 ? (r() < 0.5 ? 1 : -1) : (r() < 0.5 ? 2 : -2);
      deg = clamp(deg + stepv, 0, 9); if (i === 15) deg = start > 4 ? 5 : 0;
      out.push(deg);
    }
    return out;
  };
  const A = phrase(4), A2 = A.slice(); for (let i = 12; i < 16; i++) A2[i] = [7, 5, 4, 5][i - 12];
  const B = phrase(7), bars = [A, A2, B, A];
  return { mel: bars.flat(), bass: [0, 0, 3, 4, 0, 3, 4, 0] };
}
const MUS = { key: '', step: 0, next: 0, tune: null };
function musicTick(themeId, racing, rush) {
  if (!AC || AUD.music <= 0 || document.hidden) return;
  const th = THEMES[themeId] || THEMES.sangthong, st = TUNE_STYLE[themeId] || TUNE_STYLE.sangthong, mode = MODES[st.mode];
  const key = themeId + (racing ? 'r' : 'm');
  if (MUS.key !== key) { MUS.key = key; MUS.tune = genTune(th.music.seed); MUS.step = 0; MUS.next = AC.currentTime + 0.12; }
  const bpm = (racing ? th.music.bpm : 92) * (rush ? 1.1 : 1), dt = 60 / bpm / 2, base = th.music.base;
  const note = deg => base * Math.pow(2, (mode[deg % 5] + 12 * Math.floor(deg / 5)) / 12);
  while (MUS.next < AC.currentTime + 0.3) {
    const i = MUS.step % 64, when = MUS.next, deg = MUS.tune.mel[i], bar = i >> 4;
    if (deg != null) {
      const f = note(deg);
      if (!racing) INST.khim(f, when, 0.05);
      else {
        INST[st.lead](f, when, st.lead === 'khlui' ? 0.085 : 0.075, dt * 1.9);
        if (bar === 2 || (bar === 3 && i % 2 === 0)) INST[st.second](f * (st.second === 'khlui' ? 2 : 0.5), when, 0.035, dt * 1.9);   // the second voice doubles the bridge
      }
    }
    if (i % 4 === 0) INST.bass(base / 2 * Math.pow(2, mode[MUS.tune.bass[(i >> 2) & 7] % 5] / 12), when, racing ? 0.11 : 0.06);
    if (racing) {
      if (i % 4 === 0) INST.ching(when, 0.03); else if (i % 4 === 2) INST.chap(when, 0.035);
      const d = i % 8;
      if (d === 0 || d === 3) INST.thon(when, 0.13, false); else if (d === 2 || d === 6 || (rush && d === 7)) INST.thon(when, 0.07, true);
    } else if (i % 8 === 0) INST.ching(when, 0.018);
    MUS.step++; MUS.next += dt;
  }
}
