import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { createSupabaseWithToken } from '@/lib/supabaseServer';
import { validateApiRequest } from '@/lib/validationMiddleware';
import { uuidSchema } from '@/lib/validators';

const clientIdParamSchema = z.object({
  clientId: uuidSchema,
});

const deletePostSchema = z.object({
  postId: uuidSchema,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const validation = await validateApiRequest(request, {
      params: clientIdParamSchema,
      paramsObject: params,
      checkAuth: true,
    });

    if (!validation.success) {
      return validation.response;
    }

    const { params: validatedParams, token } = validation.data;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = validatedParams!.clientId;
    const supabase = createSupabaseWithToken(token);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      logger.error('❌ Failed to retrieve authenticated user:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .single();

    if (clientError) {
      logger.error('❌ Client ownership check failed:', clientError);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!client || client.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        last_edited_by:clients!posts_last_edited_by_fkey(id, name, email)
      `)
      .eq('client_id', clientId)
      .in('status', ['draft', 'ready'])
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('❌ Supabase error:', error);
      logger.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    // Optionally process/return only if data exists, but even if empty, return an array
    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    logger.error('💥 Error fetching posts:', error);
    return NextResponse.json({
      error: 'Failed to fetch posts',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const validation = await validateApiRequest(request, {
      body: deletePostSchema,
      params: clientIdParamSchema,
      paramsObject: params,
      checkAuth: true,
    });

    if (!validation.success) {
      return validation.response;
    }

    const { body, params: validatedParams, token } = validation.data;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = body!;
    const { clientId } = validatedParams!;

    const supabase = createSupabaseWithToken(token);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      logger.error('❌ Failed to retrieve authenticated user:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .single();

    if (clientError) {
      logger.error('❌ Client ownership check failed during delete:', clientError);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!client || client.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('client_id', clientId); // Ensure user can only delete their client's posts

    if (error) {
      logger.error('❌ Supabase delete error:', error);
      logger.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    logger.error('💥 Unexpected error in DELETE:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete post' },
      { status: 500 }
    );
  }
}
