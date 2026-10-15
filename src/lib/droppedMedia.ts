// Helpers for photos/videos dragged in from outside the app — the OS file manager, Chrome's
// downloads bar/shelf, or an image dragged out of another browser window.

const isMedia = (type: string) => type.startsWith('image/') || type.startsWith('video/');

/** True when a native drag carries something that could become a photo (files or a link). */
export function dragHasExternalMedia(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  const types = Array.from(dataTransfer.types || []);
  // Tray posts carry our own 'post' payload — those aren't external media.
  if (types.includes('post')) return false;
  return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/html');
}

/** Pull the image URL out of a drag from another web page (uri-list first, then <img src>). */
function getDroppedImageUrl(dataTransfer: DataTransfer): string | null {
  const uriList = dataTransfer.getData('text/uri-list');
  const fromList = uriList
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'));

  const html = dataTransfer.getData('text/html');
  const imgSrc = html ? /<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1] : undefined;

  // Prefer the <img> src: dragging a linked image gives the link target in uri-list.
  const url = imgSrc || fromList;
  if (!url) return null;
  if (url.startsWith('data:image/') || /^https?:\/\//i.test(url)) return url.replace(/&amp;/g, '&');
  return null;
}

async function fileFromUrl(url: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!isMedia(blob.type)) return null;
    const ext = blob.type.split('/')[1]?.split('+')[0] || 'jpg';
    const rawName = url.startsWith('data:') ? '' : decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    const name = rawName && /\.[a-z0-9]+$/i.test(rawName) ? rawName : `dropped-photo.${ext}`;
    return new File([blob], name, { type: blob.type });
  } catch {
    // Usually CORS — the other site won't let us read the image.
    return null;
  }
}

/**
 * Turn a native drop into media files. Must be called synchronously inside the drop handler
 * (DataTransfer is emptied once the event finishes); the returned promise can resolve later.
 */
export function extractDroppedMediaFiles(dataTransfer: DataTransfer | null): Promise<File[]> {
  if (!dataTransfer) return Promise.resolve([]);
  const files = Array.from(dataTransfer.files || []).filter((f) => isMedia(f.type));
  if (files.length > 0) return Promise.resolve(files);

  const url = getDroppedImageUrl(dataTransfer);
  if (!url) return Promise.resolve([]);
  return fileFromUrl(url).then((file) => (file ? [file] : []));
}
