import type { CSSProperties } from 'react';

// Board-view backgrounds. Shared by the calendar board, the client portal board and the
// clients API (which saves the agency's choice in clients.portal_settings.board_background).
export const BOARD_BACKGROUNDS: Array<{ id: string; label: string; style: CSSProperties; isPhoto?: boolean }> = [
  { id: 'ocean', label: 'Ocean', style: { background: 'linear-gradient(135deg, #0079bf 0%, #5067c5 100%)' } },
  { id: 'grape', label: 'Grape', style: { background: 'linear-gradient(135deg, #89609e 0%, #cd5a91 100%)' } },
  { id: 'forest', label: 'Forest', style: { background: 'linear-gradient(135deg, #1f845a 0%, #4bbf6b 100%)' } },
  { id: 'sunset', label: 'Sunset', style: { background: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)' } },
  { id: 'night', label: 'Night', style: { background: 'linear-gradient(135deg, #0c1a3a 0%, #3b2a6b 100%)' } },
  { id: 'slate', label: 'Slate', style: { background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)' } },
  {
    id: 'mountains',
    label: 'Mountains',
    isPhoto: true,
    style: { background: 'url(https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=70) center/cover' },
  },
  {
    id: 'beach',
    label: 'Beach',
    isPhoto: true,
    style: { background: 'url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=70) center/cover' },
  },
  {
    id: 'leaves',
    label: 'Leaves',
    isPhoto: true,
    style: { background: 'url(https://images.unsplash.com/photo-1470058869958-2a77ade41c02?auto=format&fit=crop&w=2400&q=70) center/cover' },
  },
];

export const DEFAULT_BOARD_BACKGROUND = 'ocean';

export const isBoardBackgroundId = (id: unknown): id is string =>
  typeof id === 'string' && BOARD_BACKGROUNDS.some((b) => b.id === id);

// A custom background is the public URL of a photo uploaded to our own Supabase storage
// (see /api/board-background). Only those URLs are accepted, never arbitrary links.
const STORAGE_PUBLIC_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/`;

export const isCustomBoardBackground = (value: unknown): value is string =>
  typeof value === 'string' &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  value.startsWith(STORAGE_PUBLIC_PREFIX) &&
  !/["'()\\\s]/.test(value);

/** A preset id or an uploaded photo URL. */
export const isValidBoardBackground = (value: unknown): value is string =>
  isBoardBackgroundId(value) || isCustomBoardBackground(value);

/** Resolve a saved background (preset id or photo URL) to something the board can render. */
export const resolveBoardBackground = (value: string | null | undefined) => {
  const preset = BOARD_BACKGROUNDS.find((b) => b.id === value);
  if (preset) return preset;
  if (isCustomBoardBackground(value)) {
    return { id: value, label: 'Your photo', isPhoto: true, style: { background: `url("${value}") center/cover` } as CSSProperties };
  }
  return BOARD_BACKGROUNDS[0];
};
