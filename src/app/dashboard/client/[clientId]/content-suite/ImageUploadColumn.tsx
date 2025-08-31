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
    updateImageNotes,
    postNotes,
    setPostNotes,
  } = useContentStore()

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      Array.from(files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          addImage(file)
        }
      })
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const files = event.dataTransfer.files
          Array.from(files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          addImage(file)
        }
      })
  }

  return (
    <div className="space-y-6">
      {/* Image Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Images</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('image-upload')?.click()}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop images here or click to upload
            </p>
            <p className="text-sm text-gray-500">
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
        </CardContent>
      </Card>

      {/* Uploaded Images */}
      {uploadedImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Images ({uploadedImages.length})</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <img
                        src={image.preview}
                        alt="Uploaded content"
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <textarea
                        value={image.notes}
                        onChange={(e) => updateImageNotes(image.id, e.target.value)}
                        placeholder="Add notes about this image..."
                        className="w-full p-2 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        onClick={(e) => e.stopPropagation()}
                      />
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
          </CardContent>
        </Card>
      )}

      {/* Post Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Post Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={postNotes}
            onChange={(e) => setPostNotes(e.target.value)}
            placeholder="Add specific notes, context, or instructions for your post..."
            className="min-h-[120px] resize-none"
          />
          <p className="text-xs text-muted-foreground mt-2">
            These notes will be used to generate AI captions that match your requirements.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
