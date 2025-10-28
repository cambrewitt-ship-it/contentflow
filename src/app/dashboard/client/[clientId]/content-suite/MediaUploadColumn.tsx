'use client'

import { useContentStore, UploadedImage, NotesInterpretation, ContentFocus, CopyTone } from '@/lib/contentStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { X, Image as ImageIcon, Video as VideoIcon, ChevronDown } from 'lucide-react'

export function MediaUploadColumn() {
  const {
    uploadedImages,
    activeImageId,
    setActiveImageId,
    addImage,
    removeImage,
    postNotes,
    setPostNotes,
    contentFocus,
    setContentFocus,
    copyTone,
    setCopyTone,
  } = useContentStore()


  const getContentFocusDisplayText = (focus: ContentFocus): string => {
    switch (focus) {
      case 'main-focus':
        return 'Main focus'
      case 'supporting':
        return 'Supporting'
      case 'background':
        return 'Background'
      case 'none':
        return 'None'
      default:
        return 'Main focus'
    }
  }

  const getCopyToneDisplayText = (tone: CopyTone): string => {
    switch (tone) {
      case 'promotional':
        return 'Promotional'
      case 'educational':
        return 'Educational'
      case 'personal':
        return 'Personal'
      case 'testimonial':
        return 'Testimonial'
      case 'engagement':
        return 'Engagement'
      default:
        return 'Promotional'
    }
  }

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      for (const file of Array.from(files)) {
        // Accept both images and videos
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          await addImage(file)
        }
      }
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    for (const file of Array.from(files)) {
      // Accept both images and videos
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        await addImage(file)
      }
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col flex-1">
      {/* Combined Upload, Media, and Post Notes Card */}
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="card-title-26">Upload Media</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {/* Upload Area */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors cursor-pointer w-full h-[100px] flex flex-col items-center justify-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('media-upload')?.click()}
          >
            <div className="text-6xl font-light text-gray-400">+</div>
            <input
              id="media-upload"
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleMediaUpload}
              className="hidden"
            />
          </div>

          {/* Uploaded Media */}
          {uploadedImages.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Uploaded Media ({uploadedImages.length})</h3>
              <div className="grid grid-cols-4 gap-3">
                {uploadedImages.map((media) => (
                  <div
                    key={media.id}
                    className={`relative aspect-square border-2 rounded-lg cursor-pointer transition-all ${
                      activeImageId === media.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveImageId(media.id)}
                  >
                    {/* Media Type Indicator */}
                    <div className="absolute top-1 left-1 z-10 bg-black/60 rounded px-1.5 py-0.5 flex items-center gap-1">
                      {media.mediaType === 'video' ? (
                        <VideoIcon className="w-3 h-3 text-white" />
                      ) : (
                        <ImageIcon className="w-3 h-3 text-white" />
                      )}
                      <span className="text-xs text-white">{media.mediaType === 'video' ? 'Video' : 'Image'}</span>
                    </div>

                    {/* Media Preview - Show thumbnail for videos, image for images */}
                    <img
                      src={media.mediaType === 'video' ? (media.videoThumbnail || media.preview) : media.preview}
                      alt={media.mediaType === 'video' ? "Video thumbnail" : "Uploaded content"}
                      className="w-full h-full object-cover rounded-md"
                    />
                    
                    {/* Play icon overlay for videos */}
                    {media.mediaType === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
                        <div className="bg-white/90 rounded-full p-2">
                          <svg className="w-4 h-4 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeImage(media.id)
                      }}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Focus Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Content Focus</h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-3">
                    {getContentFocusDisplayText(contentFocus)}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setContentFocus('main-focus')}
                    className={contentFocus === 'main-focus' ? 'bg-accent' : ''}
                  >
                    Main focus
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setContentFocus('supporting')}
                    className={contentFocus === 'supporting' ? 'bg-accent' : ''}
                  >
                    Supporting
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setContentFocus('background')}
                    className={contentFocus === 'background' ? 'bg-accent' : ''}
                  >
                    Background
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Post Notes Section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="mb-4">
              <h3 className="text-22px text-gray-700">Post Notes</h3>
            </div>
            <Textarea
              value={postNotes}
              onChange={(e) => setPostNotes(e.target.value)}
              placeholder="Add specific notes, context, or instructions for your post (optional)..."
              className="min-h-[120px] resize-none"
            />
          </div>

          {/* Copy Tone Section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Copy Tone</h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-3">
                    {getCopyToneDisplayText(copyTone)}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setCopyTone('promotional')}
                    className={copyTone === 'promotional' ? 'bg-accent' : ''}
                  >
                    Promotional
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setCopyTone('educational')}
                    className={copyTone === 'educational' ? 'bg-accent' : ''}
                  >
                    Formal
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setCopyTone('engagement')}
                    className={copyTone === 'engagement' ? 'bg-accent' : ''}
                  >
                    Engagement
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

