'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AutopilotSettingsPanel from '@/components/AutopilotSettingsPanel';
import { Client } from '@/types/api';
import { Loader2 } from 'lucide-react';

export default function AutopilotSettingsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const { getAccessToken } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(false);

  useEffect(() => {
    if (!clientId || fetchRef.current) return;

    async function fetchClient() {
      fetchRef.current = true;
      try {
        const token = getAccessToken();
        if (!token) {
          setTimeout(() => {
            fetchRef.current = false;
            fetchClient();
          }, 500);
          return;
        }

        const res = await fetch(`/api/clients/${clientId}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });

        if (!res.ok) throw new Error('Failed to fetch client');

        const data = await res.json();
        setClient(data.client);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load client');
        setLoading(false);
      } finally {
        fetchRef.current = false;
      }
    }

    fetchClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="p-8 text-center text-sm text-red-600">
        {error || 'Client not found'}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <AutopilotSettingsPanel
        clientId={clientId}
        client={client}
        onUpdate={updated => setClient(updated)}
      />
    </div>
  );
}
