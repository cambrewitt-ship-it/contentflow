import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
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
      console.warn('⚠️ BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { error: 'Logo upload not configured' },
        { status: 500 }
      );
    }
    
    console.log('🔄 Uploading client logo:', { clientId, filename, dataLength: imageData.length });
    
    // Convert base64 to blob
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    console.log('📦 Created blob:', { size: blob.size, type: blob.type });
    
    // Create a unique filename with client ID
    const timestamp = Date.now();
    const uniqueFilename = `client-logos/${clientId}-${timestamp}-${filename}`;
    
    // Upload to Vercel Blob
    const result = await put(uniqueFilename, blob, {
      access: 'public',
    });
    
    console.log('✅ Logo uploaded to blob:', result.url);
    
    // Update the client record with the logo URL
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
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
      console.error('❌ Error updating client with logo URL:', updateError);
      return NextResponse.json(
        { error: 'Failed to update client with logo URL' },
        { status: 500 }
      );
    }
    
    console.log('✅ Client updated with logo URL:', updatedClient);
    
    return NextResponse.json({ 
      success: true, 
      logoUrl: result.url,
      client: updatedClient
    });
    
  } catch (error) {
    console.error('❌ Error uploading client logo:', error);
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
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }
    
    // Update the client record to remove the logo URL
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
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
      console.error('❌ Error removing logo URL from client:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove logo from client' },
        { status: 500 }
      );
    }
    
    console.log('✅ Client logo removed:', updatedClient);
    
    return NextResponse.json({ 
      success: true, 
      client: updatedClient
    });
    
  } catch (error) {
    console.error('❌ Error removing client logo:', error);
    return NextResponse.json(
      { error: 'Failed to remove client logo' },
      { status: 500 }
    );
  }
}
