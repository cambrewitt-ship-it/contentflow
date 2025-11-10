import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

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

    // Delete the upload from the database
    const { error: deleteError } = await supabase
      .from('client_uploads')
      .delete()
      .eq('id', uploadId)
      .eq('client_id', clientId); // Ensure upload belongs to this client

    if (deleteError) {
      logger.error('Error deleting client upload:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete upload' },
        { status: 500 }
      );
    }

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

