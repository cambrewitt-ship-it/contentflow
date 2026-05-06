import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

const supabaseAdmin = createSupabaseAdmin();

const UpdateTagSchema = z.object({
  portal_token: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// PUT /api/portal/tags/[tagId] — update a tag's name and/or color
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const { tagId } = await params;
    const body = await request.json();
    const parsed = UpdateTagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { portal_token, ...updates } = parsed.data;
    const resolved = await resolvePortalToken(portal_token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    const { data: tag } = await supabaseAdmin
      .from('tags')
      .select('id, client_id')
      .eq('id', tagId)
      .single();

    if (!tag || tag.client_id !== resolved.clientId) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    if (updates.name) {
      const { data: existing } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('client_id', resolved.clientId)
        .eq('name', updates.name)
        .neq('id', tagId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
      }
    }

    const { data: updatedTag, error } = await supabaseAdmin
      .from('tags')
      .update(updates)
      .eq('id', tagId)
      .select('id, name, color')
      .single();

    if (error) {
      logger.error('Error updating portal tag:', error);
      return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tag: updatedTag });
  } catch (error) {
    logger.error('Portal tags PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/portal/tags/[tagId]?portal_token=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const { tagId } = await params;
    const { searchParams } = new URL(request.url);
    const portalToken = searchParams.get('portal_token');

    if (!portalToken) {
      return NextResponse.json({ error: 'portal_token required' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(portalToken);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    const { data: tag } = await supabaseAdmin
      .from('tags')
      .select('id, client_id')
      .eq('id', tagId)
      .single();

    if (!tag || tag.client_id !== resolved.clientId) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (error) {
      logger.error('Error deleting portal tag:', error);
      return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Portal tags DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
