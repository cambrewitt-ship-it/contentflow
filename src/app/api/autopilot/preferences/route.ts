import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { getStylePreferences } from '@/lib/preference-engine';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  clientId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({ clientId: searchParams.get('clientId') });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'clientId is required' },
        { status: 400 }
      );
    }

    const { clientId } = parsed.data;

    const ownership = await requireClientOwnership(request, clientId);
    if (ownership.error) return ownership.error;

    const preferences = await getStylePreferences(clientId);

    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    logger.error('GET /api/autopilot/preferences error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({ clientId: searchParams.get('clientId') });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'clientId is required' },
        { status: 400 }
      );
    }

    const { clientId } = parsed.data;

    const ownership = await requireClientOwnership(request, clientId);
    if (ownership.error) return ownership.error;

    const admin = createSupabaseAdmin();
    const { error: deleteErr } = await admin
      .from('content_preferences')
      .delete()
      .eq('client_id', clientId);

    if (deleteErr) {
      logger.error('DELETE /api/autopilot/preferences error:', deleteErr);
      return NextResponse.json({ success: false, error: 'Failed to delete preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/autopilot/preferences error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
