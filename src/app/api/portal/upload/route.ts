import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

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

    // Get client info from portal token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    // Check if portal is enabled
    if (!client.portal_enabled) {
      return NextResponse.json(
        { error: 'Portal access is disabled' },
        { status: 401 }
      );
    }

    // Get client uploads (content inbox)
    const { data: uploads, error: uploadsError } = await supabase
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
        created_at,
        updated_at
      `)
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });

    if (uploadsError) {
      logger.error('Error fetching uploads:', uploadsError);
      return NextResponse.json(
        { error: 'Failed to fetch uploads' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      client,
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

    // Get client info from portal token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    // Check if portal is enabled
    if (!client.portal_enabled) {
      return NextResponse.json(
        { error: 'Portal access is disabled' },
        { status: 401 }
      );
    }

    // Create upload record with target date
    const uploadData: any = {
      client_id: client.id,
      project_id: null, // Will be set when content is processed
      file_name: fileName,
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
    const { token, uploadId, notes, newDate } = await request.json();

    if (!token || !uploadId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get client info from portal token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    // Check if portal is enabled
    if (!client.portal_enabled) {
      return NextResponse.json(
        { error: 'Portal access is disabled' },
        { status: 401 }
      );
    }

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
      logger.error('Error updating upload notes:', updateError);
      return NextResponse.json(
        { error: 'Failed to update notes' },
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
    logger.error('Portal upload notes update error:', error);
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
      .select('id, portal_enabled')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Invalid portal token' },
        { status: 401 }
      );
    }

    // Check if portal is enabled
    if (!client.portal_enabled) {
      return NextResponse.json(
        { error: 'Portal access is disabled' },
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
