import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { PostValidator, PostData } from '../../../../lib/postValidation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();
    
    console.log('🔄 Enhanced Post Editing - Updating post:', { postId, body });
    
    // Extract editable fields from content suite
    const { 
      caption, 
      image_url, 
      notes, 
      edit_reason, 
      edited_by_user_id,
      client_id, // Required for authorization
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
      force_edit = false, // Allow overriding concurrent editing lock
      // Draft saving
      save_as_draft = false
    } = body;
    
    // Validate required fields
    if (!caption && !image_url && !notes && !tags && !categories) {
      return NextResponse.json(
        { error: 'At least one editable field must be provided for update' },
        { status: 400 }
      );
    }
    
    if (!edited_by_user_id) {
      return NextResponse.json(
        { error: 'edited_by_user_id is required for tracking edits' },
        { status: 400 }
      );
    }
    
    if (!client_id) {
      return NextResponse.json(
        { error: 'client_id is required for authorization' },
        { status: 400 }
      );
    }
    
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
      console.log('🔍 Post not found in posts table, checking calendar tables...');
      
      // Check calendar_scheduled_posts
      const { data: scheduledPost, error: scheduledError } = await supabase
        .from('calendar_scheduled_posts')
        .select('*')
        .eq('id', postId)
        .single();
      
      if (scheduledPost && !scheduledError) {
        console.log('✅ Found post in calendar_scheduled_posts');
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
          console.log('✅ Found post in calendar_unscheduled_posts');
          currentPost = unscheduledPost;
          fetchError = null;
        }
      }
    }
    
    if (fetchError) {
      console.error('❌ Error fetching current post:', fetchError);
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch post' },
        { status: 500 }
      );
    }
    
    // Authorization: Verify post belongs to the requesting client
    if (currentPost.client_id !== client_id) {
      console.error('❌ Unauthorized access attempt:', { 
        postClientId: currentPost.client_id, 
        requestedClientId: client_id 
      });
      return NextResponse.json(
        { error: 'Unauthorized: Post does not belong to this client' },
        { status: 403 }
      );
    }
    
    // 1. POST STATUS VALIDATION
    // Check if post has a status field (main posts table) or if it's in calendar tables
    const hasStatusField = currentPost.status !== undefined;
    const isCalendarPost = currentPost.scheduled_date !== undefined || currentPost.project_id !== undefined;
    
    if (hasStatusField && !['draft', 'ready', 'scheduled'].includes(currentPost.status)) {
      const statusMessages = {
        'published': 'Cannot edit published posts. Please create a new version instead.',
        'archived': 'Cannot edit archived posts. Please restore the post first.',
        'deleted': 'Cannot edit deleted posts.'
      };
      
      return NextResponse.json(
        { 
          error: statusMessages[currentPost.status as keyof typeof statusMessages] || 'Cannot edit this post in its current status',
          currentStatus: currentPost.status
        },
        { status: 400 }
      );
    }
    
    // For calendar posts, we allow editing by default since they don't have restrictive status values
    if (isCalendarPost) {
      console.log('✅ Calendar post - allowing edit (no status restrictions)');
    }
    
    // 2. CONCURRENT EDITING PREVENTION
    const now = new Date();
    const editingTimeout = 30 * 60 * 1000; // 30 minutes
    const isCurrentlyBeingEdited = currentPost.currently_editing_by && 
      currentPost.editing_started_at && 
      (now.getTime() - new Date(currentPost.editing_started_at).getTime()) < editingTimeout;
    
    if (isCurrentlyBeingEdited && currentPost.currently_editing_by !== edited_by_user_id && !force_edit) {
      const editingUser = currentPost.currently_editing_by;
      const editingStarted = new Date(currentPost.editing_started_at);
      
      return NextResponse.json(
        { 
          error: 'Post is currently being edited by another user',
          currentlyEditingBy: editingUser,
          editingStartedAt: editingStarted.toISOString(),
          canForceEdit: true,
          message: 'Use force_edit=true to override the lock'
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
        hashtags: ai_hashtags || currentPost.ai_settings?.hashtags
      }
    };
    
    const validation = PostValidator.validatePost(postData, platforms);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          validationErrors: validation.errors,
          validationWarnings: validation.warnings,
          platformWarnings: validation.platformWarnings
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
          hashtags: ai_hashtags || currentPost.ai_settings?.hashtags
        },
        saved_at: now.toISOString(),
        saved_by: edited_by_user_id
      };
      
      const { error: draftError } = await supabase
        .from('posts')
        .update({ draft_changes: draftData })
        .eq('id', postId);
      
      if (draftError) {
        console.error('❌ Error saving draft:', draftError);
        return NextResponse.json(
          { error: 'Failed to save draft changes' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Draft changes saved successfully',
        draftData
      });
    }
    
    // 5. APPROVAL WORKFLOW - Check if reapproval needed
    const needsReapproval = caption && caption !== currentPost.caption && currentPost.approval_status === 'approved';
    
    // Prepare update data - only editable fields
    const updateData: any = {
      updated_at: now.toISOString(),
      last_edited_by: edited_by_user_id,
      last_edited_at: now.toISOString(),
      last_modified_at: now.toISOString(),
      edit_count: (currentPost.edit_count || 0) + 1,
      currently_editing_by: edited_by_user_id,
      editing_started_at: now.toISOString()
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
      console.log('📝 Main posts table - including media_type and media_alt_text');
    } else {
      console.log('📝 Calendar post - skipping media_type and media_alt_text (not supported)');
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
      validation_warnings: validation.platformWarnings,
      last_validated_at: now.toISOString()
    };
    
    // 6. REAPPROVAL LOGIC
    if (needsReapproval) {
      updateData.needs_reapproval = true;
      updateData.approval_status = 'pending';
      updateData.reapproval_notified_at = null; // Reset notification flag
      console.log('🔄 Caption changed on approved post - marking for reapproval');
    }
    
    // Clear draft changes if we're committing the edit
    updateData.draft_changes = {};
    
    // Audit logging
    const changes = Object.keys(updateData).filter(key => 
      !['updated_at', 'last_edited_by', 'last_edited_at', 'edit_count', 'currently_editing_by', 'editing_started_at', 'last_modified_at'].includes(key)
    );
    
    console.log('📝 Enhanced Post Editing - Updating post with changes:', {
      postId,
      clientId: client_id,
      editedBy: edited_by_user_id,
      changes: changes,
      needsReapproval,
      validationWarnings: validation.warnings,
      platforms
    });
    
    // Determine which table to update based on where the post was found
    let tableName = 'posts';
    if (currentPost.scheduled_date) {
      tableName = 'calendar_scheduled_posts';
    } else if (currentPost.project_id && !currentPost.scheduled_date) {
      tableName = 'calendar_unscheduled_posts';
    }
    
    console.log(`📝 Updating post in table: ${tableName}`);
    
    // Update the post in the appropriate table
    const { data: updatedPost, error: updateError } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', postId)
      .eq('client_id', client_id) // Double-check authorization
      .select('*')
      .single();
    
    if (updateError) {
      console.error('❌ Supabase update error:', updateError);
      return NextResponse.json(
        { error: `Database error: ${updateError.message}` },
        { status: 500 }
      );
    }
    
    // 7. SEND REAPPROVAL NOTIFICATION (if needed)
    if (needsReapproval) {
      // TODO: Implement notification system
      console.log('📧 Post needs reapproval - notification should be sent to approvers');
    }
    
    // Enhanced audit logging
    console.log('✅ Enhanced Post Editing - Post updated successfully:', {
      postId,
      clientId: client_id,
      editedBy: edited_by_user_id,
      changes: changes,
      editCount: updatedPost.edit_count,
      needsReapproval: updatedPost.needs_reapproval,
      approvalStatus: updatedPost.approval_status,
      validationWarnings: validation.warnings,
      timestamp: now.toISOString()
    });
    
    return NextResponse.json({ 
      success: true, 
      post: updatedPost,
      message: 'Post updated successfully with enhanced validation',
      changes: changes,
      needsReapproval: updatedPost.needs_reapproval,
      validationWarnings: validation.warnings,
      platformWarnings: validation.platformWarnings,
      currentlyEditing: {
        by: updatedPost.currently_editing_by,
        startedAt: updatedPost.editing_started_at
      }
    });
    
  } catch (error) {
    console.error('💥 Unexpected error in Enhanced Post Editing:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update post' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    
    console.log('🔍 Fetching post:', postId);
    
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
      console.log('🔍 Post not found in posts table, checking calendar tables...');
      
      // Check calendar_scheduled_posts
      const { data: scheduledPost, error: scheduledError } = await supabase
        .from('calendar_scheduled_posts')
        .select('*')
        .eq('id', postId)
        .single();
      
      if (scheduledPost && !scheduledError) {
        console.log('✅ Found post in calendar_scheduled_posts');
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
          console.log('✅ Found post in calendar_unscheduled_posts');
          post = unscheduledPost;
          error = null;
        } else {
          console.log('❌ Post not found in any table');
          return NextResponse.json(
            { error: 'Post not found' },
            { status: 404 }
          );
        }
      }
    }
    
    if (error) {
      console.error('❌ Supabase error:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }
    
    console.log('✅ Post fetched:', post);
    
    return NextResponse.json({ post });
    
  } catch (error) {
    console.error('💥 Unexpected error in GET:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch post' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    
    console.log('🗑️ Deleting post:', postId);
    
    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // First check if post exists and is not published
    const { data: currentPost, error: fetchError } = await supabase
      .from('posts')
      .select('status')
      .eq('id', postId)
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching post for deletion:', fetchError);
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }
    
    // Validation: Prevent deletion of published posts
    if (currentPost.status === 'published') {
      return NextResponse.json(
        { error: 'Cannot delete published posts. Please archive instead.' },
        { status: 400 }
      );
    }
    
    // Delete the post (revisions will be deleted automatically due to CASCADE)
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);
    
    if (deleteError) {
      console.error('❌ Supabase delete error:', deleteError);
      return NextResponse.json(
        { error: `Database error: ${deleteError.message}` },
        { status: 500 }
      );
    }
    
    console.log('✅ Post deleted successfully:', postId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Post deleted successfully' 
    });
    
  } catch (error) {
    console.error('💥 Unexpected error in DELETE:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete post' },
      { status: 500 }
    );
  }
}
