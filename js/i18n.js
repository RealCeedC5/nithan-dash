'use strict';
/* Thai / English text. t('key') returns the current language; {0} {1} are filled from extra args. */
const STR = {
  th: {
    title_sub: 'วิ่งแดนนิทาน',
    tagline: 'วิ่งแข่งฝ่าด่านนิทานพื้นบ้านไทย กับเพื่อนหรือบอท',
    name: 'ชื่อนักวิ่ง', runner: 'นักวิ่ง', shirt: 'สีเสื้อ', hair: 'สีผม',
    play_bots: 'เล่นกับบอท', host: 'เปิดห้องออนไลน์', join: 'เข้าห้องเพื่อน', how: 'วิธีเล่น',
    back: 'กลับ', start: 'เริ่มแข่ง', next: 'ด่านต่อไป', again: 'แข่งอีกครั้ง', menu: 'เมนูหลัก',
    pick_level: 'เลือกด่าน', bots: 'ความเก่งของบอท', easy: 'ง่าย', normal: 'ปกติ', hard: 'ยาก',
    best: 'สถิติ', none: '—',
    room: 'ห้อง', room_code: 'รหัสห้อง', share_code: 'ส่งรหัสนี้ให้เพื่อน (สูงสุด 4 คน)',
    fill_bots: 'เติมบอทให้ครบ 6 คน', waiting: 'รอเจ้าของห้องเริ่ม…', players: 'ผู้เล่น',
    join_title: 'เข้าห้องเพื่อน', join_code: 'ใส่รหัส 5 ตัว', connect: 'เข้าห้อง',
    connecting: 'กำลังเชื่อมต่อ…', opening: 'กำลังเปิดห้อง…', net_fail: 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง',
    no_room: 'ไม่พบห้องนี้ เช็กรหัสอีกที', room_full: 'ห้องเต็มแล้ว', host_left: 'เจ้าของห้องออกไปแล้ว',
    in_race: 'ห้องนี้กำลังแข่งอยู่ รอรอบหน้านะ', net_https: 'โหมดออนไลน์ต้องเปิดเกมผ่าน https (เช่น GitHub Pages)',
    copy: 'คัดลอก', copied: 'คัดลอกแล้ว', leave: 'ออกจากห้อง', host_tag: 'เจ้าของห้อง', bot_tag: 'บอท', you: 'คุณ',
    go: 'ไป!', finish: 'เข้าเส้นชัย!', place: 'อันดับ', time: 'เวลา', results: 'ผลการแข่ง', dnf: 'ไม่จบ',
    new_best: 'สถิติใหม่!', paused: 'หยุดชั่วคราว', resume: 'เล่นต่อ', restart: 'เริ่มใหม่', quit: 'ออก',
    respawn: 'กลับจุดเช็กพอยต์', checkpoint: 'ผ่านเช็กพอยต์', sound: 'เสียง', music: 'เพลง', on: 'เปิด', off: 'ปิด',
    spectate: 'รอคนอื่นเข้าเส้นชัย…', ends_in: 'จบการแข่งใน {0}',
    rotate: 'หมุนจอเป็นแนวนอนจะเล่นง่ายขึ้น',
    preview_online: 'หน้าพรีวิวนี้เล่นออนไลน์ไม่ได้ เปิดเกมจากลิงก์ GitHub Pages เพื่อเล่นกับเพื่อน',
    how_title: 'วิธีเล่น',
    how_keys: 'คอม: ← → วิ่ง · Space / ↑ กระโดด (กดอีกทีกลางอากาศ = กระโดด 2 ชั้น) · ↓ สไลด์ · E / Shift ใช้ไอเทม · R กลับเช็กพอยต์',
    how_touch: 'มือถือ: ปุ่มซ้ายใช้วิ่ง ปุ่มขวาใช้กระโดด สไลด์ และใช้ไอเทม',
    how_tips: 'ลอดใต้ลูกตุ้มด้วยการสไลด์ เก็บกล่อง ? เพื่อสุ่มไอเทม ตกเหวหรือตกน้ำจะกลับไปเช็กพอยต์ล่าสุด',
    items_title: 'ไอเทม',
    rank: ['ที่ 1', 'ที่ 2', 'ที่ 3', 'ที่ 4', 'ที่ 5', 'ที่ 6'],
  },
  en: {
    title_sub: 'Thai folk-tale racing',
    tagline: 'Race through Thai folk tales with friends or bots',
    name: 'Runner name', runner: 'Runner', shirt: 'Shirt', hair: 'Hair',
    play_bots: 'Race the bots', host: 'Open an online room', join: "Join a friend's room", how: 'How to play',
    back: 'Back', start: 'Start race', next: 'Next level', again: 'Race again', menu: 'Main menu',
    pick_level: 'Pick a level', bots: 'Bot skill', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    best: 'Best', none: '—',
    room: 'Room', room_code: 'Room code', share_code: 'Send this code to friends (up to 4 players)',
    fill_bots: 'Fill up to 6 runners with bots', waiting: 'Waiting for the host to start…', players: 'Players',
    join_title: "Join a friend's room", join_code: 'Enter the 5-letter code', connect: 'Join',
    connecting: 'Connecting…', opening: 'Opening a room…', net_fail: "Couldn't connect. Try again.",
    no_room: 'No room with that code. Check it and try again.', room_full: 'That room is full.', host_left: 'The host left the room.',
    in_race: "That room is mid-race. Try again after it ends.", net_https: 'Online play needs the game served over https (for example GitHub Pages).',
    copy: 'Copy', copied: 'Copied', leave: 'Leave room', host_tag: 'Host', bot_tag: 'Bot', you: 'You',
    go: 'GO!', finish: 'Finish!', place: 'Place', time: 'Time', results: 'Results', dnf: 'DNF',
    new_best: 'New best!', paused: 'Paused', resume: 'Resume', restart: 'Restart', quit: 'Quit',
    respawn: 'Back to checkpoint', checkpoint: 'Checkpoint', sound: 'Sound', music: 'Music', on: 'On', off: 'Off',
    spectate: 'Waiting for the others…', ends_in: 'Race ends in {0}',
    rotate: 'Turn your phone sideways for easier play',
    preview_online: "Online rooms don't work in this preview. Open the game from its GitHub Pages link to race friends.",
    how_title: 'How to play',
    how_keys: 'Keyboard: ← → run · Space / ↑ jump (again in the air for a double jump) · ↓ slide · E / Shift use item · R back to checkpoint',
    how_touch: 'Phone: left buttons to run, right buttons to jump, slide and use your item',
    how_tips: 'Slide under swinging hazards. Grab ? boxes for a random item. Falling into a pit or water sends you back to the last checkpoint.',
    items_title: 'Items',
    rank: ['1st', '2nd', '3rd', '4th', '5th', '6th'],
  },
};

let LANG = 'th';
try { LANG = localStorage.getItem('nithan-lang') || ''; } catch (e) { LANG = ''; }
if (LANG !== 'th' && LANG !== 'en') LANG = /^th\b/i.test(navigator.language || '') ? 'th' : 'en';

function t(key, ...args) {
  let s = (STR[LANG] && STR[LANG][key]);
  if (s === undefined) s = STR.en[key];
  if (s === undefined) return key;
  if (typeof s === 'string') args.forEach((a, i) => { s = s.replace('{' + i + '}', a); });
  return s;
}
/* pick the current language from a {th, en} pair */
const L10 = o => (o && (o[LANG] || o.en)) || '';

function setLang(l) {
  LANG = l;
  try { localStorage.setItem('nithan-lang', l); } catch (e) { /* storage blocked */ }
  document.documentElement.lang = l;
}
document.documentElement.lang = LANG;
