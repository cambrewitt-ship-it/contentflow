import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { trackPostCreation } from '@/lib/subscriptionMiddleware';
import { getOrCreateDefaultProject } from '@/lib/autopilot-engine';
import type { ResearchReport } from '@/lib/competitor-research/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ clientId: string; reportId: string }> };

const bodySchema = z.object({
  index: z.number().int().min(0).max(20),
  // The caption as edited on the page; falls back to the generated one
  caption: z.string().trim().min(1).max(5000).optional(),
});

// Add a post idea to the calendar's Unscheduled Posts as a text draft; the
// shot list goes in the post notes so whoever makes it knows what to shoot.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { clientId, reportId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: row } = await admin
      .from('competitor_research_reports')
      .select('report')
      .eq('id', reportId)
      .eq('client_id', clientId)
      .maybeSingle();
    const idea = (row?.report as ResearchReport | null)?.post_ideas?.[parsed.data.index];
    if (!idea) {
      return NextResponse.json({ success: false, error: 'Idea not found' }, { status: 404 });
    }

    const project = await getOrCreateDefaultProject(clientId, auth.user.id);
    const caption =
      parsed.data.caption ??
      (idea.hashtags.length ? `${idea.caption}\n\n${idea.hashtags.join(' ')}` : idea.caption);
    const notes = [
      `Competitor research idea: ${idea.title}`,
      idea.format && `Format: ${idea.format}`,
      idea.visual_direction && `Visual: ${idea.visual_direction}`,
      idea.hook && `Hook: ${idea.hook}`,
    ]
      .filter(Boolean)
      .join('\n');

    const { data: post, error } = await admin
      .from('calendar_unscheduled_posts')
      .insert({
        project_id: project.id,
        client_id: clientId,
        caption,
        image_url: null,
        post_notes: notes,
        status: 'draft',
      })
      .select('*')
      .single();
    if (error || !post) {
      logger.error('Research idea → calendar: insert failed:', error);
      return NextResponse.json({ success: false, error: 'Failed to add idea to calendar' }, { status: 500 });
    }

    await trackPostCreation(auth.user.id);
    return NextResponse.json({ success: true, post });
  } catch (error) {
    logger.error('POST /api/clients/[clientId]/competitor-research/reports/[reportId]/ideas error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
