import { NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { createSupabaseWithToken } from '@/lib/supabaseServer';
import { uuidSchema } from '@/lib/validators';

const booleanStringSchema = z
  .union([z.literal('true'), z.literal('false')])
  .optional();

const getQuerySchema = z.object({
  clientId: uuidSchema,
  projectId: uuidSchema.nullish(),
  filterUntagged: booleanStringSchema,
  limit: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return 20;
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        throw new Error('limit must be a number');
      }
      return parsed;
    })
    .refine((value) => value >= 1 && value <= 200, {
      message: 'limit must be between 1 and 200',
    }),
});

const createUnscheduledSchema = z
  .object({
    client_id: uuidSchema,
    project_id: uuidSchema.nullish(),
    caption: z.string().max(5000).optional(),
    image_url: z.string().url().nullable().optional(),
    post_notes: z.string().max(5000).nullable().optional(),
  })
  .passthrough();

const deleteSchema = z.object({
  postId: uuidSchema,
});

function parseBooleanFlag(value: string | undefined | null): boolean {
  return value === 'true';
}

async function getAuthorizedContext(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const token = authHeader.substring(7);
  const supabase = createSupabaseWithToken(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logger.warn('Unauthorized unscheduled calendar access attempt', { reason: userError?.message });
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { supabase, user };
}

async function verifyClientOwnership(
  supabase: ReturnType<typeof createSupabaseWithToken>,
  clientId: string,
  userId: string
) {
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, user_id')
    .eq('id', clientId)
    .single();

  if (clientError) {
    logger.error('Unscheduled client ownership verification failed', clientError);
    return false;
  }

  if (!client || client.user_id !== userId) {
    logger.warn('Forbidden unscheduled calendar access attempt', { clientId, userId });
    return false;
  }

  return true;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  let parsedQuery;
  try {
    parsedQuery = getQuerySchema.parse({
      clientId: searchParams.get('clientId'),
      projectId: searchParams.get('projectId'),
      filterUntagged: searchParams.get('filterUntagged') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
  } catch (validationError) {
    logger.warn('Invalid query parameters for unscheduled calendar GET', validationError);
    return NextResponse.json(
      {
        error: 'Invalid query parameters',
        details:
          validationError instanceof Error ? validationError.message : 'Bad request',
      },
      { status: 400 }
    );
  }

  const { clientId, projectId, limit, filterUntagged } = parsedQuery;
  const shouldFilterUntagged = parseBooleanFlag(filterUntagged ?? undefined);

  const authContext = await getAuthorizedContext(request);
  if ('error' in authContext) {
    return authContext.error;
  }

  const { supabase, user } = authContext;

  const ownsClient = await verifyClientOwnership(supabase, clientId, user.id);
  if (!ownsClient) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    logger.debug('Fetching unscheduled posts', { 
      clientIdPreview: clientId?.substring(0, 8) + '...', 
      project: projectId || 'all', 
      untagged: shouldFilterUntagged 
    });

    // Build query based on filter type
    let query = supabase
      .from('calendar_unscheduled_posts')
      .select('*') // Simple: select all columns
      .eq('client_id', clientId); // Filter by client
    
    // Apply project filter
    if (shouldFilterUntagged) {
      query = query.is('project_id', null);
    } else if (projectId) {
      query = query.eq('project_id', projectId);
    }
    // If neither filterUntagged nor projectId, return all posts for client
    
    const { data, error } = await query
      .order('created_at', { ascending: false }) // Simple: single ORDER BY
      .limit(limit); // CRITICAL: Limit to prevent timeout
    
    if (error) throw error;

    // Debug logging for captions
    if (data && data.length > 0) {
      data.forEach(() => {
        // Debug logging can be added here if needed
      });
    }
    
    return NextResponse.json({ posts: data || [] });
    
  } catch (error: unknown) {
    logger.error('❌ Error fetching unscheduled posts:', error);
    
    // Enhanced error handling for timeouts
    if (error && typeof error === 'object' && 'code' in error && error.code === '57014') {
      logger.error('❌ Database timeout error detected');
      return NextResponse.json({ 
        error: 'Database query timeout - too many posts to load',
        code: 'TIMEOUT',
        suggestion: 'Try reducing the number of posts or contact support'
      }, { status: 408 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch unscheduled posts',
      details: error instanceof Error ? error.message : String(error),
      code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await getAuthorizedContext(request);
    if ('error' in authContext) {
      return authContext.error;
    }

    const { supabase, user } = authContext;
    const rawBody = await request.json();
    const parsed = createUnscheduledSchema.safeParse(rawBody);

    if (!parsed.success) {
      logger.warn('Invalid unscheduled post payload', parsed.error);
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const postData = parsed.data;

    const ownsClient = await verifyClientOwnership(
      supabase,
      postData.client_id,
      user.id
    );

    if (!ownsClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Generate ID client-side to avoid needing to select it back
    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Insert the post WITHOUT .select() to avoid RLS/trigger delays
    // This is much faster as it doesn't need to return data
    const { error } = await supabase
      .from('calendar_unscheduled_posts')
      .insert({
        id: postId,
        ...postData,
        created_at: now,
      });
    
    if (error) throw error;
    
    // Return the data we already know without fetching from DB
    return NextResponse.json({ 
      success: true, 
      post: {
        id: postId,
        client_id: postData.client_id,
        project_id: postData.project_id || null,
        caption: postData.caption || null,
        image_url: postData.image_url || null,
        post_notes: postData.post_notes || null,
        created_at: now,
      }
    });
  } catch (error: unknown) {
    logger.error('❌ Error creating unscheduled post:', error);
    
    // Enhanced error handling for timeouts
    if (error && typeof error === 'object' && 'code' in error && error.code === '57014') {
      logger.error('❌ Database timeout on POST - possible index issue');
      return NextResponse.json({ 
        error: 'Database operation timed out',
        code: 'TIMEOUT',
        suggestion: 'The post may have been created. Please refresh the page.'
      }, { status: 408 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to create post',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authContext = await getAuthorizedContext(request);
    if ('error' in authContext) {
      return authContext.error;
    }

    const { supabase, user } = authContext;

    const { searchParams } = new URL(request.url);
    const postIdParam = searchParams.get('postId');
    const parsed = deleteSchema.safeParse({ postId: postIdParam ?? undefined });

    if (!parsed.success) {
      logger.warn('Invalid unscheduled delete parameters', parsed.error);
      return NextResponse.json(
        { error: 'postId is required and must be a UUID' },
        { status: 400 }
      );
    }

    const { postId } = parsed.data;

    const { data: post, error: fetchError } = await supabase
      .from('calendar_unscheduled_posts')
      .select('id, client_id')
      .eq('id', postId)
      .single();

    if (fetchError) {
      logger.error('Failed to fetch unscheduled post before delete', fetchError);
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const ownsClient = await verifyClientOwnership(supabase, post.client_id, user.id);
    if (!ownsClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('calendar_unscheduled_posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('❌ Error deleting unscheduled post:', error);
    return NextResponse.json({ 
      error: 'Failed to delete post',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
