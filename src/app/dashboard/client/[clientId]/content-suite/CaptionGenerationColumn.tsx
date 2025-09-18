'use client'

import { useContentStore } from 'lib/contentStore'
import { Button } from 'components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'
import { Textarea } from 'components/ui/textarea'
import { Brain, RefreshCw, Check } from 'lucide-react'
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
  } = useContentStore()

  const [generatingCaptions, setGeneratingCaptions] = useState(false)
  const [remixingCaption, setRemixingCaption] = useState<string | null>(null)
  const [copyType, setCopyType] = useState<'social-media' | 'email-marketing'>('social-media')

  const activeImage = uploadedImages.find((img) => img.id === activeImageId)

  const handleGenerateCaptions = async () => {
    if (!activeImage) {
      alert('Please select an image first')
      return
    }

    console.log('Starting caption generation...')
    console.log('Copy type:', copyType)
    console.log('Post notes:', postNotes)
    console.log('Active image:', activeImage.id)

    setGeneratingCaptions(true)
    try {
      // Use the active image ID for AI caption generation
      // Post Notes are optional - pass them if they exist
      // Pass the selected copy type
      await generateAICaptions(activeImage.id, postNotes.trim() || undefined, copyType)
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
      await remixCaption(captionId)
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
    <div className="space-y-6">
      {/* Copy Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Copy Type</CardTitle>
        </CardHeader>
        <CardContent>
          <select 
            value={copyType} 
            onChange={(e) => setCopyType(e.target.value as 'social-media' | 'email-marketing')}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="social-media">Social Media Copy</option>
            <option value="email-marketing">Email Marketing Copy</option>
          </select>
          <p className="text-xs text-muted-foreground mt-2">
            Select the type of copy you want to generate for your content
          </p>
        </CardContent>
      </Card>

      {/* AI Caption Generation */}
      {activeImage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Caption Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGenerateCaptions}
              disabled={generatingCaptions}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generated Content */}
      {captions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Generated {copyType === 'social-media' ? 'Captions' : 'Email Copy'} ({captions.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit any {copyType === 'social-media' ? 'caption' : 'copy'} text and click &quot;Select&quot; to choose your preferred option
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {captions.map((caption) => (
                <div
                  key={caption.id}
                  className={`border rounded-lg p-3 transition-all ${
                    selectedCaptions.includes(caption.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Editable Caption Text */}
                    <Textarea
                      value={caption.text}
                      onChange={(e) => updateCaption(caption.id, e.target.value)}
                      placeholder="Edit your caption..."
                      className="min-h-[80px] resize-none border-0 bg-transparent focus:ring-0 focus:border-0 p-0 text-sm text-gray-900"
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
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
                      </div>
                      
                      {/* Select Button */}
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
          </CardContent>
        </Card>
      )}

      {/* No Images Message */}
      {uploadedImages.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-gray-400 mb-2">
              <Brain className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-600">Upload images to start generating AI captions</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
