import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { PostValidator, PostData } from '../../../../lib/postValidation';
import { handleApiError, handleDatabaseError, ApiErrors } from '../../../../lib/apiErrorHandler';
import { validateApiRequest } from '../../../../lib/validationMiddleware';
import { updatePostSchema, postIdParamSchema } from '../../../../lib/validators';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  let postId: string | undefined;

  try {
    // SECURITY: Comprehensive input validation with Zod
    const validation = await validateApiRequest(request, {
      body: updatePostSchema,
      params: postIdParamSchema,
      paramsObject: params,
      maxBodySize: 10 * 1024 * 1024, // 10MB limit for posts (to accommodate images)
    });

    if (!validation.success) {
      logger.error('❌ Validation failed');
      return validation.response;
    }

    const { body, params: validatedParams } = validation.data;
    postId = validatedParams!.postId;

    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    // Extract editable fields from validated input
    const {
      caption,
      image_url,
      notes,
      edit_reason,
      edited_by_user_id,
      client_id,
      platforms = ['instagram', 'facebook', 'twitter'], // Default platforms
      // AI generation settings
      ai_tone,
      ai_style,
      ai_hashtags,
      // Tags and categories
      tags,
      categories,
      // Media settings
      media_type,
      media_alt_text,
      // Concurrent editing
      force_edit = false,
      // Draft saving
      save_as_draft = false,
    } = body as any;

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // First, get the current post with full details for validation
    let { data: currentPost, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    // If not found in posts table, check calendar tables
    if (fetchError && fetchError.code === 'PGRST116') {
      // Check calendar_scheduled_posts
      const { data: scheduledPost, error: scheduledError } = await supabase
        .from('calendar_scheduled_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (scheduledPost && !scheduledError) {
        currentPost = scheduledPost;
        fetchError = null;
      } else {
        // Check calendar_unscheduled_posts
        const { data: unscheduledPost, error: unscheduledError } = await supabase
          .from('calendar_unscheduled_posts')
          .select('*')
          .eq('id', postId)
          .single();

        if (unscheduledPost && !unscheduledError) {
          currentPost = unscheduledPost;
          fetchError = null;
        }
      }
    }

    if (fetchError) {
      return handleDatabaseError(
        fetchError,
        {
          route: '/api/posts-by-id/[postId]',
          operation: 'fetch_post',
          clientId: client_id,
          additionalData: { postId },
        },
        'Post not found'
      );
    }

    // Authorization: Verify post belongs to the requesting client
    if (currentPost.client_id !== client_id) {
      logger.error('❌ Unauthorized access attempt:', {
        postClientId: currentPost.client_id,
        requestedClientId: client_id,
      });
      return ApiErrors.forbidden('Post does not belong to this client');
    }

    // 1. POST STATUS VALIDATION
    // Check if post has a status field (main posts table) or if it's in calendar tables
    const hasStatusField = currentPost.status !== undefined;
    const isCalendarPost = currentPost.scheduled_date !== undefined || currentPost.project_id !== undefined;

    if (hasStatusField && !['draft', 'ready', 'scheduled'].includes(currentPost.status)) {
      const statusMessages = {
        published: 'Cannot edit published posts. Please create a new version instead.',
        archived: 'Cannot edit archived posts. Please restore the post first.',
        deleted: 'Cannot edit deleted posts.',
      };
      return NextResponse.json(
        {
          error:
            statusMessages[currentPost.status as keyof typeof statusMessages] ||
            'Cannot edit this post in its current status',
          currentStatus: currentPost.status,
        },
        { status: 400 }
      );
    }

    // For calendar posts, we allow editing by default since they don't have restrictive status values
    if (isCalendarPost) {
      logger.debug('Calendar post - allowing edit (no status restrictions)');
    }

    // 2. CONCURRENT EDITING PREVENTION
    const now = new Date();
    const editingTimeout = 30 * 60 * 1000; // 30 minutes
    const isCurrentlyBeingEdited =
      currentPost.currently_editing_by &&
      currentPost.editing_started_at &&
      now.getTime() - new Date(currentPost.editing_started_at).getTime() < editingTimeout;

    if (isCurrentlyBeingEdited && currentPost.currently_editing_by !== edited_by_user_id && !force_edit) {
      const editingUser = currentPost.currently_editing_by;
      const editingStarted = new Date(currentPost.editing_started_at);

      return NextResponse.json(
        {
          error: 'Post is currently being edited by another user',
          currentlyEditingBy: editingUser,
          editingStartedAt: editingStarted.toISOString(),
          canForceEdit: true,
          message: 'Use force_edit=true to override the lock',
        },
        { status: 409 }
      );
    }

    // 3. DATA CONSISTENCY VALIDATION
    const postData: PostData = {
      caption: caption || currentPost.caption,
      image_url: image_url || currentPost.image_url,
      media_type: media_type || currentPost.media_type,
      platforms,
      tags: tags || currentPost.tags,
      ai_settings: {
        tone: ai_tone || currentPost.ai_settings?.tone,
        style: ai_style || currentPost.ai_settings?.style,
        hashtags: ai_hashtags || currentPost.ai_settings?.hashtags,
      },
    };

    const postValidation = PostValidator.validatePost(postData, platforms);

    if (!postValidation.isValid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          validationErrors: postValidation.errors,
          validationWarnings: postValidation.warnings,
          platformWarnings: postValidation.platformWarnings,
        },
        { status: 400 }
      );
    }

    // 4. DRAFT SAVING (if requested)
    if (save_as_draft) {
      const draftData = {
        caption: caption || currentPost.caption,
        image_url: image_url || currentPost.image_url,
        notes: notes || currentPost.notes,
        tags: tags || currentPost.tags,
        categories: categories || currentPost.categories,
        ai_settings: {
          tone: ai_tone || currentPost.ai_settings?.tone,
          style: ai_style || currentPost.ai_settings?.style,
          hashtags: ai_hashtags || currentPost.ai_settings?.hashtags,
        },
        saved_at: now.toISOString(),
        saved_by: edited_by_user_id,
      };

      const { error: draftError } = await supabase
        .from('posts')
        .update({ draft_changes: draftData })
        .eq('id', postId);

      if (draftError) {
        logger.error('❌ Error saving draft:', draftError);
        return NextResponse.json(
          { error: 'Failed to save draft changes' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Draft changes saved successfully',
        draftData,
      });
    }

    // 5. APPROVAL WORKFLOW - Check if reapproval needed
    const needsReapproval =
      caption && caption !== currentPost.caption && currentPost.approval_status === 'approved';

    // Prepare update data - only editable fields
    const updateData: any = {
      updated_at: now.toISOString(),
      last_edited_by: edited_by_user_id,
      last_edited_at: now.toISOString(),
      last_modified_at: now.toISOString(),
      edit_count: (currentPost.edit_count || 0) + 1,
      currently_editing_by: edited_by_user_id,
      editing_started_at: now.toISOString(),
    };

    // Add editable fields that are being updated
    if (caption !== undefined) {
      updateData.caption = caption;
    }
    if (image_url !== undefined) {
      updateData.image_url = image_url;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (edit_reason !== undefined) {
      updateData.edit_reason = edit_reason;
    }

    // Only add media_type and media_alt_text for main posts table, not calendar tables
    if (!isCalendarPost) {
      if (media_type !== undefined) {
        updateData.media_type = media_type;
      }
      if (media_alt_text !== undefined) {
        updateData.media_alt_text = media_alt_text;
      }
    } else {
      logger.debug('Calendar post - skipping media_type and media_alt_text (not supported)');
    }

    // AI generation settings (store as JSONB)
    const aiSettings: any = {};
    if (ai_tone !== undefined) aiSettings.tone = ai_tone;
    if (ai_style !== undefined) aiSettings.style = ai_style;
    if (ai_hashtags !== undefined) aiSettings.hashtags = ai_hashtags;

    if (Object.keys(aiSettings).length > 0) {
      updateData.ai_settings = aiSettings;
    }

    // Tags and categories (store as JSONB arrays)
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags : [];
    }
    if (categories !== undefined) {
      updateData.categories = Array.isArray(categories) ? categories : [];
    }

    // Platform requirements (store validation results)
    updateData.platform_requirements = {
      validated_platforms: platforms,
      validation_warnings: postValidation.platformWarnings,
      last_validated_at: now.toISOString(),
    };

    // 6. REAPPROVAL LOGIC
    if (needsReapproval) {
      updateData.needs_reapproval = true;
      updateData.approval_status = 'pending';
      updateData.reapproval_notified_at = null; // Reset notification flag
    }

    // Clear draft changes if we're committing the edit
    updateData.draft_changes = {};

    // Audit logging
    const changes = Object.keys(updateData).filter(
      (key) =>
        ![
          'updated_at',
          'last_edited_by',
          'last_edited_at',
          'edit_count',
          'currently_editing_by',
          'editing_started_at',
          'last_modified_at',
        ].includes(key)
    );

    // Determine which table to update based on where the post was found
    let tableName = 'posts';
    if (currentPost.scheduled_date) {
      tableName = 'calendar_scheduled_posts';
    } else if (currentPost.project_id && !currentPost.scheduled_date) {
      tableName = 'calendar_unscheduled_posts';
    }

    // Update the post in the appropriate table
    const { data: updatedPost, error: updateError } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', postId)
      .eq('client_id', client_id) // Double-check authorization
      .select('*')
      .single();

    if (updateError) {
      return handleDatabaseError(
        updateError,
        {
          route: '/api/posts-by-id/[postId]',
          operation: 'update_post',
          clientId: client_id,
          additionalData: { postId, tableName },
        },
        'Failed to update post'
      );
    }

    // 7. SEND REAPPROVAL NOTIFICATION (if needed)
    if (needsReapproval) {
      // TODO: Implement notification system
    }

    return NextResponse.json({
      success: true,
      post: updatedPost,
      message: 'Post updated successfully with enhanced validation',
      changes: changes,
      needsReapproval: updatedPost.needs_reapproval,
      validationWarnings: postValidation.warnings,
      platformWarnings: postValidation.platformWarnings,
      currentlyEditing: {
        by: updatedPost.currently_editing_by,
        startedAt: updatedPost.editing_started_at,
      },
    });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/posts-by-id/[postId]',
      operation: 'update_post',
      additionalData: { postId },
    });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  let postId: string | undefined;

  try {
    // SECURITY: Validate URL parameters
    const validation = await validateApiRequest(request, {
      params: postIdParamSchema,
      paramsObject: params,
    });

    if (!validation.success) {
      return validation.response;
    }

    const { params: validatedParams } = validation.data;
    postId = validatedParams!.postId;

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // First try to find the post in the main posts table
    let { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    // If not found in posts table, check calendar tables
    if (error && error.code === 'PGRST116') {
      // Check calendar_scheduled_posts
      const { data: scheduledPost, error: scheduledError } = await supabase
        .from('calendar_scheduled_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (scheduledPost && !scheduledError) {
        post = scheduledPost;
        error = null;
      } else {
        // Check calendar_unscheduled_posts
        const { data: unscheduledPost, error: unscheduledError } = await supabase
          .from('calendar_unscheduled_posts')
          .select('*')
          .eq('id', postId)
          .single();

        if (unscheduledPost && !unscheduledError) {
          post = unscheduledPost;
          error = null;
        } else {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }
      }
    }

    if (error) {
      return handleDatabaseError(
        error,
        {
          route: '/api/posts-by-id/[postId]',
          operation: 'fetch_post',
          additionalData: { postId },
        },
        'Post not found'
      );
    }

    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/posts-by-id/[postId]',
      operation: 'fetch_post',
      additionalData: { postId },
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  let postId: string | undefined;

  try {
    // SECURITY: Validate URL parameters
    const validation = await validateApiRequest(request, {
      params: postIdParamSchema,
      paramsObject: params,
    });

    if (!validation.success) {
      return validation.response;
    }

    const { params: validatedParams } = validation.data;
    postId = validatedParams!.postId;

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // First check if post exists and is not published
    const { data: currentPost, error: fetchError } = await supabase
      .from('posts')
      .select('status')
      .eq('id', postId)
      .single();

    if (fetchError) {
      return handleDatabaseError(
        fetchError,
        {
          route: '/api/posts-by-id/[postId]',
          operation: 'fetch_post_for_deletion',
          additionalData: { postId },
        },
        'Post not found'
      );
    }

    // Validation: Prevent deletion of published posts
    if (currentPost.status === 'published') {
      return ApiErrors.badRequest('Cannot delete published posts. Please archive instead.');
    }

    // Delete the post (revisions will be deleted automatically due to CASCADE)
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      return handleDatabaseError(
        deleteError,
        {
          route: '/api/posts-by-id/[postId]',
          operation: 'delete_post',
          additionalData: { postId },
        },
        'Failed to delete post'
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/posts-by-id/[postId]',
      operation: 'delete_post',
      additionalData: { postId },
    });
  }
}
