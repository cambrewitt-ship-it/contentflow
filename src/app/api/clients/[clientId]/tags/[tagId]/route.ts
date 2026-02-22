import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code').optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; tagId: string }> }
) {
  try {
    const { clientId, tagId } = await params;
    const body = await request.json();
    const parsed = updateTagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify client ownership first
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const supabase = auth.supabase;

    // Get the tag and verify it belongs to the specified client
    const { data: tag, error: fetchError } = await supabase
      .from('tags')
      .select('id, client_id')
      .eq('id', tagId)
      .single();

    if (fetchError || !tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Verify the tag belongs to the client in the path
    if (tag.client_id !== clientId) {
      return NextResponse.json(
        { error: 'Tag does not belong to this client' },
        { status: 403 }
      );
    }

    // If name is being updated, check for duplicates
    if (parsed.data.name) {
      const { data: existingTag } = await supabase
        .from('tags')
        .select('id')
        .eq('client_id', clientId)
        .eq('name', parsed.data.name)
        .neq('id', tagId)
        .maybeSingle();

      if (existingTag) {
        return NextResponse.json(
          { error: 'Tag with this name already exists' },
          { status: 409 }
        );
      }
    }

    const { data: updatedTag, error } = await supabase
      .from('tags')
      .update(parsed.data)
      .eq('id', tagId)
      .select('*')
      .single();

    if (error) {
      logger.error('❌ Error updating tag:', error);
      return NextResponse.json(
        { error: 'Failed to update tag', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, tag: updatedTag });
  } catch (error) {
    logger.error('💥 Error in PUT tags route:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; tagId: string }> }
) {
  try {
    const { clientId, tagId } = await params;

    // Verify client ownership first
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const supabase = auth.supabase;

    // Get the tag and verify it belongs to the specified client
    const { data: tag, error: fetchError } = await supabase
      .from('tags')
      .select('id, client_id')
      .eq('id', tagId)
      .single();

    if (fetchError || !tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Verify the tag belongs to the client in the path
    if (tag.client_id !== clientId) {
      return NextResponse.json(
        { error: 'Tag does not belong to this client' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (error) {
      logger.error('❌ Error deleting tag:', error);
      return NextResponse.json(
        { error: 'Failed to delete tag', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('💥 Error in DELETE tags route:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
