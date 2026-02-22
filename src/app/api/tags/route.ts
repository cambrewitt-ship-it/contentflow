import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

const createTagSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createTagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { client_id, name, color } = parsed.data;

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;
    const supabase = auth.supabase;

    // Check if tag with same name already exists for this client
    const { data: existingTag } = await supabase
      .from('tags')
      .select('id')
      .eq('client_id', client_id)
      .eq('name', name)
      .maybeSingle();

    if (existingTag) {
      return NextResponse.json(
        { error: 'Tag with this name already exists' },
        { status: 409 }
      );
    }

    const { data: tag, error } = await supabase
      .from('tags')
      .insert([{ client_id, name, color }])
      .select('*')
      .single();

    if (error) {
      logger.error('❌ Error creating tag:', error);
      return NextResponse.json(
        { error: 'Failed to create tag', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, tag }, { status: 201 });
  } catch (error) {
    logger.error('💥 Error in POST tags route:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
