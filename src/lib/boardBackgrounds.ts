import type { CSSProperties } from 'react';

// Board-view backgrounds. Shared by the calendar board, the client portal board and the
// clients API (which saves the agency's choice in clients.portal_settings.board_background).
//
// A saved background is one of:
//   - a preset id (below),
//   - a brand theme, `brand:<style>:<hex>.<hex>.<hex>` — colours pulled from the client's logo
//     (see logoPalette.ts) rendered in one of BRAND_STYLES,
//   - the public URL of a photo uploaded to our own Supabase storage.

export type BoardBackgroundGroup = 'studio' | 'classic' | 'photo';

export type BoardBackground = {
  id: string;
  label: string;
  style: CSSProperties;
  isPhoto?: boolean;
  group?: BoardBackgroundGroup;
};

// Soft radial "glow" layer for mesh gradients.
const glow = (color: string, at: string, size = '55%') => `radial-gradient(at ${at}, ${color} 0px, transparent ${size})`;
// Always the `background` shorthand (colour last) so swapping presets never mixes it with
// longhands, which React can't reconcile cleanly.
const mesh = (base: string, ...layers: string[]): CSSProperties => ({ background: [...layers, base].join(', ') });

export const BOARD_BACKGROUNDS: BoardBackground[] = [
  // Classic two-stop gradients.
  { id: 'ocean', label: 'Ocean', group: 'classic', style: { background: 'linear-gradient(135deg, #0079bf 0%, #5067c5 100%)' } },
  { id: 'grape', label: 'Grape', group: 'classic', style: { background: 'linear-gradient(135deg, #89609e 0%, #cd5a91 100%)' } },
  { id: 'forest', label: 'Forest', group: 'classic', style: { background: 'linear-gradient(135deg, #1f845a 0%, #4bbf6b 100%)' } },
  { id: 'sunset', label: 'Sunset', group: 'classic', style: { background: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)' } },
  { id: 'night', label: 'Night', group: 'classic', style: { background: 'linear-gradient(135deg, #0c1a3a 0%, #3b2a6b 100%)' } },
  { id: 'slate', label: 'Slate', group: 'classic', style: { background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)' } },

  // Studio — layered mesh / aurora gradients in a modern SaaS style.
  {
    id: 'aurora',
    label: 'Aurora',
    group: 'studio',
    style: mesh('#0b1023', glow('#2dd4bf', '10% 0%'), glow('#6366f1', '80% 10%'), glow('#a855f7', '60% 100%', '50%'), glow('#0ea5e9', '0% 90%', '45%')),
  },
  {
    id: 'nebula',
    label: 'Nebula',
    group: 'studio',
    style: mesh('#1a0b2e', glow('#ec4899', '15% 10%'), glow('#8b5cf6', '85% 20%'), glow('#3b82f6', '40% 100%', '50%')),
  },
  {
    id: 'midnight-mesh',
    label: 'Midnight',
    group: 'studio',
    style: mesh('#070a14', glow('rgba(79,70,229,0.75)', '0% 0%', '50%'), glow('rgba(14,165,233,0.55)', '100% 100%', '50%'), glow('rgba(168,85,247,0.35)', '100% 0%', '40%')),
  },
  {
    id: 'peach',
    label: 'Peach',
    group: 'studio',
    style: mesh('#ff9a8b', glow('#ffd29d', '0% 0%'), glow('#ff6a88', '100% 0%'), glow('#a18cd1', '100% 100%'), glow('#fbc2eb', '0% 100%')),
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    group: 'studio',
    style: mesh('#0f766e', glow('#5eead4', '0% 0%'), glow('#0284c7', '100% 30%'), glow('#1e3a8a', '50% 100%', '60%')),
  },
  {
    id: 'lavender',
    label: 'Lavender',
    group: 'studio',
    style: mesh('#c4b5fd', glow('#e0e7ff', '0% 0%'), glow('#f0abfc', '100% 0%'), glow('#818cf8', '100% 100%'), glow('#a5f3fc', '0% 100%')),
  },
  {
    id: 'ember',
    label: 'Ember',
    group: 'studio',
    style: mesh('#1c0a05', glow('#f97316', '0% 100%', '60%'), glow('#dc2626', '100% 80%', '50%'), glow('#facc15', '20% 0%', '35%')),
  },
  {
    id: 'citrus',
    label: 'Citrus',
    group: 'studio',
    style: mesh('#84cc16', glow('#fde047', '0% 0%'), glow('#22c55e', '100% 20%'), glow('#14b8a6', '60% 100%')),
  },
  {
    id: 'dusk',
    label: 'Dusk',
    group: 'studio',
    style: { background: 'linear-gradient(135deg, #312e81 0%, #7e22ce 45%, #db2777 75%, #f59e0b 100%)' },
  },
  {
    id: 'holo',
    label: 'Holo',
    group: 'studio',
    style: mesh('#c7d2fe', glow('#f0abfc', '0% 0%'), glow('#fde68a', '100% 0%', '50%'), glow('#99f6e4', '100% 100%'), glow('#fda4af', '0% 100%'), glow('#a5b4fc', '50% 50%', '40%')),
  },
  {
    id: 'graphite',
    label: 'Graphite',
    group: 'studio',
    style: mesh('#111318', glow('rgba(255,255,255,0.10)', '20% 0%', '55%'), glow('rgba(99,102,241,0.18)', '100% 100%', '50%')),
  },
  {
    id: 'arctic',
    label: 'Arctic',
    group: 'studio',
    style: mesh('#bfdbfe', glow('#f0f9ff', '0% 0%'), glow('#93c5fd', '100% 0%'), glow('#c7d2fe', '100% 100%'), glow('#a7f3d0', '0% 100%')),
  },

  // Photos.
  {
    id: 'mountains',
    label: 'Mountains',
    group: 'photo',
    isPhoto: true,
    style: { background: 'url(https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=70) center/cover' },
  },
  {
    id: 'beach',
    label: 'Beach',
    group: 'photo',
    isPhoto: true,
    style: { background: 'url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=70) center/cover' },
  },
  {
    id: 'leaves',
    label: 'Leaves',
    group: 'photo',
    isPhoto: true,
    style: { background: 'url(https://images.unsplash.com/photo-1470058869958-2a77ade41c02?auto=format&fit=crop&w=2400&q=70) center/cover' },
  },
];

export const DEFAULT_BOARD_BACKGROUND = 'ocean';

export const isBoardBackgroundId = (id: unknown): id is string =>
  typeof id === 'string' && BOARD_BACKGROUNDS.some((b) => b.id === id);

// ---------------------------------------------------------------------------------------------
// Brand themes — gradients built from three colours taken from the client's logo.
// ---------------------------------------------------------------------------------------------

export const BRAND_STYLES = [
  { id: 'mesh', label: 'Brand mesh' },
  { id: 'aurora', label: 'Brand aurora' },
  { id: 'gradient', label: 'Brand gradient' },
  { id: 'deep', label: 'Brand deep' },
  { id: 'soft', label: 'Brand soft' },
] as const;

export type BrandStyle = (typeof BRAND_STYLES)[number]['id'];

const BRAND_RE = /^brand:(mesh|aurora|gradient|deep|soft):([0-9a-f]{6})\.([0-9a-f]{6})\.([0-9a-f]{6})$/;

/** Build the saved value for a brand theme from three hex colours (with or without '#'). */
export const brandBackgroundValue = (style: BrandStyle, palette: string[]) =>
  `brand:${style}:${palette.slice(0, 3).map((c) => c.replace('#', '').toLowerCase()).join('.')}`;

export const isBrandBoardBackground = (value: unknown): value is string => typeof value === 'string' && BRAND_RE.test(value);

/** The style and colours of a brand theme value, or null if it isn't one. */
export const parseBrandBackground = (value: unknown): { style: BrandStyle; palette: [string, string, string] } | null => {
  if (typeof value !== 'string') return null;
  const m = BRAND_RE.exec(value);
  if (!m) return null;
  return { style: m[1] as BrandStyle, palette: [`#${m[2]}`, `#${m[3]}`, `#${m[4]}`] };
};

const toRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
/** Blend `hex` towards `target` by `amount` (0–1). */
const mix = (hex: string, target: string, amount: number) => {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex(a.map((v, i) => v + (b[i] - v) * amount));
};
const alpha = (hex: string, a: number) => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

export const brandBackgroundStyle = (style: BrandStyle, [a, b, c]: string[]): CSSProperties => {
  switch (style) {
    case 'mesh':
      return mesh(mix(a, '#000000', 0.45), glow(b, '0% 0%'), glow(a, '100% 0%'), glow(c, '100% 100%'), glow(mix(a, '#ffffff', 0.35), '0% 100%', '45%'));
    case 'aurora':
      return mesh(mix(a, '#05070f', 0.85), glow(alpha(a, 0.85), '10% 0%'), glow(alpha(b, 0.7), '90% 15%', '50%'), glow(alpha(c, 0.6), '50% 110%', '55%'));
    case 'gradient':
      return { background: `linear-gradient(135deg, ${a} 0%, ${b} 55%, ${c} 100%)` };
    case 'deep':
      return mesh(mix(a, '#000000', 0.7), glow(alpha(mix(a, '#ffffff', 0.15), 0.9), '0% 0%', '60%'), glow(alpha(b, 0.35), '100% 100%', '50%'));
    case 'soft':
      return mesh(mix(a, '#ffffff', 0.7), glow(mix(b, '#ffffff', 0.55), '0% 0%'), glow(mix(c, '#ffffff', 0.5), '100% 0%'), glow(mix(a, '#ffffff', 0.4), '100% 100%'));
  }
};

// ---------------------------------------------------------------------------------------------

// A custom background is the public URL of a photo uploaded to our own Supabase storage
// (see /api/board-background). Only those URLs are accepted, never arbitrary links.
const STORAGE_PUBLIC_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/`;

export const isCustomBoardBackground = (value: unknown): value is string =>
  typeof value === 'string' &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  value.startsWith(STORAGE_PUBLIC_PREFIX) &&
  !/["'()\\\s]/.test(value);

/** A preset id, a brand theme or an uploaded photo URL. */
export const isValidBoardBackground = (value: unknown): value is string =>
  isBoardBackgroundId(value) || isBrandBoardBackground(value) || isCustomBoardBackground(value);

/** Resolve a saved background (preset id, brand theme or photo URL) to something the board can render. */
export const resolveBoardBackground = (value: string | null | undefined): BoardBackground => {
  const preset = BOARD_BACKGROUNDS.find((b) => b.id === value);
  if (preset) return preset;
  const brand = parseBrandBackground(value);
  if (brand) {
    const label = BRAND_STYLES.find((s) => s.id === brand.style)?.label ?? 'Brand';
    return { id: value as string, label, style: brandBackgroundStyle(brand.style, brand.palette) };
  }
  if (isCustomBoardBackground(value)) {
    return { id: value, label: 'Your photo', isPhoto: true, style: { background: `url("${value}") center/cover` } };
  }
  return BOARD_BACKGROUNDS[0];
};
