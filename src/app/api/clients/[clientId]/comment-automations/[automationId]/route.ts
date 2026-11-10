import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { deleteAutomation, listAutomations, updateAutomation, ZernioError } from '@/lib/zernio/api';

export const dynamic = 'force-dynamic';

// Pause/resume (PATCH { isActive }) or delete one of a client's keyword auto-DMs.
// The automation must belong to the client's Zernio profile.

type Params = { params: Promise<{ clientId: string; automationId: string }> };

async function owned(clientId: string, automationId: string): Promise<boolean> {
  const { data } = await createSupabaseAdmin().from('clients').select('late_profile_id').eq('id', clientId).maybeSingle();
  if (!data?.late_profile_id) return false;
  const list = await listAutomations(data.late_profile_id);
  return list.some((a) => (a.id ?? a._id) === automationId);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { clientId, automationId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  try {
    if (!(await owned(clientId, automationId))) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    await updateAutomation(automationId, { isActive: body?.isActive === true });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZernioError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    logger.error('PATCH automation error:', error);
    return NextResponse.json({ success: false, error: 'Could not update the auto-DM' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { clientId, automationId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  try {
    if (!(await owned(clientId, automationId))) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    await deleteAutomation(automationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZernioError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    logger.error('DELETE automation error:', error);
    return NextResponse.json({ success: false, error: 'Could not delete the auto-DM' }, { status: 500 });
  }
}
