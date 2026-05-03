import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

const supabaseAdmin = createSupabaseAdmin();

const CreateTagSchema = z.object({
  portal_token: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

// GET /api/portal/tags?portal_token=xxx — list all tags for the client
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portalToken = searchParams.get('portal_token');

    if (!portalToken) {
      return NextResponse.json({ error: 'portal_token required' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(portalToken);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    const { data: tags, error } = await supabaseAdmin
      .from('tags')
      .select('id, name, color')
      .eq('client_id', resolved.clientId)
      .order('name', { ascending: true });

    if (error) {
      logger.error('Error fetching portal tags:', error);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tags: tags ?? [] });
  } catch (error) {
    logger.error('Portal tags GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/portal/tags — create a new tag for the client
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateTagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { portal_token, name, color } = parsed.data;

    const resolved = await resolvePortalToken(portal_token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    const { data: tag, error } = await supabaseAdmin
      .from('tags')
      .insert({ client_id: resolved.clientId, name: name.trim(), color })
      .select('id, name, color')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
      }
      logger.error('Error creating portal tag:', error);
      return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tag }, { status: 201 });
  } catch (error) {
    logger.error('Portal tags POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
