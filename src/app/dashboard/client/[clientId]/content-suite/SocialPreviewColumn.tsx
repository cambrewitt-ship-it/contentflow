'use client'

import { useContentStore } from 'lib/contentStore'
import { Button } from 'components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'
import { Loader2, Save, X, FolderOpen, Calendar, Clock, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Input } from 'components/ui/input'
import { Textarea } from 'components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'components/ui/dialog'

interface ConnectedAccount {
  _id: string;
  platform: string;
  name: string;
  accountId?: string;
}

interface SocialPreviewColumnProps {
  clientId: string
  handleSendToScheduler: (
    selectedCaption: string,
    uploadedImages: { preview: string; id: string; file?: File }[]
  ) => Promise<void>
  isSendingToScheduler: boolean
}

export function SocialPreviewColumn({
  clientId,
  handleSendToScheduler,
  isSendingToScheduler,
}: SocialPreviewColumnProps) {
  const {
    uploadedImages,
    captions,
    selectedCaptions,
    activeImageId,
    postNotes,
  } = useContentStore()



  const [showSaveModal, setShowSaveModal] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Scheduling state
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('12:00 PM')
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  // Custom caption state
  const [customCaption, setCustomCaption] = useState('')

  // Connected accounts state
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)


  const selectedCaption =
    selectedCaptions.length > 0
      ? captions.find((cap) => cap.id === selectedCaptions[0])?.text
      : undefined

  // Use custom caption if provided, otherwise use selected AI caption
  const displayCaption = customCaption.trim() || selectedCaption || ''

  // Sync custom caption with selected AI caption when it changes
  useEffect(() => {
    if (selectedCaption && !customCaption) {
      setCustomCaption(selectedCaption)
    }
  }, [selectedCaption, customCaption])

  // Fetch connected accounts on component mount
  useEffect(() => {
    fetchConnectedAccounts()
  }, [clientId])

  const fetchConnectedAccounts = async () => {
    try {
      setIsLoadingAccounts(true)
      const response = await fetch(`/api/late/get-accounts/${clientId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.status}`)
      }
      const data = await response.json()
      setConnectedAccounts(data.accounts || [])
      console.log('Connected accounts count:', data.accounts?.length || 0)
    } catch (error) {
      console.error('Error fetching accounts:', error)
      setScheduleError(error instanceof Error ? error.message : 'Failed to load connected accounts')
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  const handleSaveToProject = async () => {
    if (!projectName.trim()) {
      setSaveError('Project name is required')
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      // Create new project with content
        const projectData = {
          client_id: clientId,
          name: projectName.trim(),
          description: projectDescription.trim(),
          content_metadata: {
            posts: [{
              id: `post-${Date.now()}`,
              images: uploadedImages.map(img => ({
                id: img.id,
                notes: img.notes || '',
                preview: img.preview
              })),
              captions: captions.map(cap => ({
                id: cap.id,
                text: cap.text,
                isSelected: selectedCaptions.includes(cap.id)
              })),
              selectedCaption: selectedCaption,
              postNotes: postNotes || '',
              activeImageId: activeImageId,
              createdAt: new Date().toISOString()
            }]
          }
        }

        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(projectData),
        })

        const result = await response.json()

        if (result.success) {
          setShowSaveModal(false)
          setProjectName('')
          setProjectDescription('')
          alert(`Project "${projectName}" created successfully with your content!`)
        } else {
          setSaveError(result.error || 'Failed to create project')
        }
    } catch (error) {
      console.error('Error saving project:', error)
      setSaveError('Network error occurred while saving')
    } finally {
      setIsSaving(false)
    }
  }

  const openSaveModal = () => {
    // Pre-fill project name with current date/time
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
    
    setProjectName(`Content - ${dateStr} ${timeStr}`)
    setProjectDescription('')
    setSaveError(null)
    setShowSaveModal(true)
  }

  const openScheduleModal = () => {
    // Set default date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setScheduleDate(tomorrow.toISOString().split('T')[0])
    setScheduleTime('12:00 PM')
    setShowScheduleModal(true)
    setScheduleError(null)
  }

  const handleSchedulePost = async () => {
    if (!scheduleDate || !scheduleTime) {
      setScheduleError('Please select both date and time')
      return
    }

    if (!displayCaption || uploadedImages.length === 0) {
      setScheduleError('Please ensure you have both a caption and image selected')
      return
    }

    if (selectedPlatforms.size === 0) {
      setScheduleError('Please select at least one platform to schedule to')
      return
    }

    setIsScheduling(true)
    setScheduleError(null)

    try {
      // Parse the date and time
      const [time, period] = scheduleTime.split(' ')
      const [hours, minutes] = time.split(':')
      let hour24 = parseInt(hours)
      
      if (period === 'PM' && hour24 !== 12) {
        hour24 += 12
      } else if (period === 'AM' && hour24 === 12) {
        hour24 = 0
      }

      const scheduledDateTime = new Date(scheduleDate)
      scheduledDateTime.setHours(hour24, parseInt(minutes), 0, 0)

      // Format for LATE API (YYYY-MM-DDTHH:MM:SS)
      const scheduledDateStr = scheduledDateTime.toISOString().split('T')[0]
      const scheduledTimeStr = `${hour24.toString().padStart(2, '0')}:${minutes}:00`
      const scheduledDateTimeStr = `${scheduledDateStr}T${scheduledTimeStr}`

      console.log('🚀 Content Suite Scheduling - Using LATE API approach:')
      console.log('  - Caption:', displayCaption.substring(0, 50) + '...')
      console.log('  - Scheduled DateTime:', scheduledDateTimeStr)
      console.log('  - Selected Platforms:', Array.from(selectedPlatforms))

      // Get selected accounts
      const selectedAccounts = connectedAccounts.filter(account => 
        selectedPlatforms.has(account.platform)
      )

      if (selectedAccounts.length === 0) {
        throw new Error('No valid accounts selected')
      }

      // Step 1: Upload image to LATE
      console.log('Uploading image to LATE...')
      const activeImage = uploadedImages.find(img => img.id === activeImageId) || uploadedImages[0]
      let imageData = activeImage.preview

      // Convert blob URL to base64 if needed
      if (imageData.startsWith('blob:')) {
        try {
          const response = await fetch(imageData)
          const blob = await response.blob()
          const reader = new FileReader()
          
          imageData = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
        } catch (error) {
          console.error('Blob conversion failed:', error)
          throw new Error('Failed to process image')
        }
      }

      const mediaResponse = await fetch('/api/late/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBlob: imageData })
      })

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text()
        console.error('Media upload error:', errorText)
        throw new Error('Failed to upload image to LATE')
      }
      
      const { lateMediaUrl } = await mediaResponse.json()
      console.log('✅ Image uploaded to LATE successfully')

      // Step 2: Create a temporary post ID for LATE API
      const tempPostId = `content-suite-${Date.now()}`

      // Step 3: Schedule via LATE API
      const lateRequestBody = {
        postId: tempPostId,
        caption: displayCaption,
        lateMediaUrl: lateMediaUrl,
        scheduledDateTime: scheduledDateTimeStr,
        selectedAccounts: selectedAccounts,
        clientId: clientId
      }

      console.log('Scheduling post via LATE API...')
      const response = await fetch('/api/late/schedule-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lateRequestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('LATE scheduling error:', errorText)
        throw new Error('Failed to schedule post via LATE')
      }

      const result = await response.json()
      console.log('✅ Post scheduled successfully via LATE API')

      // Show success message
      const platformNames = selectedAccounts.map(acc => acc.platform).join(', ')
      alert(`Post scheduled successfully for ${scheduledDateTime.toLocaleString()} to ${platformNames}!`)
      
      // Close modal and reset form
      setShowScheduleModal(false)
      setScheduleDate('')
      setScheduleTime('12:00 PM')
      setSelectedPlatforms(new Set())
      
    } catch (error) {
      console.error('Error scheduling post:', error)
      setScheduleError(error instanceof Error ? error.message : 'Failed to schedule post')
    } finally {
      setIsScheduling(false)
    }
  }

  const handlePostNow = async () => {
    if (!displayCaption || uploadedImages.length === 0) {
      alert('Please ensure you have both a caption and image selected')
      return
    }

    if (!confirm('Are you sure you want to post this immediately to your connected social media accounts?')) {
      return
    }

    try {
      // Create the post data for immediate posting
      const postData = {
        clientId,
        caption: displayCaption,
        imageUrl: uploadedImages[0].preview,
        platforms: ['facebook', 'instagram'], // Default platforms
        postNotes: postNotes || ''
      }

      // Call the immediate posting API
      const response = await fetch('/api/publishViaLate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData)
      })

      if (!response.ok) {
        throw new Error('Failed to post immediately')
      }

      const result = await response.json()
      alert('Post published successfully!')
      
    } catch (error) {
      console.error('Error posting immediately:', error)
      alert(error instanceof Error ? error.message : 'Failed to post immediately')
    }
  }

  return (
    <div className="space-y-6">
      {/* Social Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Social Media Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {uploadedImages.length > 0 ? (
            <div className="space-y-4">
              {/* Main Social Media Preview */}
              {activeImageId && (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  {/* Selected Image */}
                  <div className="relative">
                    <img
                      src={uploadedImages.find(img => img.id === activeImageId)?.preview}
                      alt="Social media post"
                      className="w-full h-64 object-cover"
                    />
                  </div>
                  
                  {/* Caption below image */}
                  <div className="p-4 border-t border-gray-100">
                    <label htmlFor="customCaption" className="block text-sm font-medium text-gray-700 mb-2">
                      Caption
                    </label>
                    <Textarea
                      id="customCaption"
                      value={customCaption}
                      onChange={(e) => setCustomCaption(e.target.value)}
                      placeholder={selectedCaption ? "Edit the AI-generated caption or type your own..." : "Type your caption here..."}
                      className="w-full min-h-[80px] resize-none"
                      rows={3}
                    />
                    {selectedCaption && !customCaption && (
                      <p className="text-xs text-gray-500 mt-1">
                        AI Caption: {selectedCaption}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Caption Preview (when no image is selected) */}
              {!activeImageId && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <label htmlFor="customCaptionNoImage" className="block text-sm font-medium text-gray-700 mb-2">
                    Caption
                  </label>
                  <Textarea
                    id="customCaptionNoImage"
                    value={customCaption}
                    onChange={(e) => setCustomCaption(e.target.value)}
                    placeholder={selectedCaption ? "Edit the AI-generated caption or type your own..." : "Type your caption here..."}
                    className="w-full min-h-[80px] resize-none"
                    rows={3}
                  />
                  {selectedCaption && !customCaption && (
                    <p className="text-xs text-gray-500 mt-1">
                      AI Caption: {selectedCaption}
                    </p>
                  )}
                </div>
              )}

              {/* No Image Uploaded Message */}
              {!activeImageId && !displayCaption && (
                <div className="text-center py-6 text-gray-500">
                  <p>Upload images to see the social media preview</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Upload images to see preview</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {uploadedImages.length > 0 && displayCaption && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What would you like to do?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Your content is ready! Choose your next step.
            </p>
            
            <div className="space-y-3">
              {/* Post Now Button */}
              <Button
                onClick={handlePostNow}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                Post Now
              </Button>
              
              {/* Save to Projects Button */}
              <Button
                onClick={openSaveModal}
                variant="outline"
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Save className="w-5 h-5 mr-2" />
                Save to Projects
              </Button>
              
              {/* Schedule Button */}
              <Button
                onClick={openScheduleModal}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Calendar className="w-5 h-5 mr-2" />
                Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save to Project Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5" />
              Save to Projects
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Save Mode - New Project Only */}
            <div className="text-center py-2">
              <span className="text-sm text-gray-600">Create New Project</span>
            </div>

            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
                Project Name *
              </label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                className="w-full"
              />
            </div>
            
            <div>
              <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <Textarea
                id="projectDescription"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Describe this project..."
                className="w-full"
                rows={3}
              />
            </div>

            {saveError && (
              <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                {saveError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSaveToProject}
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Project
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => setShowSaveModal(false)}
                variant="outline"
                disabled={isSaving}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Post Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Post
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center py-2">
              <span className="text-sm text-gray-600">When and where would you like to post this content?</span>
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Platforms *
              </label>
              {isLoadingAccounts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="text-sm text-gray-500">Loading connected accounts...</span>
                </div>
              ) : connectedAccounts.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No connected accounts found.</p>
                  <p className="text-xs mt-1">Please connect your social media accounts first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {connectedAccounts.map((account) => (
                    <button
                      key={account._id}
                      onClick={() => {
                        const newSelected = new Set(selectedPlatforms)
                        if (newSelected.has(account.platform)) {
                          newSelected.delete(account.platform)
                        } else {
                          newSelected.add(account.platform)
                        }
                        setSelectedPlatforms(newSelected)
                      }}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        selectedPlatforms.has(account.platform)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm capitalize">{account.platform}</div>
                          <div className="text-xs text-gray-500">{account.name}</div>
                        </div>
                        {selectedPlatforms.has(account.platform) && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date Input */}
            <div>
              <label htmlFor="scheduleDate" className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <Input
                id="scheduleDate"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Time Input */}
            <div>
              <label htmlFor="scheduleTime" className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <div className="flex gap-2">
                <Input
                  id="scheduleTime"
                  type="text"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  placeholder="12:00 PM"
                  className="flex-1"
                />
                <div className="text-sm text-gray-500 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Format: 12:00 PM
                </div>
              </div>
            </div>

            {scheduleError && (
              <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                {scheduleError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSchedulePost}
                disabled={isScheduling || selectedPlatforms.size === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {isScheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Post
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => setShowScheduleModal(false)}
                variant="outline"
                disabled={isScheduling}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
