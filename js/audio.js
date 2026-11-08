'use strict';
/* =========================================================
   Sound effects and music, synthesised with the Web Audio API
   ========================================================= */
const AUD = { sfx: true, music: true };
try { Object.assign(AUD, JSON.parse(localStorage.getItem('nithan-audio') || '{}')); } catch (e) { /* defaults */ }
function saveAudio() { try { localStorage.setItem('nithan-audio', JSON.stringify(AUD)); } catch (e) { /* storage blocked */ } }

let AC = null, master = null, musicGain = null, noiseBuf = null;
function ensureAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination);
      musicGain = AC.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
      const len = Math.floor(AC.sampleRate * 0.5);
      noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { AC = null; }
}
function tone(f, dur, type, vol, slide, delay, dest) {
  if (!AC) return;
  const tt = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, tt);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), tt + dur);
  g.gain.setValueAtTime(vol || 0.04, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
  o.connect(g).connect(dest || master); o.start(tt); o.stop(tt + dur + 0.02);
}
function noise(dur, freq, vol, delay, dest, type) {
  if (!AC || !noiseBuf) return;
  const tt = AC.currentTime + (delay || 0);
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
  s.connect(f).connect(g).connect(dest || master); s.start(tt); s.stop(tt + dur);
}
const SFX = {
  jump: () => tone(420, 0.12, 'square', 0.035, 260),
  djump: () => { tone(560, 0.1, 'square', 0.03, 300); tone(840, 0.08, 'triangle', 0.03, 200, 0.05); },
  land: () => noise(0.06, 500, 0.08),
  step: () => noise(0.03, 900, 0.025),
  slide: () => noise(0.25, 1400, 0.05, 0, null, 'highpass'),
  spring: () => tone(220, 0.3, 'square', 0.04, 600),
  boost: () => { noise(0.35, 2000, 0.06, 0, null, 'highpass'); tone(300, 0.3, 'sawtooth', 0.02, 500); },
  box: () => [660, 880, 1100].forEach((f, i) => tone(f, 0.07, 'square', 0.03, 0, i * 0.05)),
  hit: () => { noise(0.1, 400, 0.18); tone(200, 0.2, 'square', 0.04, -120); },
  slip: () => { tone(700, 0.3, 'triangle', 0.05, -500); },
  splash: () => noise(0.4, 1500, 0.12),
  fall: () => tone(500, 0.45, 'triangle', 0.05, -380),
  respawn: () => tone(520, 0.12, 'triangle', 0.04, 200),
  checkpoint: () => { tone(784, 0.1, 'triangle', 0.05); tone(1046, 0.16, 'triangle', 0.05, 0, 0.09); },
  block: () => { tone(1200, 0.08, 'square', 0.03); tone(900, 0.1, 'square', 0.03, 0, 0.06); },
  frozen: () => { tone(1600, 0.3, 'sine', 0.04, -800); noise(0.2, 3000, 0.05); },
  rained: () => noise(0.5, 2600, 0.06),
  use: () => tone(880, 0.08, 'square', 0.03, 220),
  count: () => tone(523, 0.14, 'square', 0.04),
  go: () => { tone(1046, 0.25, 'square', 0.045); tone(784, 0.25, 'triangle', 0.04); },
  finish: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, 'triangle', 0.06, 0, i * 0.09)),
  click: () => tone(600, 0.04, 'square', 0.02),
};
function sfx(n, vol) {
  if (!AUD.sfx || !AC) return;
  try { if (vol !== undefined && vol < 0.15) return; SFX[n] && SFX[n](); } catch (e) { /* ignore */ }
}

/* Thai pentatonic chiptune: a melody, a ching-chap rhythm and a drone bass, seeded per level */
const MUS = { key: '', step: 0, next: 0, mel: null, bass: null };
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
function genTune(seed) {
  const r = rng(seed * 7 + 3), mel = [], bass = [];
  let deg = 4;
  for (let i = 0; i < 64; i++) {
    if (r() < 0.28 && i % 4 !== 0) { mel.push(null); continue; }
    deg = clamp(deg + Math.round((r() - 0.5) * 4), 0, PENTA.length - 1);
    mel.push(deg);
  }
  for (let i = 0; i < 8; i++) bass.push([0, 0, 3, 4, 0, 3, 4, 0][i]);
  return { mel, bass };
}
function musicTick(themeId, racing) {
  if (!AC || !AUD.music || document.hidden) return;
  const th = THEMES[themeId] || THEMES.sangthong;
  const key = themeId + (racing ? 'r' : 'm');
  if (MUS.key !== key) { MUS.key = key; const tn = genTune(th.music.seed); MUS.mel = tn.mel; MUS.bass = tn.bass; MUS.step = 0; MUS.next = AC.currentTime + 0.1; }
  const bpm = racing ? th.music.bpm : 96, dt = 60 / bpm / 2, base = th.music.base;
  while (MUS.next < AC.currentTime + 0.25) {
    const i = MUS.step % 64, tt = MUS.next - AC.currentTime, deg = MUS.mel[i];
    if (deg != null) {
      const f = base * Math.pow(2, PENTA[deg] / 12);
      tone(f, 0.18, 'square', racing ? 0.016 : 0.012, 0, tt, musicGain);
      tone(f * 2, 0.08, 'triangle', 0.008, 0, tt, musicGain);
    }
    if (i % 4 === 0) tone(base / 2 * Math.pow(2, PENTA[MUS.bass[(i >> 3) & 7]] / 12), 0.3, 'triangle', 0.04, 0, tt, musicGain);
    if (racing) {
      if (i % 2 === 1) noise(0.03, 7000, 0.025, tt, musicGain, 'highpass');
      if (i % 4 === 2) noise(0.08, 4500, 0.035, tt, musicGain, 'bandpass');
      if (i % 8 === 0) noise(0.1, 120, 0.12, tt, musicGain, 'lowpass');
    }
    MUS.step++; MUS.next += dt;
  }
}
