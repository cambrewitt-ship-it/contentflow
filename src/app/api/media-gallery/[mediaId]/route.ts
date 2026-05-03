import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { requireAuth, requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

const patchSchema = z.object({
  userTags: z.array(z.string()).optional(),
  userContext: z.string().optional(),
  userCategory: z.string().optional(),
  status: z.enum(['available', 'archived']).optional(),
});

async function getOwnedMedia(
  supabase: SupabaseClient,
  mediaId: string,
  userId: string
) {
  const { data: media, error } = await supabase
    .from('media_gallery')
    .select('*, clients(id, user_id)')
    .eq('id', mediaId)
    .maybeSingle();

  if (error || !media) return { media: null, notFound: true };

  const clientUserId = Array.isArray(media.clients)
    ? media.clients[0]?.user_id
    : (media.clients as { user_id?: string } | null)?.user_id;

  if (clientUserId !== userId) return { media: null, notFound: false };

  return { media, notFound: false };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params;

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const { media, notFound } = await getOwnedMedia(supabase, mediaId, user.id);

    if (notFound) {
      return NextResponse.json({ success: false, error: 'Media not found' }, { status: 404 });
    }
    if (!media) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, item: media });
  } catch (error) {
    logger.error('GET /api/media-gallery/[mediaId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params;

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { media, notFound } = await getOwnedMedia(supabase, mediaId, user.id);

    if (notFound) {
      return NextResponse.json({ success: false, error: 'Media not found' }, { status: 404 });
    }
    if (!media) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.userTags !== undefined) updates.user_tags = parsed.data.userTags;
    if (parsed.data.userContext !== undefined) updates.user_context = parsed.data.userContext;
    if (parsed.data.userCategory !== undefined) updates.user_category = parsed.data.userCategory;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;

    const { data: updated, error: updateError } = await supabase
      .from('media_gallery')
      .update(updates)
      .eq('id', mediaId)
      .select('*')
      .single();

    if (updateError || !updated) {
      logger.error('Error updating media gallery item:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update media item' }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    logger.error('PATCH /api/media-gallery/[mediaId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params;

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    // Use admin client to fetch the media item
    const admin = createSupabaseAdmin();
    const { data: media, error: fetchError } = await admin
      .from('media_gallery')
      .select('*')
      .eq('id', mediaId)
      .maybeSingle();

    if (fetchError || !media) {
      logger.error('Error fetching media gallery item:', fetchError);
      return NextResponse.json({ success: false, error: 'Media not found' }, { status: 404 });
    }

    // Verify user ownership of the client
    const clientAuth = await requireClientOwnership(request, media.client_id);
    if (clientAuth.error) return clientAuth.error;

    // Check query parameter for permanent delete vs archive
    const url = new URL(request.url);
    const permanent = url.searchParams.get('permanent') === 'true';

    if (permanent) {
      // Hard delete: remove references from related rows first, then delete from database and blob storage
      try {
        const cleanupTables = [
          'calendar_scheduled_posts',
          'autopilot_candidates',
          'content_preferences',
        ];

        for (const table of cleanupTables) {
          const { error: cleanupError } = await admin
            .from(table)
            .update({ media_gallery_id: null })
            .eq('media_gallery_id', mediaId);

          if (cleanupError) {
            logger.error(`Error nullifying media_gallery_id in ${table}:`, cleanupError);
            return NextResponse.json(
              { success: false, error: 'Failed to remove media references before deleting' },
              { status: 500 }
            );
          }
        }

        // Delete the file from storage
        if (media.media_url) {
          try {
            const supabaseMatch = media.media_url.match(/\/storage\/v1\/object\/public\/media-gallery\/(.+)/);
            if (supabaseMatch?.[1]) {
              await admin.storage.from('media-gallery').remove([decodeURIComponent(supabaseMatch[1])]);
            } else {
              // Fallback for legacy Vercel Blob URLs
              const { del } = await import('@vercel/blob');
              await del(media.media_url);
            }
          } catch (storageError) {
            logger.warn('Failed to delete file from storage:', storageError);
            // Continue anyway - database record is what matters
          }
        }

        // Delete from database using admin client
        const { error: deleteError } = await admin
          .from('media_gallery')
          .delete()
          .eq('id', mediaId);

        if (deleteError) {
          logger.error('Error permanently deleting media gallery item:', deleteError);
          return NextResponse.json({ success: false, error: 'Failed to permanently delete media item' }, { status: 500 });
        }
      } catch (error) {
        logger.error('Error in permanent delete process:', error);
        return NextResponse.json({ success: false, error: 'Failed to permanently delete media item' }, { status: 500 });
      }
    } else {
      // Soft delete: mark as archived using admin client
      const { error: updateError } = await admin
        .from('media_gallery')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', mediaId);

      if (updateError) {
        logger.error('Error archiving media gallery item:', updateError);
        return NextResponse.json({ success: false, error: 'Failed to archive media item' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/media-gallery/[mediaId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
