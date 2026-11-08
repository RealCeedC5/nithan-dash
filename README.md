# วิ่งแดนนิทาน · Nithan Dash

เกมวิ่งแข่งฝ่าด่านแบบพิกเซล ในโลกนิทานพื้นบ้านไทย แข่งกับบอทหรือชวนเพื่อนอีก 3 คนมาแข่งออนไลน์ เล่นได้ในเบราว์เซอร์ทั้งคอมและมือถือ สลับภาษาไทย / English ได้

A pixel-art racing platformer through Thai folk tales. Race the bots or up to three friends online, right in the browser on desktop or phone, in Thai or English.

**▶ เล่นเลย / Play:** https://realceedc5.github.io/nithan-dash/

---

## ภาษาไทย

### ด่านนิทาน 4 เรื่อง
| ด่าน | ฉาก | ระวัง |
|---|---|---|
| **สังข์ทอง** | ป่าและบ่อทองคำ | กระบองยักษ์แกว่ง หอยสังข์กลิ้ง |
| **ปลาบู่ทอง** | หมู่บ้านริมคลองยามเย็น | สากตำข้าว ใบบัวที่จมได้ โคลน |
| **ไกรทอง** | ถ้ำชาละวันใต้แม่น้ำ | จระเข้โผล่จากน้ำ หินย้อยแกว่ง ก้อนหินกลิ้ง |
| **แก้วหน้าม้า** | บนฟ้าเหนือเมฆ | เหวระหว่างเมฆ ว่าวที่ลอยขึ้นลง ลมพัดขึ้นช่วยพาข้าม |

### วิธีเล่น
| | คอมพิวเตอร์ | มือถือ |
|---|---|---|
| วิ่ง | ← → หรือ A D | ปุ่ม ◀ ▶ ด้านซ้าย |
| กระโดด | Space / ↑ / W (กดอีกครั้งกลางอากาศ = กระโดด 2 ชั้น) | ปุ่ม ▲ |
| สไลด์ / มุดลอด | ↓ / S | ปุ่ม ▼ |
| ใช้ไอเทม | E / Shift | ปุ่มไอเทม |
| กลับเช็กพอยต์ | R | ในเมนูหยุดเกม |

### ไอเทม (สุ่มจากกล่อง ?)
ลมกรด (วิ่งเร็วขึ้น) · ผ้ายันต์ (กันโดนชน 1 ครั้ง) · ลูกแก้วสะกด (สะกดคนข้างหน้า) · เปลือกกล้วย (วางให้คนข้างหลังลื่น) · เมฆฝน (ทุกคนข้างหน้าช้าลง) · ปีกครุฑ (บินได้สักพัก ไม่ตกเหว)
คนที่อยู่ท้าย ๆ จะได้ไอเทมช่วยไล่ตามบ่อยกว่า

### เล่นกับเพื่อน
1. คนหนึ่งกด **เปิดห้องออนไลน์** แล้วส่งรหัส 5 ตัวให้เพื่อน
2. เพื่อนกด **เข้าห้องเพื่อน** แล้วใส่รหัส
3. เจ้าของห้องเลือกด่าน เลือกว่าจะเติมบอทให้ครบ 6 คนไหม แล้วกด **เริ่มแข่ง**

---

## English

### Four folk-tale levels
**Sang Thong** (swinging giant clubs, rolling conch shells) · **The Golden Goby** (rice pounders, sinking lotus pads, mud) · **Krai Thong** (leaping crocodiles in Chalawan's cave) · **Kaew Na Ma** (cloud gaps, bobbing kites, updrafts).

### Controls
Arrows or A / D to run, Space / ↑ / W to jump (again in the air for a double jump), ↓ / S to slide, E / Shift to use an item, R to go back to the last checkpoint. On phones, use the on-screen buttons.

### Items
Whirlwind (speed burst), Yantra Cloth (blocks one hit), Spell Orb (freezes the runner ahead), Banana Peel (drop it behind you), Rain Cloud (slows everyone ahead), Garuda Wings (fly for a moment). Runners near the back get catch-up items more often.

### Online
One player opens a room and shares the 5-letter code; up to 4 players join, and bots can fill the race to 6 runners.

---

## How it works

- **Clock-driven hazards.** Every swinging club, crusher, crocodile and moving platform is a pure function of the race clock, so all players see the same hazards without sending them over the network.
- **Peer-to-peer races.** Rooms use WebRTC through PeerJS. The host keeps the lobby, runs the bots and decides the results; each player simulates their own runner and shares its state 15 times a second. Clocks are synced with ping/pong before the start.
- **Bots that plan their jumps.** Bots read the tiles ahead, then fly several candidate jumps through the same physics to choose one that lands on safe ground, including moving platforms at the time they'll arrive. An automated test races bots through every level.
- **No assets, no build.** All sprites, tiles, backgrounds and music are generated in code with Canvas 2D and the Web Audio API.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Online rooms need the page served over HTTPS (GitHub Pages works) and use the free PeerJS cloud server for matchmaking.

## Project structure

```
index.html      HUD, touch buttons, menu styles
js/i18n.js      Thai / English text
js/data.js      runners, items, themes, level chunks and level order
js/world.js     level building, tiles, clock-driven hazards, runner physics
js/art.js       pixel art: runners, tiles, decor, backgrounds, hazards
js/audio.js     sound effects and music
js/race.js      race clock, items, bots, ranking, results
js/net.js       online rooms (PeerJS)
js/ui.js        rendering, camera, input, HUD, menus, main loop
```

Made by C5. The tales are traditional Thai folk stories; every character and drawing in the game is original.
