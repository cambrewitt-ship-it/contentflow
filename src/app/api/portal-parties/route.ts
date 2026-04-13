import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

const CreatePartySchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  role: z.enum(['media_agency', 'pr_agency', 'creative_agency', 'client', 'other']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  notification_channel: z.enum(['email', 'slack', 'teams']).optional().nullable(),
  notification_config: z.record(z.unknown()).optional(),
});

const UpdatePartySchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['media_agency', 'pr_agency', 'creative_agency', 'client', 'other']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  notification_channel: z.enum(['email', 'slack', 'teams']).optional().nullable(),
  notification_config: z.record(z.unknown()).optional(),
});

// GET /api/portal-parties?client_id=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const client_id = searchParams.get('client_id');

    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const { data: parties, error } = await supabase
      .from('portal_parties')
      .select('id, name, role, portal_token, color, notification_channel, notification_config, created_at')
      .eq('client_id', client_id)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching portal parties:', error);
      return NextResponse.json({ error: 'Failed to fetch portal parties' }, { status: 500 });
    }

    return NextResponse.json({ parties: parties ?? [] });
  } catch (error) {
    logger.error('Portal parties GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/portal-parties
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreatePartySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { client_id, name, role, color, notification_channel, notification_config } = parsed.data;

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const { data: party, error } = await supabase
      .from('portal_parties')
      .insert({
        client_id,
        name,
        role,
        color: color ?? null,
        notification_channel: notification_channel ?? null,
        notification_config: notification_config ?? {},
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating portal party:', error);
      return NextResponse.json({ error: 'Failed to create portal party' }, { status: 500 });
    }

    return NextResponse.json({ party }, { status: 201 });
  } catch (error) {
    logger.error('Portal parties POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/portal-parties
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = UpdatePartySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id, client_id, ...updates } = parsed.data;

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const { data: party, error } = await supabase
      .from('portal_parties')
      .update(updates)
      .eq('id', id)
      .eq('client_id', client_id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating portal party:', error);
      return NextResponse.json({ error: 'Failed to update portal party' }, { status: 500 });
    }

    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    return NextResponse.json({ party });
  } catch (error) {
    logger.error('Portal parties PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/portal-parties?id=xxx&client_id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const client_id = searchParams.get('client_id');

    if (!id || !client_id) {
      return NextResponse.json({ error: 'id and client_id are required' }, { status: 400 });
    }

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const { error } = await supabase
      .from('portal_parties')
      .delete()
      .eq('id', id)
      .eq('client_id', client_id);

    if (error) {
      logger.error('Error deleting portal party:', error);
      return NextResponse.json({ error: 'Failed to delete portal party' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Portal parties DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
