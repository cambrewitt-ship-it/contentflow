import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; uploadId: string }> }
) {
  try {
    const { clientId, uploadId } = await params;

    if (!clientId || !uploadId) {
      return NextResponse.json(
        { error: 'Client ID and Upload ID are required' },
        { status: 400 }
      );
    }

    console.log('🗑️ Deleting client upload:', { clientId, uploadId });

    // Delete the upload from the database
    const { error: deleteError } = await supabase
      .from('client_uploads')
      .delete()
      .eq('id', uploadId)
      .eq('client_id', clientId); // Ensure upload belongs to this client

    if (deleteError) {
      console.error('Error deleting client upload:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete upload' },
        { status: 500 }
      );
    }

    console.log('✅ Client upload deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Upload deleted successfully'
    });

  } catch (error) {
    console.error('Delete client upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

