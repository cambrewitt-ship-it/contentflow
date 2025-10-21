import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const formData = await request.formData();
    
    const file = formData.get('file') as File;
    const filename = formData.get('filename') as string;
    
    if (!file || !filename) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only PDF, Word documents, and text files are allowed.' 
      }, { status: 400 });
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File size too large. Maximum size is 10MB.' 
      }, { status: 400 });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Store file in Supabase Storage
    const fileExt = filename.split('.').pop();
    const storageFilename = `${clientId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('brand-documents')
      .upload(storageFilename, file);

    if (uploadError) {
      logger.error('❌ File upload failed:', uploadError);
      return NextResponse.json({ 
        error: 'Failed to upload file', 
        details: uploadError.message 
      }, { status: 500 });
    }

    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('brand-documents')
      .getPublicUrl(storageFilename);

    // Determine file type for processing
    let fileType = 'unknown';
    if (file.type === 'application/pdf') fileType = 'pdf';
    else if (file.type.includes('wordprocessingml.document')) fileType = 'docx';
    else if (file.type === 'application/msword') fileType = 'doc';
    else if (file.type === 'text/plain') fileType = 'txt';

    // Create database record
    const { data: document, error: dbError } = await supabase
      .from('brand_documents')
      .insert([
        {
          client_id: clientId,
          filename: storageFilename,
          original_filename: filename,
          file_type: fileType,
          file_size: file.size,
          file_path: publicUrl,
          processing_status: 'pending'
        }
      ])
      .select()
      .single();

    if (dbError) {
      logger.error('❌ Database insert failed:', dbError);
      // Clean up uploaded file
      await supabase.storage.from('brand-documents').remove([storageFilename]);
      return NextResponse.json({ 
        error: 'Failed to save document record', 
        details: dbError.message 
      }, { status: 500 });
    }

    // TODO: In the future, we'll add background processing here for text extraction
    // For now, we'll return success and the document can be processed later

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        original_filename: document.original_filename,
        file_type: document.file_type,
        file_size: document.file_size,
        file_path: document.file_path,
        processing_status: document.processing_status
      }
    });

  } catch (error: unknown) {
    logger.error('💥 Error in brand document upload:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: documents, error } = await supabase
      .from('brand_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('❌ Database query failed:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch documents', 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documents: documents || []
    });

  } catch (error: unknown) {
    logger.error('💥 Error in fetch brand documents:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
