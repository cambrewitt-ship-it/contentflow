import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'application/pdf'
];

// Allowed file extensions
const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.mp4',
  '.mov',
  '.avi',
  '.webm',
  '.pdf'
];

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Validates file upload parameters
 */
function validateFile(
  fileName: string,
  fileType: string,
  fileSize: number
): { valid: boolean; error?: string } {
  // Check for dangerous characters in filename
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid filename: contains forbidden characters'
    };
  }

  // Validate file extension
  const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: `Invalid file type: ${fileExtension}. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(fileType)) {
    return {
      valid: false,
      error: `Invalid MIME type: ${fileType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    };
  }

  // Validate file size
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${(fileSize / (1024 * 1024)).toFixed(2)}MB. Maximum allowed: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  return { valid: true };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Resolve token — supports both legacy client tokens and party tokens
    const { resolvePortalToken } = await import('@/lib/portalAuth');
    const resolved = await resolvePortalToken(token);

    if (!resolved) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    // Get client uploads — try with new columns first, fall back to basic query if they don't exist yet
    let uploads: any[] | null = null;
    let uploadsError: any = null;

    ({ data: uploads, error: uploadsError } = await supabase
      .from('client_uploads')
      .select(`
        id,
        client_id,
        project_id,
        file_name,
        file_type,
        file_size,
        file_url,
        status,
        notes,
        review_notes,
        target_date,
        created_at,
        updated_at,
        uploaded_by_party:uploaded_by_party_id (
          id,
          name,
          role,
          color
        )
      `)
      .eq('client_id', resolved.clientId)
      .order('created_at', { ascending: false }));

    // If new columns don't exist yet, fall back to basic query
    if (uploadsError) {
      logger.debug('Falling back to basic uploads query (new columns may not exist yet)');
      ({ data: uploads, error: uploadsError } = await supabase
        .from('client_uploads')
        .select('id, client_id, project_id, file_name, file_type, file_size, file_url, status, notes, created_at, updated_at')
        .eq('client_id', resolved.clientId)
        .order('created_at', { ascending: false }));
    }

    if (uploadsError) {
      logger.error('Error fetching uploads:', uploadsError);
      return NextResponse.json(
        { error: 'Failed to fetch uploads' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      uploads: uploads || []
    });
  } catch (error) {
    logger.error('Portal uploads error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token, fileName, fileType, fileSize, fileUrl, notes, targetDate } = await request.json();

    if (!token || !fileName || !fileUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate file parameters
    const validation = validateFile(fileName, fileType || 'unknown', fileSize || 0);
    if (!validation.valid) {
      logger.warn('⚠️ Portal upload rejected - validation failed', {
        fileName,
        fileType,
        fileSize,
        error: validation.error
      });
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Resolve token — supports both legacy client tokens and party tokens
    const { resolvePortalToken } = await import('@/lib/portalAuth');
    const resolved = await resolvePortalToken(token);

    if (!resolved) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    // Build upload record — try with new columns first, fall back if they don't exist yet
    const baseUploadData: any = {
      client_id: resolved.clientId,
      project_id: null,
      file_name: fileName,
      file_type: fileType || 'unknown',
      file_size: fileSize || 0,
      file_url: fileUrl,
      status: 'pending',
      notes: notes || null,
    };

    if (targetDate) {
      const targetDateTime = new Date(targetDate + 'T00:00:00.000Z');
      baseUploadData.created_at = targetDateTime.toISOString();
    }

    const uploadDataWithNewCols = {
      ...baseUploadData,
      status: 'unassigned',
      uploaded_by_party_id: resolved.party?.id ?? null,
      target_date: targetDate ?? null,
    };

    let upload: any = null;
    let uploadError: any = null;

    ({ data: upload, error: uploadError } = await supabase
      .from('client_uploads')
      .insert(uploadDataWithNewCols)
      .select()
      .single());

    // If new columns don't exist yet, fall back to basic insert
    if (uploadError) {
      logger.debug('Falling back to basic upload insert (new columns may not exist yet)');
      ({ data: upload, error: uploadError } = await supabase
        .from('client_uploads')
        .insert(baseUploadData)
        .select()
        .single());
    }

    if (uploadError) {
      logger.error('Error creating upload:', uploadError);
      return NextResponse.json(
        { error: 'Failed to create upload' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      upload
    });
  } catch (error) {
    logger.error('Portal upload creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { token, uploadId, notes, review_notes, newDate, status, targetDate } = await request.json();

    if (!token || !uploadId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use resolvePortalToken to support both client and party tokens
    const { resolvePortalToken } = await import('@/lib/portalAuth');
    const resolved = await resolvePortalToken(token);

    if (!resolved) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    if (review_notes !== undefined) {
      updateData.review_notes = review_notes || null;
    }

    if (newDate) {
      const newDateTime = new Date(newDate + 'T00:00:00.000Z');
      updateData.created_at = newDateTime.toISOString();
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    // targetDate: schedule a queue item onto the calendar
    if (targetDate !== undefined) {
      updateData.target_date = targetDate || null;
      if (targetDate) {
        const targetDateTime = new Date(targetDate + 'T00:00:00.000Z');
        updateData.created_at = targetDateTime.toISOString();
      }
    }

    const { data: upload, error: updateError } = await supabase
      .from('client_uploads')
      .update(updateData)
      .eq('id', uploadId)
      .eq('client_id', resolved.clientId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating upload:', updateError);
      return NextResponse.json(
        { error: 'Failed to update upload' },
        { status: 500 }
      );
    }

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      upload
    });
  } catch (error) {
    logger.error('Portal upload update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { token, uploadId } = await request.json();

    if (!token || !uploadId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get client info from portal token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    // Delete upload
    const { error: deleteError } = await supabase
      .from('client_uploads')
      .delete()
      .eq('id', uploadId)
      .eq('client_id', client.id); // Ensure client can only delete their own uploads

    if (deleteError) {
      logger.error('Error deleting upload:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete upload' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    logger.error('Portal upload deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
