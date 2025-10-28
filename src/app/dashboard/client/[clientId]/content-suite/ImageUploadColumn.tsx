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
import { X, Image as ImageIcon, ChevronDown } from 'lucide-react'

export function ImageUploadColumn() {
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
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
      if (file.type.startsWith('image/')) {
        await addImage(file)
      }
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Combined Upload, Images, and Post Notes Card */}
      <Card>
        <CardHeader>
          <CardTitle className="card-title-26">Upload Images</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors cursor-pointer w-full h-[100px] flex flex-col items-center justify-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('image-upload')?.click()}
          >
            <div className="text-6xl font-light text-gray-400">+</div>
            <input
              id="image-upload"
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Uploaded Images */}
          {uploadedImages.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Uploaded Images ({uploadedImages.length})</h3>
              <div className="grid grid-cols-4 gap-3">
                {uploadedImages.map((image) => (
                  <div
                    key={image.id}
                    className={`relative aspect-square border-2 rounded-lg cursor-pointer transition-all ${
                      activeImageId === image.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveImageId(image.id)}
                  >
                    <img
                      src={image.preview}
                      alt="Uploaded content"
                      className="w-full h-full object-cover rounded-md"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeImage(image.id)
                      }}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
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
            <p className="text-xs text-muted-foreground">
              Specify how the AI should prioritize photo analysis in caption generation.
            </p>
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
            <p className="text-xs text-muted-foreground">
              Choose the writing style and tone for AI-generated captions.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
