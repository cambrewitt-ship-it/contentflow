import { NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { createSupabaseWithToken, createSupabaseAdmin } from '@/lib/supabaseServer';
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
      if (value === undefined) return 50;
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        throw new Error('limit must be a number');
      }
      return parsed;
    })
    .refine((value) => value >= 1 && value <= 200, {
      message: 'limit must be between 1 and 200',
    }),
  includeImageData: booleanStringSchema,
});

const scheduledPostSchema = z.object({
  scheduledPost: z.object({
    project_id: uuidSchema.nullish(),
    client_id: uuidSchema,
    caption: z.string().max(5000).optional(),
    image_url: z.string().url().nullable().optional(),
    post_notes: z.string().max(5000).nullable().optional(),
    scheduled_date: z.string().min(1, 'scheduled_date is required'),
    scheduled_time: z.string().min(1, 'scheduled_time is required'),
  }),
  unscheduledId: uuidSchema.optional(),
});

const patchSchema = z.object({
  postId: uuidSchema,
  updates: z.object({}).passthrough(),
});

const rescheduleSchema = z.object({
  postId: uuidSchema,
  scheduledDate: z.string().min(1, 'scheduledDate is required'),
  clientId: uuidSchema,
});

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
    logger.warn('Unauthorized calendar access attempt', { reason: userError?.message });
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
    logger.error('Client ownership verification failed', clientError);
    return false;
  }

  if (!client || client.user_id !== userId) {
    logger.warn('Forbidden calendar access attempt', { clientId, userId });
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
      includeImageData: searchParams.get('includeImageData') ?? undefined,
    });
  } catch (validationError) {
    logger.warn('Invalid query parameters for scheduled calendar GET', validationError);
    return NextResponse.json(
      {
        error: 'Invalid query parameters',
        details:
          validationError instanceof Error ? validationError.message : 'Bad request',
      },
      { status: 400 }
    );
  }

  const { clientId, projectId, limit, filterUntagged, includeImageData } = parsedQuery;
  const shouldFilterUntagged = parseBooleanFlag(filterUntagged ?? undefined);
  const shouldIncludeImageData = parseBooleanFlag(includeImageData ?? undefined);

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
    const startTime = Date.now();
    logger.debug('Fetching scheduled posts', { 
      clientId: clientId.substring(0, 8) + '...', 
      project: projectId || 'all', 
      untagged: shouldFilterUntagged, 
      limit, 
      includeImages: shouldIncludeImageData
    });

    // Use admin client to bypass slow RLS policy evaluation
    // Security: ownership already verified above via verifyClientOwnership()
    const adminSupabase = createSupabaseAdmin();

    // Optimized query - only select fields needed for approval board
    const baseFields = 'id, project_id, caption, scheduled_time, scheduled_date, approval_status, needs_attention, client_feedback, late_status, late_post_id, platforms_scheduled, created_at, updated_at, last_edited_at, edit_count, needs_reapproval, original_caption';
    const selectFields = shouldIncludeImageData ? `${baseFields}, image_url` : baseFields;
    
    // Build query based on filter type
    let query = adminSupabase
      .from('calendar_scheduled_posts')
      .select(selectFields)
      .eq('client_id', clientId);
    
    // Apply project filter
    if (shouldFilterUntagged) {
      query = query.is('project_id', null);
    } else if (projectId) {
      query = query.eq('project_id', projectId);
    }
    // If neither filterUntagged nor projectId, return all posts for client
    
    const { data, error } = await query
      .order('scheduled_date', { ascending: true })
      .limit(limit);
    
    const queryDuration = Date.now() - startTime;
    
    if (error) {
      logger.error('❌ Database error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch scheduled posts', 
        details: error.message 
      }, { status: 500 });
    }

    // Debug: Log approval status and captions of posts (only first few)
    if (data && data.length > 0) {

      data.slice(0, 3).forEach((post: Record<string, unknown>) => {
        logger.debug('Post preview', { 
          postId: post.id?.substring(0, 8) + '...', 
          status: post.approval_status || 'NO STATUS', 
          captionLength: post.caption?.length || 0 
        });
      });
    }
    
    // Fetch client uploads (content from portal) - also using admin client
    const { data: uploadsData, error: uploadsError } = await adminSupabase
      .from('client_uploads')
      .select('id, client_id, project_id, file_name, file_type, file_size, file_url, status, notes, created_at, updated_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    if (uploadsError) {
      logger.error('⚠️ Error fetching client uploads:', uploadsError);
      // Don't fail the whole request, just log the error
    }

    return NextResponse.json({ 
      posts: data || [],
      uploads: uploadsData || [],
      performance: {
        queryDuration,
        optimized: queryDuration < 1000, // Consider optimized if under 1 second
        limit,
        includeImageData
      }
    });

  } catch (error) {
    logger.error('❌ Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch scheduled posts', 
      details: error instanceof Error ? error.message : 'Unknown error'
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
    const parseResult = scheduledPostSchema.safeParse(rawBody);

    if (!parseResult.success) {
      logger.warn('Invalid scheduled post payload', parseResult.error);
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { scheduledPost, unscheduledId } = parseResult.data;

    logger.debug('Creating scheduled post', { 
      timestamp: new Date().toISOString(),
      clientId: scheduledPost.client_id.substring(0, 8) + '...',
      projectId: scheduledPost.project_id ?? 'none',
      hasUnscheduledId: Boolean(unscheduledId),
    });

    const ownsClient = await verifyClientOwnership(
      supabase,
      scheduledPost.client_id,
      user.id
    );

    if (!ownsClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate required fields
    if (!scheduledPost.scheduled_date || !scheduledPost.scheduled_time) {
      logger.error('❌ Missing required scheduling fields');
      return NextResponse.json(
        { error: 'Missing required scheduled date or time' },
        { status: 400 }
      );
    }
    
    // unscheduledId is optional - only needed when moving from unscheduled to scheduled
    const isMovingFromUnscheduled = !!unscheduledId;

    logger.debug('Moving from unscheduled', {
      unscheduledId
    });

    // Use admin client to bypass slow RLS policy evaluation
    // Security: ownership already verified above via verifyClientOwnership()
    const adminSupabase = createSupabaseAdmin();

    // Generate ID client-side for faster insert (no need to select back)
    const postId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: scheduleError } = await adminSupabase
      .from('calendar_scheduled_posts')
      .insert({
        id: postId,
        project_id: scheduledPost.project_id ?? null,
        client_id: scheduledPost.client_id,
        caption: scheduledPost.caption ?? null,
        image_url: scheduledPost.image_url ?? null,
        post_notes: scheduledPost.post_notes ?? null,
        scheduled_date: scheduledPost.scheduled_date,
        scheduled_time: scheduledPost.scheduled_time,
        created_at: now,
      });
    
    // Build the response object without needing to fetch from DB
    const scheduled = {
      id: postId,
      project_id: scheduledPost.project_id ?? null,
      client_id: scheduledPost.client_id,
      caption: scheduledPost.caption ?? null,
      image_url: scheduledPost.image_url ?? null,
      post_notes: scheduledPost.post_notes ?? null,
      scheduled_date: scheduledPost.scheduled_date,
      scheduled_time: scheduledPost.scheduled_time,
      created_at: now,
    };
    
    if (scheduleError) {
      logger.error('❌ Database insert error:', scheduleError);
      logger.error('  - Error code:', scheduleError.code);
      logger.error('  - Error message:', scheduleError.message);
      logger.error('  - Error details:', scheduleError.details);
      throw scheduleError;
    }

    logger.debug('Scheduled post created', {
      postId: scheduled.id
    });

    // Only delete from unscheduled if this was moved from unscheduled
    if (isMovingFromUnscheduled) {
      const { error: deleteError } = await adminSupabase
          .from('calendar_unscheduled_posts')
          .delete()
          .eq('id', unscheduledId);
        
        if (deleteError) {
          logger.error('❌ Delete error:', deleteError);
          logger.error('  - Error code:', deleteError.code);
          logger.error('  - Error message:', deleteError.message);
          throw deleteError;
        }
    } else {
      logger.debug('Skipping unscheduled delete - direct create operation');
    }
    
    logger.debug('Scheduled post created', { success: true });
    
    return NextResponse.json({ success: true, post: scheduled });
    
  } catch (error) {
    logger.error('❌ POST /api/calendar/scheduled - CRITICAL ERROR:');
    logger.error('  - Error type:', typeof error);
    logger.error('  - Error message:', error instanceof Error ? error.message : String(error));
    logger.error('  - Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    logger.error('  - Full error object:', JSON.stringify(error, null, 2));
    
    return NextResponse.json({ 
      error: 'Failed to schedule post',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authContext = await getAuthorizedContext(request);
    if ('error' in authContext) {
      return authContext.error;
    }

    const { supabase, user } = authContext;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn('Invalid PATCH payload for scheduled post', parsed.error);
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { postId, updates } = parsed.data;

    const { data: existingPost, error: fetchError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, client_id')
      .eq('id', postId)
      .single();

    if (fetchError) {
      logger.error('Failed to fetch scheduled post for patch', fetchError);
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const ownsClient = await verifyClientOwnership(
      supabase,
      existingPost.client_id,
      user.id
    );

    if (!ownsClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Use admin client to bypass slow RLS policy evaluation
    // Security: ownership already verified above via verifyClientOwnership()
    const adminSupabase = createSupabaseAdmin();
    
    // Ensure image_url is preserved if not being updated
    const updateData = {
      ...updates,
      // If image_url is not in updates, don't overwrite it
      ...(updates.image_url === undefined && { image_url: undefined })
    };
    
    const { error } = await adminSupabase
      .from('calendar_scheduled_posts')
      .update(updateData)
      .eq('id', postId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authContext = await getAuthorizedContext(request);
    if ('error' in authContext) {
      return authContext.error;
    }

    const { supabase, user } = authContext;
    const body = await request.json();
    const parsed = rescheduleSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn('Invalid reschedule payload', parsed.error);
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { postId, scheduledDate, clientId } = parsed.data;

    const ownsClient = await verifyClientOwnership(supabase, clientId, user.id);

    if (!ownsClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Use admin client to bypass slow RLS policy evaluation
    // Security: ownership already verified above via verifyClientOwnership()
    const adminSupabase = createSupabaseAdmin();
    const now = new Date().toISOString();
    
    const { error } = await adminSupabase
      .from('calendar_scheduled_posts')
      .update({ 
        scheduled_date: scheduledDate,
        updated_at: now
      })
      .eq('id', postId)
      .eq('client_id', clientId);
    
    if (error) {
      logger.error('Error updating post date:', error);
      throw error;
    }

    // Return success without needing to fetch data back
    return NextResponse.json({ 
      success: true, 
      post: { id: postId, scheduled_date: scheduledDate, updated_at: now } 
    });
    
  } catch (error) {
    logger.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Failed to update post date',
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
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn('Invalid delete payload for scheduled post', parsed.error);
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { postId } = parsed.data;

    const { data: post, error: fetchError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, client_id')
      .eq('id', postId)
      .single();

    if (fetchError) {
      logger.error('Failed to fetch scheduled post before delete', fetchError);
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const ownsClient = await verifyClientOwnership(supabase, post.client_id, user.id);
    if (!ownsClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Use admin client to bypass slow RLS policy evaluation
    // Security: ownership already verified above via verifyClientOwnership()
    const adminSupabase = createSupabaseAdmin();
    
    const { error } = await adminSupabase
      .from('calendar_scheduled_posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting scheduled post:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
