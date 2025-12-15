'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit3, Calendar, Trash2, Upload, X, Image, File, RefreshCw, Loader2, Check, AlertTriangle, Minus } from 'lucide-react'
import Link from 'next/link'
import BrandInformationPanel from '@/components/BrandInformationPanel'
import { CompactMonthCalendar } from '@/components/CompactMonthCalendar'
import { useAuth } from '@/contexts/AuthContext'
import { Client, BrandDocument, WebsiteScrape, OAuthMessage } from '@/types/api'
import { 
  FacebookIcon, 
  InstagramIcon, 
  TwitterIcon, 
  LinkedInIcon, 
  TikTokIcon, 
  YouTubeIcon, 
  ThreadsIcon 
} from '@/components/social-icons'

export default function ClientDashboard({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { getAccessToken } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [website, setWebsite] = useState("")
  const [about, setAbout] = useState("")
  const [brandDocuments, setBrandDocuments] = useState<BrandDocument[]>([])
  const [websiteScrapes, setWebsiteScrapes] = useState<WebsiteScrape[]>([])
  const [deletingClient, setDeletingClient] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [oauthMessage, setOauthMessage] = useState<OAuthMessage | null>(null)
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([])
  const [fetchingAccounts, setFetchingAccounts] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)
  const [isEditingLogo, setIsEditingLogo] = useState(false)
  const [scheduledPosts, setScheduledPosts] = useState<Post[]>([])
  const [scheduledPostsLoading, setScheduledPostsLoading] = useState(false)
  const [clientUploads, setClientUploads] = useState<{[key: string]: Upload[]}>({})
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  
  // Refs to prevent duplicate requests
  const fetchAccountsRef = useRef(false)
  const fetchClientRef = useRef(false)
  const fetchBrandDataRef = useRef(false)
  const oauthHandledRef = useRef<string | null>(null)

  interface ConnectedAccount {
    _id: string;
    platform: string;
    name: string;
    accountId?: string;
  }

  interface Post {
    id: string;
    project_id: string | null;
    caption: string;
    image_url: string;
    scheduled_time: string | null;
    scheduled_date?: string;
    approval_status?: 'pending' | 'approved' | 'rejected' | 'needs_attention' | 'draft';
    needs_attention?: boolean;
    client_feedback?: string;
  }

  interface ActivityLog {
    id: string;
    type: 'upload' | 'approval' | 'scheduled' | 'published' | 'portal_visit' | 'next_scheduled';
    title: string;
    timestamp: string;
    status: 'completed' | 'approved' | 'scheduled' | 'published' | 'upload' | 'none' | 'not_posted';
    timeAgo?: string;
    count?: number;
    details?: any;
  }


  // Fetch client data via API
  useEffect(() => {
    if (!clientId || fetchClientRef.current) return
    
    async function fetchClient() {
      try {
        fetchClientRef.current = true
        setLoading(true)
        setError(null)
        
        console.log('🔍 Fetching client data for ID:', clientId)
        
        const accessToken = getAccessToken();
        console.log('🔑 Access token status:', accessToken ? 'Available' : 'Missing');
        
        if (!accessToken) {
          console.log('⚠️ No access token available, waiting for session...');
          // Keep loading true while waiting for the session
          // Don't set loading to false - keep showing loading state
          setTimeout(() => {
            fetchClientRef.current = false;
            fetchClient();
          }, 500); // Reduced from 1000ms to 500ms for faster retry
          return; // Return WITHOUT going to finally block
        }
        
        const response = await fetch(`/api/clients/${clientId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Client not found')
          }
          throw new Error(`Failed to fetch client: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('✅ Client data fetched:', data)
        
        setClient(data.client)
        setWebsite(data.client.website_url || "")
        setAbout(data.client.company_description || "")
        setLoading(false) // Only set loading false on success
        
      } catch (err) {
        console.error('❌ Error fetching client:', err)
        // Only set error if it's a critical error (404, not just network issues)
        if (err instanceof Error && err.message === 'Client not found') {
          setError(err.message)
          setLoading(false) // Set loading false for 404 errors
        } else {
          // For other errors, retry after a short delay instead of showing error immediately
          console.log('🔄 Retrying client fetch in 1.5 seconds...')
          setTimeout(() => {
            if (!client) { // Only retry if we still don't have client data
              fetchClientRef.current = false
              fetchClient()
            }
          }, 1500) // Reduced from 2000ms to 1500ms
        }
      } finally {
        fetchClientRef.current = false
      }
    }

    fetchClient()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]) // ✅ Only depend on clientId, not getAccessToken (which is not memoized)

  // Fetch brand data separately to prevent infinite loops
  useEffect(() => {
    if (!clientId || fetchBrandDataRef.current) return
    
    async function fetchBrandData() {
      try {
        fetchBrandDataRef.current = true
        const accessToken = getAccessToken()
        
        if (!accessToken) {
          console.log('⚠️ No access token available for brand data fetch');
          return;
        }
        
        const headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        };
        
        // Fetch brand documents
        const docsResponse = await fetch(`/api/clients/${clientId}/brand-documents`, { headers })
        if (docsResponse.ok) {
          const docsData = await docsResponse.json()
          setBrandDocuments(docsData.documents || [])
        }

        // Fetch website scrapes
        const scrapesResponse = await fetch(`/api/clients/${clientId}/scrape-website`, { headers })
        if (scrapesResponse.ok) {
          const scrapesData = await scrapesResponse.json()
          setWebsiteScrapes(scrapesData.scrapes || [])
        }
      } catch (error) {
        console.error('Error fetching brand data:', error)
      } finally {
        fetchBrandDataRef.current = false
      }
    }
    
    fetchBrandData()
  }, [clientId, getAccessToken])

  // Fetch scheduled posts for post status
  const fetchScheduledPosts = useCallback(async () => {
    if (!clientId) return
    
    try {
      setScheduledPostsLoading(true)
      
      const accessToken = getAccessToken()
      if (!accessToken) {
        console.log('⚠️ No access token available for scheduled posts fetch')
        return
      }
      
      const response = await fetch(`/api/calendar/scheduled?clientId=${clientId}&limit=200`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        console.error('❌ Scheduled posts fetch error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          clientId
        })
        throw new Error(`Failed to fetch scheduled posts: ${response.statusText}`)
      }
      
      const data = await response.json()
      setScheduledPosts(data.posts || [])
      
      // Map uploads by date (using created_at date)
      const uploadsMapped: {[key: string]: Upload[]} = {}
      const uploads = data.uploads || []
      uploads.forEach((upload: Upload) => {
        const uploadDate = new Date(upload.created_at).toLocaleDateString('en-CA')
        if (!uploadsMapped[uploadDate]) uploadsMapped[uploadDate] = []
        uploadsMapped[uploadDate].push(upload)
      })
      setClientUploads(uploadsMapped)
      
    } catch (err) {
      console.error('Error fetching scheduled posts:', err)
    } finally {
      setScheduledPostsLoading(false)
    }
  }, [clientId])

  // Fetch activity logs
  const fetchActivityLogs = useCallback(async () => {
    if (!clientId) return
    
    try {
      setActivityLoading(true)
      
      const accessToken = getAccessToken()
      if (!accessToken) {
        console.log('⚠️ No access token available for activity logs fetch')
        return
      }
      
      const response = await fetch(`/api/clients/${clientId}/activity-logs`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch activity logs: ${response.statusText}`)
      }
      
      const data = await response.json()
      setActivityLogs(data.activities || [])
      
    } catch (err) {
      console.error('Error fetching activity logs:', err)
    } finally {
      setActivityLoading(false)
    }
  }, [clientId])

  // Fetch scheduled posts and activity logs when client is loaded
  useEffect(() => {
    if (client) {
      fetchScheduledPosts()
      fetchActivityLogs()
    }
  }, [client, fetchScheduledPosts, fetchActivityLogs])

  // Check for OAuth callback messages in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthSuccess = urlParams.get('oauth_success');
      const oauthError = urlParams.get('oauth_error');
      const errorDescription = urlParams.get('error_description');
      const username = urlParams.get('username');
      const connected = urlParams.get('connected');
      
      if (oauthSuccess) {
        setOauthMessage({
          type: 'success',
          message: `Successfully connected to ${oauthSuccess}${username ? ` (${username})` : ''}!`
        });
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (oauthError) {
        setOauthMessage({
          type: 'error',
          message: `Failed to connect: ${errorDescription || oauthError}`
        });
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const fetchConnectedAccounts = useCallback(async () => {
    if (!clientId || fetchAccountsRef.current) return

    const accessToken = getAccessToken();
    if (!accessToken) {
      console.log('⚠️ No access token available for connected accounts fetch - retrying...');
      setTimeout(() => {
        fetchConnectedAccounts();
      }, 500);
      return;
    }

    try {
      fetchAccountsRef.current = true
      setFetchingAccounts(true)
      const response = await fetch(`/api/late/get-accounts/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.warn('⚠️ Unauthorized when fetching connected accounts - keeping existing state');
          return;
        }
        if (response.status === 404) {
          console.log('Client not found or no LATE profile setup - skipping connected accounts');
          setConnectedAccounts([]);
          return;
        }
        // Don't throw error for other status codes - just log and continue
        console.warn(`⚠️ Failed to fetch accounts: ${response.status} - continuing without accounts`);
        setConnectedAccounts([]);
        return;
      }
      const data = await response.json();
      setConnectedAccounts(data.accounts || []);
      console.log('Connected accounts count:', data.accounts?.length || 0);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      // Keep existing connected accounts state on error
    } finally {
      setFetchingAccounts(false)
      fetchAccountsRef.current = false
    }
  }, [clientId]);

  // Function to clear OAuth messages after delay
  const clearOAuthMessage = useCallback(() => {
    setTimeout(() => {
      setOauthMessage(null)
    }, 5000) // Clear message after 5 seconds
  }, []);

  // Function to refresh accounts after OAuth success
  const refreshAccountsAfterOAuth = useCallback(async () => {
    if (!clientId || fetchAccountsRef.current) return

    const accessToken = getAccessToken();
    if (!accessToken) {
      console.log('⚠️ No access token available for account refresh - skipping');
      return;
    }

    try {
      fetchAccountsRef.current = true
      const response = await fetch(`/api/late/get-accounts/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.warn('⚠️ Unauthorized when refreshing accounts - keeping existing state');
          return;
        }
        if (response.status === 404) {
          console.log('Client not found or no LATE profile setup - skipping account refresh');
          setConnectedAccounts([]);
          return;
        }
        // Don't throw error for other status codes - just log and continue
        console.warn(`⚠️ Failed to refresh accounts: ${response.status} - continuing without refresh`);
        return;
      }
      const data = await response.json();
      setConnectedAccounts(data.accounts || []);
      console.log('✅ Accounts refreshed after OAuth - count:', data.accounts?.length || 0);
    } catch (error) {
      console.error('Error refreshing accounts after OAuth:', error);
      // Keep existing connected accounts state on error
    } finally {
      fetchAccountsRef.current = false
    }
  }, [clientId]);

  // Fetch connected accounts
  useEffect(() => {
    if (clientId && !fetchAccountsRef.current) {
      fetchConnectedAccounts()
    }
  }, [clientId, fetchConnectedAccounts])

  // Handle OAuth callback URL parameters
  useEffect(() => {
    if (!searchParams) return
    
    // Create a unique key for this set of search params to prevent duplicate processing
    const searchParamsString = searchParams.toString()
    
    // Skip if we've already handled these exact parameters
    if (oauthHandledRef.current === searchParamsString) return
    
    const connected = searchParams.get('connected')
    const status = searchParams.get('status')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const profileId = searchParams.get('profileId')
    const username = searchParams.get('username')
    const message = searchParams.get('message')

    console.log('🔍 OAuth URL parameters detected:', {
      connected,
      status,
      error,
      errorDescription,
      profileId,
      username,
      message
    })

    // Mark these parameters as handled
    oauthHandledRef.current = searchParamsString

    // Handle Facebook OAuth success
    if (connected === 'facebook' && status === 'success') {
      console.log('✅ Facebook OAuth success detected')
      setOauthMessage({
        type: 'success',
        message: 'Connection Successful'
      })
      
      // Clear message after delay
      clearOAuthMessage()
      
      // Refresh connected accounts to show the new connection
      setTimeout(() => {
        refreshAccountsAfterOAuth()
      }, 1000) // Small delay to ensure the connection is processed
      
      // Clean up URL parameters
      setTimeout(() => {
        const url = new URL(window.location.href)
        url.searchParams.delete('connected')
        url.searchParams.delete('status')
        url.searchParams.delete('profileId')
        url.searchParams.delete('username')
        router.replace(url.pathname + url.search)
      }, 2000) // Clean up after showing the message
    }
    
    // Handle OAuth errors
    else if (connected === 'facebook' && status === 'error') {
      console.log('❌ Facebook OAuth error detected:', { error, errorDescription })
      // Don't show error message - just clean up URL parameters
      
      // Clean up URL parameters
      setTimeout(() => {
        const url = new URL(window.location.href)
        url.searchParams.delete('connected')
        url.searchParams.delete('status')
        url.searchParams.delete('error')
        url.searchParams.delete('error_description')
        router.replace(url.pathname + url.search)
      }, 1000) // Clean up URL parameters without showing message
    }
    
    // Handle OAuth warnings
    else if (connected === 'facebook' && status === 'warning') {
      console.log('⚠️ Facebook OAuth warning detected')
      // Don't show error message - just clean up URL parameters
      
      // Clean up URL parameters
      setTimeout(() => {
        const url = new URL(window.location.href)
        url.searchParams.delete('connected')
        url.searchParams.delete('status')
        url.searchParams.delete('message')
        router.replace(url.pathname + url.search)
      }, 1000) // Clean up URL parameters without showing message
    }

    // Handle generic OAuth success (for other platforms)
    else if (connected && status === 'success') {
      console.log(`✅ ${connected} OAuth success detected`)
      setOauthMessage({
        type: 'success',
        message: 'Connection Successful'
      })
      
      // Clear message after delay
      clearOAuthMessage()
      
      // Refresh connected accounts
      setTimeout(() => {
        refreshAccountsAfterOAuth()
      }, 1000)
      
      // Clean up URL parameters
      setTimeout(() => {
        const url = new URL(window.location.href)
        url.searchParams.delete('connected')
        url.searchParams.delete('status')
        url.searchParams.delete('username')
        router.replace(url.pathname + url.search)
      }, 2000)
    }

  }, [searchParams, refreshAccountsAfterOAuth, router, clearOAuthMessage])

  // Check if a platform is connected
  const isPlatformConnected = (platform: string) => {
    return connectedAccounts.some(account => account.platform === platform);
  };

  const getPlatformButtonStyles = (platform: string) => {
    const connected = isPlatformConnected(platform);
    return {
      connected,
      buttonClasses: connected
        ? 'border-2 border-emerald-500 bg-emerald-50 shadow-sm hover:bg-emerald-100'
        : 'border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50',
      iconWrapperClasses: connected
        ? 'ring-4 ring-green-500 scale-105'
        : '',
      labelClasses: connected ? 'text-emerald-700' : 'text-gray-700'
    };
  };

  const getPlatformLabel = (platform: string, defaultLabel: string) => {
    if (connectingPlatform === platform) return 'Connecting...';
    if (isPlatformConnected(platform)) return 'CONNECTED';
    return defaultLabel;
  };

  // Handle platform connection
  const handlePlatformConnect = async (platform: string) => {
    try {
      setConnectingPlatform(platform)
      setError(null) // Clear any previous errors
      setOauthMessage(null) // Clear any previous OAuth messages
      
      console.log(`🔗 Connecting to ${platform} for client:`, clientId)

      const accessToken = getAccessToken()
      if (!accessToken) {
        console.error(`❌ No access token available for ${platform} connection`)
        return
      }
      
      // Use Facebook-specific route for Facebook, general route for others
      const apiRoute = platform === 'facebook' 
        ? '/api/late/connect-facebook'
        : '/api/late/connect-platform'
      
      const requestBody = platform === 'facebook'
        ? { clientId }
        : { platform, clientId }
      
      const response = await fetch(apiRoute, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to connect to ${platform}`)
      }
      
      const data = await response.json()
      console.log(`✅ ${platform} connection initiated:`, data)
      console.log('🔍 API Response structure:', JSON.stringify(data, null, 2))
      
      // Check if the response is successful
      if (!data.success) {
        throw new Error(data.error || `Failed to connect to ${platform}`)
      }
      
      // Redirect to OAuth URL using the correct field name
      if (data.connectUrl) {
        console.log(`🔗 Redirecting to: ${data.connectUrl}`)
        window.location.href = data.connectUrl
      } else {
        console.error('❌ No connectUrl in response:', data)
        throw new Error('No authentication URL received')
      }
      
    } catch (err) {
      console.error(`❌ Error connecting to ${platform}:`, err)
      
      // Don't show error messages - just log the error
      // All functionality remains the same, just no UI error messages
    } finally {
      setConnectingPlatform(null)
    }
  };



  // Delete client function
  const handleDeleteClient = async () => {
    if (!client) return;
    
    try {
      setDeletingClient(true);
      setError(null);
      
      console.log('🗑️ Deleting client:', clientId);
      
      const accessToken = getAccessToken();
      if (!accessToken) {
        console.error('❌ No access token available for delete operation');
        alert('Authentication required. Please refresh the page and try again.');
        return;
      }

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 Delete response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Delete error response:', errorData);
        throw new Error(`Failed to delete client: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Client deleted successfully, response:', responseData);
      
      // Redirect to main dashboard after successful deletion
      window.location.href = '/dashboard';
      
    } catch (err) {
      console.error('❌ Error deleting client:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete client');
    } finally {
      setDeletingClient(false);
      setShowDeleteConfirm(false);
    }
  };

  // Handle logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !client) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    try {
      setUploadingLogo(true);
      
      // Validate image dimensions to ensure it's square
      const validateSquareImage = (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
          const img = new window.Image();
          img.onload = () => {
            const isSquare = img.width === img.height;
            resolve(isSquare);
          };
          img.onerror = () => resolve(false);
          img.src = URL.createObjectURL(file);
        });
      };

      const isSquare = await validateSquareImage(file);
      if (!isSquare) {
        alert('Logo must be a square image (same width and height). Please crop your image to be square before uploading.');
        setUploadingLogo(false);
        event.target.value = '';
        return;
      }
      
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        
        const response = await fetch(`/api/clients/${clientId}/logo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAccessToken() || ''}`,
          },
          body: JSON.stringify({
            imageData: base64Data,
            filename: file.name
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload logo');
        }

        const data = await response.json();
        
        // Update client state with new logo URL
        setClient(prev => prev ? { ...prev, logo_url: data.logoUrl } : null);
        
        console.log('✅ Logo uploaded successfully:', data.logoUrl);
      };
      
      reader.readAsDataURL(file);
      
    } catch (err) {
      console.error('❌ Error uploading logo:', err);
      alert(`Failed to upload logo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingLogo(false);
      // Reset file input
      event.target.value = '';
      // Exit editing mode after upload
      setIsEditingLogo(false);
    }
  };

  // Handle logo removal
  const handleLogoRemove = async () => {
    if (!client) return;

    try {
      setRemovingLogo(true);
      
      const response = await fetch(`/api/clients/${clientId}/logo`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAccessToken() || ''}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove logo');
      }

      // Update client state to remove logo URL
      setClient(prev => prev ? { ...prev, logo_url: undefined } : null);
      
      console.log('✅ Logo removed successfully');
      
    } catch (err) {
      console.error('❌ Error removing logo:', err);
      alert(`Failed to remove logo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRemovingLogo(false);
      // Exit editing mode after removal
      setIsEditingLogo(false);
    }
  };

  const getActivityStatusBadge = (activity: ActivityLog) => {
    switch (activity.status) {
      case 'upload':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Upload</span>;
      case 'published':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Published</span>;
      case 'approved':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Approved</span>;
      case 'scheduled':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Scheduled</span>;
      case 'not_posted':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Not Posted Yet</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Completed</span>;
      case 'none':
        return null; // No badge for empty states
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{activity.status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading business profile dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">Client Not Found</h2>
            <p className="text-yellow-600">No client data available for ID: {clientId}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          
          {/* Client Details Card and Action Buttons - Full Width Layout */}
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            {/* Client Details Card - Takes remaining space */}
            <Card className="flex-1 shadow-md hover:shadow-lg transition-all duration-300" style={{ borderRadius: '16px' }}>
              <CardContent className="p-6 h-full">
                <div className="flex items-center space-x-6 h-full">
                  {/* Logo Display/Upload Section */}
                  <div className="relative">
                    <div className={`w-24 h-24 rounded-xl flex items-center justify-center overflow-hidden ${
                      client?.logo_url 
                        ? 'shadow-sm' 
                        : 'bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300'
                    }`}>
                      {client?.logo_url ? (
                        <img 
                          src={client.logo_url} 
                          alt={`${client.name} logo`}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-3xl font-bold text-gray-600">
                          {client?.name ? client.name.charAt(0).toUpperCase() : 'C'}
                        </span>
                      )}
                    </div>
                    
                    {/* Logo Upload Button - Only show when editing */}
                    {isEditingLogo && (
                      <div className="absolute -bottom-1 -right-1">
                        <label htmlFor="logo-upload" className="cursor-pointer">
                          <div className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-colors">
                            {uploadingLogo ? (
                              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                          </div>
                        </label>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                      </div>
                    )}
                    
                    {/* Logo Remove Button - Only show when editing */}
                    {client?.logo_url && isEditingLogo && (
                      <button
                        onClick={handleLogoRemove}
                        disabled={removingLogo}
                        className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow-lg transition-colors disabled:opacity-50"
                      >
                        {removingLogo ? (
                          <div className="w-3 h-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </button>
                    )}
                    
                    {/* Cancel Edit Button - Only show when editing */}
                    {isEditingLogo && (
                      <button
                        onClick={() => setIsEditingLogo(false)}
                        className="absolute -top-1 -left-1 bg-gray-600 hover:bg-gray-700 text-white rounded-full p-1.5 shadow-lg transition-colors"
                        title="Cancel editing"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-3">
                      <h1 className="text-3xl font-bold text-gray-800">
                        {client?.name || 'Business Profile Dashboard'}
                      </h1>
                      
                      {/* Logo Upload/Edit Button */}
                      {!isEditingLogo && (
                        <Button
                          onClick={() => setIsEditingLogo(true)}
                          variant="outline"
                          size="sm"
                          className="text-xs hover:bg-gray-50"
                        >
                          {client?.logo_url ? (
                            <>
                              <Edit3 className="w-3 h-3 mr-1" />
                              Edit Logo
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3 mr-1" />
                              Upload Logo
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span className="text-base">{website || 'No website set'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Action Buttons Container - Equal Width */}
            <div className="flex gap-6">
              {/* Create Content Button */}
              <Button 
                onClick={() => window.location.href = `/dashboard/client/${clientId}/content-suite`}
                className="bg-gradient-to-r from-pink-300 via-purple-500 to-purple-700 hover:from-pink-400 hover:via-purple-600 hover:to-purple-800 text-white w-48 font-bold shadow-md hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center"
                style={{ height: '177px', borderRadius: '16px' }}
              >
                <Plus className="w-16 h-16 mb-3 stroke-[3]" />
                <span className="text-xl font-bold">Create Content</span>
              </Button>
              
              {/* Calendar Button */}
              <Button 
                onClick={() => window.location.href = `/dashboard/client/${clientId}/calendar`}
                className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white w-48 font-bold shadow-md hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center"
                style={{ height: '177px', borderRadius: '16px' }}
              >
                <Calendar className="w-16 h-16 mb-3 stroke-[3]" />
                <span className="text-xl font-bold">Calendar</span>
              </Button>
            </div>
          </div>
        </div>

        {/* OAuth Messages */}
        {oauthMessage && (
          <div className={`mb-6 p-4 rounded-lg border ${
            oauthMessage.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-5 h-5 rounded-full mr-3 ${
                  oauthMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <p className="font-medium">{oauthMessage.message}</p>
              </div>
              <button
                onClick={() => setOauthMessage(null)}
                className="text-gray-400 hover:text-gray-600 ml-4"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Activity Hub & Month Calendar - Two Column Layout (40/60) */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-[40%_60%] gap-6">
          {/* Client Activity Hub - Takes 40% */}
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 mb-6" style={{ fontSize: '24px' }}>Client Activity Hub</h2>
            
            {activityLoading ? (
              <Card className="shadow-md hover:shadow-lg transition-all duration-300" style={{ borderRadius: '16px', height: '879px' }}>
                <CardContent className="p-6 h-full flex items-center justify-center">
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mr-3"></div>
                    <span className="text-gray-600">Loading activity...</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-300 flex flex-col" style={{ borderRadius: '16px', height: '879px' }}>
                <CardContent className="p-6 flex-1 flex flex-col min-h-0">
                  {/* Scrollable Content Container */}
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                    {/* Upcoming Posts Section */}
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center" style={{ fontSize: '18px' }}>
                        <div className="w-2.5 h-2.5 bg-green-600 rounded-full mr-3"></div>
                        Upcoming Posts
                      </h3>
                      <div className="space-y-3">
                        {(() => {
                          const upcomingPosts = activityLogs.filter(activity => activity.type === 'next_scheduled');
                          if (upcomingPosts.length === 0) {
                            return (
                              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                                <p className="text-sm text-gray-500">No upcoming posts</p>
                              </div>
                            );
                          }
                          return upcomingPosts.map((activity) => (
                            <div key={activity.id} className="bg-green-50 border border-green-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                              <div className="flex items-start gap-3">
                                {/* Post Thumbnail */}
                                <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                                  {activity.details?.image_url ? (
                                    <img
                                      src={activity.details.image_url}
                                      alt="Post thumbnail"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                      <Image className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                </div>
                                
                                {/* Post Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-800 mb-1">{activity.title}</p>
                                      <p className="text-xs text-gray-500 mb-2">{activity.timeAgo}</p>
                                      {activity.details?.caption && (
                                        <p className="text-xs text-gray-600 italic line-clamp-2">&quot;{activity.details.caption}&quot;</p>
                                      )}
                                    </div>
                                    <div className="ml-3 flex-shrink-0">
                                      {getActivityStatusBadge(activity)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Recent Activity Section */}
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center" style={{ fontSize: '18px' }}>
                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-full mr-3"></div>
                        Recent Activity
                      </h3>
                      <div className="space-y-3">
                        {activityLogs
                          .filter(activity => activity.type !== 'next_scheduled')
                          .slice(0, 10)
                          .map((activity) => (
                          <div key={activity.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 mb-1">{activity.title}</p>
                                <p className="text-xs text-gray-500">{activity.timeAgo}</p>
                              </div>
                              <div className="ml-3 flex-shrink-0">
                                {getActivityStatusBadge(activity)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {activityLogs.filter(activity => activity.type !== 'next_scheduled').length > 10 && (
                        <div className="mt-4 text-center">
                          <p className="text-xs text-gray-500">
                            Showing 10 of {activityLogs.filter(activity => activity.type !== 'next_scheduled').length} recent activities
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Month View Calendar with Post Status - Takes 60% */}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6" style={{ fontSize: '24px' }}>Content Calendar</h2>
            <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-300" style={{ borderRadius: '16px' }}>
              <CardContent className="p-6">
                {/* Post Status Grid - Single Row Layout */}
                <div className="mb-6">
                  <div className="grid grid-cols-4 gap-3">
                    {(() => {
                      const approved = scheduledPosts.filter(p => p.approval_status === 'approved').length;
                      const rejected = scheduledPosts.filter(p => p.approval_status === 'rejected').length;
                      const needsAttention = scheduledPosts.filter(p => p.approval_status === 'needs_attention').length;
                      const pending = scheduledPosts.filter(p => p.approval_status === 'pending' || !p.approval_status).length;
                      
                      return (
                        <>
                          <div className="bg-green-50 rounded-xl p-3 hover:shadow-md transition-all flex flex-col items-center justify-center text-center">
                            <div className="flex items-center mb-2">
                              <Check className="w-4 h-4 text-green-600 mr-1.5" />
                              <span className="text-xs font-black text-green-800">Approved</span>
                            </div>
                            <div className="text-2xl font-black text-green-900">{approved}</div>
                          </div>
                          <div className="bg-red-50 rounded-xl p-3 hover:shadow-md transition-all flex flex-col items-center justify-center text-center">
                            <div className="flex items-center mb-2">
                              <X className="w-4 h-4 text-red-600 mr-1.5" />
                              <span className="text-xs font-black text-red-800">Rejected</span>
                            </div>
                            <div className="text-2xl font-black text-red-900">{rejected}</div>
                          </div>
                          <div className="bg-orange-50 rounded-xl p-3 hover:shadow-md transition-all flex flex-col items-center justify-center text-center">
                            <div className="flex items-center mb-2">
                              <AlertTriangle className="w-4 h-4 text-orange-600 mr-1.5" />
                              <span className="text-xs font-black text-orange-800">Needs Attention</span>
                            </div>
                            <div className="text-2xl font-black text-orange-900">{needsAttention}</div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3 hover:shadow-md transition-all flex flex-col items-center justify-center text-center">
                            <div className="flex items-center mb-2">
                              <div className="w-4 h-4 bg-gray-400 rounded-full mr-1.5"></div>
                              <span className="text-xs font-black text-gray-800">Pending</span>
                            </div>
                            <div className="text-2xl font-black text-gray-700">{pending}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Month Calendar */}
                <div className="mt-6">
                  <CompactMonthCalendar 
                    posts={scheduledPosts} 
                    uploads={clientUploads}
                    loading={scheduledPostsLoading}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>


        {/* Unified Card - Social Media Platforms, Brand Information, and Delete Client */}
        <div className="mt-8">
          <Card className="shadow-md hover:shadow-lg transition-all" style={{ borderRadius: '16px' }}>
            <CardContent className="p-8 space-y-10">
              {/* Social Media Platforms Section */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-800" style={{ fontSize: '24px' }}>Social Media Platforms</h3>
                  {/* Powered by LATE */}
                  <div className="flex items-center space-x-2 text-gray-500">
                    <span className="text-sm">Powered by</span>
                    <img 
                      src="/lateapi-logo.png" 
                      alt="LATE" 
                      className="h-5 w-auto rounded border border-black"
                    />
                  </div>
                </div>
                
                {/* OAuth Success/Error Messages */}
                {oauthMessage && (
                  <div className={`mb-4 border rounded-lg p-4 ${
                    oauthMessage.type === 'success' 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm ${
                        oauthMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {oauthMessage.message}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOauthMessage(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                )}

                {/* Social Media Buttons Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Facebook */}
                  <button
                    onClick={() => handlePlatformConnect('facebook')}
                    disabled={connectingPlatform === 'facebook'}
                    className={`relative flex flex-col items-center space-y-2 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      getPlatformButtonStyles('facebook').buttonClasses
                    }`}
                  >
                    {getPlatformButtonStyles('facebook').connected && (
                      <span className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <div className={`w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center transition-all ${
                      getPlatformButtonStyles('facebook').iconWrapperClasses
                    }`}>
                      {connectingPlatform === 'facebook' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <FacebookIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      getPlatformButtonStyles('facebook').labelClasses
                    }`}>
                      {getPlatformLabel('facebook', 'Facebook')}
                    </span>
                  </button>

                  {/* Instagram */}
                  <button
                    onClick={() => handlePlatformConnect('instagram')}
                    disabled={connectingPlatform === 'instagram'}
                    className={`relative flex flex-col items-center space-y-2 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      getPlatformButtonStyles('instagram').buttonClasses
                    }`}
                  >
                    {getPlatformButtonStyles('instagram').connected && (
                      <span className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <div className={`w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center transition-all ${
                      getPlatformButtonStyles('instagram').iconWrapperClasses
                    }`}>
                      {connectingPlatform === 'instagram' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <InstagramIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      getPlatformButtonStyles('instagram').labelClasses
                    }`}>
                      {getPlatformLabel('instagram', 'Instagram')}
                    </span>
                  </button>

                  {/* Twitter */}
                  <button
                    onClick={() => handlePlatformConnect('twitter')}
                    disabled={connectingPlatform === 'twitter'}
                    className={`relative flex flex-col items-center space-y-2 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      getPlatformButtonStyles('twitter').buttonClasses
                    }`}
                  >
                    {getPlatformButtonStyles('twitter').connected && (
                      <span className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <div className={`w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center transition-all ${
                      getPlatformButtonStyles('twitter').iconWrapperClasses
                    }`}>
                      {connectingPlatform === 'twitter' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <TwitterIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      getPlatformButtonStyles('twitter').labelClasses
                    }`}>
                      {getPlatformLabel('twitter', 'Twitter')}
                    </span>
                  </button>

                  {/* LinkedIn */}
                  <button
                    onClick={() => handlePlatformConnect('linkedin')}
                    disabled={connectingPlatform === 'linkedin'}
                    className={`relative flex flex-col items-center space-y-2 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      getPlatformButtonStyles('linkedin').buttonClasses
                    }`}
                  >
                    {getPlatformButtonStyles('linkedin').connected && (
                      <span className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <div className={`w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center transition-all ${
                      getPlatformButtonStyles('linkedin').iconWrapperClasses
                    }`}>
                      {connectingPlatform === 'linkedin' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <LinkedInIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      getPlatformButtonStyles('linkedin').labelClasses
                    }`}>
                      {getPlatformLabel('linkedin', 'LinkedIn')}
                    </span>
                  </button>

                  {/* TikTok */}
                  <button
                    onClick={() => handlePlatformConnect('tiktok')}
                    disabled={connectingPlatform === 'tiktok'}
                    className={`relative flex flex-col items-center space-y-2 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      getPlatformButtonStyles('tiktok').buttonClasses
                    }`}
                  >
                    {getPlatformButtonStyles('tiktok').connected && (
                      <span className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <div className={`w-10 h-10 bg-black rounded-full flex items-center justify-center transition-all ${
                      getPlatformButtonStyles('tiktok').iconWrapperClasses
                    }`}>
                      {connectingPlatform === 'tiktok' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <TikTokIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      getPlatformButtonStyles('tiktok').labelClasses
                    }`}>
                      {getPlatformLabel('tiktok', 'TikTok')}
                    </span>
                  </button>

                  {/* YouTube */}
                  <button
                    onClick={() => handlePlatformConnect('youtube')}
                    disabled={connectingPlatform === 'youtube'}
                    className={`relative flex flex-col items-center space-y-2 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      getPlatformButtonStyles('youtube').buttonClasses
                    }`}
                  >
                    {getPlatformButtonStyles('youtube').connected && (
                      <span className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <div className={`w-10 h-10 bg-red-600 rounded-full flex items-center justify-center transition-all ${
                      getPlatformButtonStyles('youtube').iconWrapperClasses
                    }`}>
                      {connectingPlatform === 'youtube' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <YouTubeIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      getPlatformButtonStyles('youtube').labelClasses
                    }`}>
                      {getPlatformLabel('youtube', 'YouTube')}
                    </span>
                  </button>

                  {/* Threads */}
                  <button
                    onClick={() => handlePlatformConnect('threads')}
                    disabled={connectingPlatform === 'threads'}
                    className={`relative flex flex-col items-center space-y-2 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      getPlatformButtonStyles('threads').buttonClasses
                    }`}
                  >
                    {getPlatformButtonStyles('threads').connected && (
                      <span className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <div className={`w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center transition-all ${
                      getPlatformButtonStyles('threads').iconWrapperClasses
                    }`}>
                      {connectingPlatform === 'threads' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <ThreadsIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      getPlatformButtonStyles('threads').labelClasses
                    }`}>
                      {getPlatformLabel('threads', 'Threads')}
                    </span>
                  </button>
                </div>
              </div>

              {/* Brand Information Section */}
              <div className="border-t-2 pt-8">
                <BrandInformationPanel 
                  clientId={clientId} 
                  client={client} 
                  onUpdate={(updatedClient) => setClient(updatedClient)}
                  brandDocuments={brandDocuments}
                  websiteScrapes={websiteScrapes}
                />
              </div>

              {/* Delete Client Section */}
              <div className="border-t-2 pt-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-red-900" style={{ fontSize: '24px' }}>Delete Business Profile</h3>
                    <p className="text-sm text-red-700 mt-2">
                      Permanently delete this business profile and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {!showDeleteConfirm ? (
                      <Button
                        onClick={() => setShowDeleteConfirm(true)}
                        variant="destructive"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Business Profile
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleDeleteClient}
                          disabled={deletingClient}
                          variant="destructive"
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deletingClient ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Confirm Delete
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => setShowDeleteConfirm(false)}
                          variant="outline"
                          disabled={deletingClient}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
