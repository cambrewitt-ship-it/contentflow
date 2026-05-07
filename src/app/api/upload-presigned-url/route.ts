import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import logger from '@/lib/logger';

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'];

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;   // 50MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;  // 500MB

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName') || '';
    const fileType = searchParams.get('fileType') || '';
    const fileSize = Number(searchParams.get('fileSize') || 0);

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 });
    }

    const isImage = SUPPORTED_IMAGE_TYPES.includes(fileType);
    const isVideo = SUPPORTED_VIDEO_TYPES.includes(fileType);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType}` },
        { status: 400 }
      );
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (fileSize && fileSize > maxSize) {
      return NextResponse.json(
        { error: `File too large (${(fileSize / (1024 * 1024)).toFixed(1)}MB). Max: ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `uploads/${Date.now()}-${safeName}`;

    const { data, error } = await admin.storage
      .from('media')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      logger.error('Failed to create signed upload URL:', error);
      return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
    }

    const { data: { publicUrl } } = admin.storage.from('media').getPublicUrl(storagePath);

    logger.info('Signed upload URL created', { storagePath, fileType, fileSize });

    return NextResponse.json({ signedUrl: data.signedUrl, publicUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Error generating upload URL:', msg);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
