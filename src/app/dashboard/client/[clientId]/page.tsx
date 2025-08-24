'use client'

import { use, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'
import { Button } from 'components/ui/button'
import { Plus, Edit3, Calendar, FileText, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
}

export default function ClientDashboard({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [website, setWebsite] = useState("")
  const [about, setAbout] = useState("")
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)
  const [showProjectSelection, setShowProjectSelection] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [debugLoading, setDebugLoading] = useState(false)
  const [projectsFailed, setProjectsFailed] = useState(false)

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
      } else if (connected) {
        // Handle the new 'connected' parameter for all platforms
        const platformName = connected.charAt(0).toUpperCase() + connected.slice(1);
        setOauthMessage({
          type: 'success',
          message: `${platformName} connected successfully${username ? ` (${username})` : ''}!`
        });
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

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
        setWebsite(data.client.website || "")
        setAbout(data.client.description || "")
        
      } catch (err) {
        console.error('❌ Error fetching client:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch client data')
      } finally {
        setLoading(false)
      }
    }

    if (clientId) {
      fetchClient()
    }
  }, [clientId])

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
        console.log('📄 Projects API response data:', data);
        
        if (data.success) {
          setProjects(data.projects)
          console.log('✅ Projects fetched successfully:', data.projects)
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

  // Navigate to Content Suite
  const navigateToContentSuite = (projectId: string) => {
    window.location.href = `/dashboard/client/${clientId}/project/${projectId}/content-suite`
  }

  // Debug database issues
  const handleDebugDatabase = async () => {
    try {
      setDebugLoading(true)
      console.log('🔍 Calling debug endpoint...');
      
      const response = await fetch('/api/projects/debug')
      const data = await response.json()
      
      console.log('📊 Debug endpoint response:', data);
      setDebugInfo(data)
      
      if (data.success) {
        console.log('✅ Debug info collected successfully');
      } else {
        console.error('❌ Debug endpoint failed:', data.error);
      }
    } catch (err) {
      console.error('❌ Error calling debug endpoint:', err);
      setDebugInfo({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setDebugLoading(false)
    }
  }

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
      console.log(`✅ ${platform} connection URL generated:`, data.connectUrl)
      
      // Redirect to the connect URL from our API (which calls LATE API)
      window.location.assign(data.connectUrl)
      
    } catch (err) {
      console.error(`❌ Error connecting to ${platform}:`, err)
      setError(err instanceof Error ? err.message : `Failed to connect to ${platform}`)
    } finally {
      setConnectingPlatform(null)
    }
  }

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
        {/* Header with Client Info and Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {client?.name || 'Client Dashboard'}
              </h1>
              {client?.description && (
                <p className="text-gray-600 mt-2">{client.description}</p>
              )}
            </div>
            
            {/* Quick Actions */}
            {!projectsFailed && projects.length > 0 && (
              <div className="flex gap-3">
                {projects.length === 1 ? (
                  <Button 
                    onClick={() => navigateToContentSuite(projects[0].id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Create Content
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setShowProjectSelection(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Create Content
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                )}
              </div>
            )}
            
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
          
          {/* Client Details Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-6">
                <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-600">
                    {client?.name ? client.name.charAt(0).toUpperCase() : 'C'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-4 text-gray-600 mb-2">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span>{website || 'No website set'}</span>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                      {client?.industry || 'Technology'}
                    </span>
                    <span className="text-sm">
                      Founded: {client?.founded_date || 'Not specified'}
                    </span>
                  </div>
                  <p className="text-gray-600 text-lg">
                    {about || 'No company description available. Add a description to provide more context about your business.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          
          {/* Social Media Platforms Bar */}
          <div className="col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                  <button 
                    onClick={() => setOauthMessage(null)}
                    className={`text-xs hover:opacity-70 ${
                      oauthMessage.type === 'success' ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            
            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="text-red-500 text-xs mt-2 hover:text-red-700"
                >
                  Dismiss
                </button>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <button 
                onClick={() => handlePlatformConnect('facebook')}
                disabled={connectingPlatform === 'facebook'}
                className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  {connectingPlatform === 'facebook' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <span className="text-white text-xs font-bold">f</span>
                  )}
                </div>
                <span className="text-xs text-gray-600">
                  {connectingPlatform === 'facebook' ? 'Connecting...' : 'Facebook'}
                </span>
              </button>
              
              <button 
                onClick={() => handlePlatformConnect('instagram')}
                disabled={connectingPlatform === 'instagram'}
                className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  {connectingPlatform === 'instagram' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <span className="text-white text-xs font-bold">IG</span>
                  )}
                </div>
                <span className="text-xs text-gray-600">
                  {connectingPlatform === 'instagram' ? 'Connecting...' : 'Instagram'}
                </span>
              </button>
              
              <button 
                onClick={() => handlePlatformConnect('twitter')}
                disabled={connectingPlatform === 'twitter'}
                className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                  {connectingPlatform === 'twitter' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <span className="text-white text-xs font-bold">X</span>
                  )}
                </div>
                <span className="text-xs text-gray-600">
                  {connectingPlatform === 'twitter' ? 'Connecting...' : 'X'}
                </span>
              </button>
              
              <button 
                onClick={() => handlePlatformConnect('linkedin')}
                disabled={connectingPlatform === 'linkedin'}
                className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
                  {connectingPlatform === 'linkedin' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <span className="text-white text-xs font-bold">in</span>
                  )}
                </div>
                <span className="text-xs text-gray-600">
                  {connectingPlatform === 'linkedin' ? 'Connecting...' : 'LinkedIn'}
                </span>
              </button>
              
              <button 
                onClick={() => handlePlatformConnect('tiktok')}
                disabled={connectingPlatform === 'tiktok'}
                className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                  {connectingPlatform === 'tiktok' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <span className="text-white text-xs font-bold">TT</span>
                  )}
                </div>
                <span className="text-xs text-gray-600">
                  {connectingPlatform === 'tiktok' ? 'Connecting...' : 'TikTok'}
                </span>
              </button>
              
              <button 
                onClick={() => handlePlatformConnect('youtube')}
                disabled={connectingPlatform === 'youtube'}
                className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                  {connectingPlatform === 'youtube' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <span className="text-white text-xs font-bold">YT</span>
                  )}
                </div>
                <span className="text-xs text-gray-600">
                  {connectingPlatform === 'youtube' ? 'Connecting...' : 'YouTube'}
                </span>
              </button>
              
              <button 
                onClick={() => handlePlatformConnect('threads')}
                disabled={connectingPlatform === 'threads'}
                className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                  {connectingPlatform === 'threads' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <span className="text-white text-xs font-bold">T</span>
                  )}
                </div>
                <span className="text-xs text-gray-600">
                  {connectingPlatform === 'threads' ? 'Connecting...' : 'Threads'}
                </span>
              </button>
            </div>
          </div>

          {/* Left Column: Website & Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Website & Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website URL
                </label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Company Information
                </label>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter company description..."
                />
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  Save Changes
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Tone of Voice Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Tone of Voice Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="mt-4">
                  <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Choose Files
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  Upload brand guidelines, tone of voice documents, or style guides
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
            <div className="flex gap-2">
              <Button 
                onClick={handleDebugDatabase}
                disabled={debugLoading}
                variant="outline"
                className="text-sm"
              >
                {debugLoading ? '🔍 Debugging...' : '🔍 Debug DB'}
              </Button>
              {!projectsFailed && (
                <Button 
                  onClick={() => setShowNewProjectForm(true)}
                  className="bg-black hover:bg-gray-800 text-white"
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
                    Select which project you'd like to create content for:
                  </p>
                  
                  <div className="grid gap-3">
                    {projects.map((project) => (
                      <div 
                        key={project.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                        onClick={() => {
                          navigateToContentSuite(project.id)
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
                          <Button 
                            onClick={() => navigateToContentSuite(project.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Content Suite
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                        
                        <div className="flex gap-2">
                          <Link 
                            href={`/dashboard/client/${clientId}/project/${project.id}/scheduler`}
                            className="flex-1"
                          >
                            <Button 
                              variant="outline" 
                              className="w-full"
                            >
                              <Calendar className="w-4 h-4 mr-2" />
                              Scheduler
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm">
                            <Edit3 className="w-4 h-4" />
                          </Button>
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
                  <Button 
                    onClick={() => setShowNewProjectForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Project
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}