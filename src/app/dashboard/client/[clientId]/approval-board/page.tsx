'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { SocialPreviewCard } from 'components/SocialPreviewCard';
// Temporary inline types to resolve import issue
interface WeekData {
  weekStart: Date;
  weekLabel: string;
  posts: any[];
}

export default function ApprovalBoardPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.clientId as string;
  
  // State following your patterns
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [session, setSession] = useState<any>(null);

  // Fetch approval board data
  const fetchApprovalData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get latest session for this client/project
      // For now, we'll use a mock session ID - this will be updated when we integrate with project selection
      const sessionId = 'temp-session-id';
      
      const response = await fetch(`/api/approval-sessions/${sessionId}/posts`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch approval data: ${response.statusText}`);
      }
      
      const { session: sessionData, weeks: weeksData } = await response.json();
      
      setSession(sessionData);
      setWeeks(weeksData || []);
      
    } catch (err) {
      console.error('❌ Error fetching approval data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load approval data');
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (clientId) {
      fetchApprovalData();
    }
  }, [clientId]);

  // Loading state following your patterns
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Error state following your patterns
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Failed to Load Approval Board
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchApprovalData} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center">
              <img 
                src="/cm-logo.png" 
                alt="CM Logo" 
                className="h-12 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 px-4 min-h-screen">
        {weeks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No scheduled posts found for this project.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {weeks.map((week, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="card-title-26 text-gray-700">
                    {week.weekLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {week.posts.map((post) => (
                      <div key={`${post.post_type}-${post.id}`} className="space-y-4">
                        <SocialPreviewCard
                          platform={post.platform || 'facebook'}
                          accountName={post.account_name || 'Your Account'}
                          username={post.username}
                          caption={post.caption || ''}
                          imageUrl={post.image_url}
                          scheduledDate={post.scheduled_date}
                          scheduledTime={post.scheduled_time}
                          approvalStatus={post.approval?.approval_status}
                          clientComments={post.approval?.client_comments}
                          showApprovalInfo={true}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
