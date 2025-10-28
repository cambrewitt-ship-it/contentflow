'use client'

import { useContentStore } from '@/lib/contentStore'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Brain, RefreshCw, Check, Video, AlertCircle } from 'lucide-react'
import { useState } from 'react'

export function CaptionGenerationColumn() {
  const {
    uploadedImages,
    captions,
    selectedCaptions,
    activeImageId,
    setCaptions,
    selectCaption,
    updateCaption,
    generateAICaptions,
    remixCaption,
    postNotes,
    setPostNotes,
    copyType,
    setCopyType,
  } = useContentStore()

  const { getAccessToken } = useAuth()
  const [generatingCaptions, setGeneratingCaptions] = useState(false)
  const [remixingCaption, setRemixingCaption] = useState<string | null>(null)

  const activeImage = uploadedImages.find((img) => img.id === activeImageId)
  const isVideoSelected = activeImage?.mediaType === 'video'

  const handleGenerateCaptions = async () => {
    if (!activeImage) {
      alert('Please select media first')
      return
    }

    // For videos, require post notes since we can't analyze video content
    if (isVideoSelected && !postNotes.trim()) {
      alert('Post Notes are required when generating captions for videos. Please add notes describing your video content.')
      return
    }

    console.log('Starting caption generation...')
    console.log('Copy type:', copyType)
    console.log('Post notes:', postNotes)
    console.log('Active media:', activeImage.id)
    console.log('Media type:', activeImage.mediaType)
    console.log('Is video:', isVideoSelected)

    setGeneratingCaptions(true)
    try {
      // Get access token from auth context
      const accessToken = getAccessToken()
      if (!accessToken) {
        throw new Error('Authentication required. Please log in again.')
      }

      // For videos: Generate captions based only on post notes (no visual analysis)
      // For images: Generate captions with AI vision analysis + post notes
      if (isVideoSelected) {
        console.log('🎥 Generating captions for video - using Post Notes only (no visual analysis)')
        // Pass the media ID but the backend will skip image analysis for videos
        await generateAICaptions(activeImage.id, postNotes.trim(), copyType, accessToken)
      } else {
        console.log('🖼️ Generating captions for image - using AI vision + Post Notes')
        // Ensure aiContext is never empty - provide default value for API validation
        const aiContext = postNotes?.trim() || 'Generate engaging social media captions for this content.'
        await generateAICaptions(activeImage.id, aiContext, copyType, accessToken)
      }
      
      console.log('Caption generation completed')
      // Success - captions will be added automatically
    } catch (error) {
      console.error('Failed to generate captions:', error)
      alert(`Failed to generate captions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGeneratingCaptions(false)
    }
  }

  const handleRemixCaption = async (captionId: string) => {
    if (!activeImage) {
      alert('Please select an image first')
      return
    }

    if (!postNotes.trim()) {
      alert('Please add some Post Notes to guide the caption remix')
      return
    }

    console.log('🔄 Starting remix for caption:', captionId)
    console.log('📝 Post notes being used:', postNotes)
    console.log('🖼️ Active image:', activeImage.id)

    setRemixingCaption(captionId)
    try {
      // Get access token from auth context
      const accessToken = getAccessToken()
      if (!accessToken) {
        throw new Error('Authentication required. Please log in again.')
      }

      await remixCaption(captionId, accessToken)
      console.log('✅ Remix completed successfully')
      // Success - caption will be updated automatically
    } catch (error) {
      console.error('❌ Failed to remix caption:', error)
      alert(`Failed to remix caption: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setRemixingCaption(null)
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Copy Type Selection & AI Caption Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="card-title-26">Copy Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <select 
                value={copyType} 
                onChange={(e) => setCopyType(e.target.value as 'social-media' | 'email-marketing')}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="social-media">Social Media Copy</option>
                <option value="email-marketing">Email Marketing Copy</option>
              </select>
            </div>

            {/* AI Caption Generation */}
            <div>
              <div className="border-t pt-4">
                <h3 className="text-22px mb-3">AI Caption Generation</h3>
                
                {/* Video Notice */}
                {isVideoSelected && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Video className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-800">
                        <p className="font-medium mb-1">Video Selected</p>
                        <p>AI will generate captions based on your <strong>Post Notes only</strong>. Video visual analysis is not available. Please ensure your Post Notes describe the video content.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Warning if video but no notes */}
                {isVideoSelected && !postNotes.trim() && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-amber-800">
                        <p className="font-medium">Post Notes Required</p>
                        <p>Add Post Notes in the upload section to describe your video before generating captions.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handleGenerateCaptions}
                  disabled={generatingCaptions || !activeImage || (isVideoSelected && !postNotes.trim())}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {generatingCaptions ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Generate {copyType === 'social-media' ? 'Social Media' : 'Email Marketing'} Copy
                      {isVideoSelected && ' (From Notes)'}
                    </>
                  )}
                </Button>
                {!activeImage && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Upload media to enable caption generation
                  </p>
                )}
                {activeImage && !isVideoSelected && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    AI will analyze your image and Post Notes to generate captions
                  </p>
                )}
                {isVideoSelected && postNotes.trim() && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Captions will be generated from your Post Notes
                  </p>
                )}
                
                {/* Light grey brain icon - always positioned at 105px */}
                <div className="flex justify-center" style={{ marginTop: '105px' }}>
                  {captions.length === 0 && (
                    <Brain className="text-gray-300" style={{ width: '230px', height: '230px' }} />
                  )}
                </div>

                {/* Generated captions - moved up 100px from brain icon position */}
                {captions.length > 0 && (
                  <div className="flex justify-center" style={{ marginTop: '-75px' }}>
                    <div className="w-full max-w-md">
                      <div className="space-y-3">
                        {captions.slice(0, 3).map((caption) => (
                          <div
                            key={caption.id}
                            className={`border rounded-lg p-3 transition-all ${
                              selectedCaptions.includes(caption.id)
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200'
                            }`}
                          >
                            <div className="space-y-2">
                              <Textarea
                                value={caption.text}
                                onChange={(e) => updateCaption(caption.id, e.target.value)}
                                placeholder="Edit your caption..."
                                className="min-h-[60px] resize-none border-0 bg-transparent focus:ring-0 focus:border-0 p-0 text-sm text-gray-700"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex items-center justify-between">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemixCaption(caption.id)
                                  }}
                                  disabled={remixingCaption === caption.id}
                                  className="text-xs"
                                >
                                  <RefreshCw className={`w-3 h-3 mr-1 ${remixingCaption === caption.id ? 'animate-spin' : ''}`} />
                                  {remixingCaption === caption.id ? 'Remixing...' : 'Remix'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={selectedCaptions.includes(caption.id) ? "default" : "outline"}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    selectCaption(caption.id)
                                  }}
                                  className={`text-xs ${
                                    selectedCaptions.includes(caption.id)
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                      : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                                  }`}
                                >
                                  {selectedCaptions.includes(caption.id) ? (
                                    <>
                                      <Check className="w-3 h-3 mr-1" />
                                      Selected
                                    </>
                                  ) : (
                                    'Select'
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  )
}
