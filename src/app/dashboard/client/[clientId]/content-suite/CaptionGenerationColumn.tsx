'use client'

import { useContentStore } from '@/lib/contentStore'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Brain, RefreshCw, Check, Video, AlertCircle, Settings, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

type CaptionRulesForm = {
  captionDos: string
  captionDonts: string
  brandVoiceExamples: string
}

export function CaptionGenerationColumn() {
  const {
    clientId,
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
  const [showCreditDialog, setShowCreditDialog] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [rulesLoading, setRulesLoading] = useState(false)
  const [savingRules, setSavingRules] = useState(false)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [rulesSuccess, setRulesSuccess] = useState<string | null>(null)
  const [rulesForm, setRulesForm] = useState<CaptionRulesForm>({
    captionDos: '',
    captionDonts: '',
    brandVoiceExamples: '',
  })
  const [initialRules, setInitialRules] = useState<CaptionRulesForm | null>(null)

  const loadCaptionRules = useCallback(async () => {
    setRulesError(null)
    setRulesSuccess(null)

    if (!clientId) {
      setRulesError('Client not found. Please refresh and try again.')
      return
    }

    const token = getAccessToken()
    if (!token) {
      setRulesError('Authentication required. Please log in again.')
      return
    }

    setRulesLoading(true)
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let message = 'Failed to load AI caption rules.'
        try {
          const data = await response.json()
          if (typeof data?.error === 'string') {
            message = data.error
          }
        } catch (_) {}
        throw new Error(message)
      }

      const data = await response.json()
      const client = data?.client ?? {}

      const nextRules: CaptionRulesForm = {
        captionDos: client.caption_dos || '',
        captionDonts: client.caption_donts || '',
        brandVoiceExamples: client.brand_voice_examples || '',
      }

      setRulesForm(nextRules)
      setInitialRules(nextRules)
    } catch (error) {
      setRulesError(error instanceof Error ? error.message : 'Failed to load AI caption rules.')
    } finally {
      setRulesLoading(false)
    }
  }, [clientId, getAccessToken])

  const handleSaveCaptionRules = useCallback(async () => {
    setRulesError(null)
    setRulesSuccess(null)

    if (!clientId) {
      setRulesError('Client not found. Please refresh and try again.')
      return
    }

    const token = getAccessToken()
    if (!token) {
      setRulesError('Authentication required. Please log in again.')
      return
    }

    setSavingRules(true)
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          caption_dos: rulesForm.captionDos,
          caption_donts: rulesForm.captionDonts,
          brand_voice_examples: rulesForm.brandVoiceExamples,
        }),
      })

      if (!response.ok) {
        let message = 'Failed to update AI caption rules.'
        try {
          const data = await response.json()
          if (typeof data?.error === 'string') {
            message = data.error
          }
        } catch (_) {}
        throw new Error(message)
      }

      const data = await response.json()
      const updatedClient = data?.client ?? {}
      const nextRules: CaptionRulesForm = {
        captionDos: updatedClient.caption_dos || rulesForm.captionDos,
        captionDonts: updatedClient.caption_donts || rulesForm.captionDonts,
        brandVoiceExamples: updatedClient.brand_voice_examples || rulesForm.brandVoiceExamples,
      }

      setRulesForm(nextRules)
      setInitialRules(nextRules)
      setRulesSuccess('AI caption rules updated successfully.')
    } catch (error) {
      setRulesError(error instanceof Error ? error.message : 'Failed to update AI caption rules.')
    } finally {
      setSavingRules(false)
    }
  }, [clientId, getAccessToken, rulesForm])

  const updateRulesField = useCallback((field: keyof CaptionRulesForm, value: string) => {
    setRulesForm(prev => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const activeImage = uploadedImages.find((img) => img.id === activeImageId)
  const isVideoSelected = activeImage?.mediaType === 'video'


  useEffect(() => {
    if (showSettingsModal) {
      loadCaptionRules()
    }
  }, [showSettingsModal, loadCaptionRules])

  useEffect(() => {
    if (!showSettingsModal) {
      setRulesError(null)
      setRulesSuccess(null)
    }
  }, [showSettingsModal])

  const hasRuleChanges =
    initialRules === null ||
    initialRules.captionDos !== rulesForm.captionDos ||
    initialRules.captionDonts !== rulesForm.captionDonts ||
    initialRules.brandVoiceExamples !== rulesForm.brandVoiceExamples

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
      
      // Check for insufficient credits error
      if (error instanceof Error && error.message === 'INSUFFICIENT_CREDITS') {
        setShowCreditDialog(true)
      } else {
        alert(`Failed to generate captions: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
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
    <div className="space-y-6 h-full flex flex-col flex-1">
      {/* Copy Type Selection & AI Caption Generation */}
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="card-title-26">Copy Type</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettingsModal(true)}
            aria-label="Edit AI caption rules"
            className="text-gray-500 hover:text-gray-800"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
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
                
                {/* Caption boxes - always show at least one editable box */}
                <div className="flex justify-center mt-6">
                  <div className="w-full max-w-md">
                    <div className="space-y-3">
                      {/* Always show at least one caption box - use first caption or create empty one */}
                      {(() => {
                        // Get the first caption or create an empty placeholder
                        const firstCaption = captions.length > 0 ? captions[0] : { id: 'custom-caption-1', text: '' }
                        const displayCaptions = captions.length > 0 ? captions.slice(0, 3) : [firstCaption]
                        const isEmptyBox = captions.length === 0
                        
                        return displayCaptions.map((caption, index) => {
                          const isFirstEmpty = isEmptyBox && index === 0
                          
                          return (
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
                                  onChange={(e) => {
                                    const newText = e.target.value
                                    
                                    if (isFirstEmpty) {
                                      // Create new caption when typing in empty box
                                      const newCaption = {
                                        id: 'custom-caption-1',
                                        text: newText
                                      }
                                      setCaptions([newCaption])
                                      if (newText.trim()) {
                                        selectCaption('custom-caption-1')
                                      }
                                    } else {
                                      // Update existing caption
                                      updateCaption(caption.id, newText)
                                      // Auto-select when user types if not already selected
                                      if (newText.trim() && !selectedCaptions.includes(caption.id)) {
                                        selectCaption(caption.id)
                                      }
                                    }
                                  }}
                                  placeholder={`Type your ${copyType === 'social-media' ? 'caption' : 'email copy'} here...`}
                                  className="min-h-[60px] resize-none border-0 bg-transparent focus:ring-0 focus:border-0 p-0 text-sm text-gray-700"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex items-center justify-between">
                                  {/* Only show Remix button for AI-generated captions, not the custom caption box */}
                                  {!isFirstEmpty && caption.id !== 'custom-caption-1' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemixCaption(caption.id)
                                      }}
                                      disabled={remixingCaption === caption.id || !caption.text.trim()}
                                      className="text-xs"
                                    >
                                      <RefreshCw className={`w-3 h-3 mr-1 ${remixingCaption === caption.id ? 'animate-spin' : ''}`} />
                                      {remixingCaption === caption.id ? 'Remixing...' : 'Remix'}
                                    </Button>
                                  )}
                                  {/* If no Remix button, add a spacer to keep Select button on the right */}
                                  {(isFirstEmpty || caption.id === 'custom-caption-1') && <div />}
                                  <Button
                                    size="sm"
                                    variant={selectedCaptions.includes(caption.id) ? "default" : "outline"}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      selectCaption(caption.id)
                                    }}
                                    disabled={!caption.text.trim() || isFirstEmpty}
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
                          )
                        })
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>AI Caption Rules</DialogTitle>
            <DialogDescription>
              Update the guardrails the AI uses when generating captions for this client. Changes apply across the entire dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {rulesError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {rulesError}
              </div>
            )}
            {rulesSuccess && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {rulesSuccess}
              </div>
            )}

            {rulesLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      ✅ Do&apos;s
                    </label>
                    <Textarea
                      value={rulesForm.captionDos}
                      onChange={(e) => updateRulesField('captionDos', e.target.value)}
                      placeholder="Always include the main offer, Mention the location, Use emojis that match our tone..."
                      rows={5}
                      className="border-green-300 focus-visible:border-green-500 focus-visible:ring-green-500"
                    />
                    <p className="mt-1 text-xs text-green-600">
                      Tell the AI what must always be included in captions.
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      ❌ Don&apos;ts
                    </label>
                    <Textarea
                      value={rulesForm.captionDonts}
                      onChange={(e) => updateRulesField('captionDonts', e.target.value)}
                      placeholder="Don&apos;t mention competitors, Avoid slang, Never promise discounts unless provided..."
                      rows={5}
                      className="border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500"
                    />
                    <p className="mt-1 text-xs text-red-600">
                      List anything the AI must avoid or exclude.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    🎤 Brand Voice Examples
                  </label>
                  <Textarea
                    value={rulesForm.brandVoiceExamples}
                    onChange={(e) => updateRulesField('brandVoiceExamples', e.target.value)}
                    placeholder="Paste 5-10 of your strongest captions, social posts, or marketing copy so AI can imitate the exact tone."
                    rows={6}
                    className="border-blue-300 focus-visible:border-blue-500 focus-visible:ring-blue-500"
                  />
                  <p className="mt-2 text-xs text-blue-600">
                    Provide high-quality examples that show vocabulary, sentence structure, and personality. The AI mirrors this voice.
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSettingsModal(false)}
              disabled={savingRules}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCaptionRules}
              disabled={savingRules || rulesLoading || !hasRuleChanges}
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-200"
            >
              {savingRules ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insufficient Credits Dialog */}
      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Out of Credits
            </DialogTitle>
            <DialogDescription>
              Failed to generate captions: Insufficient AI credits. You have 0 credits remaining - Please upgrade your plan or wait until next month.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowCreditDialog(false)
                window.location.href = '/pricing'
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Upgrade Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
