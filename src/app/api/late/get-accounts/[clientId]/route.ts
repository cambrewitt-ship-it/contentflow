import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { markOnboardingStep } from '@/lib/onboardingHelpers';
export async function GET(
  request: Request,
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

    const auth = await requireClientOwnership(request, clientId);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    // Get the client's LATE profile ID
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('late_profile_id')
      .eq('id', clientId)
      .single();
    
    if (clientError || !client) {
      logger.error('Client not found:', clientError);
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    
    const profileId = client.late_profile_id;
    
    // If no LATE profile ID, return empty accounts array
    if (!profileId) {

      return NextResponse.json({ accounts: [] });
    }

    // Get connected accounts from LATE API
    const response = await fetch(
      `https://getlate.dev/api/v1/accounts?profileId=${profileId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.LATE_API_KEY}`
        }
      });

    if (!response.ok) {
      logger.error('LATE API error:', response.status);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
    
    const data = await response.json();
    const accounts = data.accounts || [];

    // LATE is the source of truth for connections, so tick the onboarding step here too —
    // this catches connections whose OAuth callback couldn't record them
    if (accounts.length > 0) {
      await markOnboardingStep(supabase, user.id, 'checklist_connect_social');
    }

    return NextResponse.json({ accounts });
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
