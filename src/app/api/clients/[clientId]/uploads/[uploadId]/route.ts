import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; uploadId: string }> }
) {
  try {
    const { clientId, uploadId } = await params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    if (!clientId || !uploadId) {
      return NextResponse.json(
        { error: 'Client ID and Upload ID are required' },
        { status: 400 }
      );
    }

    // First, check if the upload exists and belongs to this client
    const { data: existingUpload, error: fetchError } = await supabase
      .from('client_uploads')
      .select('id, client_id')
      .eq('id', uploadId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (fetchError) {
      logger.error('Error checking upload existence:', fetchError);
      return NextResponse.json(
        { error: 'Failed to check upload', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!existingUpload) {
      logger.warn('Upload not found', { uploadId, clientId });
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Use admin client for deletion since we've already verified ownership
    // This bypasses RLS which can be problematic even when policies exist
    const adminSupabase = createSupabaseAdmin();
    
    // Delete the upload from the database using admin client
    const { data: deletedData, error: deleteError } = await adminSupabase
      .from('client_uploads')
      .delete()
      .eq('id', uploadId)
      .eq('client_id', clientId) // Ensure upload belongs to this client
      .select(); // Select to verify deletion

    if (deleteError) {
      logger.error('Error deleting client upload:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete upload', details: deleteError.message },
        { status: 500 }
      );
    }

    // Verify that a row was actually deleted
    if (!deletedData || deletedData.length === 0) {
      logger.error('Delete operation returned no rows', { 
        uploadId, 
        clientId
      });
      return NextResponse.json(
        { 
          error: 'Failed to delete upload. The upload may have already been deleted.',
        },
        { status: 404 }
      );
    }

    logger.info('Successfully deleted client upload', { uploadId, clientId });
    return NextResponse.json({
      success: true,
      message: 'Upload deleted successfully'
    });
  } catch (error) {
    logger.error('Delete client upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

