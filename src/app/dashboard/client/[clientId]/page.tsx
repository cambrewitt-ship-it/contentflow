'use client'

import { use, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'

export default function ClientDashboard({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [website, setWebsite] = useState("")
  const [about, setAbout] = useState("")
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Check for OAuth callback messages in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthSuccess = urlParams.get('oauth_success');
      const oauthError = urlParams.get('oauth_error');
      const errorDescription = urlParams.get('error_description');
      const username = urlParams.get('username');
      
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
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-600">
                {client.name ? client.name.charAt(0).toUpperCase() : 'C'}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{client.name || 'Client Name'}</h1>
              <div className="flex items-center space-x-4 text-gray-600">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span>{website || 'No website set'}</span>
                </div>
                <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                  {client.industry || 'Technology'}
                </span>
                <span className="text-sm">
                  Founded: {client.founded_date || 'Not specified'}
                </span>
              </div>
            </div>
          </div>
          <p className="text-gray-600 mt-4 text-lg">
            {about || 'No company description available. Add a description to provide more context about your business.'}
          </p>
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
            <button className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors">
              New Project
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No projects yet</h3>
            <p className="mt-2 text-gray-600">Get started by creating your first project to organize your content strategy.</p>
          </div>
        </div>
      </div>
    </div>
  )
}