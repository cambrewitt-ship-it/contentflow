import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { normalizeHandle } from '@/lib/competitor-research/profile';
import { fetchInstagramAccount, instagramResearchConfigured, InstagramLookupError } from '@/lib/competitor-research/instagram';
import { MAX_TRACKED_ACCOUNTS } from '@/lib/competitor-research/run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ clientId: string }> };

const bodySchema = z.object({
  platform: z.enum(['instagram', 'tiktok']),
  handle: z.string().trim().min(1).max(200),
  relationship: z.enum(['competitor', 'inspiration']).default('competitor'),
  source: z.enum(['manual', 'discovered']).default('manual'),
});

// Track an account. Instagram handles are looked up first so typos and
// personal accounts (which Business Discovery can't read) are caught here
// rather than on the next research run.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }
    const { platform, relationship, source } = parsed.data;
    const handle = normalizeHandle(platform, parsed.data.handle);
    if (!handle) {
      return NextResponse.json({ success: false, error: "That doesn't look like a valid handle" }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { count } = await admin
      .from('competitor_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId);
    if ((count ?? 0) >= MAX_TRACKED_ACCOUNTS) {
      return NextResponse.json(
        { success: false, error: `You can track up to ${MAX_TRACKED_ACCOUNTS} accounts — remove one first.` },
        { status: 400 }
      );
    }

    let details: Record<string, unknown> = {};
    if (platform === 'instagram' && instagramResearchConfigured()) {
      try {
        const account = await fetchInstagramAccount(handle, 0);
        details = {
          display_name: account.display_name,
          bio: account.bio,
          profile_picture_url: account.profile_picture_url,
          followers_count: account.followers_count,
          media_count: account.media_count,
          last_checked_at: new Date().toISOString(),
        };
      } catch (err) {
        if (err instanceof InstagramLookupError && err.kind !== 'not_found') {
          // Rate limit / config problems shouldn't block tracking the handle
          logger.warn('Competitor account lookup skipped', { handle, kind: err.kind });
        } else {
          return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Instagram lookup failed' },
            { status: 400 }
          );
        }
      }
    }

    const { data, error } = await admin
      .from('competitor_accounts')
      .insert({ client_id: clientId, platform, handle, relationship, source, ...details })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: `@${handle} is already tracked` }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, account: data }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/clients/[clientId]/competitor-research/accounts error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
