'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit3, Calendar, Trash2, Upload, X, Image, File, RefreshCw, Loader2, Check, AlertTriangle, Minus, Globe, Sparkles, ArrowRight, CalendarCheck, Clock, MessagesSquare, Activity } from 'lucide-react'
import { usePortfolio } from '@/components/analytics/Portfolio'
import { MetricChart } from '@/components/analytics/MetricChart'
import { attentionItems, AttentionBanner, ContentSuitePromo, KpiColumn, SectionCard, StatCard } from '@/components/home/DashboardOverview'
import { authedFetchJson } from '@/lib/authedFetch'
import type { ClientAnalyticsResponse } from '@/lib/analytics/types'
import Link from 'next/link'
import BrandInformationPanel from '@/components/BrandInformationPanel'
import BrandKitSection from '@/components/brand-kit/BrandKitSection'
import CaptionLibrarySection from '@/components/caption-library/CaptionLibrarySection'
import { CompactMonthCalendar } from '@/components/CompactMonthCalendar'
import { useAuth } from '@/contexts/AuthContext'
import OnboardingChecklist from '@/components/OnboardingChecklist'
import { Client, BrandDocument, WebsiteScrape, OAuthMessage } from '@/types/api'
import { currentReturnPath } from '@/lib/returnPath'
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
  const { getAccessToken, user } = useAuth()
  // Overview for the top of the dashboard: status, attention items and 30-day results
  const portfolio = usePortfolio(true)
  const pulse = portfolio.clients[clientId]
  const [analytics, setAnalytics] = useState<ClientAnalyticsResponse | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    setAnalyticsLoading(true)
    authedFetchJson<ClientAnalyticsResponse>(`/api/clients/${clientId}/analytics?range=30`, { timeoutMs: 120_000 })
      .then((res) => { if (!cancelled) setAnalytics(res) })
      .catch(() => { /* the overview works without results */ })
      .finally(() => { if (!cancelled) setAnalyticsLoading(false) })
    return () => { cancelled = true }
  }, [clientId])
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
  const [unreadCount, setUnreadCount] = useState<number>(0)
  
  // Refs to prevent duplicate requests
  const fetchAccountsRef = useRef(false)
  const fetchClientRef = useRef(false)
  const fetchBrandDataRef = useRef(false)
  const oauthHandledRef = useRef<string | null>(null)
  const markedAsViewedRef = useRef(false)

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

  // Fetch unread count and mark as viewed when dashboard loads
  useEffect(() => {
    if (!clientId || markedAsViewedRef.current) return
    
    async function handleActivityViewing() {
      const accessToken = getAccessToken()
      if (!accessToken) return
      
      try {
        // First, fetch the current unread count
        const unreadResponse = await fetch('/api/clients/unread-counts', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (unreadResponse.ok) {
          const unreadData = await unreadResponse.json()
          const count = unreadData.unreadCounts?.[clientId] || 0
          setUnreadCount(count)
          console.log('📊 Unread count for this client:', count)
        }
        
        // Then mark all activities as viewed
        const markViewedResponse = await fetch(`/api/clients/${clientId}/mark-viewed`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (markViewedResponse.ok) {
          console.log('✅ Activities marked as viewed for client:', clientId)
          // After marking as viewed, set unread count to 0
          setTimeout(() => setUnreadCount(0), 1000) // Delay to show the badge briefly
        }
        
        markedAsViewedRef.current = true
      } catch (err) {
        console.error('Error handling activity viewing:', err)
      }
    }
    
    handleActivityViewing()
  }, [clientId, getAccessToken])

  // Check for OAuth callback messages in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthSuccess = urlParams.get('oauth_success');
      const oauthError = urlParams.get('oauth_error');
      const errorDescription = urlParams.get('error_description');
      const username = urlParams.get('username');
      const connected = urlParams.get('connected');
      
      const connectedStatus = urlParams.get('status');
      const successPlatform = oauthSuccess || (connected && connectedStatus === 'success' ? connected : null);

      if (successPlatform) {
        setOauthMessage({
          type: 'success',
          message: `Successfully connected to ${successPlatform}${username ? ` (${username})` : ''}!`
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
        // Don't throw error for other status codes - keep existing state
        console.warn(`⚠️ Failed to fetch accounts: ${response.status} - keeping existing state`);
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
      const accounts = data.accounts || [];
      setConnectedAccounts(accounts);
      console.log('✅ Accounts refreshed after OAuth - count:', accounts.length);

      // If LATE hasn't propagated the connection yet, retry once after 3s
      if (accounts.length === 0) {
        fetchAccountsRef.current = false;
        setTimeout(async () => {
          if (fetchAccountsRef.current) return;
          try {
            fetchAccountsRef.current = true;
            const retryResponse = await fetch(`/api/late/get-accounts/${clientId}`, {
              headers: { Authorization: `Bearer ${getAccessToken()}`, 'Content-Type': 'application/json' }
            });
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              if ((retryData.accounts || []).length > 0) {
                setConnectedAccounts(retryData.accounts);
                console.log('✅ Accounts loaded on retry - count:', retryData.accounts.length);
              }
            }
          } catch { /* silent */ } finally {
            fetchAccountsRef.current = false;
          }
        }, 3000);
        return;
      }
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

      // Optimistic update — show as connected immediately
      setConnectedAccounts(prev => {
        if (prev.some(a => a.platform === 'facebook')) return prev
        return [...prev, { _id: `facebook-${Date.now()}`, platform: 'facebook', name: username || 'Facebook' }]
      })

      // Confirm with live data from LATE
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

      // Optimistic update — show as connected immediately
      setConnectedAccounts(prev => {
        if (prev.some(a => a.platform === connected)) return prev
        return [...prev, { _id: `${connected}-${Date.now()}`, platform: connected, name: username || connected }]
      })

      // Confirm with live data from LATE
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
    if (isPlatformConnected(platform)) return 'Connected';
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
        ? { clientId, returnTo: currentReturnPath() }
        : { platform, clientId, returnTo: currentReturnPath() }
      
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
    <div className="min-h-screen bg-background">
      <div className="px-4 pt-4 pb-8 md:px-8 md:pt-6 max-w-7xl mx-auto">
        {/* Onboarding Checklist */}
        <OnboardingChecklist clientId={clientId} refreshKey={connectedAccounts.length} />

        {/* Header — welcome, brand logo (editable) and main actions */}
        <header className="mb-6 mt-2 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4 md:gap-6">
                  {/* Logo Display/Upload Section */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-20 h-20 md:w-24 md:h-24 rounded-3xl flex items-center justify-center overflow-hidden border border-white/80 shadow-card ${
                      client?.logo_url 
                        ? 'bg-white p-2' 
                        : 'bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700'
                    }`}>
                      {client?.logo_url ? (
                        <img 
                          src={client.logo_url} 
                          alt={`${client.name} logo`}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-3xl font-bold text-blue-700">
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
            <div className="min-w-0">
              <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-gray-900 md:text-[34px]">
                Welcome back, {(((user?.user_metadata as { full_name?: string } | undefined)?.full_name || '').split(' ')[0]) || user?.email?.split('@')[0] || 'there'}!
              </h1>
              <p className="mt-1 text-[15px] text-gray-500 md:text-lg">
                Here&apos;s what&apos;s happening with <span className="font-medium text-gray-700">{client?.name || 'your business'}</span>.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{website || 'No website set'}</span>
                </span>
                {/* Logo Upload/Edit Button */}
                      {!isEditingLogo && (
                        <Button
                          onClick={() => setIsEditingLogo(true)}
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-lg text-xs hover:bg-gray-50"
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
            </div>
          </div>
          {/* Hidden on phones, where the bottom nav covers Create/Calendar */}
          <div className="hidden flex-shrink-0 items-center gap-2 md:flex">
            <Button
              onClick={() => router.push(`/dashboard/client/${clientId}/calendar`)}
              variant="outline"
              className="h-12 rounded-2xl px-5 text-[15px]"
            >
              <Calendar className="h-5 w-5" />
              Calendar
            </Button>
            <Button
              onClick={() => router.push(`/dashboard/client/${clientId}/content-suite`)}
              className="group h-12 rounded-2xl bg-gradient-ai px-6 text-[15px] font-semibold text-white shadow-[0_10px_30px_-8px_rgb(99_102_241/0.55)] hover:brightness-105"
            >
              <Sparkles className="h-5 w-5" />
              Create Content
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </header>

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

        {/* Needs attention + key numbers */}
        <div className="mb-6 space-y-6">
          <AttentionBanner
            items={attentionItems([pulse])}
            names={{ [clientId]: client?.name || '' }}
            showBrand={false}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={CalendarCheck}
              value={pulse ? pulse.scheduledNext7 : '—'}
              label="Scheduled Posts"
              note="Next 7 days"
              tone="blue"
              href={`/dashboard/client/${clientId}/calendar`}
              loading={!portfolio.loaded}
            />
            <StatCard
              icon={Clock}
              value={pulse ? pulse.awaitingApproval : '—'}
              label="Awaiting Approval"
              note={pulse && pulse.awaitingApproval > 0 ? 'Posts in the next 7 days' : 'Nothing waiting'}
              tone="violet"
              href={`/dashboard/client/${clientId}/calendar`}
              loading={!portfolio.loaded}
            />
            <StatCard
              icon={MessagesSquare}
              value={unreadCount}
              label="Unread Activity"
              note={unreadCount > 0 ? 'In the Activity Hub below' : 'All caught up'}
              tone="emerald"
              href={`/dashboard/client/${clientId}/comments`}
            />
            <StatCard
              icon={Activity}
              value={pulse?.last30 && pulse.last30.posts ? `${pulse.last30.medianEngagementRate.toFixed(1)}%` : '—'}
              label="Engagement Rate"
              change={
                pulse?.engagementChange != null && Math.abs(pulse.engagementChange) >= 0.01
                  ? { value: `${Math.abs(Math.round(pulse.engagementChange * 100))}% vs last month`, up: pulse.engagementChange > 0 }
                  : null
              }
              note={pulse?.last30 ? `Median · ${pulse.last30.posts} posts in 30 days` : 'Last 30 days'}
              tone="blue"
              href={`/dashboard/client/${clientId}/analytics`}
              loading={!portfolio.loaded}
            />
          </div>
        </div>

        {/* Activity Hub & Month Calendar - Two Column Layout (40/60) */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
          {/* Client Activity Hub - Takes 40% */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-[22px] font-bold tracking-[-0.02em] text-gray-900">Client Activity Hub</h2>
              {unreadCount > 0 && (
                <div className="bg-red-500 text-white text-xs font-semibold rounded-full px-2.5 py-0.5 shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </div>
            
            {activityLoading ? (
              <Card className="rounded-3xl border-white/80 bg-white/90 shadow-card backdrop-blur-sm h-60 lg:h-[879px]">
                <CardContent className="p-4 md:p-6 h-full flex items-center justify-center">
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mr-3"></div>
                    <span className="text-gray-600">Loading activity...</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-3xl border-white/80 bg-white/90 shadow-card backdrop-blur-sm flex flex-col max-h-[70vh] lg:max-h-none lg:h-[879px]">
                <CardContent className="p-4 md:p-6 flex-1 flex flex-col min-h-0">
                  {/* Scrollable Content Container */}
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                    {/* Upcoming Posts Section */}
                    <div>
                      <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center">
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
                            <div key={activity.id} className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 hover:shadow-card transition-shadow">
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
                      <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center">
                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-full mr-3"></div>
                        Recent Activity
                      </h3>
                      <div className="space-y-3">
                        {activityLogs
                          .filter(activity => activity.type !== 'next_scheduled')
                          .slice(0, 10)
                          .map((activity) => (
                          <div key={activity.id} className="bg-white border border-gray-200/80 rounded-2xl p-4 hover:shadow-card transition-shadow">
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
            <h2 className="text-[22px] font-bold tracking-[-0.02em] text-gray-900 mb-4">Content Calendar</h2>
            <Card className="rounded-3xl border-white/80 bg-white/90 shadow-card backdrop-blur-sm">
              <CardContent className="p-4 md:p-6">
                {/* Post Status Grid - Single Row Layout */}
                <div className="mb-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(() => {
                      const approved = scheduledPosts.filter(p => p.approval_status === 'approved').length;
                      const rejected = scheduledPosts.filter(p => p.approval_status === 'rejected').length;
                      const needsAttention = scheduledPosts.filter(p => p.approval_status === 'needs_attention').length;
                      const pending = scheduledPosts.filter(p => p.approval_status === 'pending' || !p.approval_status).length;
                      
                      return (
                        <>
                          <div className="bg-emerald-50/70 rounded-2xl p-3 ring-1 ring-emerald-100 hover:shadow-card transition-all flex flex-col items-center justify-center text-center">
                            <div className="flex items-center mb-2">
                              <Check className="w-4 h-4 text-green-600 mr-1.5" />
                              <span className="text-xs font-semibold text-green-800">Approved</span>
                            </div>
                            <div className="text-2xl font-semibold text-green-900">{approved}</div>
                          </div>
                          <div className="bg-red-50/70 rounded-2xl p-3 ring-1 ring-red-100 hover:shadow-card transition-all flex flex-col items-center justify-center text-center">
                            <div className="flex items-center mb-2">
                              <X className="w-4 h-4 text-red-600 mr-1.5" />
                              <span className="text-xs font-semibold text-red-800">Rejected</span>
                            </div>
                            <div className="text-2xl font-semibold text-red-900">{rejected}</div>
                          </div>
                          <div className="bg-amber-50/70 rounded-2xl p-3 ring-1 ring-amber-100 hover:shadow-card transition-all flex flex-col items-center justify-center text-center">
                            <div className="flex items-center mb-2">
                              <AlertTriangle className="w-4 h-4 text-orange-600 mr-1.5" />
                              <span className="text-xs font-semibold text-orange-800">Needs Attention</span>
                            </div>
                            <div className="text-2xl font-semibold text-orange-900">{needsAttention}</div>
                          </div>
                          <div className="bg-gray-50 rounded-2xl p-3 ring-1 ring-gray-200/70 hover:shadow-card transition-all flex flex-col items-center justify-center text-center">
                            <div className="flex items-center mb-2">
                              <div className="w-4 h-4 bg-gray-400 rounded-full mr-1.5"></div>
                              <span className="text-xs font-semibold text-gray-800">Pending</span>
                            </div>
                            <div className="text-2xl font-semibold text-gray-700">{pending}</div>
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


        {/* Performance overview + Content Suite */}
        {(() => {
          const d = analytics?.dashboard
          const pct = (cur: number, prev: number | undefined | null) =>
            prev ? (cur - prev) / prev : null
          const eng = (t: { likes: number; comments: number; shares: number; saves: number }) => t.likes + t.comments + t.shares + t.saves
          const kpis = d
            ? [
                { label: 'Total Reach', change: pct(d.totals.reach, d.previousTotals?.reach) },
                { label: 'Engagement', change: pct(eng(d.totals), d.previousTotals ? eng(d.previousTotals) : null) },
                { label: 'Clicks', change: pct(d.totals.clicks, d.previousTotals?.clicks) },
              ]
            : []
          return (
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <SectionCard
                title="Performance Overview"
                action={<span className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700">Last 30 days</span>}
              >
                {analyticsLoading ? (
                  <div className="h-[220px] animate-pulse rounded-2xl bg-gray-50" />
                ) : !d ? (
                  <div className="rounded-2xl bg-gray-50/80 px-4 py-8 text-center text-[13px] text-gray-500">
                    {analytics?.message || 'Results appear here once your accounts are connected and posts are published.'}{' '}
                    <Link href={`/dashboard/client/${clientId}/connect-platforms`} className="font-medium text-blue-700 hover:underline">
                      Social Accounts
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-center">
                    <div>
                      <p className="mb-1 text-xs font-medium text-gray-500">Daily reach</p>
                      <MetricChart points={d.daily.map((p) => ({ date: p.date, value: p.reach }))} label="Reach" />
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-100">
                      {kpis.map((k) => (
                        <KpiColumn
                          key={k.label}
                          value={k.change === null || !Number.isFinite(k.change) ? '—' : `${k.change >= 0 ? '+' : '−'}${Math.abs(Math.round(k.change * 100))}%`}
                          label={k.label}
                          positive={k.change === null || !Number.isFinite(k.change) ? null : k.change >= 0}
                        />
                      ))}
                      <p className="col-span-3 mt-3 border-0 pl-0 text-[11px] text-gray-400">Compared with the previous 30 days.</p>
                    </div>
                  </div>
                )}
              </SectionCard>
              <ContentSuitePromo brands={client ? [{ id: clientId, name: client.name, logo_url: client.logo_url }] : []} />
            </div>
          )
        })()}

        {/* Unified Card - Social Media Platforms, Brand Information, and Delete Client */}
        {/* This card spans full width to match the combined Activity Hub + Calendar above */}
        <Card className="mt-8 shadow-md hover:shadow-lg transition-all" style={{ borderRadius: '16px' }}>
            <CardContent className="p-4 md:p-8 space-y-10">
              {/* Social Media Platforms Section */}
              <div id="social-media-platforms">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-800">Social Media Platforms</h3>
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
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
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

              {/* Brand Kit (Design Studio) */}
              <div className="border-t-2 pt-8">
                <BrandKitSection clientId={clientId} />
              </div>

              {/* Accounts to tag + hashtag sets (caption @/# autocomplete) */}
              <div className="border-t-2 pt-8">
                <CaptionLibrarySection clientId={clientId} />
              </div>

              {/* Delete Client Section */}
              <div className="border-t-2 pt-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-red-900">Delete Business Profile</h3>
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
  )
}
