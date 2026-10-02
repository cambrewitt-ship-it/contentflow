// Pull a three-colour brand palette out of a logo image, in the browser.
//
// The logo is drawn onto a small canvas and its opaque pixels are bucketed by hue and
// lightness; the most prominent, distinct colours win (saturated colours are favoured over
// greys, and near-white / near-black backgrounds are ignored). When the logo has fewer than
// three usable colours the rest are derived from the main one, so a single-colour or black
// logo still gets a pleasant palette.
//
// Logos live in our public Supabase bucket, which sends CORS headers, so the canvas isn't
// tainted. Any failure (CORS, decode) rejects and the caller hides the brand options.

type Hsl = { h: number; s: number; l: number };

const rgbToHsl = (r: number, g: number, b: number): Hsl => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
};

const hslToHex = ({ h, s, l }: Hsl) => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
};

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load logo'));
    img.src = src;
  });

/** Three hex colours (primary, secondary, accent) taken from the logo at `src`. */
export async function extractLogoPalette(src: string): Promise<[string, string, string]> {
  const img = await loadImage(src);
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size); // throws if the canvas is tainted

  // Bucket opaque pixels: 24 hue slices × 4 lightness bands for colours, plus one for greys.
  const buckets = new Map<string, { r: number; g: number; b: number; n: number; s: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const { h, s, l } = rgbToHsl(r, g, b);
    if (l > 0.94 || l < 0.04) continue; // page-white / pure black backgrounds
    const key = s < 0.15 ? `grey-${Math.floor(l * 4)}` : `${Math.floor(h / 15)}-${Math.floor(l * 4)}`;
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, s: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.s += s;
    bucket.n += 1;
    buckets.set(key, bucket);
  }

  // Ignore slivers (mostly anti-aliased edges blending a colour into the background).
  const total = [...buckets.values()].reduce((sum, bk) => sum + bk.n, 0);
  const candidates = [...buckets.values()]
    .filter((bk) => bk.n >= total * 0.05)
    .map((bk) => {
      const hsl = rgbToHsl(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n);
      // Favour saturated colours: a small coloured mark beats a big grey wordmark.
      return { hsl, score: bk.n * (0.25 + (bk.s / bk.n) * 2) };
    })
    .sort((x, y) => y.score - x.score);

  // Once the logo has real colour, greys (text, edge blending) only muddy the gradients.
  const hasColour = candidates.some((c) => c.hsl.s >= 0.15);
  const picked: Hsl[] = [];
  for (const { hsl } of candidates) {
    if (hasColour && hsl.s < 0.15) continue;
    if (picked.length === 3) break;
    const distinct = picked.every(
      (p) => (hsl.s >= 0.15 && p.s >= 0.15 ? hueDistance(p.h, hsl.h) >= 25 : true) || Math.abs(p.l - hsl.l) > 0.3
    );
    if (distinct) picked.push(hsl);
  }

  // Nothing usable (e.g. a white logo on transparency) — fall back to a neutral slate.
  const primary = picked[0] ?? { h: 222, s: 0.3, l: 0.35 };
  // Keep gradients rich: no washed-out or near-black primaries.
  const main: Hsl = { ...primary, l: clamp(primary.l, 0.3, 0.6) };

  const derived: Hsl[] =
    main.s < 0.15
      ? // Monochrome logo: tasteful tonal greys with a hint of cool blue.
        [
          { h: 220, s: 0.15, l: clamp(main.l + 0.2, 0.45, 0.7) },
          { h: 230, s: 0.35, l: 0.25 },
        ]
      : [
          { h: (main.h + 35) % 360, s: clamp(main.s, 0.45, 0.9), l: clamp(main.l + 0.12, 0.4, 0.7) },
          { h: (main.h + 325) % 360, s: clamp(main.s, 0.45, 0.9), l: clamp(main.l - 0.1, 0.25, 0.5) },
        ];

  const rest = picked.slice(1).map((c) => ({ ...c, l: clamp(c.l, 0.25, 0.75) }));
  const palette = [main, ...rest, ...derived].slice(0, 3);
  return palette.map(hslToHex) as [string, string, string];
}
