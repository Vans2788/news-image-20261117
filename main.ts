// A news-image-daily entry (Node 22, standard library only): the program draws
// a 1024x1024 front-page poster summing up Tuesday 17 November 2026 and writes
// it to /output/entry.png. No network, no randomness, no timestamps: two runs
// write byte-identical output.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node's standard library has no image drawing, so this file carries its own
// PNG encoder (signature, IHDR, IDAT via zlib deflate, IEND, CRC32) and a
// small 5x7 bitmap font rasterised onto a pixel buffer.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

// ---------------------------------------------------------------- palette
const PAPER = [247, 243, 234];
const INK = [20, 20, 20];
const RED = [185, 28, 28];
const WHITE = [255, 255, 255];
const GREY = [90, 90, 90];
const SKY = [214, 232, 245];
const SEA = [38, 98, 140];
const SEA_LIGHT = [90, 150, 190];
const SAND = [232, 220, 196];
const NAVY = [30, 58, 95];
const TEAL = [15, 118, 110];
const OCHRE = [180, 83, 9];
const SLATE = [51, 65, 85];
const CRIMSON = [159, 18, 57];
const FOREST = [22, 101, 52];
const SUN = [245, 190, 60];
const STEEL = [120, 130, 140];
const DARK_SKY = [16, 28, 52];

// ---------------------------------------------------------------- pixels
function setPx(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function fillRect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPx(i, j, c);
}
function fillCircle(cx, cy, r, c) {
  for (let y = cy - r; y <= cy + r; y++) {
    const dy = y - cy;
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let x = cx - dx; x <= cx + dx; x++) setPx(x, y, c);
  }
}
function line(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function fillPoly(pts, c) {
  // scanline fill of a simple polygon given as [[x,y], ...]
  let minY = H, maxY = 0;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(Math.round(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) setPx(x, y, c);
    }
  }
}

// ---------------------------------------------------------------- font
// 5x7 bitmap font on an 8-row cell (row 6 is the baseline; row 7 holds
// descenders). '#' is on, '.' is off. Lowercase x-height letters sit on
// rows 2-6, ascenders reach row 0, descenders reach row 7.
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#', '.....'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.', '.....'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####', '.....'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.', '.....'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####', '.....'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....', '.....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.', '.....'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#', '.....'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.', '.....'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..', '.....'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#', '.....'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####', '.....'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#', '.....'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#', '.....'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.', '.....'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....', '.....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#', '.....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#', '.....'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.', '.....'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '.....'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.', '.....'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..', '.....'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#', '.....'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#', '.....'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..', '.....'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####', '.....'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.', '.....'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.', '.....'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####', '.....'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.', '.....'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.', '.....'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.', '.....'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.', '.....'],
  '7': ['#####', '....#', '...#.', '...#.', '..#..', '..#..', '..#..', '.....'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.', '.....'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.', '.....'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.###.', '.....'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.', '.....'],
  c: ['.....', '.....', '.####', '#....', '#....', '#....', '.####', '.....'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####', '.....'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.', '.....'],
  f: ['..##.', '.#...', '.#...', '#####', '.#...', '.#...', '.#...', '.....'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#', '.....'],
  i: ['.....', '..#..', '.....', '..#..', '..#..', '..#..', '.###.', '.....'],
  j: ['.....', '...#.', '.....', '..##.', '...#.', '...#.', '...#.', '..##.'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '.....'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.', '.....'],
  m: ['.....', '.....', '#.#.#', '##.##', '#.#.#', '#.#.#', '#.#.#', '.....'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#', '.....'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.', '.....'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....', '.....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.', '.....'],
  t: ['.#...', '.#...', '#####', '.#...', '.#...', '.#...', '..##.', '.....'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '.....'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..', '.....'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.', '.....'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '.##..', '.....'],
  ',': ['.....', '.....', '.....', '.....', '.....', '.....', '.##..', '.#...'],
  ':': ['.....', '.....', '.##..', '.....', '.....', '.##..', '.....', '.....'],
  ';': ['.....', '.....', '.##..', '.....', '.....', '.##..', '.#...', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..', '.....'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..', '.....'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.', '.....'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...', '.....'],
  '&': ['.###.', '#...#', '#.#..', '.#...', '#.#.#', '#..#.', '.###.', '.....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.#..', '#..##', '.....'],
  $: ['..#..', '.####', '#.#.#', '.###.', '..#.#', '####.', '..#..', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....', '.....'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....', '.....'],
};

function textWidth(s, scale) {
  return s.length * 6 * scale;
}
function drawText(s, x, y, scale, c) {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] || FONT['?'];
    for (let r = 0; r < 8; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '#') fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(s, cx, y, scale, c) {
  drawText(s, Math.round(cx - textWidth(s, scale) / 2), y, scale, c);
}
function wrapText(s, maxW, scale) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur === '' ? w : cur + ' ' + w;
    if (textWidth(test, scale) <= maxW) {
      cur = test;
    } else {
      if (cur !== '') lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- PNG
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(b) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(buf.subarray(y * W * 3, (y + 1) * W * 3)).copy(raw, y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- scenes
// Each scene draws inside the box (x, y, w, h). Simple flat vector art:
// recognisable shapes, high contrast, no fine detail.
function sceneBridge(x, y, w, h) {
  fillRect(x, y, w, h, SKY);
  fillRect(x, y + Math.round(h * 0.62), w, h - Math.round(h * 0.62), SEA);
  // deck: two spans with a broken gap in the middle
  const deckY = y + Math.round(h * 0.52);
  fillRect(x, deckY, Math.round(w * 0.38), 8, INK);
  fillRect(x + Math.round(w * 0.62), deckY, Math.round(w * 0.38), 8, INK);
  // falling broken piece, tilted
  fillPoly([
    [x + Math.round(w * 0.44), deckY + 6],
    [x + Math.round(w * 0.56), deckY + 2],
    [x + Math.round(w * 0.58), deckY + 14],
    [x + Math.round(w * 0.46), deckY + 18],
  ], INK);
  // towers
  fillRect(x + Math.round(w * 0.16), y + 8, 8, deckY - y - 8, INK);
  fillRect(x + Math.round(w * 0.78), y + 8, 8, deckY - y - 8, INK);
  // cables
  line(x + Math.round(w * 0.16) + 4, y + 8, x + 6, deckY, INK);
  line(x + Math.round(w * 0.16) + 4, y + 8, x + Math.round(w * 0.38), deckY, INK);
  line(x + Math.round(w * 0.78) + 4, y + 8, x + Math.round(w * 0.62), deckY, INK);
  line(x + Math.round(w * 0.78) + 4, y + 8, x + w - 6, deckY, INK);
  // smoke above the gap
  fillCircle(x + Math.round(w * 0.5), y + 14, 10, GREY);
  fillCircle(x + Math.round(w * 0.46), y + 20, 8, GREY);
  fillCircle(x + Math.round(w * 0.55), y + 20, 8, GREY);
  // water lines
  line(x + 8, y + h - 12, x + w - 8, y + h - 12, SEA_LIGHT);
  line(x + 20, y + h - 6, x + w - 20, y + h - 6, SEA_LIGHT);
}
function sceneHormuz(x, y, w, h) {
  fillRect(x, y, w, h, SKY);
  fillRect(x, y + Math.round(h * 0.55), w, h - Math.round(h * 0.55), SEA);
  // tanker 1 (left)
  const t1y = y + Math.round(h * 0.42);
  fillPoly([
    [x + 14, t1y], [x + 150, t1y], [x + 138, t1y + 22], [x + 26, t1y + 22],
  ], INK);
  fillRect(x + 96, t1y - 16, 34, 16, WHITE);
  fillRect(x + 106, t1y - 26, 10, 10, RED);
  // tanker 2 (right, smaller)
  const t2y = y + Math.round(h * 0.5);
  fillPoly([
    [x + w - 150, t2y], [x + w - 16, t2y], [x + w - 28, t2y + 18], [x + w - 138, t2y + 18],
  ], STEEL);
  fillRect(x + w - 60, t2y - 12, 26, 12, WHITE);
  // mine near tanker 1
  const mx = x + 168, my = y + Math.round(h * 0.66);
  fillCircle(mx, my, 9, INK);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    line(mx, my, Math.round(mx + Math.cos(ang) * 15), Math.round(my + Math.sin(ang) * 15), INK);
  }
  // explosion star above the mine
  fillCircle(mx + 26, my - 26, 6, SUN);
  line(mx + 26, my - 38, mx + 26, my - 14, SUN);
  line(mx + 14, my - 26, mx + 38, my - 26, SUN);
  line(mx + 17, my - 35, mx + 35, my - 17, SUN);
  line(mx + 35, my - 35, mx + 17, my - 17, SUN);
  // waves
  line(x + 8, y + h - 10, x + w - 8, y + h - 10, SEA_LIGHT);
}
function sceneManila(x, y, w, h) {
  fillRect(x, y, w, h, SKY);
  fillCircle(x + w - 42, y + 20, 16, SUN);
  // skyline
  const base = y + h;
  const builds = [
    [0, 0.42, 0.16], [0.18, 0.62, 0.14], [0.34, 0.5, 0.16],
    [0.52, 0.7, 0.14], [0.68, 0.55, 0.16], [0.86, 0.45, 0.14],
  ];
  for (const b of builds) {
    const bx = x + Math.round(w * b[0]);
    const bw = Math.round(w * b[2]);
    const bh = Math.round(h * b[1]);
    fillRect(bx, base - bh, bw, bh, SLATE);
    for (let wy = base - bh + 8; wy < base - 10; wy += 14) {
      for (let wx = bx + 6; wx < bx + bw - 6; wx += 12) {
        fillRect(wx, wy, 5, 6, SUN);
      }
    }
  }
  // three flags on poles in front (each with a thin ink border so the
  // white flag still reads against the sky)
  const flags = [RED, WHITE, [0, 56, 168]];
  for (let i = 0; i < 3; i++) {
    const fx = x + 40 + i * 52;
    line(fx, y + h - 34, fx, y + h - 78, INK);
    fillRect(fx, y + h - 78, 30, 18, flags[i]);
    line(fx, y + h - 78, fx + 29, y + h - 78, INK);
    line(fx, y + h - 61, fx + 29, y + h - 61, INK);
    line(fx, y + h - 78, fx, y + h - 61, INK);
    line(fx + 29, y + h - 78, fx + 29, y + h - 61, INK);
  }
}
function sceneVulcan(x, y, w, h) {
  fillRect(x, y, w, h, DARK_SKY);
  // stars (fixed positions)
  const stars = [[0.08, 0.12], [0.22, 0.06], [0.38, 0.16], [0.55, 0.08], [0.72, 0.14], [0.88, 0.06], [0.94, 0.3], [0.12, 0.34], [0.3, 0.3], [0.62, 0.3], [0.82, 0.34]];
  for (const s of stars) fillRect(x + Math.round(w * s[0]), y + Math.round(h * s[1]), 3, 3, WHITE);
  // falling rocket, tilted: body as a rotated rectangle via polygon
  const cx = x + Math.round(w * 0.5), cy = y + Math.round(h * 0.45);
  fillPoly([
    [cx - 34, cy - 6], [cx + 26, cy - 22], [cx + 34, cy - 14], [cx - 26, cy + 2],
  ], WHITE);
  fillPoly([
    [cx + 26, cy - 22], [cx + 42, cy - 16], [cx + 34, cy - 14],
  ], RED);
  fillPoly([
    [cx - 34, cy - 6], [cx - 26, cy + 2], [cx - 22, cy - 6],
  ], STEEL);
  // flame at the base
  fillCircle(cx - 38, cy + 6, 10, SUN);
  fillCircle(cx - 44, cy + 8, 6, RED);
  // debris: broken satellite pieces
  fillRect(x + 24, y + h - 30, 22, 8, STEEL);
  fillRect(x + 52, y + h - 22, 12, 6, WHITE);
  fillRect(x + w - 60, y + h - 34, 18, 7, STEEL);
  fillCircle(x + w - 40, y + h - 18, 4, SUN);
  // ground line
  line(x, y + h - 4, x + w, y + h - 4, WHITE);
}
function sceneBank(x, y, w, h) {
  fillRect(x, y, w, h, SAND);
  // bank facade
  const bx = x + Math.round(w * 0.22), bw = Math.round(w * 0.56);
  const base = y + h - 8;
  fillRect(bx, y + 26, bw, base - (y + 26), WHITE);
  // pediment
  fillPoly([
    [bx - 8, y + 26], [bx + bw + 8, y + 26], [bx + bw / 2, y + 6],
  ], INK);
  // columns
  for (let i = 0; i < 4; i++) {
    const colx = bx + 14 + i * Math.round((bw - 28) / 3);
    fillRect(colx, y + 34, 12, base - (y + 34), STEEL);
  }
  // red lightning bolt striking the facade
  fillPoly([
    [x + Math.round(w * 0.62), y + 2],
    [x + Math.round(w * 0.52), y + 34],
    [x + Math.round(w * 0.6), y + 34],
    [x + Math.round(w * 0.5), y + 66],
    [x + Math.round(w * 0.68), y + 26],
    [x + Math.round(w * 0.6), y + 26],
  ], RED);
  // terminal screen at the foot of the steps
  fillRect(x + 14, base - 22, 64, 22, INK);
  drawText('BUG', x + 22, base - 19, 2, RED);
}
function scenePentagon(x, y, w, h) {
  fillRect(x, y, w, h, SKY);
  // red ring (audit stamp) first, then the pentagon building on top of it:
  // the ring's inner fill used to erase the building drawn underneath.
  const cx = x + Math.round(w * 0.5), cy = y + Math.round(h * 0.48);
  const R = Math.round(h * 0.34);
  fillCircle(cx, cy, R + 14, RED);
  fillCircle(cx, cy, R + 8, SKY);
  // pentagon building (top view)
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push([Math.round(cx + R * Math.cos(a)), Math.round(cy + R * Math.sin(a))]);
  }
  fillPoly(pts, STEEL);
  fillPoly([
    [Math.round(cx - R * 0.45), Math.round(cy - R * 0.2)],
    [Math.round(cx + R * 0.45), Math.round(cy - R * 0.2)],
    [Math.round(cx + R * 0.28), Math.round(cy + R * 0.36)],
    [Math.round(cx - R * 0.28), Math.round(cy + R * 0.36)],
  ], [200, 210, 218]);
  fillCircle(cx, cy, Math.round(R * 0.22), WHITE);
  // red cross through the ring
  line(cx - R - 8, cy - R - 8, cx + R + 8, cy + R + 8, RED);
  line(cx + R + 8, cy - R - 8, cx - R - 8, cy + R + 8, RED);
}

// ---------------------------------------------------------------- layout
const PANELS = [
  {
    kicker: 'UKRAINE', color: NAVY, scene: sceneBridge,
    headline: 'KERCH BRIDGE HIT',
    caption: 'Ukraine struck the bridge to Crimea; a road span collapsed. Russia hit bridges in Kyiv.',
  },
  {
    kicker: 'MIDDLE EAST', color: TEAL, scene: sceneHormuz,
    headline: 'MINES IN THE STRAIT',
    caption: 'Two tankers hit mines in the Strait of Hormuz. Drones fired at a US radar in Bahrain were intercepted.',
  },
  {
    kicker: 'ASIA', color: OCHRE, scene: sceneManila,
    headline: 'TRUMP IN MANILA',
    caption: 'Trump arrived for the ASEAN summit and signed a trade statement with Thailand.',
  },
  {
    kicker: 'SPACE', color: SLATE, scene: sceneVulcan,
    headline: 'VULCAN ROCKET LOST',
    caption: "ULA's Vulcan failed, destroying 40 Amazon Leo satellites.",
  },
  {
    kicker: 'MARKETS', color: CRIMSON, scene: sceneBank,
    headline: 'A BUG, NOT HACKERS',
    caption: "JPMorgan blamed a software bug for Monday's banking outage.",
  },
  {
    kicker: 'WASHINGTON', color: FOREST, scene: scenePentagon,
    headline: 'NINTH FAILED AUDIT',
    caption: 'The Pentagon failed its financial audit for the 9th straight year.',
  },
];

function drawPanel(p, px, py, pw, ph) {
  // border
  fillRect(px, py, pw, ph, INK);
  fillRect(px + 2, py + 2, pw - 4, ph - 4, WHITE);
  // kicker strip
  fillRect(px + 2, py + 2, pw - 4, 30, p.color);
  drawText(p.kicker, px + 14, py + 8, 2, WHITE);
  // scene
  const sx = px + 10, sy = py + 40, sw = pw - 20, sh = 92;
  p.scene(sx, sy, sw, sh);
  // headline (up to 2 lines, scale 3)
  const hlines = wrapText(p.headline, pw - 28, 3);
  let ty = py + 142;
  for (const ln of hlines.slice(0, 2)) {
    drawText(ln, px + 14, ty, 3, INK);
    ty += 27;
  }
  // caption (up to 3 lines, scale 2)
  const clines = wrapText(p.caption, pw - 28, 2);
  ty += 4;
  for (const ln of clines.slice(0, 3)) {
    drawText(ln, px + 14, ty, 2, INK);
    ty += 18;
  }
}

function draw() {
  fillRect(0, 0, W, H, PAPER);
  // masthead
  fillRect(28, 28, W - 56, 6, RED);
  drawTextCentered('THE WORLD IN ONE DAY', W / 2, 44, 2, RED);
  drawTextCentered('TUESDAY 17 NOVEMBER 2026', W / 2, 66, 6, INK);
  fillRect(28, 124, W - 56, 4, RED);
  fillRect(28, 132, W - 56, 2, INK);
  // panels: 2 columns x 3 rows
  const pw = 476, ph = 244;
  const xs = [28, 520];
  const ys = [148, 408, 668];
  for (let i = 0; i < 6; i++) {
    drawPanel(PANELS[i], xs[i % 2], ys[Math.floor(i / 2)], pw, ph);
  }
  // also-today strip
  const sy = 928;
  fillRect(28, sy, W - 56, 68, INK);
  drawText('ALSO TODAY:', 44, sy + 10, 2, SUN);
  const strip = "Nvidia reports earnings after the close, its first since Jensen Huang's exit. A third US carrier arrived in the region.";
  const slines = wrapText(strip, W - 56 - 32, 2);
  let sty = sy + 32;
  for (const ln of slines.slice(0, 2)) {
    drawText(ln, 44, sty, 2, WHITE);
    sty += 18;
  }
}

// ---------------------------------------------------------------- main
draw();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG());
