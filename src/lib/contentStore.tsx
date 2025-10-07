'use client'

import React from 'react'
import { createContext, useContext, useState, useEffect } from 'react'
import { uploadImageToBlob } from './blobUpload'

export interface Caption {
  id: string
  text: string
}

export interface ContentIdea {
  idea: string
  angle: string
  visualSuggestion: string
  timing: string
  holidayConnection?: string
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
export type NotesInterpretation = 'quote-directly' | 'paraphrase' | 'use-as-inspiration'
export type ContentFocus = 'main-focus' | 'supporting' | 'background' | 'none'
export type CopyTone = 'promotional' | 'educational' | 'personal' | 'testimonial' | 'engagement'

export interface ContentStore {
  clientId: string
  uploadedImages: UploadedImage[]
  captions: Caption[]
  selectedCaptions: string[]
  activeImageId: string | null
  hasHydrated: boolean
  postNotes: string
  notesInterpretation: NotesInterpretation
  contentFocus: ContentFocus
  copyTone: CopyTone
  copyType: 'social-media' | 'email-marketing'
  contentIdeas: ContentIdea[]
  setUploadedImages: (images: UploadedImage[]) => void
  setCaptions: (captions: Caption[]) => void
  setSelectedCaptions: (captions: string[]) => void
  setActiveImageId: (id: string | null) => void
  setPostNotes: (notes: string) => void
  setNotesInterpretation: (interpretation: NotesInterpretation) => void
  setContentFocus: (focus: ContentFocus) => void
  setCopyTone: (tone: CopyTone) => void
  setCopyType: (copyType: 'social-media' | 'email-marketing') => void
  setContentIdeas: (ideas: ContentIdea[]) => void
  addImage: (file: File) => Promise<void>
  removeImage: (id: string) => void
  updateImageNotes: (id: string, notes: string) => void
  updateCaption: (id: string, text: string) => void
  selectCaption: (id: string) => void
  generateAICaptions: (imageId: string, notes?: string, copyType?: 'social-media' | 'email-marketing') => Promise<void>
  remixCaption: (captionId: string) => Promise<void>
  clearAll: () => void
  clearStorageOnly: () => void
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
  const [notesInterpretation, setNotesInterpretation] = useState<NotesInterpretation>('quote-directly')
  const [contentFocus, setContentFocus] = useState<ContentFocus>('main-focus')
  const [copyTone, setCopyTone] = useState<CopyTone>('promotional')
  const [copyType, setCopyType] = useState<'social-media' | 'email-marketing'>('social-media')
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([])

  // Track if we've hydrated from localStorage
  const [hasHydrated, setHasHydrated] = useState(false)

  // Function to check and clean up localStorage if it's getting full
  const cleanupLocalStorage = () => {
    if (typeof window !== "undefined") {
      try {
        // Check if we're approaching quota limits
        const used = JSON.stringify(localStorage).length
        const maxSize = 5 * 1024 * 1024 // 5MB limit
        
        if (used > maxSize * 0.8) { // If we're using more than 80% of quota
          console.warn("localStorage approaching quota limit, cleaning up...")
          
          // Clear old image metadata first
          localStorage.removeItem(getStorageKey("imageMetadata"))
          
          // If still too large, clear everything except essential data
          if (JSON.stringify(localStorage).length > maxSize * 0.9) {
            console.warn("localStorage still too large, clearing all data...")
            localStorage.clear()
          }
        }
      } catch (error) {
        console.error("Error during localStorage cleanup:", error)
      }
    }
  }

  // Hydrate from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined" && !hasHydrated) {
      try {
        const savedCaptions = localStorage.getItem(getStorageKey("captions"))
        const savedSelectedCaptions = localStorage.getItem(getStorageKey("selectedCaptions"))
        const savedActiveImageId = localStorage.getItem(getStorageKey("activeImageId"))
        const savedPostNotes = localStorage.getItem(getStorageKey("postNotes"))
        const savedNotesInterpretation = localStorage.getItem(getStorageKey("notesInterpretation"))
        const savedContentFocus = localStorage.getItem(getStorageKey("contentFocus"))
        const savedCopyTone = localStorage.getItem(getStorageKey("copyTone"))
        const savedImageMetadata = localStorage.getItem(getStorageKey("imageMetadata"))

        // Restore non-image data
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
        if (savedNotesInterpretation) {
          setNotesInterpretation(savedNotesInterpretation as NotesInterpretation)
        }
        if (savedContentFocus) {
          setContentFocus(savedContentFocus as ContentFocus)
        }
        if (savedCopyTone) {
          setCopyTone(savedCopyTone as CopyTone)
        }

        // For images, we'll start with an empty array since we can't restore the actual image data
        // Users will need to re-upload images, but their captions and other data will be preserved
        if (savedImageMetadata) {
          console.log("Found image metadata in localStorage, but images need to be re-uploaded")
        }

        setHasHydrated(true)
      } catch (error) {
        console.error("Error hydrating from localStorage:", error)
        setHasHydrated(true)
      }
    }
  }, [hasHydrated])

  // Save to localStorage whenever state changes (but not images to avoid quota issues)
  useEffect(() => {
    if (hasHydrated) {
      try {
        // Only save non-image data to localStorage to avoid quota issues
        localStorage.setItem(getStorageKey("captions"), JSON.stringify(captions))
        localStorage.setItem(getStorageKey("selectedCaptions"), JSON.stringify(selectedCaptions))
        localStorage.setItem(getStorageKey("activeImageId"), activeImageId || "")
        localStorage.setItem(getStorageKey("postNotes"), postNotes)
        localStorage.setItem(getStorageKey("notesInterpretation"), notesInterpretation)
        localStorage.setItem(getStorageKey("contentFocus"), contentFocus)
        localStorage.setItem(getStorageKey("copyTone"), copyTone)
        
        // For images, only save metadata (not the actual image data)
        const imageMetadata = uploadedImages.map(img => ({
          id: img.id,
          filename: img.file.name,
          size: img.file.size,
          type: img.file.type,
          notes: img.notes,
          hasBlobUrl: !!img.blobUrl
        }))
        localStorage.setItem(getStorageKey("imageMetadata"), JSON.stringify(imageMetadata))
      } catch (error) {
        console.error("Error saving to localStorage:", error)
        // If we hit quota issues, clear old data and try again
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn("localStorage quota exceeded, clearing old data...")
          try {
            localStorage.clear()
            // Retry saving essential data only
            localStorage.setItem(getStorageKey("captions"), JSON.stringify(captions))
            localStorage.setItem(getStorageKey("selectedCaptions"), JSON.stringify(selectedCaptions))
            localStorage.setItem(getStorageKey("activeImageId"), activeImageId || "")
            localStorage.setItem(getStorageKey("postNotes"), postNotes)
            
            // Show user-friendly notification
            if (typeof window !== "undefined") {
              console.info("💾 Storage cleared to free up space. Your captions and settings have been preserved.")
            }
          } catch (retryError) {
            console.error("Failed to save after clearing localStorage:", retryError)
          }
        }
      }
    }
  }, [hasHydrated, captions, selectedCaptions, activeImageId, postNotes, notesInterpretation, contentFocus, copyTone, uploadedImages])

  // Cleanup localStorage periodically and on unmount
  useEffect(() => {
    // Run cleanup immediately
    cleanupLocalStorage()
    
    // Set up periodic cleanup every 5 minutes
    const cleanupInterval = setInterval(cleanupLocalStorage, 5 * 60 * 1000)
    
    // Cleanup on unmount
    return () => {
      clearInterval(cleanupInterval)
      // Clean up blob URLs when component unmounts
      uploadedImages.forEach(image => {
        if (image.preview.startsWith('blob:')) {
          URL.revokeObjectURL(image.preview)
        }
      })
    }
  }, [uploadedImages])

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

  const generateAICaptions = async (imageId: string, notes?: string, copyType?: 'social-media' | 'email-marketing') => {
    try {
      // Find the image data
      const image = uploadedImages.find(img => img.id === imageId)
      if (!image) {
        console.error('Image not found:', imageId)
        return
      }

      // Convert blob URL to base64 data URL for OpenAI API
      let imageData = image.blobUrl || image.preview
      if (!imageData) {
        throw new Error('No image data available for AI processing')
      }

      // If it's a blob URL, convert it to base64
      if (imageData.startsWith('blob:')) {
        console.log('Converting blob URL to base64 for OpenAI API...')
        const response = await fetch(imageData)
        const blob = await response.blob()
        
        // Convert blob to base64 data URL
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
        })
        reader.readAsDataURL(blob)
        imageData = await base64Promise
      }
      
      console.log('Using image data for AI:', imageData.substring(0, 100) + '...')
      console.log('Image details:', {
        id: image.id,
        filename: image.file.name,
        hasBlobUrl: !!image.blobUrl,
        previewType: image.preview.startsWith('blob:') ? 'temporary' : 'permanent',
        dataType: imageData.startsWith('data:') ? 'base64' : 'url'
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
          copyType: copyType || 'social-media',
          copyTone: copyTone,
          postNotesStyle: notesInterpretation,
          imageFocus: contentFocus,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API response error:', response.status, errorText)
        throw new Error(`Failed to generate captions: ${response.status}`)
      }

      const data = await response.json()
      console.log('API Response:', data)
      console.log('Copy Type:', copyType)
      
      if (data.captions && Array.isArray(data.captions)) {
        console.log('Captions received:', data.captions)
        // Convert the captions array to the expected format with IDs
        const newCaptions = data.captions.map((text: string, index: number) => ({
          id: `caption-${Date.now()}-${index}`,
          text: text,
          isSelected: false
        }))
        console.log('New captions to set:', newCaptions)
        setCaptions(newCaptions)
      } else {
        console.error('No captions in response or not an array:', data)
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
    
    // Reset notes interpretation to default
    setNotesInterpretation('quote-directly')
    
    // Reset content focus to default
    setContentFocus('main-focus')
    
    // Reset copy tone to default
    setCopyTone('promotional')
    
    // Also clear localStorage to prevent hydration from restoring old data
    if (typeof window !== "undefined") {
      localStorage.removeItem(getStorageKey("imageMetadata"))
      localStorage.removeItem(getStorageKey("captions"))
      localStorage.removeItem(getStorageKey("selectedCaptions"))
      localStorage.removeItem(getStorageKey("activeImageId"))
      localStorage.removeItem(getStorageKey("postNotes"))
      localStorage.removeItem(getStorageKey("notesInterpretation"))
      localStorage.removeItem(getStorageKey("contentFocus"))
      localStorage.removeItem(getStorageKey("copyTone"))
    }
  }

  const clearStorageOnly = () => {
    // Clear only localStorage without affecting current state
    if (typeof window !== "undefined") {
      try {
        localStorage.clear()
        console.info("💾 Storage cleared successfully")
      } catch (error) {
        console.error("Error clearing storage:", error)
      }
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
    notesInterpretation,
    contentFocus,
    copyTone,
    copyType,
    contentIdeas,
    setUploadedImages,
    setCaptions,
    setSelectedCaptions,
    setActiveImageId,
    setPostNotes,
    setNotesInterpretation,
    setContentFocus,
    setCopyTone,
    setCopyType,
    setContentIdeas,
    addImage,
    removeImage,
    updateImageNotes,
    updateCaption,
    selectCaption,
    generateAICaptions,
    remixCaption,
    clearAll,
    clearStorageOnly,
  }

  return (
    <ContentStoreContext.Provider value={value}>
      {children}
    </ContentStoreContext.Provider>
  )
}
