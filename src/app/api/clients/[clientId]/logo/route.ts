import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const { clientId } = params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const { imageData, filename } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Check if BLOB_READ_WRITE_TOKEN is available
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      logger.warn('⚠️ BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { error: 'Logo upload not configured' },
        { status: 500 }
      );
    }

    // Convert base64 to blob
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const byteCharacters = Buffer.from(base64Data, 'base64');
    const blob = new Blob([byteCharacters], { type: mimeType });

    // Create a unique filename with client ID
    const timestamp = Date.now();
    const uniqueFilename = `client-logos/${clientId}-${timestamp}-${filename}`;

    // Upload to Vercel Blob
    const result = await put(uniqueFilename, blob, {
      access: 'public'
    });

    // Update the client record with the logo URL
    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update({
        logo_url: result.url,
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId)
      .select()
      .single();

    if (updateError) {
      logger.error('❌ Error updating client with logo URL:', updateError);
      return NextResponse.json(
        { error: 'Failed to update client with logo URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      logoUrl: result.url,
      client: updatedClient
    });
  } catch (error) {
    logger.error('❌ Error uploading client logo:', error);
    return NextResponse.json(
      { error: 'Failed to upload client logo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const { clientId } = params;
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Update the client record to remove the logo URL
    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update({
        logo_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId)
      .select()
      .single();

    if (updateError) {
      logger.error('❌ Error removing logo URL from client:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove logo from client' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      client: updatedClient
    });
  } catch (error) {
    logger.error('❌ Error removing client logo:', error);
    return NextResponse.json(
      { error: 'Failed to remove client logo' },
      { status: 500 }
    );
  }
}
