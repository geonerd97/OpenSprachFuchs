"use strict";
/* ---------- QR codes ----------
   A small encoder for error correction level M, versions 1–10, in alphanumeric mode (the account key, e.g.
   "K7QM-4XD2-PL9A-H3TV", fits version 1) or byte mode with UTF-8 (the friend link with code and name), best of the
   eight masks. A phone's camera app reads both. */
const QR_ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
// Per version (level M): error correction codewords per block, and the blocks as [count, data codewords].
const QR_M = [null, [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]], [16, [[4, 27]]],
  [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]], [26, [[4, 43], [1, 44]]]];
const QR_ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

function qrMatrix(text) {
  text = String(text);
  const alnum = [...text].every(c => QR_ALNUM.includes(c)), bytes = alnum ? null : [...new TextEncoder().encode(text)];
  const count = alnum ? text.length : bytes.length;
  // Pick the smallest version that holds the text.
  let v = 0, dataLen = 0;
  for (let t = 1; t <= 10 && !v; t++) {
    const cap = QR_M[t][1].reduce((a, [n, d]) => a + n * d, 0) * 8;
    const need = 4 + (alnum ? (t < 10 ? 9 : 11) : (t < 10 ? 8 : 16)) + (alnum ? 11 * Math.floor(count / 2) + 6 * (count % 2) : 8 * count);
    if (need <= cap) { v = t; dataLen = cap / 8; }
  }
  if (!v) return null;
  const bits = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  if (alnum) {
    put(0b0010, 4); put(count, v < 10 ? 9 : 11);
    for (let i = 0; i < count; i += 2) {
      const a = QR_ALNUM.indexOf(text[i]);
      if (i + 1 < count) put(a * 45 + QR_ALNUM.indexOf(text[i + 1]), 11); else put(a, 6);
    }
  } else { put(0b0100, 4); put(count, v < 10 ? 8 : 16); for (const b of bytes) put(b, 8); }
  put(0, Math.min(4, dataLen * 8 - bits.length)); // terminator
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let k = 0; data.length < dataLen; k++) data.push(k % 2 ? 0x11 : 0xEC);
  // Reed–Solomon over GF(256), polynomial 0x11D, per block; then data and error correction are interleaved.
  const EXP = [], LOG = [];
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  const [ecLen, groups] = QR_M[v];
  let gen = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(gen.length + 1).fill(0);
    gen.forEach((g, j) => { next[j] ^= g; next[j + 1] ^= mul(g, EXP[i]); });
    gen = next;
  }
  const blocks = [];
  let pos = 0;
  for (const [n, d] of groups) for (let b = 0; b < n; b++) {
    const part = data.slice(pos, pos + d), ec = new Array(ecLen).fill(0); pos += d;
    for (const x of part) { const f = x ^ ec.shift(); ec.push(0); for (let j = 0; j < ecLen; j++) ec[j] ^= mul(gen[j + 1], f); }
    blocks.push([part, ec]);
  }
  const codewords = [];
  for (let i = 0; i < Math.max(...blocks.map(b => b[0].length)); i++) for (const [part] of blocks) if (i < part.length) codewords.push(part[i]);
  for (let i = 0; i < ecLen; i++) for (const [, ec] of blocks) codewords.push(ec[i]);
  // Function patterns: finders with separators, timing lines, alignment patterns, dark module, format and version areas.
  const N = 17 + 4 * v, m = [...Array(N)].map(() => new Array(N).fill(null));
  const finder = (r, c) => {
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
      const rr = r + y, cc = c + x, ring = Math.max(Math.abs(y - 3), Math.abs(x - 3));
      if (rr >= 0 && cc >= 0 && rr < N && cc < N) m[rr][cc] = ring !== 2 && ring !== 4;
    }
  };
  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  for (let i = 8; i < N - 8; i++) m[6][i] = m[i][6] = i % 2 === 0;
  const al = QR_ALIGN[v];
  for (const r of al) for (const c of al) {
    if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) m[r + y][c + x] = Math.max(Math.abs(y), Math.abs(x)) !== 1;
  }
  const fmtCells = [];
  for (let i = 0; i <= 5; i++) fmtCells.push([i, 8]);
  fmtCells.push([7, 8], [8, 8], [8, 7]);
  for (let i = 9; i < 15; i++) fmtCells.push([8, 14 - i]);
  for (let i = 0; i < 8; i++) fmtCells.push([8, N - 1 - i]);
  for (let i = 8; i < 15; i++) fmtCells.push([N - 15 + i, 8]);
  for (const [r, c] of fmtCells) m[r][c] = false;
  m[N - 8][8] = true; // dark module
  if (v >= 7) {
    let rem = v;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1F25);
    const vbits = (v << 12) | rem;
    for (let i = 0; i < 18; i++) { const on = ((vbits >> i) & 1) === 1, a = Math.floor(i / 3), b = N - 11 + (i % 3); m[a][b] = on; m[b][a] = on; }
  }
  // Data in the zigzag columns from the bottom right (unmasked for now); left-over modules stay light.
  const dbits = [], isData = [...Array(N)].map(() => new Array(N).fill(false));
  for (const b of codewords) for (let i = 7; i >= 0; i--) dbits.push((b >> i) & 1);
  let k = 0, up = true;
  for (let c = N - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let s = 0; s < N; s++) {
      const r = up ? N - 1 - s : s;
      for (const cc of [c, c - 1]) {
        if (m[r][cc] !== null) continue;
        m[r][cc] = (k < dbits.length ? dbits[k] : 0) === 1; isData[r][cc] = true; k++;
      }
    }
    up = !up;
  }
  // Try all eight masks with their format bits and keep the one with the lowest penalty (readable for every scanner).
  const MASKS = [(r, c) => (r + c) % 2 === 0, r => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0];
  const withMask = mask => {
    const g = m.map((row, r) => row.map((val, c) => (isData[r][c] && MASKS[mask](r, c) ? !val : val)));
    const fmtData = (0b00 << 3) | mask; // error correction M = 00
    let rem = fmtData << 10;
    for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
    const fmt = ((fmtData << 10) | rem) ^ 0x5412;
    fmtCells.forEach(([r, c], i) => { g[r][c] = ((fmt >> (i < 15 ? i : i - 15)) & 1) === 1; });
    return g;
  };
  const penalty = g => {
    let p = 0, dark = 0;
    const lines = [...g, ...g[0].map((_, c) => g.map(row => row[c]))];
    for (const line of lines) {
      for (let i = 0, run = 1; i < N; i++, run++) if (i === N - 1 || line[i] !== line[i + 1]) { if (run >= 5) p += run - 2; run = 0; }
      const str = line.map(x => (x ? 1 : 0)).join("");
      p += 40 * ((str.match(/(?=10111010000|00001011101)/g) || []).length);
    }
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) if (g[r][c] === g[r + 1][c] && g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c + 1]) p += 3;
    g.forEach(row => row.forEach(x => { if (x) dark++; }));
    return p + 10 * Math.floor(Math.abs(dark * 100 / (N * N) - 50) / 5);
  };
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) { const g = withMask(mask), p = penalty(g); if (p < bestP) { best = g; bestP = p; } }
  return best;
}
/** The QR code as SVG with the usual quiet zone; black on white so every scanner reads it, also in dark mode. */
function qrSVG(text, size = 200, label = "QR-Code mit deinem Schlüssel") {
  const m = qrMatrix(text);
  if (!m) return "";
  const W = m.length + 8;
  let d = "";
  m.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${c + 4} ${r + 4}h1v1h-1z`; }));
  return `<svg class="qr" width="${size}" height="${size}" viewBox="0 0 ${W} ${W}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="${W}" height="${W}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
