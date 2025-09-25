'use client'

import { useContentStore, ContentIdea } from 'lib/contentStore'
import { Button } from 'components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'
import { Lightbulb, RefreshCw, Calendar, Eye, Clock, AlertCircle, RotateCcw } from 'lucide-react'
import { useState } from 'react'

// TypeScript types for API responses
interface ContentIdeasResponse {
  success: boolean
  ideas: ContentIdea[]
  error?: string
}

interface ContentIdeasError {
  error: string
  status?: number
}

export function ContentIdeasColumn() {
  const { clientId, contentIdeas, setContentIdeas } = useContentStore()
  const [generatingIdeas, setGeneratingIdeas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasGeneratedIdeas, setHasGeneratedIdeas] = useState(false)

  const handleGenerateIdeas = async () => {
    if (!clientId) {
      setError('Client ID not found. Please refresh the page and try again.')
      return
    }

    console.log('Starting content ideas generation...')
    console.log('Client ID:', clientId)

    setGeneratingIdeas(true)
    setError(null)
    
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate_content_ideas',
          clientId: clientId,
        }),
      })

      if (!response.ok) {
        const errorData: ContentIdeasError = await response.json().catch(() => ({ error: 'Network error' }))
        throw new Error(errorData.error || `Server error (${response.status})`)
      }

      const data: ContentIdeasResponse = await response.json()
      
      if (data.success && data.ideas && Array.isArray(data.ideas)) {
        if (data.ideas.length === 0) {
          setError('No content ideas were generated. Please try again.')
          return
        }
        
        setContentIdeas(data.ideas)
        setHasGeneratedIdeas(true)
        console.log('Content ideas generated successfully:', data.ideas)
      } else {
        throw new Error(data.error || 'Invalid response format from server')
      }
    } catch (error) {
      console.error('Failed to generate content ideas:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setError(`Failed to generate content ideas: ${errorMessage}`)
    } finally {
      setGeneratingIdeas(false)
    }
  }

  const handleRefreshIdeas = () => {
    setError(null)
    handleGenerateIdeas()
  }

  // Skeleton loading component
  const SkeletonCard = () => (
    <div className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-blue-50 animate-pulse">
      <div className="space-y-3">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
          </div>
        </div>
        <div className="space-y-3 ml-11">
          <div className="flex items-start space-x-2">
            <div className="flex-shrink-0 w-5 h-5 bg-purple-200 rounded mt-0.5"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded w-1/4 mb-1"></div>
              <div className="h-4 bg-gray-300 rounded w-full"></div>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <div className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded mt-0.5"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded w-1/4 mb-1"></div>
              <div className="h-4 bg-gray-300 rounded w-full"></div>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <div className="flex-shrink-0 w-5 h-5 bg-green-200 rounded mt-0.5"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded w-1/4 mb-1"></div>
              <div className="h-4 bg-gray-300 rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Content Ideas Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="card-title-26">Content Ideas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">Error</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                    <Button
                      onClick={handleRefreshIdeas}
                      variant="outline"
                      size="sm"
                      className="mt-3 border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Action Area */}
            {!hasGeneratedIdeas && !generatingIdeas && !error && (
              <div className="text-center py-4">
                <div className="text-gray-400 mb-3">
                  <Lightbulb className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-600 mb-4">
                  Get AI-powered content ideas based on upcoming New Zealand holidays and your brand context
                </p>
                <Button
                  onClick={handleGenerateIdeas}
                  disabled={generatingIdeas}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  💡 Get Fresh Ideas
                </Button>
              </div>
            )}

            {/* Loading State */}
            {generatingIdeas && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="text-purple-500 mb-3">
                    <RefreshCw className="w-12 h-12 mx-auto animate-spin" />
                  </div>
                  <p className="text-gray-600 mb-2">Generating content ideas...</p>
                  <p className="text-sm text-gray-500">
                    Analyzing your brand context and upcoming holidays
                  </p>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Content Ideas */}
      {contentIdeas.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="card-title-26">
                  Generated Ideas ({contentIdeas.length})
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  AI-generated content ideas tailored to your brand and upcoming holidays
                </p>
              </div>
              <Button
                onClick={handleRefreshIdeas}
                disabled={generatingIdeas}
                variant="outline"
                size="sm"
                className="text-purple-600 border-purple-300 hover:bg-purple-50"
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${generatingIdeas ? 'animate-spin' : ''}`} />
                {generatingIdeas ? 'Generating...' : 'Refresh'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contentIdeas.map((idea, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 transition-all hover:border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50"
                >
                  <div className="space-y-3">
                    {/* Idea Title */}
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 font-semibold text-sm">
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                          {idea.idea}
                        </h3>
                      </div>
                    </div>

                    {/* Idea Details */}
                    <div className="space-y-3 ml-11">
                      {/* Angle */}
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 text-purple-500 mt-0.5">
                          <Lightbulb className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Marketing Angle</p>
                          <p className="text-sm text-gray-600">{idea.angle}</p>
                        </div>
                      </div>

                      {/* Visual Suggestion */}
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 text-blue-500 mt-0.5">
                          <Eye className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Visual Suggestion</p>
                          <p className="text-sm text-gray-600">{idea.visualSuggestion}</p>
                        </div>
                      </div>

                      {/* Post Example */}
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 text-green-500 mt-0.5">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Post Example</p>
                          <p className="text-sm text-gray-600">{idea.timing}</p>
                        </div>
                      </div>

                      {/* Holiday Connection */}
                      {idea.holidayConnection && (
                        <div className="flex items-start space-x-2">
                          <div className="flex-shrink-0 w-5 h-5 text-orange-500 mt-0.5">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Holiday Connection</p>
                            <p className="text-sm text-gray-600">{idea.holidayConnection}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State - Show when no ideas generated yet and not in error state */}
      {contentIdeas.length === 0 && !generatingIdeas && !error && hasGeneratedIdeas && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <div className="text-gray-400 mb-3">
                <Calendar className="w-12 h-12 mx-auto" />
              </div>
              <p className="text-gray-600 mb-2">No content ideas generated</p>
              <p className="text-sm text-gray-500 mb-4">
                The AI couldn't generate ideas this time. This might be due to missing brand information or network issues.
              </p>
              <Button
                onClick={handleRefreshIdeas}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
