import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { brandKitSchema, normalizeBrandKit, EMPTY_BRAND_KIT } from '@/lib/brandKit';

export const dynamic = 'force-dynamic';

// The client's brand kit for the Design Studio (logos, colours, fonts, uploads library).

type Params = { params: Promise<{ clientId: string }> };

// Postgres "relation does not exist" — migration 031 hasn't been run yet
const isMissingTable = (error: { code?: string } | null) => error?.code === '42P01';
const SETUP_MESSAGE = 'Brand kits need a one-off database update (migrations/031-brand-kits.sql).';

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from('client_brand_kits')
    .select('kit')
    .eq('client_id', clientId)
    .maybeSingle();

  if (error && !isMissingTable(error)) {
    logger.error('GET brand kit error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load brand kit' }, { status: 500 });
  }
  if (data) {
    return NextResponse.json({ success: true, kit: normalizeBrandKit(data.kit), saved: true });
  }

  // No kit yet: start from the client's existing logo
  const { data: client } = await admin.from('clients').select('logo_url').eq('id', clientId).maybeSingle();
  const logoUrl = client?.logo_url as string | null | undefined;
  const kit = {
    ...EMPTY_BRAND_KIT,
    logos: logoUrl?.startsWith('https://') ? [{ id: 'client-logo', url: logoUrl, name: 'Logo' }] : [],
  };
  return NextResponse.json({
    success: true,
    kit,
    saved: false,
    ...(isMissingTable(error) ? { setupRequired: SETUP_MESSAGE } : {}),
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    const parsed = brandKitSchema.safeParse(body?.kit);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid brand kit' },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const { error } = await admin.from('client_brand_kits').upsert({
      client_id: clientId,
      kit: parsed.data,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ success: false, error: SETUP_MESSAGE }, { status: 503 });
      }
      logger.error('PUT brand kit error:', error);
      return NextResponse.json({ success: false, error: 'Failed to save brand kit' }, { status: 500 });
    }
    return NextResponse.json({ success: true, kit: parsed.data });
  } catch (error) {
    logger.error('PUT /api/clients/[clientId]/brand-kit error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
