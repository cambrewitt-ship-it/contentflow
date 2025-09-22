'use client'

import { useContentStore, UploadedImage } from 'lib/contentStore'
import { Button } from 'components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card'
import { Textarea } from 'components/ui/textarea'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

export function ImageUploadColumn() {
  const {
    uploadedImages,
    activeImageId,
    setActiveImageId,
    addImage,
    removeImage,
    postNotes,
    setPostNotes,
  } = useContentStore()

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
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 mb-1">
              Drop images here or click to upload
            </p>
            <p className="text-xs text-gray-500">
              Supports JPG, PNG, GIF up to 10MB each
            </p>
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

          {/* Post Notes Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-22px text-gray-700 mb-4">Post Notes</h3>
            <Textarea
              value={postNotes}
              onChange={(e) => setPostNotes(e.target.value)}
              placeholder="Add specific notes, context, or instructions for your post (optional)..."
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              These notes will be used to generate AI captions that match your requirements. Leave empty to generate captions based on image content and brand context.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
