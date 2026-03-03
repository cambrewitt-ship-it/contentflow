import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';

export const dynamic = 'force-dynamic';

const CHECKLIST_FIELDS = [
  'checklist_business_profile',
  'checklist_create_post',
  'checklist_add_to_calendar',
  'checklist_publish_post',
] as const;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from('user_profiles')
    .select(CHECKLIST_FIELDS.join(', '))
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch checklist' }, { status: 500 });
  }

  return NextResponse.json({ checklist: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updates: Partial<Record<(typeof CHECKLIST_FIELDS)[number], boolean>> = {};
  for (const field of CHECKLIST_FIELDS) {
    if (field in body && typeof body[field] === 'boolean') {
      updates[field] = body[field] as boolean;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update checklist' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
