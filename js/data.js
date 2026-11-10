'use strict';
/* =========================================================
   Game data: sizes, runners, items, themes and level layouts
   ========================================================= */
const TILE = 16;
const ROWS = 18;            // level height in tiles
const VH = 240;             // internal view height in pixels (width follows the screen)
const MAX_RUNNERS = 6;
const MAX_HUMANS = 4;

/* ---------- runners (original characters) ---------- */
const SKINS = ['#f2c9a0', '#e0a878', '#c98a5a', '#9c6440'];
const SHIRTS = ['#3f7fd8', '#e0503f', '#f0b62e', '#3fae6a', '#a35fd0', '#f07fae', '#2fb5b5', '#f4f1ea'];
const HAIRS = ['#1d1410', '#4a2c1a', '#8a5a2b', '#d9b45a', '#c0392b', '#6a6a7a'];
const RUNNERS = [
  { id: 'namsai',  name: { th: 'น้ำใส', en: 'Namsai' },  skin: 0, hairStyle: 'pony',  hair: 0, shirt: 0, pants: '#2b3a67', acc: 'none' },
  { id: 'khaotu',  name: { th: 'ข้าวตู', en: 'Khaotu' }, skin: 1, hairStyle: 'spiky', hair: 0, shirt: 1, pants: '#3a3a3a', acc: 'band' },
  { id: 'maprang', name: { th: 'มะปราง', en: 'Maprang' }, skin: 0, hairStyle: 'bob',   hair: 1, shirt: 5, pants: '#5b2a4a', acc: 'flower' },
  { id: 'phupha',  name: { th: 'ภูผา', en: 'Phupha' },   skin: 2, hairStyle: 'short', hair: 0, shirt: 3, pants: '#4a3a22', acc: 'sash' },
  { id: 'khing',   name: { th: 'ขิง', en: 'Khing' },     skin: 1, hairStyle: 'cap',   hair: 2, shirt: 2, pants: '#2b4a67', acc: 'none' },
  { id: 'mek',     name: { th: 'เมฆ', en: 'Mek' },       skin: 3, hairStyle: 'long',  hair: 0, shirt: 4, pants: '#222a3a', acc: 'none' },
];
/* a look is a runner preset plus the colours the player picked */
function makeLook(runnerIdx, shirtIdx, hairIdx) {
  const r = RUNNERS[runnerIdx % RUNNERS.length];
  return {
    r: runnerIdx % RUNNERS.length,
    skin: SKINS[r.skin], hairStyle: r.hairStyle, acc: r.acc, pants: r.pants,
    shirt: SHIRTS[(shirtIdx ?? r.shirt) % SHIRTS.length],
    hair: HAIRS[(hairIdx ?? r.hair) % HAIRS.length],
  };
}

/* ---------- items ---------- */
const ITEMS = {
  boost:  { name: { th: 'ลมกรด', en: 'Whirlwind' },      desc: { th: 'พุ่งเร็วขึ้นชั่วครู่', en: 'A burst of speed' },                 col: '#7fd4ff' },
  shield: { name: { th: 'ผ้ายันต์', en: 'Yantra Cloth' }, desc: { th: 'กันการโดนชนได้ 1 ครั้ง', en: 'Blocks one hit' },              col: '#ffd34d' },
  freeze: { name: { th: 'ลูกแก้วสะกด', en: 'Spell Orb' }, desc: { th: 'สะกดคนที่อยู่ข้างหน้าให้หยุด', en: 'Freezes the runner ahead' },  col: '#b58cff' },
  trap:   { name: { th: 'เปลือกกล้วย', en: 'Banana Peel' }, desc: { th: 'วางไว้ข้างหลังให้คนตามมาลื่น', en: 'Drop it for chasers to slip on' }, col: '#f5d33b' },
  cloud:  { name: { th: 'เมฆฝน', en: 'Rain Cloud' },     desc: { th: 'ทำให้ทุกคนข้างหน้าช้าลง', en: 'Slows everyone ahead' },        col: '#8aa0b8' },
  wing:   { name: { th: 'ปีกครุฑ', en: 'Garuda Wings' },  desc: { th: 'บินได้สักพัก ไม่ตกเหว', en: 'Fly for a moment, safe from pits' }, col: '#ff9a3c' },
};
const ITEM_KEYS = Object.keys(ITEMS);
/* chances by race position: leaders get defensive items, the back of the pack gets catch-up items */
const ITEM_ODDS = {
  front:  { trap: 35, shield: 35, boost: 20, freeze: 10 },
  middle: { boost: 25, freeze: 25, trap: 15, shield: 15, wing: 10, cloud: 10 },
  back:   { boost: 30, wing: 25, cloud: 20, freeze: 20, shield: 5 },
};

/* ---------- medal times in seconds: gold, silver, bronze ---------- */
const PAR = { sangthong: [51, 57, 68], plabuthong: [54, 61, 74], kraithong: [48, 54, 66], kaewnama: [42, 47, 58] };
function medalFor(levelId, time) { const p = PAR[levelId]; if (!p || time == null) return 0; return time <= p[0] ? 3 : time <= p[1] ? 2 : time <= p[2] ? 1 : 0; }

/* ---------- themes: one per folk tale ---------- */
const THEMES = {
  sangthong: {
    name: { th: 'สังข์ทอง · บ่อทองคำ', en: 'Sang Thong · The Golden Pond' },
    story: { th: 'เจ้าเงาะถอดรูปกลายเป็นสังข์ทอง วิ่งให้ทันก่อนยักษ์จะตามมาถึงบ่อทอง!',
             en: 'The prince sheds his conch-shell disguise. Race to the golden pond before the giants catch up!' },
    sky: ['#7cc6f0', '#c4ecff'], sun: '#fff3b0',
    far: '#7fb8a8', mid: '#4f9a5c', near: '#3c7a45',
    soil: '#8a5a32', soil2: '#6f4526', top: '#5fbf4a', top2: '#3f9a3a', plank: '#b07a3e', wall: '#3f8a3e', wall2: '#2f6a32',
    water: '#ffcf4a', water2: '#f0a92a', spike: '#c9c3b8',
    hazards: { L: 'club', R: 'conch', K: 'stone', G: 'fish' }, music: { base: 261.6, bpm: 132, seed: 3 },
  },
  plabuthong: {
    name: { th: 'ปลาบู่ทอง · ริมคลองหมู่บ้าน', en: 'The Golden Goby · Village Canal' },
    story: { th: 'เอื้อยตามหาปลาบู่ทองริมคลอง ระวังสากตำข้าวกับใบบัวที่จมได้!',
             en: 'Ueay searches the canal for the golden goby. Mind the rice pounders and the sinking lotus pads!' },
    sky: ['#f6b26b', '#ffe3b0'], sun: '#fff0c8',
    far: '#c9a27a', mid: '#8fae4a', near: '#6a8f3a',
    soil: '#7a5230', soil2: '#5e3e22', top: '#9ccf4a', top2: '#78a83a', plank: '#9a6a3a', wall: '#6f9a3a', wall2: '#557a2c',
    water: '#4aa7c9', water2: '#2f86a8', spike: '#b8aa90',
    hazards: { L: 'bell', R: 'coconut', K: 'pestle', G: 'fish' }, music: { base: 220, bpm: 120, seed: 7 },
  },
  kraithong: {
    name: { th: 'ไกรทอง · ถ้ำชาละวัน', en: 'Krai Thong · Chalawan\'s Cave' },
    story: { th: 'ไกรทองบุกถ้ำจระเข้ชาละวันใต้แม่น้ำ จระเข้จะโผล่ขึ้นมาจากน้ำ อย่าให้งับได้!',
             en: 'Krai Thong dives into the crocodile king\'s cave. Crocodiles leap from the water, so don\'t get bitten!' },
    sky: ['#1d2b45', '#3e5a7a'], sun: '#e8f0ff',
    far: '#2c3f5a', mid: '#23344a', near: '#1a2738',
    soil: '#4a4a5a', soil2: '#363646', top: '#5f7a8a', top2: '#46606e', plank: '#6a5a4a', wall: '#3a3a4c', wall2: '#2a2a3a',
    water: '#2f7f8f', water2: '#1f5f6f', spike: '#8fe0ff',
    hazards: { L: 'stalactite', R: 'boulder', K: 'stone', G: 'croc' }, music: { base: 196, bpm: 112, seed: 11 },
  },
  kaewnama: {
    name: { th: 'แก้วหน้าม้า · ว่าววิเศษ', en: 'Kaew Na Ma · The Magic Kite' },
    story: { th: 'แก้วหน้าม้าขี่ลมไปเก็บว่าวของพระปิ่นทอง ลมพัดขึ้นจะช่วยพาข้ามเหว!',
             en: 'Kaew Na Ma rides the wind to fetch the prince\'s kite. Updrafts will carry you over the gaps!' },
    sky: ['#ff8a6a', '#ffd6a0'], sun: '#fff6d8',
    far: '#e8a0a0', mid: '#f0c0b0', near: '#ffffff',
    soil: '#e8eef8', soil2: '#cfd8e8', top: '#ffffff', top2: '#dfe8f4', plank: '#c0392b', wall: '#d8e2f0', wall2: '#b8c6dc',
    water: '#9ad0ff', water2: '#6ab0f0', spike: '#5a5a7a',
    hazards: { L: 'chime', R: 'cloudball', K: 'stone', G: 'fish' }, music: { base: 293.7, bpm: 140, seed: 19 },
  },
};

/* ---------- level chunks ----------
   12 rows each, bottom-aligned to the 18-row level. Ground surface is chunk row 8.
   .  empty            #  ground          =  one-way platform    h  wall / branch (solid)
   ^  spikes           ~  water (kills)   m  mud (slows)          B  boost pad
   S  spring           ?  item box        C  checkpoint           F  finish line
   L  swinging hazard (pivot)   R  roller (rolls left)   K  crusher (2 wide)
   P  moving platform (sideways)   V  moving platform (up/down)   O  sinking pad
   G  leaping crocodile / fish     W  updraft column                                   */
const GROUND4 = w => ['#'.repeat(w), '#'.repeat(w), '#'.repeat(w), '#'.repeat(w)];
const SKY = w => '.'.repeat(w);
const CHUNKS = {
  start: [SKY(26), SKY(26), SKY(26), SKY(26), SKY(26), SKY(26), SKY(26), SKY(26), ...GROUND4(26)],
  flat: [SKY(16), SKY(16), SKY(16), SKY(16), SKY(16), SKY(16), SKY(16), SKY(16), ...GROUND4(16)],
  boxes: [
    '..................',
    '..................',
    '..................',
    '.............?....',
    '..................',
    '..................',
    '.......?..........',
    '..................',
    ...GROUND4(18)],
  gap3: [
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '######...#####',
    '######...#####',
    '######...#####',
    '######...#####'],
  gapplat: [
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '.......====.......',
    '..................',
    '#####........#####',
    '#####........#####',
    '#####........#####',
    '#####........#####'],
  spikes: [
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '......^^^...^^....',
    ...GROUND4(18)],
  tunnel: [
    '......hhhhhh......',
    '......hhhhhh......',
    '......hhhhhh......',
    '......hhhhhh......',
    '......hhhhhh......',
    '......hhhhhh......',
    '......hhhhhh......',
    '..................',
    ...GROUND4(18)],
  pend: [
    '....................',
    '....................',
    '......L......L......',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    ...GROUND4(20)],
  roll: [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '.....................R',
    ...GROUND4(22)],
  crush: [
    '..................',
    '..................',
    '.......K....K.....',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    ...GROUND4(18)],
  stairs: [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '..........######......',
    '.......#########......',
    '....############......',
    ...GROUND4(22)],
  upper: [
    '............................',
    '............................',
    '............................',
    '..........B....?............',
    '.......===========..........',
    '............................',
    '............................',
    '.....S....^^.........R......',
    ...GROUND4(28)],
  water: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '#####.O...O....O...#####',
    '#####~~~G~~~~G~~~~~#####',
    '########################',
    '########################'],
  mplat: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........P.............',
    '#####............#######',
    '#####............#######',
    '#####............#######',
    '#####............#######'],
  boostrun: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '....B.........B.........',
    ...GROUND4(24)],
  mud: [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '...=============....',
    '....................',
    '....................',
    '####mmmmmmmmmmmm####',
    '####################',
    '####################',
    '####################'],
  springwall: [
    '....................',
    '....................',
    '....................',
    '..........##########',
    '..........##########',
    '..........##########',
    '..........##########',
    '.......S..##########',
    ...GROUND4(20)],
  checkpoint: [SKY(10), SKY(10), SKY(10), SKY(10), SKY(10), SKY(10), SKY(10), '....C.....', ...GROUND4(10)],
  finish: [SKY(30), SKY(30), SKY(30), SKY(30), SKY(30), SKY(30), SKY(30), '......F.......................', ...GROUND4(30)],
  /* sky level pieces */
  clouds: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...........====.........',
    '........................',
    '...====...........====..',
    '##....................##',
    '##....................##',
    '........................',
    '........................'],
  wind: [
    '......................',
    '......................',
    '......................',
    '...........=====......',
    '......................',
    '......................',
    '......................',
    '......................',
    '####.W.W.W.W....######',
    '####............######',
    '......................',
    '......................'],
  kites: [
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '.......V.........P........',
    '..........................',
    '####..................####',
    '####..................####',
    '..........................',
    '..........................'],
  thunder: [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '..........?.........',
    '.....====...====....',
    '......^^^.....^^....',
    ...GROUND4(20)],
};

/* ---------- levels ---------- */
const LEVELS = [
  { id: 'sangthong', theme: 'sangthong',
    seq: ['start', 'flat', 'boxes', 'gap3', 'flat', 'roll', 'boxes', 'pend', 'checkpoint', 'stairs', 'gapplat', 'boxes', 'spikes',
          'tunnel', 'checkpoint', 'upper', 'roll', 'boxes', 'pend', 'gap3', 'checkpoint', 'boostrun', 'spikes', 'water', 'boxes', 'mplat', 'finish'] },
  { id: 'plabuthong', theme: 'plabuthong',
    seq: ['start', 'boxes', 'water', 'flat', 'crush', 'boxes', 'checkpoint', 'mud', 'gap3', 'roll', 'water', 'boxes', 'checkpoint',
          'crush', 'tunnel', 'upper', 'boxes', 'checkpoint', 'water', 'mplat', 'boostrun', 'crush', 'boxes', 'pend', 'finish'] },
  { id: 'kraithong', theme: 'kraithong',
    seq: ['start', 'boxes', 'water', 'pend', 'checkpoint', 'roll', 'gapplat', 'springwall', 'boxes', 'checkpoint', 'tunnel', 'spikes',
          'mplat', 'water', 'checkpoint', 'pend', 'crush', 'upper', 'boxes', 'roll', 'water', 'gap3', 'finish'] },
  { id: 'kaewnama', theme: 'kaewnama',
    seq: ['start', 'boxes', 'clouds', 'wind', 'checkpoint', 'kites', 'boxes', 'gapplat', 'pend', 'checkpoint', 'wind', 'clouds',
          'boostrun', 'kites', 'checkpoint', 'thunder', 'mplat', 'boxes', 'wind', 'finish'] },
];
