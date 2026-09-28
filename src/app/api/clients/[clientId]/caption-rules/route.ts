import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { listCaptionRules, saveCaptionRule } from '@/lib/captionPlaybook';

export const dynamic = 'force-dynamic';

// The client's caption playbook — rules the Content Agent follows on every run.

type Params = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  const rules = await listCaptionRules(clientId);
  return NextResponse.json({ success: true, rules });
}

const createSchema = z.object({ rule: z.string().trim().min(1).max(500) });

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const saved = await saveCaptionRule({
      clientId,
      userId: auth.user.id,
      rule: parsed.data.rule,
      source: 'manual',
    });
    if (!saved) {
      return NextResponse.json({ success: false, error: 'Failed to save rule' }, { status: 500 });
    }
    return NextResponse.json({ success: true, rule: saved }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/clients/[clientId]/caption-rules error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  const ruleId = request.nextUrl.searchParams.get('id');
  if (!ruleId || !z.string().uuid().safeParse(ruleId).success) {
    return NextResponse.json({ success: false, error: 'A valid rule id is required' }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from('client_caption_rules')
    .delete()
    .eq('id', ruleId)
    .eq('client_id', clientId);

  if (error) {
    logger.error('DELETE caption rule error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete rule' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
