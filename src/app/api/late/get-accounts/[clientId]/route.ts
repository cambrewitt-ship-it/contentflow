import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    console.log('Getting accounts for client:', clientId);
    
    // Get the client's LATE profile ID
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('late_profile_id')
      .eq('id', clientId)
      .single();
    
    if (clientError || !client) {
      console.error('Client not found:', clientError);
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    
    const profileId = client.late_profile_id;
    console.log('Using LATE profile ID:', profileId);
    
    // Get connected accounts from LATE API
    const response = await fetch(
      `https://getlate.dev/api/v1/accounts?profileId=${profileId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.LATE_API_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      console.error('LATE API error:', response.status);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
    
    const data = await response.json();
    console.log('LATE accounts:', data.accounts?.length || 0);
    
    return NextResponse.json({ accounts: data.accounts || [] });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
