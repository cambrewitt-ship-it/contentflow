import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
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

    // Convert base64 to buffer
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload to Supabase Storage
    const admin = createSupabaseAdmin();
    const storagePath = `client-logos/${clientId}-${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: storageError } = await admin.storage
      .from('logos')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (storageError) {
      logger.error('❌ Storage upload failed:', storageError);
      return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
    }

    const { data: { publicUrl } } = admin.storage.from('logos').getPublicUrl(storagePath);

    // Update the client record with the logo URL
    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update({
        logo_url: publicUrl,
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
      logoUrl: publicUrl,
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
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
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
