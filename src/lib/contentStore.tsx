'use client'

import React from 'react'
import { createContext, useContext, useState, useEffect } from 'react'
import { uploadImageToBlob } from './blobUpload'

export interface Caption {
  id: string
  text: string
}

export interface UploadedImage {
  id: string
  file: File
  preview: string
  blobUrl?: string
  notes?: string
}

// Serializable version for localStorage
export interface SerializableUploadedImage {
  id: string
  filename: string
  preview: string
  blobUrl?: string
  notes?: string
  size: number
  type: string
}

// Global store context
export interface ContentStore {
  clientId: string
  uploadedImages: UploadedImage[]
  captions: Caption[]
  selectedCaptions: string[]
  activeImageId: string | null
  hasHydrated: boolean
  postNotes: string
  setUploadedImages: (images: UploadedImage[]) => void
  setCaptions: (captions: Caption[]) => void
  setSelectedCaptions: (captions: string[]) => void
  setActiveImageId: (id: string | null) => void
  setPostNotes: (notes: string) => void
  addImage: (file: File) => Promise<void>
  removeImage: (id: string) => void
  updateImageNotes: (id: string, notes: string) => void
  updateCaption: (id: string, text: string) => void
  selectCaption: (id: string) => void
  generateAICaptions: (imageId: string, notes?: string) => Promise<void>
  remixCaption: (captionId: string) => Promise<void>
  clearAll: () => void
}

const ContentStoreContext = createContext<ContentStore | null>(null)

export const useContentStore = () => {
  const context = useContext(ContentStoreContext)
  if (!context) {
    throw new Error('useContentStore must be used within ContentStoreProvider')
  }
  return context
}

const getStorageKey = (key: string) => `contentflow_${key}`

// Helper functions to convert between UploadedImage and SerializableUploadedImage
const toSerializable = (image: UploadedImage): SerializableUploadedImage => ({
  id: image.id,
  filename: image.file.name,
  preview: image.preview,
  blobUrl: image.blobUrl,
  notes: image.notes,
  size: image.file.size,
  type: image.file.type
})

const fromSerializable = (serializable: SerializableUploadedImage): UploadedImage => {
  // Create a mock File object for compatibility (we'll use blobUrl for actual data)
  const mockFile = new File([], serializable.filename, {
    type: serializable.type,
    lastModified: Date.now()
  })
  
  return {
    id: serializable.id,
    file: mockFile,
    preview: serializable.preview,
    blobUrl: serializable.blobUrl,
    notes: serializable.notes
  }
}

// Store provider component
export function ContentStoreProvider({ children, clientId }: { children: React.ReactNode; clientId: string }) {
  // Default values
  const defaultCaptions: Caption[] = [
    {
      id: "1",
      text: "Ready to create amazing content? Let's make something special! ✨",
    },
    {
      id: "2",
      text: "Your brand story deserves to be told. Let's craft the perfect message together. 🚀",
    },
    {
      id: "3",
      text: "From concept to creation, we're here to bring your vision to life. 💫",
    },
  ]

  // Initialize state with default values (same for server and client)
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [captions, setCaptions] = useState<Caption[]>(defaultCaptions)
  const [selectedCaptions, setSelectedCaptions] = useState<string[]>([])
  const [activeImageId, setActiveImageId] = useState<string | null>(null)
  const [postNotes, setPostNotes] = useState<string>('')

  // Track if we've hydrated from localStorage
  const [hasHydrated, setHasHydrated] = useState(false)

  // Hydrate from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined" && !hasHydrated) {
      try {
        const savedImages = localStorage.getItem(getStorageKey("uploadedImages"))
        const savedCaptions = localStorage.getItem(getStorageKey("captions"))
        const savedSelectedCaptions = localStorage.getItem(getStorageKey("selectedCaptions"))
        const savedActiveImageId = localStorage.getItem(getStorageKey("activeImageId"))
        const savedPostNotes = localStorage.getItem(getStorageKey("postNotes"))

        if (savedImages) {
          const parsedImages: SerializableUploadedImage[] = JSON.parse(savedImages)
          const restoredImages = parsedImages.map(fromSerializable)
          setUploadedImages(restoredImages)
        }
        if (savedCaptions) {
          const parsedCaptions = JSON.parse(savedCaptions)
          setCaptions(parsedCaptions)
        }
        if (savedSelectedCaptions) {
          const parsedSelectedCaptions = JSON.parse(savedSelectedCaptions)
          setSelectedCaptions(parsedSelectedCaptions)
        }
        if (savedActiveImageId) {
          setActiveImageId(savedActiveImageId)
        }
        if (savedPostNotes) {
          setPostNotes(savedPostNotes)
        }

        setHasHydrated(true)
      } catch (error) {
        console.error("Error hydrating from localStorage:", error)
        setHasHydrated(true)
      }
    }
  }, [hasHydrated])

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (hasHydrated) {
      const serializableImages = uploadedImages.map(toSerializable)
      localStorage.setItem(getStorageKey("uploadedImages"), JSON.stringify(serializableImages))
      localStorage.setItem(getStorageKey("captions"), JSON.stringify(captions))
      localStorage.setItem(getStorageKey("selectedCaptions"), JSON.stringify(selectedCaptions))
      localStorage.setItem(getStorageKey("activeImageId"), activeImageId || "")
      localStorage.setItem(getStorageKey("postNotes"), postNotes)
    }
  }, [hasHydrated, uploadedImages, captions, selectedCaptions, activeImageId, postNotes])

  const addImage = async (file: File) => {
    const id = `img-${Date.now()}`
    const preview = URL.createObjectURL(file) // Temporary preview while uploading
    
    // Create initial image entry with temporary preview
    const newImage: UploadedImage = { id, file, preview }
    setUploadedImages(prev => [...prev, newImage])
    setActiveImageId(id)
    
    try {
      // Upload to blob storage
      // uploadImageToBlob is now imported at the top of the file
      const filename = `content-${Date.now()}-${file.name}`
      const blobUrl = await uploadImageToBlob(file, filename)
      
      // Update the image with the blob URL
      setUploadedImages(prev => 
        prev.map(img => 
          img.id === id 
            ? { ...img, preview: blobUrl, blobUrl } 
            : img
        )
      )
      
      console.log('✅ Image uploaded to blob storage:', blobUrl)
    } catch (error) {
      console.error('❌ Failed to upload image to blob storage:', error)
      // Keep the temporary preview if upload fails
    }
  }

  const removeImage = (id: string) => {
    // Find the image to clean up its blob URL
    const imageToRemove = uploadedImages.find(img => img.id === id)
    if (imageToRemove && imageToRemove.preview.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.preview)
    }
    
    setUploadedImages(prev => prev.filter(img => img.id !== id))
    if (activeImageId === id) {
      setActiveImageId(null)
    }
  }

  const updateImageNotes = (id: string, notes: string) => {
    setUploadedImages(prev =>
      prev.map(img => (img.id === id ? { ...img, notes } : img))
    )
  }

  const updateCaption = (id: string, text: string) => {
    setCaptions(prev =>
      prev.map(cap => (cap.id === id ? { ...cap, text } : cap))
    )
  }

  const selectCaption = (id: string) => {
    setSelectedCaptions(prev => {
      if (prev.includes(id)) {
        // If clicking the already selected caption, deselect it
        return []
      } else {
        // Otherwise, select only this caption (single selection)
        return [id]
      }
    })
  }

  const generateAICaptions = async (imageId: string, notes?: string) => {
    try {
      // Find the image data
      const image = uploadedImages.find(img => img.id === imageId)
      if (!image) {
        console.error('Image not found:', imageId)
        return
      }

      // Use blob URL directly (no need to convert to base64)
      let imageData = image.blobUrl || image.preview
      if (!imageData) {
        throw new Error('No image data available for AI processing')
      }
      
      console.log('Using image data for AI:', imageData)
      console.log('Image details:', {
        id: image.id,
        filename: image.file.name,
        hasBlobUrl: !!image.blobUrl,
        previewType: image.preview.startsWith('blob:') ? 'temporary' : 'permanent'
      })

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate_captions',
          imageData: imageData,
          aiContext: notes || postNotes,
          clientId: clientId,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API response error:', response.status, errorText)
        throw new Error(`Failed to generate captions: ${response.status}`)
      }

      const data = await response.json()
      if (data.captions && Array.isArray(data.captions)) {
        // Convert the captions array to the expected format with IDs
        const newCaptions = data.captions.map((text: string, index: number) => ({
          id: `caption-${Date.now()}-${index}`,
          text: text,
          isSelected: false
        }))
        setCaptions(newCaptions)
      }
    } catch (error) {
      console.error('Error generating AI captions:', error)
    }
  }

  const remixCaption = async (captionId: string) => {
    try {
      const caption = captions.find(cap => cap.id === captionId)
      if (!caption) return

      // Find the active image for context
      const activeImage = activeImageId ? uploadedImages.find(img => img.id === activeImageId) : null

      // Use blob URL directly (no need to convert to base64)
      let imageData = ''
      if (activeImage?.blobUrl || activeImage?.preview) {
        imageData = activeImage.blobUrl || activeImage.preview
        console.log('Using image data for remix:', imageData)
      }

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'remix_caption',
          imageData: imageData,
          prompt: `Create a fresh variation of this caption while maintaining the same style, tone, and message. Keep the core meaning but rephrase it differently. Original caption: "${caption.text}"`,
          existingCaptions: captions.map(cap => cap.text),
          aiContext: postNotes,
          clientId: clientId,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API response error:', response.status, errorText)
        throw new Error(`Failed to remix caption: ${response.status}`)
      }

      const data = await response.json()
      if (data.caption) {
        // Update the existing caption with the remixed version
        setCaptions(prev => prev.map(cap => 
          cap.id === captionId ? { ...cap, text: data.caption } : cap
        ))
      }
    } catch (error) {
      console.error('Error remixing caption:', error)
    }
  }

  const clearAll = () => {
    // Clean up blob URLs before clearing
    uploadedImages.forEach(image => {
      if (image.preview.startsWith('blob:')) {
        URL.revokeObjectURL(image.preview)
      }
    })
    
    // Clear all uploaded images
    setUploadedImages([])
    
    // Clear captions to empty array
    setCaptions([])
    
    // Clear selected captions
    setSelectedCaptions([])
    
    // Clear active image
    setActiveImageId(null)
    
    // Clear post notes
    setPostNotes('')
    
    // Also clear localStorage to prevent hydration from restoring old data
    if (typeof window !== "undefined") {
      localStorage.removeItem(getStorageKey("uploadedImages"))
      localStorage.removeItem(getStorageKey("captions"))
      localStorage.removeItem(getStorageKey("selectedCaptions"))
      localStorage.removeItem(getStorageKey("activeImageId"))
      localStorage.removeItem(getStorageKey("postNotes"))
    }
  }

  const value: ContentStore = {
    clientId,
    uploadedImages,
    captions,
    selectedCaptions,
    activeImageId,
    hasHydrated,
    postNotes,
    setUploadedImages,
    setCaptions,
    setSelectedCaptions,
    setActiveImageId,
    setPostNotes,
    addImage,
    removeImage,
    updateImageNotes,
    updateCaption,
    selectCaption,
    generateAICaptions,
    remixCaption,
    clearAll,
  }

  return (
    <ContentStoreContext.Provider value={value}>
      {children}
    </ContentStoreContext.Provider>
  )
}
