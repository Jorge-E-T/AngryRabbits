/* ============================================================
   ANGRY RABBITS — an original slingshot physics game
   Built for the Rabbit R1, played SIDEWAYS: the whole app is
   rotated 90 degrees (CSS transform) so the 282px screen edge
   becomes the horizontal play axis. Slingshot on the left, fox
   forts to the right. In a wide browser window it renders
   unrotated. All input is mapped through the rotation.

   Original characters & artwork. Genre mechanics: drag-launch
   slingshot, arc physics, destructible wood/glass/stone forts,
   tap-activated abilities, 3-star scoring.
   ============================================================ */
(function () {
'use strict';

/* ---------------- constants ---------------- */
var W = 282, H = 240, GY = 214;         // landscape canvas, ground top
var GRAV = 0.22;                        // gravity px/frame^2
var MAXPULL = 48, POWER = 0.19;         // slingshot pull radius / power
var MAXSPD = 11;
var SL = { x: 58, y: 176 };             // slingshot anchor (left side)

var MATS = {
  wood:  { hp: 20, score: 500, c1: '#c98a4b', c2: '#9a6630' },
  glass: { hp: 10, score: 300, c1: '#bfe3f5', c2: '#7fb8d8' },
  stone: { hp: 45, score: 800, c1: '#a2a8b0', c2: '#6f757e' }
};

/* Original rabbit roster — one per classic ability archetype */
var TYPES = {
  rusty:  { label: 'Rusty',    r: 7,   mass: 1.15, c: '#e04b3a', c2: '#b3372a', ab: 'none'  },
  trio:   { label: 'The Trio', r: 5.5, mass: 0.85, c: '#4d9be6', c2: '#3573b3', ab: 'split' },
  zip:    { label: 'Zip',      r: 6.5, mass: 0.95, c: '#f5c531', c2: '#c99a1d', ab: 'dash'  },
  boomer: { label: 'Boomer',   r: 7,   mass: 1.25, c: '#4a4a58', c2: '#2e2e38', ab: 'boom'  },
  willow: { label: 'Willow',   r: 7,   mass: 1.05, c: '#f6f1e3', c2: '#cfc6ad', ab: 'drop'  },
  moe:    { label: 'Big Moe',  r: 10.5, mass: 2.6, c: '#a4693a', c2: '#7c4c26', ab: 'none'  }
};

function B(mat, x, y, w, h) {
  return { mat: mat, x: x, y: y, w: w, h: h, hp: MATS[mat].hp,
           vx: 0, vy: 0, dead: false, falling: false,
           ang: 0, angv: 0, tipT: 0 };
}
function F(x, y) {
  return { x: x, y: y, r: 6.5, hp: 4, dead: false, vy: 0,
           falling: false, blink: (Math.random() * 200) | 0 };
}

/* ---------------- levels (landscape layouts) ----------------
   Sling at (58,176), ground top y=214, field 282 wide. Forts live
   at x >= ~130. Foxes are exposed (open-top pens, tower tops) or
   inside collapsible/blastable structures — solver-verified. */
var LEVELS = [
  { // 1 — two foxes behind a glass post; learn to drag & lob
    name: 'First Hop',
    stars: [10000, 14000, 20000],
    queue: ['rusty', 'rusty'],
    platforms: [],
    make: function () { return {
      blocks: [
        B('glass', 176, 184, 10, 30),
        B('wood', 206, 200, 16, 14)
      ],
      foxes: [F(196, 207), F(232, 207)]
    }; }
  },
  { // 2 — glass pen + a lookout tower
    name: 'Glass House',
    stars: [15000, 20000, 26000],
    queue: ['rusty', 'zip', 'rusty'],
    platforms: [],
    make: function () { return {
      blocks: [
        B('glass', 150, 184, 10, 30),
        B('glass', 196, 184, 10, 30),
        B('wood', 236, 186, 14, 28)
      ],
      foxes: [F(170, 207), F(188, 207), F(243, 179)]
    }; }
  },
  { // 3 — spread-out targets; The Trio's split shines
    name: 'Split Decision',
    stars: [15000, 21000, 25500],
    queue: ['trio', 'rusty', 'zip'],
    platforms: [{ x: 150, y: 126, w: 70, h: 10 }],
    make: function () { return {
      blocks: [
        B('glass', 134, 184, 10, 30),
        B('glass', 176, 184, 10, 30),
        B('glass', 236, 190, 10, 24),
        B('wood', 176, 112, 14, 14)
      ],
      foxes: [F(158, 207), F(256, 207), F(162, 119)]
    }; }
  },
  { // 4 — tall wood walls; Zip slices straight through
    name: 'Woodpecker',
    stars: [15000, 21000, 26000],
    queue: ['zip', 'rusty', 'zip'],
    platforms: [],
    make: function () { return {
      blocks: [
        B('wood', 168, 164, 10, 50),
        B('wood', 216, 164, 10, 50),
        B('glass', 250, 196, 12, 18)
      ],
      foxes: [F(194, 207), F(238, 207), F(256, 189)]
    }; }
  },
  { // 5 — a high ledge pen; Willow bombs it from above
    name: 'Sky Ledge',
    stars: [15000, 21000, 26000],
    queue: ['rusty', 'willow', 'rusty'],
    platforms: [{ x: 186, y: 118, w: 88, h: 10 }],
    make: function () { return {
      blocks: [
        B('glass', 194, 88, 10, 30),
        B('glass', 252, 88, 10, 30),
        B('wood', 146, 190, 12, 24)
      ],
      foxes: [F(220, 111), F(238, 111), F(166, 207)]
    }; }
  },
  { // 6 — two storeys; shatter the glass legs and it all comes down
    name: 'Double Decker',
    stars: [20000, 26000, 33000],
    queue: ['rusty', 'zip', 'trio'],
    platforms: [],
    make: function () { return {
      blocks: [
        B('glass', 188, 174, 10, 40),
        B('glass', 242, 174, 10, 40),
        B('wood', 182, 164, 76, 10),
        B('glass', 192, 134, 10, 30),
        B('glass', 240, 134, 10, 30)
      ],
      foxes: [F(212, 207), F(228, 207), F(212, 157), F(228, 157)]
    }; }
  },
  { // 7 — stone gate; Boomer's blast makes the introductions
    name: 'Stone Gate',
    stars: [15000, 22000, 29000],
    queue: ['boomer', 'rusty', 'trio'],
    platforms: [],
    make: function () { return {
      blocks: [
        B('stone', 172, 166, 14, 48),
        B('stone', 216, 190, 14, 24)
      ],
      foxes: [F(198, 207), F(244, 207), F(179, 159)]
    }; }
  },
  { // 8 — foxes perched on towers; topple or snipe them
    name: 'Fox Towers',
    stars: [20000, 27000, 34000],
    queue: ['trio', 'willow', 'zip'],
    platforms: [],
    make: function () { return {
      blocks: [
        B('wood', 176, 168, 12, 46),
        B('wood', 226, 150, 12, 64),
        B('glass', 258, 188, 10, 26)
      ],
      foxes: [F(182, 161), F(232, 143), F(204, 207), F(274, 207)]
    }; }
  },
  { // 9 — a stone bunker; Big Moe simply does not care
    name: 'Heavyweight',
    stars: [20000, 28000, 36000],
    queue: ['moe', 'rusty', 'trio'],
    platforms: [],
    make: function () { return {
      blocks: [
        B('stone', 184, 174, 12, 40),
        B('stone', 240, 174, 12, 40),
        B('stone', 178, 164, 80, 10),
        B('wood', 208, 150, 14, 14)
      ],
      foxes: [F(210, 207), F(228, 207), F(215, 143), F(268, 207)]
    }; }
  },
  { // 10 — everything at once: wall, stone keep, sky pen
    name: 'The Carrot Vault',
    stars: [25000, 35000, 46000],
    queue: ['zip', 'trio', 'boomer', 'willow', 'moe'],
    platforms: [{ x: 158, y: 112, w: 104, h: 10 }],
    make: function () { return {
      blocks: [
        B('wood', 148, 170, 10, 44),
        B('stone', 186, 174, 12, 40),
        B('stone', 236, 174, 12, 40),
        B('stone', 180, 164, 74, 10),
        B('glass', 168, 82, 10, 30),
        B('glass', 238, 82, 10, 30),
        B('wood', 196, 98, 16, 14)
      ],
      foxes: [F(212, 207), F(228, 207), F(217, 157), F(186, 105), F(224, 105)]
    }; }
  }
];

/* ---------------- state ---------------- */
var cv, ctx, app;
var save = { best: [], stars: [] };
var scene = 'menu';                 // menu | play | end
var lvIdx = 0, sel = 0;
var platforms = [], blocks = [], foxes = [], projs = [], parts = [], texts = [];
var queue = [], loaded = null;      // loaded = type key of rabbit on the sling
var sub = 'ready';                  // ready | aiming | flight | settle | over
var drag = null;                    // {dx,dy} pull from anchor
var score = 0, shake = 0, bannerT = 0, hintT = 0, winT = 0, settleT = 0;
var frame = 0, ended = false;
var endPrimary = 'btnRetry';
var rotated = false, scaleF = 1;    // set by fit(); used to map pointer coords

/* ---------------- persistence ----------------
   Belt-and-braces: progress is written to BOTH the R1's
   creationStorage (base64, async) and localStorage (sync) on
   every save AND on pagehide, and on load both stores are read
   and merged taking the best value per level — so whichever
   store actually survived the session wins and neither can
   regress the other. Arrays auto-resize to the level count. */
var SAVEKEY = 'angry_rabbits_v1';

function normalizeSave() {
  if (!save || typeof save !== 'object') save = { best: [], stars: [] };
  if (!save.best) save.best = [];
  if (!save.stars) save.stars = [];
  for (var i = 0; i < LEVELS.length; i++) {
    save.best[i] = Math.max(0, save.best[i] | 0);
    save.stars[i] = Math.min(3, Math.max(0, save.stars[i] | 0));
  }
  save.best.length = LEVELS.length;
  save.stars.length = LEVELS.length;
}

function mergeSave(b) {         // take the max per level; never regress
  if (!b || typeof b !== 'object') return;
  var i;
  if (b.best) for (i = 0; i < LEVELS.length; i++) {
    save.best[i] = Math.max(save.best[i] | 0, b.best[i] | 0);
  }
  if (b.stars) for (i = 0; i < LEVELS.length; i++) {
    save.stars[i] = Math.max(save.stars[i] | 0, b.stars[i] | 0);
  }
}

function parseRaw(v) {          // accept base64-wrapped or plain JSON
  if (!v) return null;
  try { return JSON.parse(atob(v)); } catch (e) {}
  try { return JSON.parse(v); } catch (e2) {}
  return null;
}

function loadSave() {
  normalizeSave();
  return new Promise(function (res) {
    try { mergeSave(parseRaw(localStorage.getItem(SAVEKEY))); } catch (e) {}
    var done = function () { normalizeSave(); res(); };
    try {
      if (window.creationStorage && window.creationStorage.plain) {
        window.creationStorage.plain.getItem(SAVEKEY)
          .then(function (v) { mergeSave(parseRaw(v)); done(); })
          .catch(done);
        return;
      }
    } catch (e2) {}
    done();
  });
}

function writeSave() {
  normalizeSave();
  var s;
  try { s = JSON.stringify(save); } catch (e) { return; }
  try { localStorage.setItem(SAVEKEY, s); } catch (e1) {}
  try {
    if (window.creationStorage && window.creationStorage.plain) {
      window.creationStorage.plain.setItem(SAVEKEY, btoa(s));
    }
  } catch (e2) {}
}

/* ---------------- tiny sound synth ---------------- */
var AC = null;
function unlockAudio() {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC && AC.state === 'suspended') AC.resume();
    startMusic();
  } catch (e) {}
}
function sfx(freq, dur, type, vol) {
  if (!AC) return;
  try {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, AC.currentTime);
    g.gain.setValueAtTime(vol || 0.04, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur + 0.02);
  } catch (e) {}
}

/* ---------------- looping music ---------------- */
var musicOn = false, musicStep = 0;
var MELODY = [523, 659, 784, 659, 587, 784, 880, 784,
              523, 659, 784, 880, 1047, 880, 784, 659,
              523, 659, 784, 659, 587, 740, 880, 740,
              659, 784, 880, 1047, 784, 659, 587, 523];
var BASSLN = [131, 131, 196, 196, 147, 147, 220, 220,
              131, 131, 196, 196, 165, 165, 196, 196];
function note(freq, t, dur, type, vol) {
  try {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
function musicTick() {
  if (!AC || AC.state !== 'running') return;
  var t = AC.currentTime;
  note(MELODY[musicStep % MELODY.length], t, 0.16, 'triangle', 0.022);
  if (musicStep % 2 === 0) note(BASSLN[(musicStep >> 1) % BASSLN.length], t, 0.3, 'sine', 0.03);
  if (musicStep % 4 === 2) note(2400, t, 0.03, 'square', 0.008);
  musicStep++;
}
function startMusic() {
  if (musicOn || !AC) return;
  musicOn = true;
  setInterval(musicTick, 190);
}

/* ---------------- helpers ---------------- */
function circRect(px, py, r, bx, by, bw, bh) {
  var cx = Math.max(bx, Math.min(px, bx + bw));
  var cy = Math.max(by, Math.min(py, by + bh));
  var dx = px - cx, dy = py - cy, d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 === 0) { // centre inside: push out along shortest axis
    var l = px - bx, rt = bx + bw - px, tp = py - by, bt = by + bh - py;
    var m = Math.min(l, rt, tp, bt);
    if (m === tp) return { nx: 0, ny: -1, pen: r + tp };
    if (m === bt) return { nx: 0, ny: 1, pen: r + bt };
    if (m === l)  return { nx: -1, ny: 0, pen: r + l };
    return { nx: 1, ny: 0, pen: r + rt };
  }
  var d = Math.sqrt(d2);
  return { nx: dx / d, ny: dy / d, pen: r - d };
}

function spawnParts(x, y, n, color, sp) {
  for (var i = 0; i < n && parts.length < 70; i++) {
    var a = Math.random() * Math.PI * 2, s = (0.5 + Math.random()) * sp;
    parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
                 life: 26 + Math.random() * 18, c: color, sz: 1.5 + Math.random() * 2 });
  }
}
function addScore(n, x, y) {
  score += n;
  if (x !== undefined) texts.push({ x: x, y: y, t: '+' + n, life: 55 });
}

/* ---------------- damage & destruction ---------------- */
function damageBlock(b, d) {
  if (b.dead || d <= 0) return;
  b.hp -= d;
  if (b.hp <= 0) {
    b.dead = true;
    addScore(MATS[b.mat].score, b.x + b.w / 2, b.y + b.h / 2);
    spawnParts(b.x + b.w / 2, b.y + b.h / 2, 7, MATS[b.mat].c2, 2.6);
    sfx(b.mat === 'glass' ? 650 : b.mat === 'stone' ? 70 : 130, 0.09,
        b.mat === 'glass' ? 'triangle' : 'square', 0.05);
  } else if (d > 2.5) {
    sfx(b.mat === 'glass' ? 520 : b.mat === 'stone' ? 90 : 150, 0.05, 'square', 0.03);
  }
}
function damageFox(f, d) {
  if (f.dead || d <= 0) return;
  f.hp -= d;
  if (f.hp <= 0) killFox(f);
}
function killFox(f) {
  if (f.dead) return;
  f.dead = true;
  addScore(5000, f.x, f.y - 10);
  spawnParts(f.x, f.y, 9, '#e8843a', 2.8);
  spawnParts(f.x, f.y, 4, '#fff', 2);
  sfx(430, 0.14, 'square', 0.06);
  sfx(650, 0.1, 'square', 0.04);
}

function explode(x, y, R, pow) {
  shake = Math.min(9, shake + 6);
  sfx(60, 0.35, 'sawtooth', 0.09);
  sfx(120, 0.2, 'square', 0.05);
  spawnParts(x, y, 14, '#ffb347', 3.4);
  spawnParts(x, y, 8, '#6a6a6a', 2.2);
  var i, b, f, cx, cy, d, reach, dmg, k;
  for (i = 0; i < blocks.length; i++) {
    b = blocks[i];
    if (b.dead) continue;
    cx = b.x + b.w / 2; cy = b.y + b.h / 2;
    d = Math.hypot(cx - x, cy - y);
    reach = R + Math.max(b.w, b.h) / 2;
    if (d < reach) {
      dmg = pow * (1 - d / (reach + 14));
      if (b.mat === 'stone' && pow < 90) dmg *= 0.8;
      damageBlock(b, dmg);
      if (!b.dead) {
        k = dmg * 0.05; d = d || 1;
        b.vx += (cx - x) / d * k;
        b.vy += (cy - y) / d * k * 0.5;
        b.falling = true;
      }
    }
  }
  for (i = 0; i < foxes.length; i++) {
    f = foxes[i];
    if (f.dead) continue;
    d = Math.hypot(f.x - x, f.y - y);
    if (d < R + f.r) damageFox(f, pow * (1 - d / (R + 20)) + 4);
  }
}

/* ---------------- projectiles ---------------- */
function makeProj(typeKey, x, y, vx, vy, opts) {
  var t = TYPES[typeKey];
  var p = { type: typeKey, x: x, y: y, vx: vx, vy: vy,
            r: t.r, mass: t.mass, rot: 0, age: 0, slow: 0,
            dead: false, abUsed: false, dash: false, small: false,
            fuse: -1, bomb: false };
  if (opts) for (var k in opts) p[k] = opts[k];
  return p;
}

function triggerAbility() {
  for (var i = 0; i < projs.length; i++) {
    var p = projs[i];
    if (p.dead || p.bomb || p.abUsed) continue;
    var ab = TYPES[p.type].ab;
    if (ab === 'none') { continue; }
    p.abUsed = true;
    if (ab === 'split') {
      for (var j = 0; j < 2; j++) {
        var a = j === 0 ? -0.26 : 0.26;
        var cs = Math.cos(a), sn = Math.sin(a);
        projs.push(makeProj('trio', p.x, p.y,
          p.vx * cs - p.vy * sn, p.vx * sn + p.vy * cs,
          { r: 4, mass: 0.55, small: true, abUsed: true }));
      }
      p.r = 4; p.mass = 0.55; p.small = true;
      sfx(700, 0.08, 'square', 0.05); sfx(900, 0.08, 'square', 0.04);
    } else if (ab === 'dash') {
      var s = Math.hypot(p.vx, p.vy) || 1;
      var ns = Math.min(13, s * 1.8);
      p.vx = p.vx / s * ns; p.vy = p.vy / s * ns; p.dash = true;
      sfx(1200, 0.12, 'sawtooth', 0.05);
    } else if (ab === 'boom') {
      explode(p.x, p.y, 46, 95);
      p.dead = true;
    } else if (ab === 'drop') {
      projs.push(makeProj('willow', p.x, p.y + 6, p.vx * 0.25, 2.5,
        { bomb: true, r: 4, mass: 0.8, abUsed: true }));
      p.vy = -6; p.vx *= 0.6;
      sfx(500, 0.1, 'triangle', 0.05);
    }
  }
}

function stepProj(p) {
  p.age++;
  for (var s = 0; s < 2; s++) {          // 2 substeps: no tunnelling
    p.vy += GRAV * 0.5;
    var sp0 = Math.hypot(p.vx, p.vy);
    if (sp0 > MAXSPD + 3) { p.vx *= (MAXSPD + 3) / sp0; p.vy *= (MAXSPD + 3) / sp0; }
    p.x += p.vx * 0.5; p.y += p.vy * 0.5;
    p.rot += p.vx * 0.03;
    collideProj(p);
    if (p.dead) return;
  }
  if (p.dash && frame % 2 === 0) spawnParts(p.x, p.y, 1, '#f5c531', 0.6);
  if (p.fuse > 0) {
    p.fuse--;
    if (p.fuse === 0 && !p.dead) { explode(p.x, p.y, 46, 95); p.dead = true; return; }
  }
  if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx) * 0.4; }
  if (p.x > W - p.r) { p.x = W - p.r; p.vx = -Math.abs(p.vx) * 0.4; }
  if (p.y > H + 60) { p.dead = true; return; }
  var sp = Math.hypot(p.vx, p.vy);
  if (sp < 0.25) p.slow++; else p.slow = 0;
  if (p.slow > 40 || p.age > 450) {
    p.dead = true;
    if (!p.bomb) spawnParts(p.x, p.y, 5, '#ddd', 1.4);
  }
}

function collideProj(p) {
  var i, hit, vn;
  /* foxes */
  for (i = 0; i < foxes.length; i++) {
    var f = foxes[i];
    if (f.dead) continue;
    var dx = p.x - f.x, dy = p.y - f.y, rr = p.r + f.r;
    if (dx * dx + dy * dy < rr * rr) {
      if (p.bomb) { explode(p.x, p.y, 40, 75); p.dead = true; return; }
      var spd = Math.hypot(p.vx, p.vy);
      if (spd * p.mass > 1.4) damageFox(f, spd * p.mass * 1.5);
      var dd = Math.hypot(dx, dy) || 1;
      p.x = f.x + dx / dd * rr; p.y = f.y + dy / dd * rr;
      p.vx *= 0.6; p.vy *= 0.6;
    }
  }
  /* blocks */
  for (i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (b.dead) continue;
    hit = circRect(p.x, p.y, p.r, b.x, b.y, b.w, b.h);
    if (!hit) continue;
    if (p.bomb) { explode(p.x, p.y, 40, 75); p.dead = true; return; }
    vn = p.vx * hit.nx + p.vy * hit.ny;        // negative = moving into block
    var impact = Math.max(0, -vn) * p.mass;
    var bonus = 1;
    if (p.dash && b.mat === 'wood') bonus = 2.6;
    if (p.small && b.mat === 'glass') bonus = 2.6;
    if (p.type === 'moe') bonus *= 1.7;
    if (impact > 1) {
      damageBlock(b, impact * 2 * bonus);
      b.vx += -hit.nx * impact * 0.5;
      // spin: a hit above centre tips the block WITH the shot,
      // a hit below centre kicks the base out and tips it the OTHER way
      if (b.h > b.w && Math.abs(hit.nx) > 0.4) {
        var hitLever = ((b.y + b.h / 2) - p.y) / (b.h / 2);
        b.angv += (-hit.nx) * hitLever * impact * 0.03;
      }
      if (impact > 5) shake = Math.min(6, shake + 2);
      if (b.dead) {
        // smashed clean through — keep most momentum
        p.vx *= 0.75; p.vy *= 0.75;
        if (p.type === 'boomer' && p.fuse < 0) p.fuse = 54;
        continue;
      }
    }
    p.x += hit.nx * hit.pen; p.y += hit.ny * hit.pen;
    if (vn < 0) {
      var rest = 0.3;
      p.vx -= (1 + rest) * vn * hit.nx;
      p.vy -= (1 + rest) * vn * hit.ny;
      p.vx *= 0.85; p.vy *= 0.85;
      p.dash = false;
      if (p.type === 'boomer' && p.fuse < 0 && impact > 1) p.fuse = 54;
      if (impact > 2) sfx(b.mat === 'glass' ? 600 : b.mat === 'stone' ? 85 : 140, 0.05, 'square', 0.03);
    }
  }
  /* platforms + ground */
  for (i = 0; i < platforms.length; i++) {
    var pl = platforms[i];
    hit = circRect(p.x, p.y, p.r, pl.x, pl.y, pl.w, pl.h);
    if (!hit) continue;
    if (p.bomb) { explode(p.x, p.y, 40, 75); p.dead = true; return; }
    vn = p.vx * hit.nx + p.vy * hit.ny;
    p.x += hit.nx * hit.pen; p.y += hit.ny * hit.pen;
    if (vn < 0) {
      var r2 = Math.abs(vn) > 2 ? 0.28 : 0;
      p.vx -= (1 + r2) * vn * hit.nx;
      p.vy -= (1 + r2) * vn * hit.ny;
      if (hit.ny < -0.5) p.vx *= 0.92; else p.vx *= 0.7;
      if (p.type === 'boomer' && p.fuse < 0 && Math.abs(vn) > 1.5) p.fuse = 54;
      if (Math.abs(vn) > 3) sfx(100, 0.04, 'square', 0.025);
    }
  }
}

/* ---------------- blocks & foxes physics ---------------- */
function findSupport(x, w, bottom, self) {
  var best = null;
  function consider(sx, sw, top) {
    var ov = Math.min(x + w, sx + sw) - Math.max(x, sx);
    if (ov < 6) return;
    if (bottom >= top - 3 && bottom <= top + 7) {
      if (best === null || top < best) best = top;
    }
  }
  var i;
  for (i = 0; i < platforms.length; i++) consider(platforms[i].x, platforms[i].w, platforms[i].y);
  for (i = 0; i < blocks.length; i++) {
    var o = blocks[i];
    if (o === self || o.dead || (o.falling && o.vy > 1.5)) continue;
    consider(o.x, o.w, o.y);
  }
  return best;
}

/* where is this block actually held up? returns the left/right
   edges of everything solid under it, or null if nothing */
function supportSpan(b) {
  var lo = null, hi = null, bottom = b.y + b.h;
  function consider(sx, sw, top) {
    var a = Math.max(b.x, sx), z = Math.min(b.x + b.w, sx + sw);
    if (z - a < 2) return;
    if (bottom >= top - 3 && bottom <= top + 7) {
      if (lo === null || a < lo) lo = a;
      if (hi === null || z > hi) hi = z;
    }
  }
  for (var i = 0; i < platforms.length; i++) consider(platforms[i].x, platforms[i].w, platforms[i].y);
  for (var j = 0; j < blocks.length; j++) {
    var o = blocks[j];
    if (o === b || o.dead || (o.falling && o.vy > 1.5)) continue;
    consider(o.x, o.w, o.y);
  }
  return lo === null ? null : { lo: lo, hi: hi };
}

/* a standing piece tipped past the point of no return: lay it
   down flat on the side it fell toward and slam what's under it */
function toppleFlat(b) {
  var dir = b.ang > 0 ? 1 : -1;
  var v = Math.abs(b.angv) * 26 + 3;
  var nw = b.h, nh = b.w;
  var nx = dir > 0 ? b.x + b.w : b.x - nw;
  b.x = Math.max(0, Math.min(W - nw, nx));
  b.y = b.y + b.h - nh;
  b.w = nw; b.h = nh;
  b.ang = 0; b.angv = 0; b.tipT = 0;
  b.vx = dir * 0.4; b.vy = 2; b.falling = true;
  damageBlock(b, v * 0.8);
  slamZone(b, v);
  shake = Math.min(shake + 3, 7);
  sfx(85, 0.09, 'square', 0.05);
}

/* damage everything caught under a toppled piece */
function slamZone(b, v) {
  var i, x1 = b.x - 2, x2 = b.x + b.w + 2, y2 = b.y + b.h + 8;
  for (i = 0; i < blocks.length; i++) {
    var o = blocks[i];
    if (o === b || o.dead) continue;
    if (o.x < x2 && o.x + o.w > x1 && o.y < y2 && o.y + o.h > b.y - 4) {
      damageBlock(o, v * 1.5);
    }
  }
  for (i = 0; i < foxes.length; i++) {
    var f = foxes[i];
    if (f.dead) continue;
    if (f.x + f.r > x1 && f.x - f.r < x2 && f.y - f.r < y2 && f.y + f.r > b.y - 4) {
      killFox(f);
    }
  }
}

function stepBlocks() {
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (b.dead) continue;
    var sup = findSupport(b.x, b.w, b.y + b.h, b);

    // balance: if the centre of mass hangs past every support,
    // the piece goes over the edge instead of hovering
    if (sup !== null) {
      var span = supportSpan(b);
      var cx = b.x + b.w / 2;
      if (span && (cx < span.lo - 2 || cx > span.hi + 2)) {
        b.tipT = (b.tipT || 0) + 1;
        if (b.tipT > 5) {
          sup = null;
          var td = cx > span.hi ? 1 : -1;
          b.vx += td * 0.5;
          b.angv += td * 0.02;
        }
      } else b.tipT = 0;
    }

    if (sup !== null) {
      if (b.falling && b.vy > 2.4) landImpact(b);
      b.falling = false;
      if (b.vy > 0) b.vy = 0;
      b.y = sup - b.h;
      b.vx *= 0.86;
      if (Math.abs(b.vx) < 0.06) b.vx = 0;

      // toppling: standing pieces wobble back from small knocks
      // and fall right over from big ones
      if (b.h > b.w) {
        b.ang += b.angv;
        b.angv *= 0.94;
        var crit = Math.atan2(b.w, b.h);
        if (Math.abs(b.ang) > 0.01) {
          var tq = 0.0045 * (b.h / Math.max(b.w, 1));
          if (Math.abs(b.ang) > crit) b.angv += (b.ang > 0 ? 1 : -1) * tq;
          else b.angv += (b.ang > 0 ? -1 : 1) * tq * 0.25;
        }
        if (Math.abs(b.ang) < 0.015 && Math.abs(b.angv) < 0.004) { b.ang = 0; b.angv = 0; }
        if (Math.abs(b.ang) > 1.2) { toppleFlat(b); continue; }
      } else {
        b.ang *= 0.7;
        if (Math.abs(b.ang) < 0.01) b.ang = 0;
      }
    } else {
      b.falling = true;
      b.vy += GRAV;
      if (b.vy > 8) b.vy = 8;
      b.ang += b.angv;
      b.angv *= 0.985;
    }
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < 0) { b.x = 0; b.vx = 0; }
    if (b.x + b.w > W) { b.x = W - b.w; b.vx = 0; }
    if (b.y > H + 50) { b.dead = true; continue; }
    if (Math.abs(b.vx) > 0.2 || b.falling) pushBlocks(b);
    if (b.falling && b.vy > 1.6) crushCheck(b);
  }
}

function landImpact(b) {
  var v = b.vy;
  shake = Math.min(shake + v * 0.4, 6);
  damageBlock(b, v * 1.1);
  sfx(90, 0.06, 'square', 0.04);
  for (var i = 0; i < blocks.length; i++) {
    var o = blocks[i];
    if (o === b || o.dead) continue;
    var ov = Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x);
    if (ov >= 6 && Math.abs((b.y + b.h) - o.y) < 8) damageBlock(o, v * 2.2);
  }
}

function crushCheck(b) {
  for (var i = 0; i < foxes.length; i++) {
    var f = foxes[i];
    if (f.dead) continue;
    if (f.x + f.r > b.x && f.x - f.r < b.x + b.w &&
        f.y + f.r > b.y && f.y - f.r < b.y + b.h + b.vy + 2) {
      killFox(f);
    }
  }
}

function pushBlocks(b) {
  for (var i = 0; i < blocks.length; i++) {
    var o = blocks[i];
    if (o === b || o.dead) continue;
    var ox = Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x);
    var oy = Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y);
    if (ox <= 0 || oy <= 0) continue;
    if (ox < oy) {
      var dir = (b.x + b.w / 2) < (o.x + o.w / 2) ? -1 : 1;
      b.x += dir * ox * 0.6;
      o.vx += b.vx * 0.45;
      if (Math.abs(b.vx) > 2.2) {
        var d = Math.abs(b.vx) * 1.4;
        damageBlock(o, d);
        damageBlock(b, d * 0.6);
      }
      b.vx *= 0.5;
    } else if (b.falling && b.vy > 0 && (b.y + b.h / 2) < (o.y + o.h / 2)) {
      b.y = o.y - b.h;
    }
  }
}

function stepFoxes() {
  for (var i = 0; i < foxes.length; i++) {
    var f = foxes[i];
    if (f.dead) continue;
    var sup = findSupport(f.x - 7, 14, f.y + f.r, null);
    if (sup !== null) {
      if (f.falling && f.vy > 1.8) {
        damageFox(f, (f.vy - 1.4) * 2.2);
        if (f.dead) continue;
        spawnParts(f.x, f.y + f.r, 3, '#e8843a', 1.2);
      }
      f.falling = false; f.vy = 0; f.y = sup - f.r;
    } else {
      f.falling = true;
      f.vy += GRAV;
      f.y += f.vy;
    }
    for (var j = 0; j < blocks.length; j++) {
      var b = blocks[j];
      if (b.dead) continue;
      if (f.x + f.r - 2 > b.x && f.x - f.r + 2 < b.x + b.w &&
          f.y + f.r - 2 > b.y && f.y - f.r + 2 < b.y + b.h) {
        if (Math.abs(b.vx) > 1.2 || b.falling) { killFox(f); break; }
      }
    }
    if (!f.dead && f.y > H + 30) killFox(f);
  }
}

function stepParts() {
  var i;
  for (i = 0; i < parts.length; i++) {
    var p = parts[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
  }
  parts = parts.filter(function (p) { return p.life > 0; });
  for (i = 0; i < texts.length; i++) { texts[i].y -= 0.5; texts[i].life--; }
  texts = texts.filter(function (t) { return t.life > 0; });
}

/* ---------------- game flow ---------------- */
function startLevel(i) {
  lvIdx = i;
  var L = LEVELS[i];
  platforms = L.platforms.map(function (p) { return { x: p.x, y: p.y, w: p.w, h: p.h }; });
  platforms.push({ x: 0, y: GY, w: W, h: H - GY, ground: true });
  var made = L.make();
  blocks = made.blocks;
  foxes = made.foxes;
  projs = []; parts = []; texts = [];
  queue = L.queue.slice();
  loaded = queue.shift();
  score = 0; shake = 0; winT = 0; settleT = 0; ended = false;
  sub = 'ready'; drag = null;
  bannerT = 100;
  hintT = (i === 0 && save.stars[0] === 0) ? 260 : 0;
  scene = 'play';
  document.getElementById('menu').classList.remove('show');
  document.getElementById('endcard').classList.remove('show');
}

function launch() {
  var vx = -drag.dx * POWER;
  var vy = -drag.dy * POWER;
  projs.push(makeProj(loaded, SL.x + drag.dx, SL.y + drag.dy, vx, vy));
  loaded = null; drag = null;
  sub = 'flight';
  sfx(240, 0.12, 'triangle', 0.06);
  sfx(340, 0.1, 'triangle', 0.04);
}

function resolveTurn() {
  if (ended) return;
  if (foxes.length === 0) return;      // win watcher will take it
  if (queue.length > 0) {
    loaded = queue.shift();
    sub = 'ready';
  } else {
    doLose();
  }
}

function doWin() {
  if (ended) return;
  ended = true; sub = 'over';
  var unused = queue.length + (loaded ? 1 : 0);
  if (unused > 0) score += unused * 10000;
  var t = LEVELS[lvIdx].stars;
  var st = score >= t[2] ? 3 : score >= t[1] ? 2 : 1;
  if (score > save.best[lvIdx]) save.best[lvIdx] = score;
  if (st > save.stars[lvIdx]) save.stars[lvIdx] = st;
  writeSave();
  showEnd(true, st, unused);
}

function doLose() {
  if (ended) return;
  ended = true; sub = 'over';
  if (score > save.best[lvIdx]) { save.best[lvIdx] = score; writeSave(); }
  showEnd(false, 0, 0);
}

function updatePlay() {
  frame++;
  if (bannerT > 0) bannerT--;
  if (hintT > 0) hintT--;
  for (var i = 0; i < projs.length; i++) if (!projs[i].dead) stepProj(projs[i]);
  projs = projs.filter(function (p) { return !p.dead; });
  stepBlocks();
  stepFoxes();
  stepParts();
  blocks = blocks.filter(function (b) { return !b.dead; });
  foxes = foxes.filter(function (f) { return !f.dead; });

  if (!ended) {
    if (foxes.length === 0) {
      winT++;
      if (winT > 55) { doWin(); return; }
    } else winT = 0;
  }
  if (sub === 'flight' && projs.length === 0) { sub = 'settle'; settleT = 0; }
  if (sub === 'settle') {
    settleT++;
    var moving = false;
    for (var j = 0; j < blocks.length; j++) {
      if (blocks[j].falling || Math.abs(blocks[j].vx) > 0.15) { moving = true; break; }
    }
    if (!moving) for (var k = 0; k < foxes.length; k++) if (foxes[k].falling) { moving = true; break; }
    if ((!moving && settleT > 25) || settleT > 150) resolveTurn();
  }
}

/* ---------------- overlays / menu ---------------- */
function buildMenu() {
  var list = document.getElementById('levelList');
  list.innerHTML = '';
  LEVELS.forEach(function (L, i) {
    var locked = i > 0 && save.stars[i - 1] === 0;
    var div = document.createElement('div');
    div.className = 'lvl' + (locked ? ' locked' : '') + (i === sel ? ' sel' : '');
    var starTxt = '';
    for (var s = 0; s < 3; s++) starTxt += s < save.stars[i] ? '\u2605' : '\u2606';
    div.innerHTML =
      '<span class="n">' + (i + 1) + '</span>' +
      '<span class="st">' + (locked ? '\uD83D\uDD12' : starTxt) + '</span>';
    div.addEventListener('click', function () { sel = i; refreshSel(); startSelected(); });
    list.appendChild(div);
  });
  refreshSel();
}
function refreshSel() {
  var els = document.querySelectorAll('.lvl');
  for (var i = 0; i < els.length; i++) els[i].classList.toggle('sel', i === sel);
  var info = document.getElementById('lvlInfo');
  if (info) {
    var L = LEVELS[sel];
    var locked = sel > 0 && save.stars[sel - 1] === 0;
    info.textContent = (sel + 1) + '. ' + L.name +
      (locked ? ' \u00b7 locked' : (save.best[sel] ? ' \u00b7 best ' + save.best[sel] : ''));
  }
}
function moveSel(d) {
  sel = (sel + d + LEVELS.length) % LEVELS.length;
  refreshSel();
}
function startSelected() {
  if (sel > 0 && save.stars[sel - 1] === 0) return;   // locked
  startLevel(sel);
}
function showMenu() {
  scene = 'menu';
  buildMenu();
  document.getElementById('endcard').classList.remove('show');
  document.getElementById('menu').classList.add('show');
}

function showEnd(win, st, unused) {
  scene = 'end';
  document.getElementById('endTitle').textContent = win ? 'Fort Smashed!' : 'The foxes held out!';
  var sb = document.getElementById('starsBox');
  sb.innerHTML = '';
  for (var i = 0; i < 3; i++) {
    var sp = document.createElement('span');
    sp.className = 'star';
    sp.textContent = '\u2605';
    sb.appendChild(sp);
    if (win && i < st) {
      (function (el, j) {
        setTimeout(function () {
          el.classList.add('on');
          sfx(600 + j * 160, 0.15, 'triangle', 0.06);
        }, 350 + j * 330);
      })(sp, i);
    }
  }
  document.getElementById('endLines').innerHTML =
    '<div>Score <b>' + score + '</b></div>' +
    (unused > 0 ? '<div class="bonus">includes +' + (unused * 10000) + ' rabbit bonus</div>' : '') +
    '<div class="best">Best ' + save.best[lvIdx] + '</div>';
  var nextBtn = document.getElementById('btnNext');
  var hasNext = win && lvIdx < LEVELS.length - 1;
  nextBtn.style.display = hasNext ? '' : 'none';
  endPrimary = hasNext ? 'btnNext' : 'btnRetry';
  document.getElementById('endcard').classList.add('show');
}

/* ---------------- input ---------------- */
function ptFromEvent(e) {
  // Map screen coords into game space, accounting for the 90deg
  // rotation applied when the viewport is portrait (the R1).
  var rect = app.getBoundingClientRect();
  var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  if (rotated) {
    return { x: (e.clientY - cy) / scaleF + W / 2,
             y: H / 2 - (e.clientX - cx) / scaleF };
  }
  return { x: (e.clientX - cx) / scaleF + W / 2,
           y: (e.clientY - cy) / scaleF + H / 2 };
}

function bindInput() {
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault(); unlockAudio();
    if (scene !== 'play') return;
    var pt = ptFromEvent(e);
    if (sub === 'ready' && loaded &&
        Math.hypot(pt.x - SL.x, pt.y - SL.y) < 30) {
      sub = 'aiming';
      drag = { dx: 0, dy: 0 };
      if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
    } else if (sub === 'flight') {
      triggerAbility();
    }
  });
  cv.addEventListener('pointermove', function (e) {
    if (scene !== 'play' || sub !== 'aiming') return;
    e.preventDefault();
    var pt = ptFromEvent(e);
    var dx = pt.x - SL.x, dy = pt.y - SL.y;
    var d = Math.hypot(dx, dy);
    if (d > MAXPULL) { dx = dx / d * MAXPULL; dy = dy / d * MAXPULL; }
    if (SL.x + dx < 14) dx = 14 - SL.x;          // keep pouch on-screen (left wall)
    drag = { dx: dx, dy: dy };
  });
  var release = function (e) {
    if (scene !== 'play' || sub !== 'aiming') return;
    if (e) e.preventDefault();
    if (drag && Math.hypot(drag.dx, drag.dy) > 8) launch();
    else { drag = null; sub = 'ready'; }
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  document.addEventListener('pointerdown', unlockAudio);
  app.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* R1 hardware: PTT + scroll wheel */
  var lastSide = 0;
  window.addEventListener('sideClick', function () {
    var now = Date.now();
    if (now - lastSide < 250) return;    // double-click sends two events
    lastSide = now;
    if (scene === 'play' && sub === 'flight') triggerAbility();
    else if (scene === 'menu') startSelected();
    else if (scene === 'end') {
      var btn = document.getElementById(endPrimary);
      if (btn) btn.click();
    }
  });
  window.addEventListener('longPressStart', function () {
    if (scene === 'play') startLevel(lvIdx);
  });
  window.addEventListener('scrollUp', function () { if (scene === 'menu') moveSel(-1); });
  window.addEventListener('scrollDown', function () { if (scene === 'menu') moveSel(1); });

  /* keyboard, for browser testing */
  window.addEventListener('keydown', function (e) {
    if (e.key === ' ') {
      if (scene === 'play' && sub === 'flight') triggerAbility();
      else if (scene === 'menu') startSelected();
    } else if (e.key === 'r' || e.key === 'R') {
      if (scene === 'play') startLevel(lvIdx);
    } else if (e.key === 'ArrowUp') { if (scene === 'menu') moveSel(-1); }
    else if (e.key === 'ArrowDown') { if (scene === 'menu') moveSel(1); }
  });

  window.addEventListener('pagehide', writeSave);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' || document.hidden) writeSave();
  });

  document.getElementById('btnRetry').addEventListener('click', function () { startLevel(lvIdx); });
  document.getElementById('btnNext').addEventListener('click', function () {
    startLevel(Math.min(lvIdx + 1, LEVELS.length - 1));
  });
  document.getElementById('btnMenu').addEventListener('click', showMenu);
}

/* ---------------- drawing ---------------- */
var CLOUDS = [{ x: 64, y: 40, s: 1 }, { x: 158, y: 24, s: 0.7 }, { x: 236, y: 52, s: 0.85 }];
var SPECK = [];
(function () { for (var i = 0; i < 14; i++) SPECK.push({ x: (i * 53 + 9) % W, y: GY + 8 + ((i * 29) % 14) }); })();

function ellipsePath(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function drawSky() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6fb7e8');
  g.addColorStop(0.55, '#a8dcf5');
  g.addColorStop(1, '#cfeede');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sun
  ctx.fillStyle = 'rgba(255,224,138,0.45)';
  ctx.beginPath(); ctx.arc(W - 28, 26, 22, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath(); ctx.arc(W - 28, 26, 13, 0, 7); ctx.fill();
  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (var i = 0; i < CLOUDS.length; i++) {
    var c = CLOUDS[i];
    ctx.beginPath();
    ctx.arc(c.x, c.y, 9 * c.s, 0, 7);
    ctx.arc(c.x + 10 * c.s, c.y - 4 * c.s, 7 * c.s, 0, 7);
    ctx.arc(c.x + 20 * c.s, c.y, 8 * c.s, 0, 7);
    ctx.fill();
  }
  // distant hills
  ctx.fillStyle = '#8ec9a0';
  ellipsePath(70, GY + 8, 95, 26); ctx.fill();
  ctx.fillStyle = '#7bbd8f';
  ellipsePath(215, GY + 10, 105, 30); ctx.fill();
  // ground
  ctx.fillStyle = '#5fae3c';
  ctx.fillRect(0, GY, W, 7);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(0, GY + 7, W, H - GY - 7);
  ctx.fillStyle = 'rgba(60,38,18,0.5)';
  for (var j = 0; j < SPECK.length; j++) ctx.fillRect(SPECK[j].x, SPECK[j].y, 2, 2);
}

function drawPlatforms() {
  for (var i = 0; i < platforms.length; i++) {
    var p = platforms[i];
    if (p.ground) continue;
    ctx.fillStyle = '#8a5a33';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#5fae3c';
    ctx.fillRect(p.x, p.y, p.w, 3);
    ctx.fillStyle = 'rgba(60,38,18,0.6)';
    ctx.fillRect(p.x, p.y + p.h - 2, p.w, 2);
  }
}

function drawBlock(b) {
  var m = MATS[b.mat];
  ctx.save();
  if (b.ang) {
    ctx.translate(b.x + b.w / 2, b.y + b.h);
    ctx.rotate(b.ang);
    ctx.translate(-(b.x + b.w / 2), -(b.y + b.h));
  }
  ctx.fillStyle = b.mat === 'glass' ? 'rgba(185,225,245,0.8)' : m.c1;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = m.c2; ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  if (b.mat === 'wood') {
    ctx.strokeStyle = 'rgba(122,74,30,0.55)';
    ctx.beginPath();
    if (b.w >= b.h) { ctx.moveTo(b.x + 2, b.y + b.h / 2); ctx.lineTo(b.x + b.w - 2, b.y + b.h / 2); }
    else { ctx.moveTo(b.x + b.w / 2, b.y + 2); ctx.lineTo(b.x + b.w / 2, b.y + b.h - 2); }
    ctx.stroke();
  } else if (b.mat === 'glass') {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(b.x + 2, b.y + b.h - 3);
    ctx.lineTo(b.x + Math.min(b.w, b.h) * 0.7, b.y + 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(80,86,94,0.5)';
    ctx.fillRect(b.x + 3, b.y + 3, 2, 2);
    ctx.fillRect(b.x + b.w - 6, b.y + b.h - 6, 2, 2);
  }
  var ratio = b.hp / MATS[b.mat].hp;
  if (ratio < 0.66) drawCrack(b, 1);
  if (ratio < 0.33) drawCrack(b, -1);
  ctx.restore();
}
function drawCrack(b, dir) {
  ctx.strokeStyle = 'rgba(30,22,14,0.65)'; ctx.lineWidth = 1;
  var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + dir * b.w * 0.3, cy - b.h * 0.28);
  ctx.lineTo(cx + dir * b.w * 0.42, cy - b.h * 0.45);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - dir * b.w * 0.25, cy + b.h * 0.3);
  ctx.stroke();
}

function drawFox(f) {
  ctx.save();
  ctx.translate(f.x, f.y);
  var r = f.r;
  ctx.fillStyle = '#e8843a'; ctx.strokeStyle = '#b65f22'; ctx.lineWidth = 1;
  var s;
  for (var i = 0; i < 2; i++) {
    s = i === 0 ? -1 : 1;
    var tw = Math.sin(frame * 0.11 + f.blink + i * 2.3);
    tw = tw > 0.82 ? (tw - 0.82) * 2.4 : 0;
    ctx.save();
    ctx.translate(s * r * 0.5, -r * 0.55);
    ctx.rotate(s * tw * 0.45);
    ctx.beginPath();
    ctx.moveTo(s * r * 0.4, r * 0.15);
    ctx.lineTo(s * r * 0.1, -r * 1.25);
    ctx.lineTo(-s * r * 0.35, -r * 0.2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fdf3e3';
  ellipsePath(0, r * 0.42, r * 0.62, r * 0.5); ctx.fill();
  if ((frame + f.blink) % 190 < 10) {
    ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.15); ctx.lineTo(-r * 0.15, -r * 0.15);
    ctx.moveTo(r * 0.15, -r * 0.15); ctx.lineTo(r * 0.55, -r * 0.15);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.15, r * 0.26, 0, 7);
    ctx.arc(r * 0.35, -r * 0.15, r * 0.26, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.13, r * 0.12, 0, 7);
    ctx.arc(r * 0.4, -r * 0.13, r * 0.12, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#3a2314';
  ctx.beginPath(); ctx.arc(0, r * 0.28, r * 0.14, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, r * 0.4, r * 0.32, 0.25, Math.PI - 0.25); ctx.stroke();
  ctx.restore();
}

function drawRabbit(key, x, y, rot, r) {
  var t = TYPES[key];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  var er = r * 0.42, s;
  for (var i = 0; i < 2; i++) {
    s = i === 0 ? -1 : 1;
    ctx.save();
    ctx.rotate(s * (0.22 + Math.sin(frame * 0.13 + s * 1.7) * 0.08));
    ctx.fillStyle = t.c; ctx.strokeStyle = t.c2; ctx.lineWidth = 1;
    ellipsePath(s * r * 0.42, -r * 1.5, er, r * 1.05); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f4a9b8';
    ellipsePath(s * r * 0.42, -r * 1.42, er * 0.45, r * 0.7); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = t.c; ctx.strokeStyle = t.c2; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ellipsePath(0, r * 0.38, r * 0.55, r * 0.42); ctx.fill();
  var ex = r * 0.36, ey = -r * 0.18, es = Math.max(1.6, r * 0.24);
  if ((frame + ((r * 37) | 0)) % 200 < 8) {
    ctx.strokeStyle = '#33222a'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-ex - es * 0.7, ey); ctx.lineTo(-ex + es * 0.7, ey);
    ctx.moveTo(ex - es * 0.7, ey); ctx.lineTo(ex + es * 0.7, ey);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-ex, ey, es, 0, 7);
    ctx.arc(ex, ey, es, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-ex + es * 0.3, ey, es * 0.45, 0, 7);
    ctx.arc(ex + es * 0.3, ey, es * 0.45, 0, 7);
    ctx.fill();
  }
  ctx.strokeStyle = '#33222a'; ctx.lineWidth = Math.max(1.2, r * 0.16); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-ex - es, ey - es * 1.4); ctx.lineTo(-ex + es * 0.7, ey - es * 0.5);
  ctx.moveTo(ex + es, ey - es * 1.4); ctx.lineTo(ex - es * 0.7, ey - es * 0.5);
  ctx.stroke();
  ctx.fillStyle = '#e07a8a';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.12); ctx.lineTo(-r * 0.14, -r * 0.02); ctx.lineTo(r * 0.14, -r * 0.02);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.6;
  ctx.fillRect(-r * 0.14, r * 0.16, r * 0.28, r * 0.3);
  ctx.strokeRect(-r * 0.14, r * 0.16, r * 0.28, r * 0.3);
  ctx.restore();
}

function drawBomb(p) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = '#2e2e38'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(2, -p.r - 4); ctx.stroke();
  ctx.fillStyle = frame % 6 < 3 ? '#ffcf5a' : '#ff8a3a';
  ctx.beginPath(); ctx.arc(2, -p.r - 5, 1.6, 0, 7); ctx.fill();
  ctx.restore();
}

function drawSlingWood() {
  ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(SL.x, GY + 2);
  ctx.lineTo(SL.x, SL.y + 16);
  ctx.lineTo(SL.x - 10, SL.y - 4);
  ctx.moveTo(SL.x, SL.y + 16);
  ctx.lineTo(SL.x + 10, SL.y - 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,222,170,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(SL.x - 1, GY);
  ctx.lineTo(SL.x - 1, SL.y + 15);
  ctx.stroke();
}

function band(fx, fy, x, y) {
  ctx.strokeStyle = '#7a2d2d'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(x, y); ctx.stroke();
}

function drawTraj() {
  if (!drag) return;
  var x = SL.x + drag.dx, y = SL.y + drag.dy;
  var vx = -drag.dx * POWER, vy = -drag.dy * POWER;
  ctx.lineWidth = 1;
  for (var i = 0; i < 46; i++) {
    vy += GRAV; x += vx; y += vy;
    if (i % 2 === 0) {
      ctx.globalAlpha = Math.max(0.4, 1 - i * 0.014);
      ctx.beginPath(); ctx.arc(x, y, 2.3, 0, 7);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = 'rgba(58,42,24,0.85)'; ctx.stroke();
    }
    if (y > GY) break;
  }
  ctx.globalAlpha = 1;
}

function drawLoaded() {
  var fLx = SL.x - 10, fLy = SL.y - 4, fRx = SL.x + 10, fRy = SL.y - 4;
  if (scene !== 'menu' && loaded && (sub === 'ready' || sub === 'aiming')) {
    var bob = sub === 'ready' ? Math.sin(frame * 0.09) * 1.2 : 0;
    var px = SL.x + (drag ? drag.dx : 0);
    var py = SL.y + (drag ? drag.dy : 0) + bob;
    if (sub === 'aiming') drawTraj();
    band(fRx, fRy, px, py);
    drawRabbit(loaded, px, py, drag ? Math.atan2(-drag.dy, -drag.dx) * 0.15 : 0, TYPES[loaded].r);
    band(fLx, fLy, px, py);
  } else {
    ctx.strokeStyle = '#7a2d2d'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fLx, fLy);
    ctx.quadraticCurveTo(SL.x, SL.y + 5, fRx, fRy);
    ctx.stroke();
  }
}

function drawQueueMinis() {
  for (var i = 0; i < queue.length; i++) {
    var k = queue[i];
    var r = Math.min(5.5, TYPES[k].r * 0.72);
    drawRabbit(k, 12 + i * 15, GY - r + 2, 0, r);
  }
}

function drawParts() {
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    ctx.globalAlpha = Math.min(1, p.life / 18);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
  }
  ctx.globalAlpha = 1;
}

function drawTexts() {
  ctx.font = '800 9px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (var i = 0; i < texts.length; i++) {
    var t = texts[i];
    ctx.globalAlpha = Math.min(1, t.life / 22);
    ctx.strokeStyle = 'rgba(58,42,24,0.9)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.strokeText(t.t, t.x, t.y);
    ctx.fillStyle = '#f5a623';
    ctx.fillText(t.t, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  ctx.font = '800 10px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#3a2a18';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE ' + score, 5, 5);
  ctx.textAlign = 'right';
  ctx.fillText('BEST ' + (save.best[lvIdx] || 0), W - 5, 5);
  if (bannerT > 0 && scene === 'play') {
    ctx.globalAlpha = Math.min(1, bannerT / 25);
    ctx.textAlign = 'center';
    ctx.font = '900 15px sans-serif';
    ctx.strokeStyle = 'rgba(58,42,24,0.9)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.fillStyle = '#fff';
    var nm = 'Level ' + (lvIdx + 1) + ' \u00b7 ' + LEVELS[lvIdx].name;
    ctx.strokeText(nm, W / 2, 30);
    ctx.fillText(nm, W / 2, 30);
    ctx.globalAlpha = 1;
  }
  if (hintT > 0 && sub === 'ready') {
    ctx.textAlign = 'center';
    ctx.font = '700 9px sans-serif';
    ctx.fillStyle = 'rgba(255,248,230,0.92)';
    ctx.fillText('drag the rabbit, release to fire', W / 2, GY + 14);
  }
  if (sub === 'flight') {
    var showTap = false;
    for (var i = 0; i < projs.length; i++) {
      var p = projs[i];
      if (!p.bomb && !p.abUsed && TYPES[p.type].ab !== 'none') { showTap = true; break; }
    }
    if (showTap) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(frame * 0.28);
      ctx.textAlign = 'center';
      ctx.font = '900 11px sans-serif';
      ctx.fillStyle = '#c94f2e';
      ctx.fillText('TAP = ABILITY', W / 2, 20);
      ctx.globalAlpha = 1;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawSky();
  ctx.save();
  if (shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shake *= 0.88;
  } else shake = 0;
  drawPlatforms();
  drawSlingWood();
  if (scene !== 'menu') drawQueueMinis();
  var i;
  for (i = 0; i < blocks.length; i++) if (!blocks[i].dead) drawBlock(blocks[i]);
  for (i = 0; i < foxes.length; i++) if (!foxes[i].dead) drawFox(foxes[i]);
  for (i = 0; i < projs.length; i++) {
    var p = projs[i];
    if (p.dead) continue;
    if (p.bomb) drawBomb(p);
    else {
      drawRabbit(p.type, p.x, p.y, p.rot, p.r);
      if (p.fuse > 0 && frame % 8 < 4) {
        ctx.fillStyle = 'rgba(255,90,60,0.35)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 3, 0, 7); ctx.fill();
      }
    }
  }
  drawLoaded();
  drawParts();
  drawTexts();
  ctx.restore();
  if (scene === 'menu') {
    drawRabbit('rusty', 58, GY - 7, 0, 7);
    drawFox({ x: 246, y: GY - 6.5, r: 6.5, blink: 40 });
  }
  drawHUD();
}

/* ---------------- boot ---------------- */
function fit() {
  var iw = window.innerWidth, ih = window.innerHeight;
  rotated = ih > iw;              // portrait viewport (the R1) -> rotate 90deg
  var s = rotated ? Math.min(iw / H, ih / W) : Math.min(iw / W, ih / H);
  s = Math.max(0.5, Math.floor(s * 4) / 4);
  scaleF = s;
  app.style.transform = 'translate(-50%, -50%)' +
    (rotated ? ' rotate(180deg)' : '') + ' scale(' + s + ')';
}

function loop() {
  if (scene === 'play') updatePlay();
  else { frame++; stepParts(); }
  draw();
  requestAnimationFrame(loop);
}

function init() {
  app = document.getElementById('app');
  cv = document.getElementById('game');
  ctx = cv.getContext('2d');
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  fit();
  window.addEventListener('resize', fit);
  bindInput();
  loadSave().then(function () {
    buildMenu();
    requestAnimationFrame(loop);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
