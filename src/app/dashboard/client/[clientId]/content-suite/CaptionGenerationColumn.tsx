'use client'

import { useContentStore } from '@/lib/contentStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
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
    copyType,
    setCopyType,
  } = useContentStore()

  const [generatingCaptions, setGeneratingCaptions] = useState(false)
  const [remixingCaption, setRemixingCaption] = useState<string | null>(null)

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
              <p className="text-xs text-muted-foreground mt-2">
                Select the type of copy you want to generate for your content
              </p>
            </div>

            {/* AI Caption Generation */}
            <div>
              <div className="border-t pt-4">
                <h3 className="text-22px mb-3">AI Caption Generation</h3>
                <Button
                  onClick={handleGenerateCaptions}
                  disabled={generatingCaptions || !activeImage}
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
                    </>
                  )}
                </Button>
                {!activeImage && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Upload an image to enable caption generation
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
