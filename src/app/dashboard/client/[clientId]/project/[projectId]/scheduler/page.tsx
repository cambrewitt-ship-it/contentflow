import { Suspense } from 'react';
import SchedulerClient from './scheduler-client';

interface PageProps {
  params: {
    clientId: string;
    projectId: string;
  };
}

export default async function SchedulerPage({ params }: PageProps) {
  console.log('📅 Scheduler page called with params:', params);
  console.log('📅 Params type:', typeof params);
  console.log('📅 Params keys:', Object.keys(params));
  console.log('📅 SchedulerClient component:', SchedulerClient); // Should not be undefined
  
  const { clientId, projectId } = params;
  
  console.log('📅 Scheduler page params resolved:', { clientId, projectId });
  console.log('📅 clientId type:', typeof clientId);
  console.log('📅 clientId value:', clientId);
  console.log('📅 projectId type:', typeof projectId);
  console.log('📅 projectId value:', projectId);
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="text-center py-20">
            <div className="animate-pulse">
              <div className="h-12 w-12 mx-auto mb-4 bg-muted rounded-md" />
              <h1 className="text-2xl font-bold mb-2">Loading Scheduler...</h1>
              <p className="text-muted-foreground">Please wait while we prepare your calendar view.</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <SchedulerClient clientId={clientId} projectId={projectId} />
    </Suspense>
  );
}