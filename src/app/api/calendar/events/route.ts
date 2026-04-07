import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseWithToken, createSupabaseAdmin } from '@/lib/supabaseServer';
import { uuidSchema } from '@/lib/validators';

async function getAuthorizedContext(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const token = authHeader.substring(7);
  const supabase = createSupabaseWithToken(token);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, supabase };
}

const getQuerySchema = z.object({
  clientId: uuidSchema,
});

const createSchema = z.object({
  client_id: uuidSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).nullable().optional(),
  type: z.enum(['event', 'note']).default('event'),
  color: z.string().max(20).default('purple'),
});

const patchSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
  type: z.enum(['event', 'note']).optional(),
  color: z.string().max(20).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const deleteSchema = z.object({
  id: uuidSchema,
});

export async function GET(request: Request) {
  const ctx = await getAuthorizedContext(request);
  if ('error' in ctx) return ctx.error;

  const { searchParams } = new URL(request.url);
  const parseResult = getQuerySchema.safeParse({ clientId: searchParams.get('clientId') });
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });
  }

  const { clientId } = parseResult.data;
  const admin = createSupabaseAdmin();

  const { data, error } = await admin
    .from('calendar_events')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data });
}

export async function POST(request: Request) {
  const ctx = await getAuthorizedContext(request);
  if ('error' in ctx) return ctx.error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = createSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from('calendar_events')
    .insert(parseResult.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ctx = await getAuthorizedContext(request);
  if ('error' in ctx) return ctx.error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = patchSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const { id, ...updates } = parseResult.data;
  const admin = createSupabaseAdmin();

  const { data, error } = await admin
    .from('calendar_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data });
}

export async function DELETE(request: Request) {
  const ctx = await getAuthorizedContext(request);
  if ('error' in ctx) return ctx.error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = deleteSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from('calendar_events')
    .delete()
    .eq('id', parseResult.data.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
