import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    
    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const supabase = auth.supabase;

    const { data: tags, error } = await supabase
      .from('tags')
      .select('*')
      .eq('client_id', clientId)
      .order('name', { ascending: true });

    if (error) {
      logger.error('❌ Error fetching tags:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tags', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, tags: tags || [] });
  } catch (error) {
    logger.error('💥 Error in GET tags route:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
