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
    <div className="space-y-6">
      {/* Combined Upload and Uploaded Images Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Upload Images</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Area */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors cursor-pointer w-full h-[100px] flex flex-col items-center justify-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('image-upload')?.click()}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900 mb-1">
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Images ({uploadedImages.length})</h3>
              <div className="space-y-4">
                {uploadedImages.map((image) => (
                  <div
                    key={image.id}
                    className={`relative border-2 rounded-lg p-3 cursor-pointer transition-all ${
                      activeImageId === image.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveImageId(image.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <img
                          src={image.preview}
                          alt="Uploaded content"
                          className="w-16 h-16 object-cover rounded-md"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600 truncate">
                          {image.file.name}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeImage(image.id)
                        }}
                        className="flex-shrink-0 text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Post Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={postNotes}
            onChange={(e) => setPostNotes(e.target.value)}
            placeholder="Add specific notes, context, or instructions for your post (optional)..."
            className="min-h-[120px] resize-none"
          />
          <p className="text-xs text-muted-foreground mt-2">
            These notes will be used to generate AI captions that match your requirements. Leave empty to generate captions based on image content and brand context.
          </p>
        </CardContent>
      </Card>

    </div>
  )
}
