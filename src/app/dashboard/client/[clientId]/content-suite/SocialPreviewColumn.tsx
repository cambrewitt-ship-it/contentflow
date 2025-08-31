'use client'

import { useContentStore } from 'lib/contentStore'
import { Button } from 'components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'
import { Loader2, Save, X, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { Input } from 'components/ui/input'
import { Textarea } from 'components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'components/ui/dialog'

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


  const selectedCaption =
    selectedCaptions.length > 0
      ? captions.find((cap) => cap.id === selectedCaptions[0])?.text
      : undefined

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
                  
                  {/* Caption below image (if selected) */}
                  {selectedCaption && (
                    <div className="p-4">
                      <p className="text-sm text-gray-900 leading-relaxed">{selectedCaption}</p>
                    </div>
                  )}
                  
                  {/* No Caption Message */}
                  {!selectedCaption && (
                    <div className="p-4 bg-gray-50 border-t border-gray-100">
                      <p className="text-sm text-gray-500 italic">Select a caption to complete your post</p>
                    </div>
                  )}
                </div>
              )}

              {/* Caption Preview (when no image is selected) */}
              {selectedCaption && !activeImageId && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-900">{selectedCaption}</p>
                </div>
              )}

              {/* No Caption Selected Message */}
              {!selectedCaption && !activeImageId && (
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
      {uploadedImages.length > 0 && selectedCaptions.length > 0 && (
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
                onClick={() => {
                  // TODO: Implement direct posting functionality
                  alert('Direct posting coming soon! This will post immediately to your connected social media accounts.');
                }}
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
                onClick={() => {
                  if (selectedCaption) {
                    handleSendToScheduler(selectedCaption, uploadedImages)
                  }
                }}
                disabled={isSendingToScheduler}
                className="w-full bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSendingToScheduler ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Loading
                  </>
                ) : (
                  <>
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2V7a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Schedule
                  </>
                )}
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
    </div>
  )
}
