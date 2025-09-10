'use client'

import { use, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'
import { Button } from 'components/ui/button'
import { Plus, Edit3, Calendar, FileText, ArrowRight, Trash2 } from 'lucide-react'
import Link from 'next/link'
import BrandInformationPanel from 'components/BrandInformationPanel'
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

  interface ConnectedAccount {
    _id: string;
    platform: string;
    name: string;
    accountId?: string;
  }


  // Fetch client data via API
  useEffect(() => {
    async function fetchClient() {
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔍 Fetching client data for ID:', clientId)
        
        const response = await fetch(`/api/clients/${clientId}`)
        
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
        setError(err instanceof Error ? err.message : 'Failed to fetch client data')
      } finally {
        setLoading(false)
      }
    }

    if (clientId) {
      fetchClient()
      
      // Fetch brand documents and website scrapes
      const fetchBrandData = async () => {
        try {
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
        }
      }
      
      fetchBrandData()
    }
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

  // Fetch connected accounts
  useEffect(() => {
    if (clientId) {
      fetchConnectedAccounts()
    }
  }, [clientId])

  const fetchConnectedAccounts = async () => {
    try {
      const response = await fetch(`/api/late/get-accounts/${clientId}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Client not found or no LATE profile setup - skipping connected accounts');
          setConnectedAccounts([]);
          return;
        }
        throw new Error(`Failed to fetch accounts: ${response.status}`);
      }
      const data = await response.json();
      setConnectedAccounts(data.accounts || []);
      console.log('Connected accounts count:', data.accounts?.length || 0);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      // Don't crash the dashboard if accounts can't be fetched
      setConnectedAccounts([]);
    }
  };

  // Check if a platform is connected
  const isPlatformConnected = (platform: string) => {
    return connectedAccounts.some(account => account.platform === platform);
  };

  // Handle platform connection
  const handlePlatformConnect = async (platform: string) => {
    try {
      setConnectingPlatform(platform)
      setError(null)
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
      
      // Redirect to OAuth URL
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        throw new Error('No authentication URL received')
      }
      
    } catch (err) {
      console.error(`❌ Error connecting to ${platform}:`, err)
      setError(err instanceof Error ? err.message : `Failed to connect to ${platform}`)
      setOauthMessage({
        type: 'error',
        message: `Failed to connect to ${platform}: ${err instanceof Error ? err.message : 'Unknown error'}`
      })
    } finally {
      setConnectingPlatform(null)
    }
  };

  // Fetch projects for the client
  useEffect(() => {
    async function fetchProjects() {
      if (!clientId) return;
      
      try {
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
      
      const response = await fetch(`/api/clients?clientId=${clientId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete client: ${response.statusText}`);
      }
      
      console.log('✅ Client deleted successfully');
      
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading client dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
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
      <div className="min-h-screen bg-gray-50 p-8">
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
    <div className="min-h-screen bg-gray-50 p-8">
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
                <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-600">
                    {client?.name ? client.name.charAt(0).toUpperCase() : 'C'}
                  </span>
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    {client?.name || 'Client Dashboard'}
                  </h1>
                  <div className="flex items-center space-x-4 text-gray-600">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span>{website || 'No website set'}</span>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                      {client?.industry || 'Technology'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
            
            {/* Create Content Button */}
            <Button 
              onClick={() => window.location.href = `/dashboard/client/${clientId}/content-suite`}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white w-64 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center"
              style={{ height: '190px' }}
            >
              <Plus className="w-16 h-16 mb-4" />
              <span className="text-2xl font-bold">Create Content</span>
            </Button>
          </div>
        </div>

        {/* Projects Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
            <div className="flex gap-2">
              {!projectsFailed && (
                <Button 
                  onClick={() => setShowNewProjectForm(true)}
                  className="bg-black hover:bg-gray-800 text-white"
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
                <CardTitle className="text-lg text-yellow-800">Projects Temporarily Unavailable</CardTitle>
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
                <CardTitle className="text-lg text-orange-800">Database Debug Information</CardTitle>
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
                <CardTitle className="text-lg">Create New Project</CardTitle>
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
                <CardTitle className="text-lg">Choose Project for Content Creation</CardTitle>
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
                          <h4 className="font-medium text-gray-900">{project.name}</h4>
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading projects...</p>
                </div>
              ) : projects.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <Card key={project.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
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
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No projects yet</h3>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Media Platforms</h3>
                
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
                        ? 'border-2 border-black'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'facebook' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
                        ? 'border-2 border-black'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'instagram' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
                        ? 'border-2 border-black'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'twitter' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
                        ? 'border-2 border-black'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'linkedin' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
                        ? 'border-2 border-black'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                      {connectingPlatform === 'tiktok' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
                        ? 'border-2 border-black'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'youtube' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
                        ? 'border-2 border-black'
                        : 'border-2 border-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                      {connectingPlatform === 'threads' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
                    <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
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
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
