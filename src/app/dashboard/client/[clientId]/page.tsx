'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'
import { Button } from 'components/ui/button'
import { Plus, Edit3, Calendar, FileText, ArrowRight, Trash2, Upload, X } from 'lucide-react'
import Link from 'next/link'
import BrandInformationPanel from 'components/BrandInformationPanel'
import { useAuth } from 'contexts/AuthContext'
import { Client, Project, DebugInfo, BrandDocument, WebsiteScrape, OAuthMessage } from 'types/api'
import { 
  FacebookIcon, 
  InstagramIcon, 
  TwitterIcon, 
  LinkedInIcon, 
  TikTokIcon, 
  YouTubeIcon, 
  ThreadsIcon 
} from 'components/social-icons'

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
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)
  const [showProjectSelection, setShowProjectSelection] = useState(false)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [debugLoading, setDebugLoading] = useState(false)
  const [projectsFailed, setProjectsFailed] = useState(false)
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
  
  // Refs to prevent duplicate requests
  const fetchAccountsRef = useRef(false)
  const fetchClientRef = useRef(false)
  const fetchProjectsRef = useRef(false)
  const fetchBrandDataRef = useRef(false)
  const oauthHandledRef = useRef<string | null>(null)

  interface ConnectedAccount {
    _id: string;
    platform: string;
    name: string;
    accountId?: string;
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
          // Wait a bit for the session to be available after OAuth callback
          setTimeout(() => {
            fetchClientRef.current = false;
            fetchClient();
          }, 1000);
          return;
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
        
      } catch (err) {
        console.error('❌ Error fetching client:', err)
        // Only set error if it's a critical error (404, not just network issues)
        if (err instanceof Error && err.message === 'Client not found') {
          setError(err.message)
        } else {
          // For other errors, retry after a short delay instead of showing error immediately
          console.log('🔄 Retrying client fetch in 2 seconds...')
          setTimeout(() => {
            if (!client) { // Only retry if we still don't have client data
              fetchClientRef.current = false
              fetchClient()
            }
          }, 2000)
        }
      } finally {
        setLoading(false)
        fetchClientRef.current = false
      }
    }

    fetchClient()
  }, [clientId, getAccessToken])

  // Fetch brand data separately to prevent infinite loops
  useEffect(() => {
    if (!clientId || fetchBrandDataRef.current) return
    
    async function fetchBrandData() {
      try {
        fetchBrandDataRef.current = true
        
        // Fetch brand documents
        const docsResponse = await fetch(`/api/clients/${clientId}/brand-documents`)
        if (docsResponse.ok) {
          const docsData = await docsResponse.json()
          setBrandDocuments(docsData.documents || [])
        }

        // Fetch website scrapes
        const scrapesResponse = await fetch(`/api/clients/${clientId}/scrape-website`)
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
  }, [clientId])

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
    
    try {
      fetchAccountsRef.current = true
      setFetchingAccounts(true)
      const response = await fetch(`/api/late/get-accounts/${clientId}`);
      if (!response.ok) {
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
      // Don't crash the dashboard if accounts can't be fetched
      setConnectedAccounts([]);
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
    
    try {
      fetchAccountsRef.current = true
      const response = await fetch(`/api/late/get-accounts/${clientId}`);
      if (!response.ok) {
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
      // Don't crash the dashboard if accounts can't be fetched
      setConnectedAccounts([]);
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
        message: 'Facebook account connected successfully!'
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
        message: `${connected.charAt(0).toUpperCase() + connected.slice(1)} account connected successfully!`
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

  // Handle platform connection
  const handlePlatformConnect = async (platform: string) => {
    try {
      setConnectingPlatform(platform)
      setError(null) // Clear any previous errors
      setOauthMessage(null) // Clear any previous OAuth messages
      
      console.log(`🔗 Connecting to ${platform} for client:`, clientId)
      
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

  // Fetch projects for the client
  useEffect(() => {
    if (!clientId || fetchProjectsRef.current) return
    
    async function fetchProjects() {
      try {
        fetchProjectsRef.current = true
        setProjectsLoading(true)
        console.log('🔄 Fetching projects for clientId:', clientId);
        
        const response = await fetch(`/api/projects?clientId=${clientId}`)
        console.log('📡 Projects API response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Projects API error response:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json()
        console.log('📄 Projects API response - success:', data.success, 'count:', data.projects?.length || 0);
        
        if (data.success) {
          setProjects(data.projects)
          console.log('✅ Projects fetched successfully - count:', data.projects.length)
        } else {
          console.error('❌ Projects API returned success: false:', data.error);
          throw new Error(data.error || 'Failed to fetch projects');
        }
      } catch (err) {
        console.error('❌ Error fetching projects:', err);
        // Don't crash the dashboard - just log the error and set projects to empty array
        console.log('⚠️ Projects unavailable, continuing with empty projects state');
        setProjects([]); // Set to empty array instead of crashing
        setProjectsFailed(true); // Mark that projects failed to load
        // Don't set the main error state - let the dashboard render without projects
      } finally {
        setProjectsLoading(false)
        fetchProjectsRef.current = false
      }
    }

    fetchProjects()
  }, [clientId])

  // Create new project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      setCreatingProject(true)
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          name: newProjectName.trim(),
          description: newProjectDescription.trim()
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.statusText}`)
      }
      
      const data = await response.json()
      if (data.success) {
        setProjects(prev => [data.project, ...prev])
        setNewProjectName("")
        setNewProjectDescription("")
        setShowNewProjectForm(false)
        console.log('✅ Project created successfully:', data.project)
      } else {
        throw new Error(data.error || 'Failed to create project')
      }
    } catch (err) {
      console.error('❌ Error creating project:', err)
      alert(`Failed to create project: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCreatingProject(false)
    }
  }



  // Debug database issues
  const handleDebugDatabase = async () => {
    try {
      setDebugLoading(true)
      console.log('🔍 Calling debug endpoint...');
      
      const response = await fetch('/api/projects/debug')
      const data = await response.json()
      
      console.log('📊 Debug endpoint response - success:', data.success);
      setDebugInfo(data)
      
      if (data.success) {
        console.log('✅ Debug info collected successfully');
      } else {
        console.error('❌ Debug endpoint failed:', data.error);
      }
    } catch (err) {
      console.error('❌ Error calling debug endpoint:', err);
      setDebugInfo({ 
        message: 'Debug endpoint error', 
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err) 
      });
    } finally {
      setDebugLoading(false)
    }
  }

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
      
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        
        const response = await fetch(`/api/clients/${clientId}/logo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading client dashboard...</p>
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
        {/* Header with Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {/* Quick Actions when Projects Failed */}
            {projectsFailed && (
              <div className="flex gap-3">
                <Button 
                  onClick={handleDebugDatabase}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3"
                >
                  🔍 Debug Database
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="px-6 py-3"
                >
                  🔄 Retry
                </Button>
              </div>
            )}
          </div>
          
          {/* Client Details Card and Create Content Button */}
          <div className="flex items-center gap-6">
          {/* Client Details Card */}
            <Card className="flex-1">
            <CardContent className="p-6">
              <div className="flex items-center space-x-6">
                {/* Logo Display/Upload Section */}
                <div className="relative">
                  <div className="w-20 h-20 bg-gray-100 border-2 border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {client?.logo_url ? (
                      <img 
                        src={client.logo_url} 
                        alt={`${client.name} logo`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-gray-600">
                        {client?.name ? client.name.charAt(0).toUpperCase() : 'C'}
                      </span>
                    )}
                  </div>
                  
                  {/* Logo Upload Button - Only show when editing */}
                  {isEditingLogo && (
                    <div className="absolute -bottom-1 -right-1">
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        <div className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-1.5 shadow-lg transition-colors">
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
                      className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-lg transition-colors disabled:opacity-50"
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
                      className="absolute -top-1 -left-1 bg-gray-600 hover:bg-gray-700 text-white rounded-full p-1 shadow-lg transition-colors"
                      title="Cancel editing"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h1 className="font-bold text-gray-700 mb-3 text-smooth" style={{ fontSize: '24px' }}>
                      {client?.name || 'Client Dashboard'}
                    </h1>
                    
                    {/* Edit Logo Button */}
                    {client?.logo_url && !isEditingLogo && (
                      <Button
                        onClick={() => setIsEditingLogo(true)}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-gray-600">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span>{website || 'No website set'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
            
            {/* Create Content Button */}
            <Button 
              onClick={() => window.location.href = `/dashboard/client/${clientId}/content-suite`}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white w-64 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center"
              style={{ height: '177px' }}
            >
              <Plus className="w-16 h-16 mb-4" />
              <span className="text-2xl font-bold">Create Content</span>
            </Button>
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

        {/* Projects Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-700 text-smooth">Projects</h2>
            <div className="flex gap-2">
              {!projectsFailed && (
                <Button 
                  onClick={() => setShowNewProjectForm(true)}
                  className="bg-gray-700 hover:bg-gray-800 text-white"
                  style={{ width: '255px' }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              )}
            </div>
          </div>

          {/* Projects Failed Message */}
          {projectsFailed && (
            <Card className="mb-6 border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="card-title-26 text-yellow-800">Projects Temporarily Unavailable</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-yellow-700">
                    Unable to load projects at this time. This might be due to:
                  </p>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    <li>Database connection issues</li>
                    <li>Projects table not yet created</li>
                    <li>Temporary service interruption</li>
                  </ul>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={handleDebugDatabase}
                      variant="outline"
                      size="sm"
                    >
                      🔍 Debug Database
                    </Button>
                    <Button 
                      onClick={() => window.location.reload()}
                      variant="outline"
                      size="sm"
                    >
                      🔄 Retry
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Debug Information */}
          {debugInfo && (
            <Card className="mb-6 border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="card-title-26 text-orange-800">Database Debug Information</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
                <div className="mt-3 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setDebugInfo(null)}
                  >
                    Close
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDebugDatabase}
                  >
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* New Project Form - Only show if projects haven't failed */}
          {!projectsFailed && showNewProjectForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="card-title-26">Create New Project</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter project name..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter project description..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCreateProject}
                    disabled={!newProjectName.trim() || creatingProject}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {creatingProject ? 'Creating...' : 'Create Project'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setShowNewProjectForm(false)
                      setNewProjectName("")
                      setNewProjectDescription("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Project Selection Modal - Only show if projects haven't failed */}
          {!projectsFailed && showProjectSelection && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="card-title-26">Choose Project for Content Creation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Select which project you&apos;d like to create content for:
                  </p>
                  
                  <div className="grid gap-3">
                    {projects.map((project) => (
                      <div 
                        key={project.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setShowProjectSelection(false)
                        }}
                      >
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-700">{project.name}</h4>
                          {project.description && (
                            <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Created {new Date(project.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowProjectSelection(false)
                          setShowNewProjectForm(true)
                        }}
                        className="flex-1"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Project
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setShowProjectSelection(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Projects List - Only show if projects haven't failed */}
          {!projectsFailed && (
            <>
              {projectsLoading ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-900 border-t-transparent mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading projects...</p>
                </div>
              ) : projects.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <Card key={project.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="card-title-26">{project.name}</CardTitle>
                        {project.description && (
                          <p className="text-sm text-gray-600">{project.description}</p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-4 h-4 mr-2" />
                          Created {new Date(project.created_at).toLocaleDateString()}
                        </div>
                        
                        <div className="flex gap-2">
                          <Link 
                            href={`/dashboard/client/${clientId}/planner?projectId=${project.id}`}
                            className="flex-1"
                          >
                            <Button 
                              variant="outline" 
                              className="w-full"
                            >
                              <Calendar className="w-4 h-4 mr-2" />
                              Planner
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-4 text-2xl font-bold text-gray-700">No projects yet</h3>
                  <p className="mt-2 text-gray-600 mb-4">Get started by creating your first project to organize your content strategy.</p>
                  <div className="flex gap-3 justify-center">
                    <Button 
                      onClick={() => window.location.href = `/dashboard/client/${clientId}/content-suite`}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Go to Content Suite
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <Button 
                      onClick={() => setShowNewProjectForm(true)}
                      variant="outline"
                      className="px-6 py-3"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Project First
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Unified Card - Everything Below Projects */}
        <div className="mt-8">
          <Card>
            <CardContent className="p-6 space-y-8">
              {/* Social Media Platforms Section */}
              <div>
                <h3 className="text-2xl font-bold text-gray-700 mb-4 text-smooth">Social Media Platforms</h3>
                
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
                    className={`flex flex-col items-center space-y-2 p-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isPlatformConnected('facebook')
                        ? 'border-2 border-gray-700'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'facebook' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <FacebookIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {connectingPlatform === 'facebook' ? 'Connecting...' : 'Facebook'}
                    </span>
                  </button>

                  {/* Instagram */}
                  <button
                    onClick={() => handlePlatformConnect('instagram')}
                    disabled={connectingPlatform === 'instagram'}
                    className={`flex flex-col items-center space-y-2 p-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isPlatformConnected('instagram')
                        ? 'border-2 border-gray-700'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'instagram' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <InstagramIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {connectingPlatform === 'instagram' ? 'Connecting...' : 'Instagram'}
                    </span>
                  </button>

                  {/* Twitter */}
                  <button
                    onClick={() => handlePlatformConnect('twitter')}
                    disabled={connectingPlatform === 'twitter'}
                    className={`flex flex-col items-center space-y-2 p-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isPlatformConnected('twitter')
                        ? 'border-2 border-gray-700'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'twitter' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <TwitterIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {connectingPlatform === 'twitter' ? 'Connecting...' : 'Twitter'}
                    </span>
                  </button>

                  {/* LinkedIn */}
                  <button
                    onClick={() => handlePlatformConnect('linkedin')}
                    disabled={connectingPlatform === 'linkedin'}
                    className={`flex flex-col items-center space-y-2 p-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isPlatformConnected('linkedin')
                        ? 'border-2 border-gray-700'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'linkedin' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <LinkedInIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {connectingPlatform === 'linkedin' ? 'Connecting...' : 'LinkedIn'}
                    </span>
                  </button>

                  {/* TikTok */}
                  <button
                    onClick={() => handlePlatformConnect('tiktok')}
                    disabled={connectingPlatform === 'tiktok'}
                    className={`flex flex-col items-center space-y-2 p-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isPlatformConnected('tiktok')
                        ? 'border-2 border-gray-700'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                      {connectingPlatform === 'tiktok' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <TikTokIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {connectingPlatform === 'tiktok' ? 'Connecting...' : 'TikTok'}
                    </span>
                  </button>

                  {/* YouTube */}
                  <button
                    onClick={() => handlePlatformConnect('youtube')}
                    disabled={connectingPlatform === 'youtube'}
                    className={`flex flex-col items-center space-y-2 p-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isPlatformConnected('youtube')
                        ? 'border-2 border-gray-700'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'youtube' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <YouTubeIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {connectingPlatform === 'youtube' ? 'Connecting...' : 'YouTube'}
                    </span>
                  </button>

                  {/* Threads */}
                  <button
                    onClick={() => handlePlatformConnect('threads')}
                    disabled={connectingPlatform === 'threads'}
                    className={`flex flex-col items-center space-y-2 p-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isPlatformConnected('threads')
                        ? 'border-2 border-gray-700'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'threads' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <ThreadsIcon className="text-white" size={20} />
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {connectingPlatform === 'threads' ? 'Connecting...' : 'Threads'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Brand Information Section */}
              <div className="border-t pt-6">
                <BrandInformationPanel 
                  clientId={clientId} 
                  client={client} 
                  onUpdate={(updatedClient) => setClient(updatedClient)}
                  brandDocuments={brandDocuments}
                  websiteScrapes={websiteScrapes}
                />
              </div>

              {/* Delete Client Section */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-red-900">Delete Client</h3>
                    <p className="text-sm text-red-700 mt-1">
                      Permanently delete this client and all associated data. This action cannot be undone.
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
                        Delete Client
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
