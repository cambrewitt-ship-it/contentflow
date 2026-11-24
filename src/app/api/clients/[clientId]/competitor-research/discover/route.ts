import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { trackAICreditUsage, withAICreditCheck } from '@/lib/subscriptionMiddleware';
import { DISCOVERY_CREDITS, discoverAccounts } from '@/lib/competitor-research/run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

type Params = { params: Promise<{ clientId: string }> };

const bodySchema = z.object({
  platform: z.enum(['instagram', 'tiktok']),
  query: z.string().trim().max(200).optional(),
});

// Search the web for competitors and niche accounts based on the research profile.
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

    const creditCheck = await withAICreditCheck(request, DISCOVERY_CREDITS);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { success: false, error: creditCheck.error || 'Insufficient AI credits' },
        { status: 402 }
      );
    }

    const suggestions = await discoverAccounts(clientId, parsed.data.platform, parsed.data.query || undefined);
    await trackAICreditUsage(auth.user.id, DISCOVERY_CREDITS, 'competitor_discovery', clientId, {
      platform: parsed.data.platform,
      found: suggestions.length,
    });

    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    logger.error('POST /api/clients/[clientId]/competitor-research/discover error:', error);
    return NextResponse.json({ success: false, error: 'Account search failed — please try again.' }, { status: 500 });
  }
}
