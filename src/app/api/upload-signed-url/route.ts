import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/authHelpers';

const SUPPORTED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg',
];
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { filename, type, size } = await request.json();

  if (!SUPPORTED_TYPES.includes(type)) {
    return NextResponse.json({ error: `Unsupported file type: ${type}` }, { status: 400 });
  }

  const isVideo = type.startsWith('video/');
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (size > maxSize) {
    return NextResponse.json(
      { error: `File too large. Max ${maxSize / 1024 / 1024}MB for ${isVideo ? 'videos' : 'images'}` },
      { status: 400 }
    );
  }

  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage
    .from('media-gallery')
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create upload URL' },
      { status: 500 }
    );
  }

  const { data: { publicUrl } } = admin.storage.from('media-gallery').getPublicUrl(path);

  return NextResponse.json({ signedUrl: data.signedUrl, path, publicUrl });
}
