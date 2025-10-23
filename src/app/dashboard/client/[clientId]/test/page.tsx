'use client'
import { use, useEffect, useState, useCallback } from 'react'
import { Client } from '@/types/api'

export default function TestClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchClient = useCallback(async () => {
    console.log('🔍 fetchClient called')
    setLoading(true)

    try {
      // Get auth token from localStorage (assuming it's stored there)
      const token = localStorage.getItem('supabase.auth.token');
      if (!token) {
        console.error('❌ No auth token found');
        setLoading(false);
        return;
      }

      console.log('🔍 TEST PAGE - API call details:')
      console.log('  - Client ID:', clientId)
      console.log('  - API endpoint: /api/clients/[clientId]/data')
      console.log('  - AUTH METHOD: Using Bearer token via API route (server-side)')

      const response = await fetch(`/api/clients/${clientId}/data`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📊 API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API error:', errorData);
        setLoading(false);
        return;
      }

      const result = await response.json();
      console.log('✅ API response:', result);

      if (result.success && result.client) {
        console.log('✅ Client found via API:', result.client);
        setClient(result.client);
      } else {
        console.log('❌ No client found in API response');
      }
    } catch (error) {
      console.error('❌ Error fetching client via API:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId])

  useEffect(() => {
    console.log('🔥 useEffect triggered for clientId:', clientId)
    fetchClient()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  console.log('🎬 TestClientPage rendering for clientId:', clientId)

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
