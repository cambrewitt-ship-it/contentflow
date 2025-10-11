'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Client {
  id: string;
  name: string;
  description?: string;
  company_description?: string;
  logo_url?: string;
  created_at: string;
}

interface ClientSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectClient: (clientId: string) => void;
  title: string;
  description: string;
  loading?: boolean;
}

export function ClientSelectorModal({
  isOpen,
  onClose,
  onSelectClient,
  title,
  description,
  loading = false
}: ClientSelectorModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [fetchingClients, setFetchingClients] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    if (isOpen && clients.length === 0) {
      fetchClients();
    }
  }, [isOpen]);

  const fetchClients = async () => {
    try {
      setFetchingClients(true);
      setError(null);
      
      const token = getAccessToken();
      if (!token) {
        throw new Error('Please log in to view your clients');
      }
      
      const response = await fetch('/api/clients', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to view your clients');
        }
        throw new Error(`Failed to fetch clients: ${response.statusText}`);
      }
      
      const data = await response.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch clients');
    } finally {
      setFetchingClients(false);
    }
  };

  const handleClientSelect = (clientId: string) => {
    onSelectClient(clientId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white/50 backdrop-blur-md border border-white/20 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Users className="h-5 w-5" />
            {title}
          </DialogTitle>
          <p className="text-sm text-gray-700">
            {description}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {fetchingClients ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center bg-white/50 backdrop-blur-sm rounded-lg p-6 border border-white/30">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-gray-700">Loading your clients...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-6 border border-white/30">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Clients</h3>
                <p className="text-gray-700 mb-4">{error}</p>
                <Button onClick={fetchClients} variant="outline" className="bg-white/50 backdrop-blur-sm border-white/30 hover:bg-white/70">
                  Try Again
                </Button>
              </div>
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-6 border border-white/30">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No clients found</h3>
                <p className="text-gray-700 mb-4">
                  You need to create a client first to use this feature.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clients.map((client) => (
                <Card 
                  key={client.id}
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border border-white/30 bg-white/50 backdrop-blur-sm hover:bg-white/70"
                  onClick={() => handleClientSelect(client.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                        client.logo_url 
                          ? '' 
                          : 'bg-primary/10 text-primary'
                      } overflow-hidden flex-shrink-0`}>
                        {client.logo_url ? (
                          <img 
                            src={client.logo_url} 
                            alt={`${client.name} logo`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{client.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {client.name}
                        </h3>
                        {(client.company_description || client.description) && (
                          <p className="text-sm text-gray-700 line-clamp-2 mt-1">
                            {client.company_description || client.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-2">
                          Created {new Date(client.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
