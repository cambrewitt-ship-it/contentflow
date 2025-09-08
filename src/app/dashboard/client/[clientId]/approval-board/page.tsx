'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
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
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Error state following your patterns
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Client Approval Board</h1>
              <p className="text-sm text-gray-500">
                Review and manage client feedback on scheduled posts
              </p>
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
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {week.weekLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {week.posts.map((post) => (
                      <div key={`${post.post_type}-${post.id}`} className="border rounded-lg p-4 bg-white h-auto">
                        {/* Image */}
                        {post.image_url && (
                          <img
                            src={post.image_url}
                            alt="Post"
                            className="w-full h-40 object-cover rounded-lg mb-3"
                          />
                        )}

                        {/* Caption */}
                        <p className="text-sm text-gray-900 mb-2 line-clamp-3">
                          {post.caption}
                        </p>

                        {/* Schedule Info */}
                        <div className="text-xs text-gray-500 mb-3">
                          {new Date(post.scheduled_date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short'
                          })}
                          {post.scheduled_time && (
                            <span> at {post.scheduled_time.slice(0, 5)}</span>
                          )}
                        </div>

                        {/* Approval Status */}
                        <div className="flex items-center justify-between">
                          <div className={`text-xs px-2 py-1 rounded ${
                            post.approval?.approval_status === 'approved' 
                              ? 'bg-green-100 text-green-700'
                              : post.approval?.approval_status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {post.approval?.approval_status || 'pending'}
                          </div>
                        </div>

                        {/* Client Comments */}
                        {post.approval?.client_comments && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <span className="font-medium">Client:</span> {post.approval.client_comments}
                          </div>
                        )}
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
