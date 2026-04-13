import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const UpdateUploadSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'unassigned', 'in_use', 'published']).optional(),
  notes: z.string().max(2000).optional().nullable(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// PATCH /api/client-uploads/[uploadId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  try {
    const { uploadId } = await params;
    const body = await request.json();
    const parsed = UpdateUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    // Verify upload belongs to a client owned by this user
    const { data: upload } = await supabaseAdmin
      .from('client_uploads')
      .select('id, client_id')
      .eq('id', uploadId)
      .maybeSingle();

    if (!upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    const { data: clientCheck } = await supabase
      .from('clients')
      .select('id')
      .eq('id', upload.client_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!clientCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('client_uploads')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', uploadId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating upload:', error);
      return NextResponse.json({ error: 'Failed to update upload' }, { status: 500 });
    }

    return NextResponse.json({ upload: updated });
  } catch (error) {
    logger.error('Client upload PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
