// Original 120 BPM soundtrack + key-matched SFX for the Content Manager brag video.
const fs = require('fs');
const SR = 48000, DUR = 23.0, N = Math.round(SR * DUR);
const BEAT = 0.5;
const L = new Float32Array(N), R = new Float32Array(N);      // dry bus
const RL = new Float32Array(N), RR = new Float32Array(N);    // reverb send
const KICKENV = new Float32Array(N);                         // for sidechain ducking
const DUCKED_L = new Float32Array(N), DUCKED_R = new Float32Array(N);

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function add(buf, i, v) { if (i >= 0 && i < N) buf[i] += v; }
function put(t, fn, len, { gain = 1, pan = 0, send = 0, duck = false } = {}) {
  const s0 = Math.round(t * SR), n = Math.round(len * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  const dl = duck ? DUCKED_L : L, dr = duck ? DUCKED_R : R;
  for (let k = 0; k < n; k++) {
    const v = fn(k / SR, k);
    add(dl, s0 + k, v * gl); add(dr, s0 + k, v * gr);
    if (send) { add(RL, s0 + k, v * gl * send); add(RR, s0 + k, v * gr * send); }
  }
}

// ---------- instruments ----------
function kick(t) {
  put(t, (x) => {
    const f = 45 + 85 * Math.exp(-x * 28);
    const ph = 2 * Math.PI * (45 * x + 85 * (1 - Math.exp(-x * 28)) / 28);
    return Math.sin(ph) * Math.exp(-x * 9) * (x < 0.002 ? x / 0.002 : 1);
  }, 0.45, { gain: 0.6 });
  const s0 = Math.round(t * SR);
  for (let k = 0; k < SR * 0.35; k++) if (s0 + k < N) KICKENV[s0 + k] = Math.max(KICKENV[s0 + k], Math.exp(-k / SR * 10));
}
function hat(t, g = 0.08, open = false) {
  let prev = 0;
  put(t, (x) => { const n = rnd() * 2 - 1; const hp = n - prev; prev = n; return hp * Math.exp(-x * (open ? 18 : 60)); },
    open ? 0.25 : 0.08, { gain: g, pan: 0.25, send: 0.08 });
}
function clap(t, g = 0.22) {
  let lp = 0, prev = 0;
  put(t, (x) => {
    const n = rnd() * 2 - 1; lp += 0.35 * (n - lp); const bp = lp - prev; prev = lp;
    const env = Math.exp(-x * 22) * (1 + 0.6 * Math.exp(-((x - 0.012) ** 2) / 0.00002));
    return bp * env * 2.2 + Math.sin(2 * Math.PI * 196 * x) * Math.exp(-x * 30) * 0.25;
  }, 0.3, { gain: g, pan: -0.05, send: 0.25 });
}
function bass(t, midi, len, g = 0.32) {
  const f = mtof(midi); let lp = 0;
  put(t, (x) => {
    const saw = 2 * ((f * x) % 1) - 1, sn = Math.sin(2 * Math.PI * f * x);
    lp += 0.06 * (saw - lp);
    const env = Math.min(1, x / 0.005) * Math.exp(-x * 2.2) * (x > len - 0.03 ? Math.max(0, (len - x) / 0.03) : 1);
    return (sn * 0.75 + lp * 0.5) * env;
  }, len, { gain: g, duck: true });
}
function pad(t, notes, len, g = 0.05) {
  let f1 = 0, f2 = 0; const ca = 1 - Math.exp(-2 * Math.PI * 1100 / SR);
  put(t, (x) => {
    let s = 0;
    notes.forEach((m, j) => {
      const f = mtof(m);
      for (const d of [-0.08, 0.08]) s += 2 * ((f * (1 + d / 12) * x + j * 0.13) % 1) - 1;
    });
    const env = Math.min(1, x / 0.35) * Math.min(1, Math.max(0, (len - x) / 0.4));
    f1 += ca * (s - f1); f2 += ca * (f1 - f2);
    return f2 * env;
  }, len, { gain: g * 1.6, send: 0.5, duck: true });
}
function pluck(t, midi, g = 0.12, pan = 0, decay = 7, send = 0.35) {
  const f = mtof(midi);
  put(t, (x) => {
    const e = Math.exp(-x * decay) * Math.min(1, x / 0.002);
    return (Math.sin(2 * Math.PI * f * x) + 0.35 * Math.sin(4 * Math.PI * f * x) * Math.exp(-x * 14) + 0.12 * Math.sin(6 * Math.PI * f * x) * Math.exp(-x * 25)) * e;
  }, 0.9, { gain: g, pan, send });
}
function bell(t, midi, g = 0.16, pan = 0) {
  const f = mtof(midi), partials = [[1, 1, 2.2], [2.0, 0.45, 3.5], [3.01, 0.22, 5], [4.17, 0.12, 7], [5.43, 0.06, 9]];
  put(t, (x) => partials.reduce((s, [r, a, d]) => s + a * Math.sin(2 * Math.PI * f * r * x) * Math.exp(-x * d), 0) * Math.min(1, x / 0.003),
    2.5, { gain: g, pan, send: 0.6 });
}
function whoosh(tPeak, rise = 0.45, fall = 0.3, g = 0.12) {
  const t0 = tPeak - rise; let lp1 = 0, lp2 = 0;
  put(t0, (x) => {
    const n = rnd() * 2 - 1;
    const p = x < rise ? x / rise : 1 - (x - rise) / fall;
    const cut = 0.02 + 0.25 * Math.max(0, x < rise ? x / rise : 1 - (x - rise) / fall);
    lp1 += cut * (n - lp1); lp2 += cut * (lp1 - lp2);
    return (lp1 - lp2 * 0.6) * Math.pow(Math.max(0, p), 2);
  }, rise + fall, { gain: g, pan: 0, send: 0.4 });
}
function tick(t, g = 0.05) {
  let prev = 0;
  put(t, (x) => { const n = rnd() * 2 - 1; const hp = n - prev; prev = n; return hp * Math.exp(-x * 220) + Math.sin(2 * Math.PI * 2093 * x) * Math.exp(-x * 120) * 0.3; },
    0.03, { gain: g, pan: 0.15 + (rnd() - 0.5) * 0.2, send: 0.1 });
}

// ---------- music ----------
// C major: Cmaj7 / Am7 / Fmaj7 / G6 — one chord per bar (2s)
const CH = [
  { root: 36, pad: [60, 64, 67, 71], arp: [72, 76, 79, 83, 79, 76] },
  { root: 33, pad: [57, 60, 64, 67], arp: [69, 72, 76, 79, 76, 72] },
  { root: 29, pad: [57, 60, 64, 65], arp: [69, 72, 77, 76, 72, 69] },
  { root: 31, pad: [59, 62, 64, 67], arp: [71, 74, 79, 76, 74, 71] },
];
const END = 22.0;
for (let bar = 0; bar * 2 < END; bar++) {
  const t0 = bar * 2, c = CH[bar % 4];
  // land on C for the outro (19.5), G the bar before
  const chord = t0 >= 18 ? CH[0] : (t0 >= 16 ? CH[3] : c);
  pad(t0, chord.pad, 2.15, 0.028);
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    if (tb >= END) break;
    const quiet = tb >= 3.5 && tb < 4.0; // breath before reveal
    if (!quiet) kick(tb);
    if (b % 2 === 1 && tb >= 4) clap(tb);
    hat(tb + BEAT / 2, tb >= 4 ? 0.07 : 0.045);
    if (tb >= 4) { hat(tb + BEAT / 4, 0.03); hat(tb + 3 * BEAT / 4, 0.03); }
    if (!quiet) { bass(tb, chord.root, 0.22); bass(tb + 0.25, chord.root + (b === 3 ? 12 : 0), 0.2, 0.26); }
  }
  for (let k = 0; k < 16; k++) {
    const t = t0 + k * 0.125; if (t >= END) break;
    if (t >= 3.5 && t < 4.0) continue;
    const m = chord.arp[k % chord.arp.length];
    pluck(t, m, (t < 4 ? 0.035 : 0.05) * (k % 4 === 0 ? 1.25 : 1), (k % 2 ? 0.35 : -0.35), 9, 0.3);
  }
}
pad(22.0, [48, 55, 60, 64, 67, 71], 1.0, 0.03);
bass(22.0, 36, 0.9, 0.3); kick(22.0);
bell(22.0, 84, 0.08);

// ---------- SFX (in key, under the music) ----------
// original scene timeline -> final cut (mirrors toOld() in brag.html)
// The logo reveal (4.0–7.0 of the 26s cut) is removed, so later events move 3s earlier.
const C_ = (t) => (t < 4 ? t : t - 3);
function N_(o) { return C_(N26(o)); }
function N26(o) {
  if (o < 4) return o;
  if (o < 7.5) return 4 + (o - 4) * 3 / 3.5;
  if (o < 12.5) return 12.5 + (o - 7.5) / 1.25;
  if (o < 16.5) return 16.5 + (o - 12.5) * 3.5 / 4;
  if (o < 19.5) return 20 + (o - 16.5) / 1.2;
  return o + 3;
}
[4.0, 9.5, 13.5, 17.0, 19.5].forEach(t => whoosh(t, 0.45, 0.3, t === 4.0 || t === 19.5 ? 0.14 : 0.09));
[.1, .3, .5, .7, .85, 1.0, 1.2, 1.38].forEach((t, i) => pluck(t + 0.08, [72, 76, 79, 72, 76, 79, 84, 88][i], 0.05, (i % 2 ? .2 : -.2), 10, 0.4));
clap(4.0, 0.1);

// Content Agent (4.0–9.5)
for (let i = 0; i < 8; i++) pluck(C_(7.62 + i * 0.08), [60, 62, 64, 67, 69, 72, 74, 76][i], 0.05, -0.4 + i * 0.11, 9);        // photos land
for (let i = 0; i < 8; i++) {                                                                                                  // AI scan shimmer
  const sa = C_(7.95 + i * 0.08);
  put(sa, (x) => Math.sin(2 * Math.PI * 2637 * x + 3 * Math.sin(2 * Math.PI * 9 * x)) * Math.sin(Math.PI * x / 0.42), 0.42, { gain: 0.012, pan: -0.4 + i * 0.11, send: 0.4 });
  pluck(sa + 0.42, 96, 0.03, -0.4 + i * 0.11, 16, 0.3);                                                                     // tick
}
tick(C_(9.3), 0.08); pluck(C_(9.3), 91, 0.05, 0.1, 18, 0.2);                                                                          // Run Agent
for (let k = 0; k < 6; k++) pluck(C_(9.58 + k * 0.16), [79, 81, 84, 86, 88, 91][k], 0.03, (k % 2 ? .3 : -.3), 10, 0.5);           // drafting
bell(C_(10.75), 84, 0.08, 0);                                                                                                     // plan ready
for (let i = 0; i < 7; i++) pluck(C_(10.85 + i * 0.09), [72, 74, 76, 79, 81, 84, 86][i], 0.055, -0.45 + i * 0.15, 8);

// remaining scenes, retimed
for (let t = 8.05; t < 8.85; t += 0.055) tick(N_(t + rnd() * 0.012), 0.035);
for (let t = 14.0; t < 14.55; t += 0.055) tick(N_(t + rnd() * 0.012), 0.035);
[9.35, 10.5, 13.7, 17.3].forEach(t => { tick(N_(t), 0.08); pluck(N_(t), 91, 0.05, 0.1, 18, 0.2); });
[9.95, 10.08, 10.21].forEach((t, i) => pluck(N_(t + .05), [76, 79, 84][i], 0.07, [-0.3, 0, 0.3][i], 8));
pluck(N_(13.75), 79, 0.07, 0, 6); pluck(N_(13.86), 84, 0.08, 0, 5);
if (!process.env.VERT) { pluck(N_(14.95), 72, 0.06, 0.4, 7); pluck(N_(15.05), 79, 0.05, 0.4, 7); }
[72, 76, 79].forEach((m, i) => pluck(N_(17.32) + i * 0.06, m + 12, 0.06, 0, 7));
[72, 74, 76, 79, 81, 84, 86].forEach((m, i) => pluck(N_(17.5 + i * 0.17), m, 0.065, -0.45 + i * 0.15, 8));
bell(N_(19.55), 84, 0.15, -0.1); bell(N_(19.55), 76, 0.09, 0.2); bell(N_(19.6), 72, 0.08, 0);

// ---------- mix ----------
// sidechain duck for bass+pads
for (let i = 0; i < N; i++) { const d = 1 - 0.55 * KICKENV[i]; L[i] += DUCKED_L[i] * d; R[i] += DUCKED_R[i] * d; }
// gentle master lowpass to soften naive saws (one-pole, ~9kHz)
const a = 1 - Math.exp(-2 * Math.PI * 9000 / SR); let zl = 0, zr = 0;
for (let i = 0; i < N; i++) { zl += a * (L[i] - zl); zr += a * (R[i] - zr); L[i] = zl; R[i] = zr; }
// Schroeder reverb on the send bus
function reverb(inp, offs) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422].map(n => ({ b: new Float32Array(n + offs), i: 0, lp: 0 }));
  const aps = [225, 556, 441].map(n => ({ b: new Float32Array(n + offs), i: 0 }));
  let lpIn = 0;
  for (let n = 0; n < N; n++) {
    lpIn += 0.3 * (inp[n] - lpIn);
    let s = 0;
    for (const c of combs) { const y = c.b[c.i]; c.lp += 0.45 * (y - c.lp); c.b[c.i] = lpIn + c.lp * 0.82; c.i = (c.i + 1) % c.b.length; s += y; }
    s *= 0.25;
    for (const p of aps) { const y = p.b[p.i]; const v = s + y * 0.5; p.b[p.i] = v; s = y - v * 0.5; p.i = (p.i + 1) % p.b.length; }
    out[n] = s;
  }
  return out;
}
const wl = reverb(RL, 0), wr = reverb(RR, 23);
for (let i = 0; i < N; i++) { L[i] += wl[i] * 0.55; R[i] += wr[i] * 0.55; }
// fade tail + soft clip
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = 0.9 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const fade = i > N - SR * 0.6 ? (N - i) / (SR * 0.6) : 1;
  const l = Math.tanh(L[i] * norm * 1.1) * fade, r = Math.tanh(R[i] * norm * 1.1) * fade;
  buf.writeInt16LE(Math.round(l * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(r * 32000), 46 + i * 4);
}
fs.writeFileSync(process.env.VERT ? 'soundtrack_v_raw.wav' : 'soundtrack_raw.wav', buf);
console.log('peak', peak.toFixed(3));
