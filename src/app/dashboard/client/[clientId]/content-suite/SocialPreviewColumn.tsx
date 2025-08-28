'use client'

import { useContentStore } from './page'
import { Button } from 'components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'
import { Loader2 } from 'lucide-react'

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
  } = useContentStore()

  const selectedCaption =
    selectedCaptions.length > 0
      ? captions.find((cap) => cap.id === selectedCaptions[0])?.text
      : undefined

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
                onClick={() => {
                  // TODO: Implement save to projects functionality
                  alert('Save to projects coming soon! This will save your content to a project for later use.');
                }}
                variant="outline"
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
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
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
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
    </div>
  )
}
