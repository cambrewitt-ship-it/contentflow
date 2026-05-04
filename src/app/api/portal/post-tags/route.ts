import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

const supabaseAdmin = createSupabaseAdmin();

const BodySchema = z.object({
  portal_token: z.string().uuid(),
  post_id: z.string().uuid(),
  tag_id: z.string().uuid(),
});

async function resolveAndVerify(portalToken: string, postId: string) {
  const resolved = await resolvePortalToken(portalToken);
  if (!resolved) return null;

  const { data: post } = await supabaseAdmin
    .from('calendar_scheduled_posts')
    .select('client_id')
    .eq('id', postId)
    .maybeSingle();

  if (post) {
    if (post.client_id !== resolved.clientId) return null;
    return resolved;
  }

  // Also allow tagging client uploads
  const { data: upload } = await supabaseAdmin
    .from('client_uploads')
    .select('client_id')
    .eq('id', postId)
    .maybeSingle();

  if (!upload || upload.client_id !== resolved.clientId) return null;
  return resolved;
}

// POST /api/portal/post-tags — add a tag to a post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { portal_token, post_id, tag_id } = parsed.data;

    const resolved = await resolveAndVerify(portal_token, post_id);
    if (!resolved) {
      return NextResponse.json({ error: 'Post not found or access denied' }, { status: 404 });
    }

    // Check it's a tag that belongs to this client
    const { data: tag } = await supabaseAdmin
      .from('tags')
      .select('id, name, color')
      .eq('id', tag_id)
      .eq('client_id', resolved.clientId)
      .maybeSingle();

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('post_tags')
      .insert({ post_id, tag_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, tag }); // already assigned, idempotent
      }
      logger.error('Error adding portal post tag:', error);
      return NextResponse.json({ error: 'Failed to add tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tag }, { status: 201 });
  } catch (error) {
    logger.error('Portal post-tags POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/portal/post-tags?portal_token=x&post_id=x&tag_id=x
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portalToken = searchParams.get('portal_token');
    const postId = searchParams.get('post_id');
    const tagId = searchParams.get('tag_id');

    if (!portalToken || !postId || !tagId) {
      return NextResponse.json({ error: 'portal_token, post_id, and tag_id are required' }, { status: 400 });
    }

    const resolved = await resolveAndVerify(portalToken, postId);
    if (!resolved) {
      return NextResponse.json({ error: 'Post not found or access denied' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('post_tags')
      .delete()
      .eq('post_id', postId)
      .eq('tag_id', tagId);

    if (error) {
      logger.error('Error removing portal post tag:', error);
      return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Portal post-tags DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
