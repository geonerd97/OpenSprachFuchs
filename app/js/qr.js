"use strict";
/* ---------- QR code for the account key ----------
   A minimal encoder: version 1 (21×21), error correction M, alphanumeric mode, best of the eight masks. That holds up to 20 characters,
   enough for a key like "K7QM-4XD2-PL9A-H3TV". On a new phone the camera app reads it, and the text can be pasted
   into "Mit Schlüssel anmelden". */
const QR_ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
function qrMatrix(text) {
  if (text.length > 20 || [...text].some(c => !QR_ALNUM.includes(c))) return null;
  const bits = [], put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  put(0b0010, 4); put(text.length, 9);
  for (let i = 0; i < text.length; i += 2) {
    const a = QR_ALNUM.indexOf(text[i]);
    if (i + 1 < text.length) put(a * 45 + QR_ALNUM.indexOf(text[i + 1]), 11); else put(a, 6);
  }
  put(0, Math.min(4, 128 - bits.length)); // terminator
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let k = 0; data.length < 16; k++) data.push(k % 2 ? 0x11 : 0xEC);
  // Reed–Solomon over GF(256), polynomial 0x11D, 10 error correction codewords.
  const EXP = [], LOG = [];
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  let gen = [1];
  for (let i = 0; i < 10; i++) {
    const next = new Array(gen.length + 1).fill(0);
    gen.forEach((g, j) => { next[j] ^= g; next[j + 1] ^= mul(g, EXP[i]); });
    gen = next;
  }
  const ec = new Array(10).fill(0);
  for (const d of data) { const f = d ^ ec.shift(); ec.push(0); for (let j = 0; j < 10; j++) ec[j] ^= mul(gen[j + 1], f); }
  // Function patterns: finders with separators, timing lines, dark module, reserved format areas.
  const N = 21, m = [...Array(N)].map(() => new Array(N).fill(null));
  const finder = (r, c) => {
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
      const rr = r + y, cc = c + x, ring = Math.max(Math.abs(y - 3), Math.abs(x - 3));
      if (rr >= 0 && cc >= 0 && rr < N && cc < N) m[rr][cc] = ring !== 2 && ring !== 4;
    }
  };
  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  for (let i = 8; i < N - 8; i++) m[6][i] = m[i][6] = i % 2 === 0;
  // Reserve the format areas, then place the data in the zigzag columns from the bottom right (unmasked for now).
  const fmtCells = [];
  for (let i = 0; i <= 5; i++) fmtCells.push([i, 8]);
  fmtCells.push([7, 8], [8, 8], [8, 7]);
  for (let i = 9; i < 15; i++) fmtCells.push([8, 14 - i]);
  for (let i = 0; i < 8; i++) fmtCells.push([8, N - 1 - i]);
  for (let i = 8; i < 15; i++) fmtCells.push([N - 15 + i, 8]);
  for (const [r, c] of fmtCells) m[r][c] = false;
  m[N - 8][8] = true; // dark module
  const dbits = [], isData = [...Array(N)].map(() => new Array(N).fill(false));
  for (const b of [...data, ...ec]) for (let i = 7; i >= 0; i--) dbits.push((b >> i) & 1);
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
    const g = m.map((row, r) => row.map((v, c) => (isData[r][c] && MASKS[mask](r, c) ? !v : v)));
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
      const str = line.map(v => (v ? 1 : 0)).join("");
      p += 40 * ((str.match(/(?=10111010000|00001011101)/g) || []).length);
    }
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) if (g[r][c] === g[r + 1][c] && g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c + 1]) p += 3;
    g.forEach(row => row.forEach(v => { if (v) dark++; }));
    return p + 10 * Math.floor(Math.abs(dark * 100 / (N * N) - 50) / 5);
  };
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) { const g = withMask(mask), p = penalty(g); if (p < bestP) { best = g; bestP = p; } }
  return best;
}
/** The QR code as SVG with the usual quiet zone; black on white so every scanner reads it, also in dark mode. */
function qrSVG(text, size = 200) {
  const m = qrMatrix(text);
  if (!m) return "";
  let d = "";
  m.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${c + 4} ${r + 4}h1v1h-1z`; }));
  return `<svg class="qr" width="${size}" height="${size}" viewBox="0 0 29 29" role="img" aria-label="QR-Code mit deinem Schlüssel" shape-rendering="crispEdges"><rect width="29" height="29" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
