import { jsPDF } from 'jspdf';
import { extractVideoThumbnail } from '@/lib/videoUtils';
import type { FeedPreviewItem } from '@/components/InstagramFeedPreview';

/**
 * Builds a portrait A4 PDF of the Instagram feed preview, drawn client-side so it
 * matches exactly what's selected in the preview. `items` are newest first (grid order).
 *
 * - 'full'   → a title line and the bare 3-column grid, paginated.
 * - 'mobile' → the phone mock-up: profile header on the first page, then the grid
 *              continuing on further phone "screens".
 */

const PAGE_W = 210;
const PAGE_H = 297;
const TILE_PX_W = 600;
const TILE_PX_H = 800; // Instagram's 3:4 profile-grid crop

type Tile = { data: string; format: 'JPEG' };

// ── Images ─────────────────────────────────────────────────────────────────────

// Fetching as a blob (rather than <img crossOrigin>) keeps the canvas untainted for
// storage buckets that send CORS headers; anything that fails falls back to a placeholder.
async function loadImage(src: string): Promise<HTMLImageElement | null> {
  let objectUrl: string | null = null;
  try {
    let url = src;
    if (!src.startsWith('data:')) {
      const res = await fetch(src, { mode: 'cors' });
      if (!res.ok) return null;
      objectUrl = URL.createObjectURL(await res.blob());
      url = objectUrl;
    }
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    // Safe once decoded — the pixels stay on the element for drawImage
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 0);
  }
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// Small white glyphs in the top-right corner, like the grid shows
function drawBadge(ctx: CanvasRenderingContext2D, kind: 'carousel' | 'video') {
  const s = 44;
  const x = TILE_PX_W - s - 22;
  const y = 22;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  if (kind === 'carousel') {
    ctx.beginPath();
    ctx.roundRect(x + 10, y, s - 10, s - 10, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x, y + 10, s - 10, s - 10, 6);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + s, y + s / 2);
    ctx.lineTo(x + 8, y + s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

async function renderTile(item: FeedPreviewItem): Promise<Tile> {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX_W;
  canvas.height = TILE_PX_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, TILE_PX_W, TILE_PX_H);

  const cover = item.media[0];
  let img: HTMLImageElement | null = null;
  if (cover) {
    if (cover.isVideo) {
      const frame = await extractVideoThumbnail(cover.url).catch(() => null);
      if (frame) img = await loadImage(frame);
    } else {
      img = await loadImage(cover.url);
    }
  }
  if (img) drawCover(ctx, img, TILE_PX_W, TILE_PX_H);

  if (item.media.length > 1) drawBadge(ctx, 'carousel');
  else if (cover?.isVideo) drawBadge(ctx, 'video');

  return { data: canvas.toDataURL('image/jpeg', 0.85), format: 'JPEG' };
}

async function renderAvatar(url: string | null | undefined, name: string): Promise<string> {
  const size = 240;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // Instagram's gradient ring
  const ring = ctx.createLinearGradient(0, size, size, 0);
  ring.addColorStop(0, '#facc15');
  ring.addColorStop(0.5, '#ec4899');
  ring.addColorStop(1, '#9333ea');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.fill();

  const r = size / 2 - 16;
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.clip();
  const img = url ? await loadImage(url) : null;
  if (img) {
    ctx.translate(16, 16);
    drawCover(ctx, img, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#6b7280';
    ctx.font = `600 ${Math.round(size * 0.35)}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.charAt(0).toUpperCase(), size / 2, size / 2);
  }
  ctx.restore();
  return canvas.toDataURL('image/png');
}

// ── Layouts ────────────────────────────────────────────────────────────────────

function drawGridTab(doc: jsPDF, cx: number, cy: number, s: number) {
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.35);
  doc.rect(cx - s / 2, cy - s / 2, s, s);
  doc.line(cx - s / 6, cy - s / 2, cx - s / 6, cy + s / 2);
  doc.line(cx + s / 6, cy - s / 2, cx + s / 6, cy + s / 2);
  doc.line(cx - s / 2, cy - s / 6, cx + s / 2, cy - s / 6);
  doc.line(cx - s / 2, cy + s / 6, cx + s / 2, cy + s / 6);
}

function layoutFull(doc: jsPDF, tiles: Tile[], title: string, subtitle: string) {
  const margin = 15;
  const gap = 1;
  const gridW = PAGE_W - margin * 2;
  const tileW = (gridW - gap * 2) / 3;
  const tileH = tileW * (4 / 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text(title, margin, margin + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(subtitle, margin, margin + 11);

  let y = margin + 18;
  tiles.forEach((tile, i) => {
    const col = i % 3;
    if (col === 0 && i > 0) y += tileH + gap;
    if (col === 0 && y + tileH > PAGE_H - margin) {
      doc.addPage();
      y = margin;
    }
    doc.addImage(tile.data, tile.format, margin + col * (tileW + gap), y, tileW, tileH);
  });
}

function layoutMobile(
  doc: jsPDF,
  tiles: Tile[],
  { handle, name, avatar, postCount }: { handle: string; name: string; avatar: string; postCount: number }
) {
  const phoneW = 124;
  const phoneH = 267;
  const phoneX = (PAGE_W - phoneW) / 2;
  const phoneY = (PAGE_H - phoneH) / 2;
  const bezel = 4;
  const sx = phoneX + bezel;
  const sy = phoneY + bezel;
  const sw = phoneW - bezel * 2;
  const sh = phoneH - bezel * 2;
  const gap = 0.5;
  const tileW = (sw - gap * 2) / 3;
  const tileH = tileW * (4 / 3);

  const drawScreen = () => {
    doc.setFillColor(17, 24, 39);
    doc.roundedRect(phoneX, phoneY, phoneW, phoneH, 14, 14, 'F');
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(sx, sy, sw, sh, 11, 11, 'F');
    // Status bar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text('9:41', sx + 9, sy + 6.5);
    doc.setFillColor(17, 24, 39);
    doc.roundedRect(sx + sw / 2 - 11, sy + 3, 22, 5, 2.5, 2.5, 'F');
    doc.setDrawColor(17, 24, 39);
    doc.setLineWidth(0.3);
    doc.roundedRect(sx + sw - 15, sy + 4, 6, 3.2, 0.6, 0.6, 'S');
    doc.rect(sx + sw - 14.4, sy + 4.6, 4.2, 2, 'F');
    // Top bar
    doc.setFontSize(11);
    doc.text(handle, sx + 5, sy + 15.5);
    return sy + 20;
  };

  let y = drawScreen();

  // Profile header
  const avatarSize = 21;
  doc.addImage(avatar, 'PNG', sx + 5, y + 1, avatarSize, avatarSize);
  const stats: Array<[string, string]> = [
    [String(postCount), 'posts'],
    ['—', 'followers'],
    ['—', 'following'],
  ];
  const statsX = sx + 5 + avatarSize + 4;
  const statW = (sx + sw - 4 - statsX) / 3;
  stats.forEach(([value, label], i) => {
    const cx = statsX + statW * i + statW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(value, cx, y + 10.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(label, cx, y + 15, { align: 'center' });
  });
  y += avatarSize + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(name, sx + 5, y);
  y += 4;
  const btnW = (sw - 10 - 1.5) / 2;
  doc.setFillColor(243, 244, 246);
  ['Following', 'Message'].forEach((label, i) => {
    const bx = sx + 5 + i * (btnW + 1.5);
    doc.roundedRect(bx, y, btnW, 7, 1.5, 1.5, 'F');
    doc.text(label, bx + btnW / 2, y + 4.7, { align: 'center' });
  });
  y += 11;

  // Tabs
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.2);
  doc.line(sx, y, sx + sw, y);
  drawGridTab(doc, sx + sw / 6, y + 4.5, 3.6);
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.5);
  doc.line(sx, y + 9, sx + sw / 3, y + 9);
  y += 9.5;

  const bottom = sy + sh - 6; // stay clear of the rounded corners
  tiles.forEach((tile, i) => {
    const col = i % 3;
    if (col === 0 && i > 0) y += tileH + gap;
    if (col === 0 && y + tileH > bottom) {
      doc.addPage();
      y = drawScreen();
    }
    doc.addImage(tile.data, tile.format, sx + col * (tileW + gap), y, tileW, tileH);
  });
}

// ── Entry point ────────────────────────────────────────────────────────────────

export async function exportFeedPreviewPdf({
  items,
  mode,
  handle,
  accountName,
  avatarUrl,
  dateRange,
}: {
  items: FeedPreviewItem[];
  mode: 'mobile' | 'full';
  handle: string;
  accountName: string;
  avatarUrl?: string | null;
  dateRange: string;
}) {
  const tiles = await Promise.all(items.map(renderTile));
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const name = accountName || handle;

  if (mode === 'full') {
    layoutFull(
      doc,
      tiles,
      `${name} · Instagram feed preview`,
      `${items.length} post${items.length === 1 ? '' : 's'}${dateRange ? ` · ${dateRange}` : ''} · newest first`
    );
  } else {
    const avatar = await renderAvatar(avatarUrl, name);
    layoutMobile(doc, tiles, { handle, name, avatar, postCount: items.length });
  }

  doc.save(`${handle}-instagram-feed-preview-${new Date().toLocaleDateString('en-CA')}.pdf`);
}
