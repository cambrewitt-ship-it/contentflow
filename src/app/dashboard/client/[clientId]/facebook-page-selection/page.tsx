'use client'

import { use, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'

interface FacebookPage {
  id: string
  name: string
  category?: string
  access_token?: string
  picture?: {
    data?: {
      url?: string
    }
  }
}

interface PageSelectionProps {
  params: Promise<{ clientId: string }>
}

export default function FacebookPageSelection({ params }: PageSelectionProps) {
  const { clientId } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState<string>('')
  
  // Page selection data from URL parameters
  const [sessionData, setSessionData] = useState<{
    sessionId: string
    profileId: string
    clientName: string
    pages: FacebookPage[]
    code: string
    state: string
  } | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      
      const sessionId = urlParams.get('sessionId')
      const profileId = urlParams.get('profileId')
      const clientName = urlParams.get('clientName')
      const pagesParam = urlParams.get('pages')
      const code = urlParams.get('code')
      const state = urlParams.get('state')
      
      if (!sessionId || !profileId || !clientName || !pagesParam || !code) {
        setError('Missing required page selection parameters')
        setLoading(false)
        return
      }
      
      try {
        const pages = JSON.parse(decodeURIComponent(pagesParam))
        setSessionData({
          sessionId,
          profileId,
          clientName: decodeURIComponent(clientName),
          pages,
          code,
          state: state || ''
        })
        setLoading(false)
      } catch (err) {
        console.error('Error parsing pages data:', err)
        setError('Invalid page data received')
        setLoading(false)
      }
    }
  }, [])

  const handlePageSelection = async () => {
    if (!selectedPageId || !sessionData) {
      setError('Please select a Facebook page')
      return
    }

    try {
      setConnecting(true)
      setError(null)
      
      const selectedPage = sessionData.pages.find(page => page.id === selectedPageId)
      if (!selectedPage) {
        throw new Error('Selected page not found')
      }
      
      console.log('🔗 Connecting Facebook page:', selectedPage)
      
      // Call the page connection API
      const response = await fetch('/api/late/connect-facebook-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          profileId: sessionData.profileId,
          pageId: selectedPageId,
          pageName: selectedPage.name,
          code: sessionData.code,
          state: sessionData.state
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to connect Facebook page')
      }
      
      const data = await response.json()
      console.log('✅ Facebook page connected successfully:', data)
      
      // Redirect to client dashboard with success message
      const successUrl = `/dashboard/client/${clientId}?connected=facebook&username=${encodeURIComponent(selectedPage.name)}`
      window.location.href = successUrl
      
    } catch (err) {
      console.error('❌ Error connecting Facebook page:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect Facebook page')
    } finally {
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Facebook pages...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Error Loading Pages</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.href = `/dashboard/client/${clientId}`}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Return to Dashboard
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Session Data Missing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">Unable to load page selection data. Please try connecting to Facebook again.</p>
              <button
                onClick={() => window.location.href = `/dashboard/client/${clientId}`}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Return to Dashboard
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Facebook Page</h1>
          <p className="text-gray-600">
            Choose which Facebook page to connect to <strong>{sessionData.clientName}</strong>
          </p>
        </div>

        {/* Page Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">f</span>
              </div>
              <span>Available Facebook Pages</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sessionData.pages.map((page) => (
                <div
                  key={page.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPageId === page.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedPageId(page.id)}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="pageSelection"
                      value={page.id}
                      checked={selectedPageId === page.id}
                      onChange={() => setSelectedPageId(page.id)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        {page.picture?.data?.url ? (
                          <img
                            src={page.picture.data.url}
                            alt={page.name}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 text-sm font-bold">
                              {page.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900">{page.name}</h3>
                          {page.category && (
                            <p className="text-sm text-gray-500">{page.category}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => window.location.href = `/dashboard/client/${clientId}`}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                disabled={connecting}
              >
                Cancel
              </button>
              <button
                onClick={handlePageSelection}
                disabled={!selectedPageId || connecting}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {connecting ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Connecting...</span>
                  </div>
                ) : (
                  'Connect Selected Page'
                )}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            This page will be connected to your client profile and can be used for content publishing.
          </p>
        </div>
      </div>
    </div>
  )
}
