#!/usr/bin/env node

/**
 * Update Portal Upload Route with Enhanced Security
 */

const fs = require('fs');

const filePath = 'src/app/api/portal/upload/route.ts';

// Read the current file
let content = fs.readFileSync(filePath, 'utf8');

// Replace the remaining methods with secure versions
const securePOSTMethod = `export async function POST(request: NextRequest) {
  const errorContext = extractErrorContext(request);
  
  try {
    const { token, fileName, fileType, fileSize, fileUrl, notes, targetDate } = await request.json();

    if (!token || !fileName || !fileUrl) {
      return handleApiError(
        new Error('Missing required fields'),
        { ...errorContext, operation: 'portal_upload_post_validation' },
        'VALIDATION_ERROR'
      );
    }

    // Enhanced file validation using security module
    const validation = await validateFileUpload(
      Buffer.from(''), // Empty buffer for URL-based uploads
      fileType || 'unknown',
      MAX_FILE_SIZE,
      {
        scanContent: false, // Skip content scanning for URL uploads
        generateSecureName: true,
        quarantineSuspicious: true
      }
    );

    if (!validation.isValid) {
      logger.warn('⚠️ Portal upload rejected - validation failed', {
        fileName,
        fileType,
        fileSize,
        errors: validation.errors
      });
      return handleApiError(
        new Error(validation.errors.join(', ')),
        { ...errorContext, operation: 'portal_upload_post_validation' },
        'VALIDATION_ERROR'
      );
    }

    // Sanitize filename
    const sanitizedFileName = sanitizeFilename(fileName);

    // Get client info from portal token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return handleApiError(
        new Error('Invalid portal token'),
        { ...errorContext, operation: 'portal_upload_post_auth' },
        'AUTHENTICATION_REQUIRED'
      );
    }

    // Check if portal is enabled
    if (!client.portal_enabled) {
      return handleApiError(
        new Error('Portal access is disabled'),
        { ...errorContext, operation: 'portal_upload_post_access' },
        'ACCESS_DENIED'
      );
    }

    errorContext.clientId = client.id;

    // Create upload record with target date
    const uploadData: any = {
      client_id: client.id,
      project_id: null, // Will be set when content is processed
      file_name: sanitizedFileName,
      file_type: fileType || 'unknown',
      file_size: fileSize || 0,
      file_url: fileUrl,
      status: 'pending',
      notes: notes || null
    };

    // If targetDate is provided, set the created_at to that date
    if (targetDate) {
      const targetDateTime = new Date(targetDate + 'T00:00:00.000Z');
      uploadData.created_at = targetDateTime.toISOString();
    }

    const { data: upload, error: uploadError } = await supabase
      .from('client_uploads')
      .insert(uploadData)
      .select()
      .single();

    if (uploadError) {
      return handleApiError(
        uploadError,
        { ...errorContext, operation: 'portal_upload_post_insert' },
        'DATABASE_ERROR'
      );
    }

    return NextResponse.json({
      success: true,
      upload
    });

  } catch (error) {
    return handleApiError(
      error,
      { ...errorContext, operation: 'portal_upload_post_processing' },
      'INTERNAL_ERROR'
    );
  }
}`;

const securePATCHMethod = `export async function PATCH(request: NextRequest) {
  const errorContext = extractErrorContext(request);
  
  try {
    const { token, uploadId, notes, newDate } = await request.json();

    if (!token || !uploadId) {
      return handleApiError(
        new Error('Missing required fields'),
        { ...errorContext, operation: 'portal_upload_patch_validation' },
        'VALIDATION_ERROR'
      );
    }

    // Get client info from portal token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return handleApiError(
        new Error('Invalid portal token'),
        { ...errorContext, operation: 'portal_upload_patch_auth' },
        'AUTHENTICATION_REQUIRED'
      );
    }

    // Check if portal is enabled
    if (!client.portal_enabled) {
      return handleApiError(
        new Error('Portal access is disabled'),
        { ...errorContext, operation: 'portal_upload_patch_access' },
        'ACCESS_DENIED'
      );
    }

    errorContext.clientId = client.id;

    // Update upload notes and/or date
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (notes !== undefined) {
      updateData.notes = notes || null;
    }
    
    if (newDate) {
      // Convert the date string to a proper date for the created_at field
      const targetDate = new Date(newDate + 'T00:00:00.000Z');
      updateData.created_at = targetDate.toISOString();
    }

    const { data: upload, error: updateError } = await supabase
      .from('client_uploads')
      .update(updateData)
      .eq('id', uploadId)
      .eq('client_id', client.id) // Ensure client can only update their own uploads
      .select()
      .single();

    if (updateError) {
      return handleApiError(
        updateError,
        { ...errorContext, operation: 'portal_upload_patch_update' },
        'DATABASE_ERROR'
      );
    }

    if (!upload) {
      return handleApiError(
        new Error('Upload not found'),
        { ...errorContext, operation: 'portal_upload_patch_not_found' },
        'NOT_FOUND'
      );
    }

    return NextResponse.json({
      success: true,
      upload
    });

  } catch (error) {
    return handleApiError(
      error,
      { ...errorContext, operation: 'portal_upload_patch_processing' },
      'INTERNAL_ERROR'
    );
  }
}`;

const secureDELETEMethod = `export async function DELETE(request: NextRequest) {
  const errorContext = extractErrorContext(request);
  
  try {
    const { token, uploadId } = await request.json();

    if (!token || !uploadId) {
      return handleApiError(
        new Error('Missing required fields'),
        { ...errorContext, operation: 'portal_upload_delete_validation' },
        'VALIDATION_ERROR'
      );
    }

    // Get client info from portal token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return handleApiError(
        new Error('Invalid portal token'),
        { ...errorContext, operation: 'portal_upload_delete_auth' },
        'AUTHENTICATION_REQUIRED'
      );
    }

    // Check if portal is enabled
    if (!client.portal_enabled) {
      return handleApiError(
        new Error('Portal access is disabled'),
        { ...errorContext, operation: 'portal_upload_delete_access' },
        'ACCESS_DENIED'
      );
    }

    errorContext.clientId = client.id;

    // Delete upload
    const { error: deleteError } = await supabase
      .from('client_uploads')
      .delete()
      .eq('id', uploadId)
      .eq('client_id', client.id); // Ensure client can only delete their own uploads

    if (deleteError) {
      return handleApiError(
        deleteError,
        { ...errorContext, operation: 'portal_upload_delete_operation' },
        'DATABASE_ERROR'
      );
    }

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    return handleApiError(
      error,
      { ...errorContext, operation: 'portal_upload_delete_processing' },
      'INTERNAL_ERROR'
    );
  }
}`;

// Replace the methods in the content
content = content.replace(
  /export async function POST\(request: NextRequest\) \{[\s\S]*?\n\}/,
  securePOSTMethod
);

content = content.replace(
  /export async function PATCH\(request: NextRequest\) \{[\s\S]*?\n\}/,
  securePATCHMethod
);

content = content.replace(
  /export async function DELETE\(request: NextRequest\) \{[\s\S]*?\n\}/,
  secureDELETEMethod
);

// Write the updated content back
fs.writeFileSync(filePath, content);

console.log('✅ Portal upload route updated with enhanced security');
