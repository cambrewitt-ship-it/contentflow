'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'components/ui/button';
import { ClientSelectorModal } from 'components/ClientSelectorModal';
import { 
  PenTool, 
  Calendar, 
  Lightbulb,
  Loader2
} from 'lucide-react';

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  const router = useRouter();
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'content' | 'calendar' | 'ideas' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleActionClick = (action: 'content' | 'calendar' | 'ideas') => {
    setSelectedAction(action);
    setShowClientSelector(true);
  };

  const handleClientSelect = (clientId: string) => {
    if (!selectedAction) return;

    setLoading(true);

    // Navigate based on the selected action
    switch (selectedAction) {
      case 'content':
        // Navigate to content suite - need to check if there are projects first
        // For now, we'll navigate to the client's content suite
        router.push(`/dashboard/client/${clientId}/content-suite`);
        break;
      case 'calendar':
        // Navigate to calendar
        router.push(`/dashboard/client/${clientId}/calendar`);
        break;
      case 'ideas':
        // Placeholder for ideas generator - will be implemented later
        console.log('Ideas Generator selected for client:', clientId);
        // For now, just show an alert
        alert('Ideas Generator feature coming soon!');
        setLoading(false);
        break;
      default:
        setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowClientSelector(false);
    setSelectedAction(null);
    setLoading(false);
  };

  const getModalConfig = () => {
    switch (selectedAction) {
      case 'content':
        return {
          title: 'Create Content',
          description: 'Select a client to create social media content'
        };
      case 'calendar':
        return {
          title: 'View Calendar',
          description: 'Select a client to view their content calendar'
        };
      case 'ideas':
        return {
          title: 'Ideas Generator',
          description: 'Select a client to generate content ideas'
        };
      default:
        return {
          title: 'Select Client',
          description: 'Choose a client to continue'
        };
    }
  };

  const modalConfig = getModalConfig();

  return (
    <>
      <div className={className}>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Quick Actions
          </h2>
          <p className="text-muted-foreground">
            Get started with your most common tasks
          </p>
        </div>

        <div className="flex gap-6 justify-center flex-wrap">
          {/* Create Content */}
          <Button 
            onClick={() => handleActionClick('content')}
            className="bg-gradient-to-r from-pink-300 via-purple-500 to-purple-700 hover:from-pink-400 hover:via-purple-600 hover:to-purple-800 text-white w-48 font-bold shadow-md hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center"
            style={{ height: '177px', borderRadius: '16px' }}
            disabled={loading}
          >
            {loading && selectedAction === 'content' ? (
              <Loader2 className="w-16 h-16 mb-3 animate-spin stroke-[3]" />
            ) : (
              <PenTool className="w-16 h-16 mb-3 stroke-[3]" />
            )}
            <span className="text-xl font-bold">Create Content</span>
          </Button>
          
          {/* Calendar */}
          <Button 
            onClick={() => handleActionClick('calendar')}
            className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white w-48 font-bold shadow-md hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center"
            style={{ height: '177px', borderRadius: '16px' }}
            disabled={loading}
          >
            {loading && selectedAction === 'calendar' ? (
              <Loader2 className="w-16 h-16 mb-3 animate-spin stroke-[3]" />
            ) : (
              <Calendar className="w-16 h-16 mb-3 stroke-[3]" />
            )}
            <span className="text-xl font-bold">Calendar</span>
          </Button>
          
          {/* Ideas Generator */}
          <Button 
            onClick={() => handleActionClick('ideas')}
            className="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 hover:from-purple-600 hover:via-purple-700 hover:to-purple-800 text-white w-48 font-bold shadow-md hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center"
            style={{ height: '177px', borderRadius: '16px' }}
            disabled={loading}
          >
            {loading && selectedAction === 'ideas' ? (
              <Loader2 className="w-16 h-16 mb-3 animate-spin stroke-[3]" />
            ) : (
              <Lightbulb className="w-16 h-16 mb-3 stroke-[3]" />
            )}
            <span className="text-xl font-bold">Ideas Generator</span>
          </Button>
        </div>
      </div>

      <ClientSelectorModal
        isOpen={showClientSelector}
        onClose={handleCloseModal}
        onSelectClient={handleClientSelect}
        title={modalConfig.title}
        description={modalConfig.description}
        loading={loading}
      />
    </>
  );
}
