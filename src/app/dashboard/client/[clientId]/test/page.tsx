'use client'
import { use, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function TestClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  console.log('🎬 TestClientPage rendering for clientId:', clientId)
  
  useEffect(() => {
    console.log('🔥 useEffect triggered for clientId:', clientId)
    fetchClient()
  }, [clientId])
  
  const fetchClient = async () => {
    console.log('🔍 fetchClient called')
    setLoading(true)
    
    // Create Supabase client with ANON key (fallback approach)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Detailed query logging for comparison with main dashboard
    console.log('🔍 TEST PAGE - Query details:')
    console.log('  - Table name:', 'clients')
    console.log('  - Column filter:', 'id =', clientId)
    console.log('  - Client ID type:', typeof clientId)
    console.log('  - Client ID value:', clientId)
    console.log('  - Supabase URL:', supabaseUrl)
    console.log('  - Environment check - NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('  - Environment check - NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    console.log('  - AUTH METHOD: Using ANON key (may be limited by RLS policies)')
    console.log('  - COMPARISON: Sidebar uses SERVICE ROLE via API endpoint (server-side)')
    
    console.log('📊 About to query Supabase')
    
    // Test 1: Try to fetch ALL clients first (like the sidebar does)
    console.log('🧪 TEST 1: Fetching ALL clients...')
    const { data: allClients, error: allClientsError } = await supabase
      .from('clients')
      .select('*')
    
    console.log('🧪 TEST 1 Result - All clients:', { 
      data: allClients, 
      error: allClientsError, 
      count: allClients?.length 
    })
    
    // Test 2: Try to find the specific client from the all clients result
    if (allClients && allClients.length > 0) {
      const foundClient = allClients.find(c => c.id === clientId)
      console.log('🧪 TEST 2: Client-side filtering result:', foundClient)
    }
    
    // Test 3: Original specific client query
    console.log('🧪 TEST 3: Original specific client query...')
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
    
    console.log('📊 Supabase response:', { data, error, dataLength: data?.length, firstItem: data?.[0] })
    console.log('📊 Raw data array:', data)
    console.log('📊 Error details:', error)
    
    // Enhanced error logging for RLS debugging
    if (error) {
      console.log('🚨 FULL SUPABASE ERROR OBJECT:', error)
      console.log('🚨 Error message:', error.message)
      console.log('🚨 Error details:', error.details)
      console.log('🚨 Error hint:', error.hint)
      console.log('🚨 Error code:', error.code)
    }
    
    if (data && data.length > 0) {
      console.log('✅ Client found:', data[0])
      setClient(data[0])
    } else {
      console.log('❌ No client found')
      if (error) {
        console.log('🚨 Database error prevented client fetch:', error.message)
      }
    }
    
    setLoading(false)
  }
  
  if (loading) return <div>Loading test page...</div>
  if (!client) return <div>Client not found in test page</div>
  
  return (
    <div>
      <h1>Test Client Page</h1>
      <p>Client Name: {client.name}</p>
      <p>Client ID: {client.id}</p>
      <p>Description: {client.description}</p>
    </div>
  )
}
