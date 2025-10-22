import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import logger from '@/lib/logger';

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

      );    }
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }

      );    }
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }

      );    }

    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Authentication required',
        details: 'User must be logged in to upload client logos'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Create Supabase client with the user's token
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.error('❌ Authentication error:', authError);
      return NextResponse.json({
        error: 'Authentication failed',
        details: 'Invalid or expired authentication token'
      }, { status: 401 });
    }

    // Verify the client belongs to the authenticated user
    const { data: existingClient, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single();

    if (clientError || !existingClient) {
      logger.error('❌ Client not found or access denied:', clientError);
      return NextResponse.json({ 
        error: 'Access denied',
        details: 'Client not found or you do not have permission to upload logos for this client'
      }, { status: 403 });
    }
    
    // Check if BLOB_READ_WRITE_TOKEN is available
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      logger.warn('⚠️ BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { error: 'Logo upload not configured' },
        { status: 500 }

      );    }

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

    // Create a unique filename with client ID
    const timestamp = Date.now();
    const uniqueFilename = `client-logos/${clientId}-${timestamp}-${filename}`;
    
    // Upload to Vercel Blob
    const result = await put(uniqueFilename, blob, {
      access: 'public',
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

      );    }

    return NextResponse.json({ 
      success: true, 
      logoUrl: result.url,
    });      client: updatedClient

  } catch (error) {
    logger.error('❌ Error uploading client logo:', error);
    return NextResponse.json(
      { error: 'Failed to upload client logo' },
    );      { status: 500 }

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

      );    }

    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Authentication required',
        details: 'User must be logged in to remove client logos'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Create Supabase client with the user's token
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.error('❌ Authentication error:', authError);
      return NextResponse.json({
        error: 'Authentication failed',
        details: 'Invalid or expired authentication token'
      }, { status: 401 });
    }

    // Verify the client belongs to the authenticated user
    const { data: existingClient, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single();

    if (clientError || !existingClient) {
      logger.error('❌ Client not found or access denied:', clientError);
      return NextResponse.json({ 
        error: 'Access denied',
        details: 'Client not found or you do not have permission to remove logos for this client'
      }, { status: 403 });
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

      );    }

    return NextResponse.json({ 
      success: true, 
      client: updatedClient

    });  } catch (error) {
    logger.error('❌ Error removing client logo:', error);
    return NextResponse.json(
      { error: 'Failed to remove client logo' },
      { status: 500 }

    );  }
}
