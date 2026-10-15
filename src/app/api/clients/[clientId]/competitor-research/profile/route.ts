import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { saveResearchProfile } from '@/lib/competitor-research/profile';
import { researchProfileSchema } from '@/lib/competitor-research/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ clientId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { clientId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const parsed = researchProfileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid profile' },
        { status: 400 }
      );
    }
    if (!parsed.data.category) {
      return NextResponse.json({ success: false, error: 'Add your business category' }, { status: 400 });
    }

    await saveResearchProfile(clientId, parsed.data);
    return NextResponse.json({ success: true, profile: parsed.data });
  } catch (error) {
    logger.error('PUT /api/clients/[clientId]/competitor-research/profile error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
