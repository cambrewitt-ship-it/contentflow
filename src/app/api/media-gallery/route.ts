import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { put } from '@vercel/blob';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

const uploadItemSchema = z
  .object({
    mediaData: z.string().min(1).optional(),
    mediaUrl: z.string().url().optional(),
    fileName: z.string().min(1),
    mediaType: z.enum(['image', 'video']),
    userTags: z.array(z.string()).optional(),
    userContext: z.string().optional(),
    userCategory: z.string().optional(),
  })
  .refine((item) => !!item.mediaData || !!item.mediaUrl, {
    message: 'Either mediaData or mediaUrl must be provided',
  });

const bulkUploadSchema = z.object({
  clientId: z.string().uuid(),
  items: z.array(uploadItemSchema).min(1).max(50),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ success: false, error: 'clientId is required' }, { status: 400 });
    }

    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    // Use admin client — ownership already verified above
    const admin = createSupabaseAdmin();

    const status = searchParams.get('status') || 'available';
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = admin
      .from('media_gallery')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId)
      .eq('status', status)
      .order('freshness_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.contains('ai_categories', [category]);
    }

    if (search) {
      query = query.or(
        `ai_description.ilike.%${search}%,user_context.ilike.%${search}%`
      );
    }

    const { data: items, error, count } = await query;

    if (error) {
      logger.error('Error fetching media gallery:', error);
      return NextResponse.json(
        { success: false, error: `Failed to fetch media gallery: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, items: items || [], total: count || 0 });
  } catch (error) {
    logger.error('GET /api/media-gallery error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bulkUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { clientId, items } = parsed.data;

    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const { user } = auth;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      logger.warn('⚠️ BLOB_READ_WRITE_TOKEN not configured for media gallery upload');
      return NextResponse.json(
        { success: false, error: 'Media upload is not configured. Missing BLOB_READ_WRITE_TOKEN.' },
        { status: 500 }
      );
    }

    // Use admin client for writes — ownership already verified above,
    // and the RLS policy's USING clause doesn't reliably cover INSERTs.
    const admin = createSupabaseAdmin();

    const uploadedItems: Array<{ id: string; media_url: string; ai_analysis_status: string }> = [];
    const imageIds: string[] = [];

    for (const item of items) {
      let blobResult: { url: string };
      let fileSize: number | null = null;

      if (item.mediaUrl) {
        blobResult = { url: item.mediaUrl };
      } else {
        const mimeMatch = item.mediaData.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch?.[1] || '';
        const base64Data = item.mediaData.includes(',')
          ? item.mediaData.split(',')[1]
          : item.mediaData;

        const allowedTypes = item.mediaType === 'image' ? IMAGE_MIME_TYPES : VIDEO_MIME_TYPES;
        if (!allowedTypes.includes(mimeType)) {
          return NextResponse.json(
            { success: false, error: `Invalid file type "${mimeType}" for ${item.mediaType} "${item.fileName}"` },
            { status: 400 }
          );
        }

        const padding = (base64Data.match(/=/g) || []).length;
        fileSize = Math.floor(base64Data.length * 0.75) - padding;
        const maxBytes = item.mediaType === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;

        if (fileSize > maxBytes) {
          return NextResponse.json(
            { success: false, error: `"${item.fileName}" exceeds the ${maxBytes / 1024 / 1024}MB size limit` },
            { status: 400 }
          );
        }

        try {
          const buffer = Buffer.from(base64Data, 'base64');
          const fileBlob = new Blob([buffer], { type: mimeType });
          blobResult = await put(item.fileName, fileBlob, { access: 'public', addRandomSuffix: true });
        } catch (blobErr) {
          const msg = blobErr instanceof Error ? blobErr.message : String(blobErr);
          logger.error('Vercel Blob upload failed:', blobErr);
          return NextResponse.json({ success: false, error: `Storage upload failed: ${msg}` }, { status: 500 });
        }
      }

      const { data: record, error: insertError } = await admin
        .from('media_gallery')
        .insert({
          client_id: clientId,
          user_id: user.id,
          media_url: blobResult.url,
          media_type: item.mediaType,
          file_name: item.fileName,
          file_size: fileSize,
          user_tags: item.userTags || [],
          user_context: item.userContext ?? null,
          user_category: item.userCategory ?? null,
          ai_analysis_status: 'pending',
        })
        .select('id, media_url, ai_analysis_status')
        .single();

      if (insertError || !record) {
        logger.error('Error inserting media gallery item:', insertError);
        return NextResponse.json(
          { success: false, error: `Failed to save media item: ${insertError?.message ?? 'unknown error'}` },
          { status: 500 }
        );
      }

      uploadedItems.push(record);
      if (item.mediaType === 'image') {
        imageIds.push(record.id);
      }
    }

    // Fire-and-forget AI analysis for uploaded images
    if (imageIds.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      fetch(`${appUrl}/api/media-gallery/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('authorization') || '',
        },
        body: JSON.stringify({ mediaIds: imageIds }),
      }).catch((err) => logger.error('Background analyze trigger failed:', err));
    }

    return NextResponse.json({
      success: true,
      uploaded: uploadedItems.length,
      items: uploadedItems,
    });
  } catch (error) {
    logger.error('POST /api/media-gallery error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
