'use client'

import React from 'react'
import { createContext, useContext, useState, useEffect } from 'react'
import { uploadMediaToBlob, getMediaType } from './blobUpload'
import logger from './logger'

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
  mediaType?: 'image' | 'video'
  mimeType?: string
  videoThumbnail?: string // Thumbnail image for videos (first frame)
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
  mediaType?: 'image' | 'video'
  mimeType?: string
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
  generateAICaptions: (imageId: string, notes?: string, copyType?: 'social-media' | 'email-marketing', accessToken?: string) => Promise<void>
  remixCaption: (captionId: string, accessToken?: string) => Promise<void>
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

// Helper function to extract first frame from video as thumbnail
const extractVideoThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      reject(new Error('Could not get canvas context'))
      return
    }
    
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    
    video.onloadedmetadata = () => {
      // Set canvas size to video dimensions
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      // Seek to first frame
      video.currentTime = 0
    }
    
    video.onseeked = () => {
      // Draw the current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Convert canvas to data URL
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8)
      
      // Clean up
      URL.revokeObjectURL(video.src)
      
      resolve(thumbnail)
    }
    
    video.onerror = () => {
      reject(new Error('Failed to load video'))
    }
    
    // Create blob URL from file
    video.src = URL.createObjectURL(file)
  })
}

// Helper functions to convert between UploadedImage and SerializableUploadedImage
const toSerializable = (image: UploadedImage): SerializableUploadedImage => ({
  id: image.id,
  filename: image.file.name,
  preview: image.preview,
  blobUrl: image.blobUrl,
  notes: image.notes,
  size: image.file.size,
  type: image.file.type,
  mediaType: image.mediaType,
  mimeType: image.mimeType
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
    notes: serializable.notes,
    mediaType: serializable.mediaType,
    mimeType: serializable.mimeType
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
          logger.warn("localStorage approaching quota limit, cleaning up...")
          
          // Clear old image metadata first
          localStorage.removeItem(getStorageKey("imageMetadata"))
          
          // If still too large, clear everything except essential data
          if (JSON.stringify(localStorage).length > maxSize * 0.9) {
            logger.warn("localStorage still too large, clearing all data...")
            localStorage.clear()
          }
        }
      } catch (error) {
        logger.error("Error during localStorage cleanup:", error)
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

        }

        setHasHydrated(true)
      } catch (error) {
        logger.error("Error hydrating from localStorage:", error)
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
        
        // For media (images/videos), only save metadata (not the actual file data)
        const imageMetadata = uploadedImages.map(img => ({
          id: img.id,
          filename: img.file.name,
          size: img.file.size,
          type: img.file.type,
          notes: img.notes,
          hasBlobUrl: !!img.blobUrl,
          mediaType: img.mediaType,
          mimeType: img.mimeType
        }))
        localStorage.setItem(getStorageKey("imageMetadata"), JSON.stringify(imageMetadata))
      } catch (error) {
        logger.error("Error saving to localStorage:", error)
        // If we hit quota issues, clear old data and try again
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          logger.warn("localStorage quota exceeded, clearing old data...")
          try {
            localStorage.clear()
            // Retry saving essential data only
            localStorage.setItem(getStorageKey("captions"), JSON.stringify(captions))
            localStorage.setItem(getStorageKey("selectedCaptions"), JSON.stringify(selectedCaptions))
            localStorage.setItem(getStorageKey("activeImageId"), activeImageId || "")
            localStorage.setItem(getStorageKey("postNotes"), postNotes)
            
            // Show user-friendly notification
            if (typeof window !== "undefined") {

            }
          } catch (retryError) {
            logger.error("Failed to save after clearing localStorage:", retryError)
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
    
    // Cleanup on unmount only (not on every uploadedImages change)
    return () => {
      clearInterval(cleanupInterval)
      // Clean up only temporary blob URLs when component unmounts
      // (permanent Vercel Blob URLs should not be revoked)
      uploadedImages.forEach(image => {
        if (image.preview.startsWith('blob:http')) {
          URL.revokeObjectURL(image.preview)
        }
      })
    }
  }, []) // Empty dependency array - only run on mount/unmount

  const addImage = async (file: File) => {
    const id = `media-${Date.now()}`
    const detectedType = getMediaType(file)
    const mediaType = detectedType === 'unknown' ? undefined : detectedType
    const isVideo = mediaType === 'video'
    
    // For videos, extract first frame as thumbnail
    let previewUrl: string
    let videoThumbnail: string | undefined
    
    if (isVideo) {
      try {

        videoThumbnail = await extractVideoThumbnail(file)
        previewUrl = videoThumbnail // Use thumbnail as preview

      } catch (error) {
        logger.error('❌ Failed to extract video thumbnail:', error)
        // Fallback to temp blob URL if thumbnail extraction fails
        previewUrl = URL.createObjectURL(file)
      }
    } else {
      // For images, use the standard blob URL
      previewUrl = URL.createObjectURL(file)
    }
    
    // Create initial media entry with preview
    const newImage: UploadedImage = { 
      id, 
      file, 
      preview: previewUrl, 
      mediaType,
      mimeType: file.type,
      videoThumbnail: videoThumbnail
    }
    setUploadedImages(prev => [...prev, newImage])
    setActiveImageId(id)
    
    try {
      // Upload to blob storage (now supports both images and videos)
      const filename = `content-${Date.now()}-${file.name}`
      const uploadResult = await uploadMediaToBlob(file, filename)
      
      // Clean up temporary blob URL if we used one (images only, thumbnails are base64)
      if (!isVideo || !videoThumbnail) {
        URL.revokeObjectURL(previewUrl)
      }
      
      // Update the media entry with the blob URL and confirmed media type
      setUploadedImages(prev => 
        prev.map(img => 
          img.id === id 
            ? { 
                ...img, 
                blobUrl: uploadResult.url,
                mediaType: uploadResult.mediaType,
                mimeType: uploadResult.mimeType,
                // Keep the thumbnail for videos, update preview for images
                preview: isVideo ? (img.videoThumbnail || uploadResult.url) : uploadResult.url
              } 
            : img
        )
      )

    } catch (error) {
      logger.error('❌ Failed to upload media to blob storage:', error)
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

  const generateAICaptions = async (imageId: string, notes?: string, copyType?: 'social-media' | 'email-marketing', accessToken?: string) => {
    try {
      // Find the image data
      const image = uploadedImages.find(img => img.id === imageId)
      if (!image) {
        logger.error('Image not found:', imageId)
        return
      }

      const isVideo = image.mediaType === 'video'

      // For videos: DON'T send video data (AI can't analyze videos)
      // For images: Convert blob URL to base64 for OpenAI Vision API
      let imageData = ''
      
      if (isVideo) {
        // For videos, we send an empty string or a placeholder since the API won't use it anyway
        // The API route will detect this is a video from the request and skip visual analysis
        imageData = 'VIDEO_PLACEHOLDER' // Placeholder to indicate video content
      } else {
        // IMAGES ONLY: Convert blob URL to base64 data URL for OpenAI API
        imageData = image.blobUrl || image.preview
        if (!imageData) {
          throw new Error('No image data available for AI processing')
        }

        // If it's a blob URL, convert it to base64
        if (imageData.startsWith('blob:')) {

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
      }
      
      // Check image data size (base64 encoded images can be quite large)
      // Note: Videos send a placeholder, so we only check size for images
      if (!isVideo && imageData !== 'VIDEO_PLACEHOLDER') {
        const imageSizeMB = (imageData.length / (1024 * 1024)).toFixed(2)

        if (imageData.length > 5 * 1024 * 1024) { // 5MB limit for single image
          throw new Error(`Image is too large (${imageSizeMB}MB). Please use an image smaller than 5MB.`)
        }
      }

      if (!accessToken) {
        throw new Error('Access token is required for AI caption generation')
      }

      // Build the request body
      const requestBody = {
        action: 'generate_captions',
        imageData: imageData,
        aiContext: notes || postNotes,
        clientId: clientId,
        copyType: copyType || 'social-media',
        copyTone: copyTone,
        postNotesStyle: notesInterpretation,
        imageFocus: contentFocus,
      }

      const bodyString = JSON.stringify(requestBody)
      const bodySizeMB = (bodyString.length / (1024 * 1024)).toFixed(2)

      if (bodyString.length > 10 * 1024 * 1024) {
        logger.warn('⚠️ Large request body detected:', bodySizeMB, 'MB')
      }

      let response
      try {
        response = await fetch('/api/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: bodyString,
          signal: AbortSignal.timeout(120000) // 2 minute timeout
        })
      } catch (fetchError) {
        logger.error('❌ Fetch failed at network level')
        logger.error('Fetch error details:', {
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          name: fetchError instanceof Error ? fetchError.name : 'Unknown',
          stack: fetchError instanceof Error ? fetchError.stack : 'No stack trace',
          errorType: typeof fetchError,
          isTimeoutError: fetchError instanceof Error && fetchError.name === 'TimeoutError',
          isAbortError: fetchError instanceof Error && fetchError.name === 'AbortError',
          isTypeError: fetchError instanceof TypeError
        })
        
        // Provide specific error message based on error type
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timeout - AI processing took too long. Try with a smaller image or simpler request.')
        } else if (fetchError instanceof TypeError && fetchError.message === 'Failed to fetch') {
          throw new Error('Network error - unable to reach AI service. Check your internet connection or try again.')
        } else {
          throw new Error(`Network error while contacting AI service: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('API response error:', response.status, errorText)
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
      } else {
        logger.error('No captions in response or not an array:', data)
      }
    } catch (error) {
      logger.error('Error generating AI captions:', error)
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      if (errorMessage.includes('too large')) {
        alert(errorMessage + '\n\nTip: You can compress your image before uploading using online tools.')
      } else if (errorMessage.includes('Network error') || errorMessage.includes('Failed to fetch')) {
        alert('Unable to connect to AI service. This could be due to:\n\n' +
          '1. Network connectivity issues\n' +
          '2. Image file too large (try a smaller image)\n' +
          '3. Server timeout (AI processing taking too long)\n\n' +
          'Please try again with a smaller image or check your connection.')
      } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
        alert('Authentication error. Please refresh the page and try again.')
      } else {
        alert('Failed to generate captions: ' + errorMessage + '\n\nPlease try again or contact support if the issue persists.')
      }
      
      throw error // Re-throw to allow caller to handle if needed
    }
  }

  const remixCaption = async (captionId: string, accessToken?: string) => {
    try {
      const caption = captions.find(cap => cap.id === captionId)
      if (!caption) return

      // Find the active image for context
      const activeImage = activeImageId ? uploadedImages.find(img => img.id === activeImageId) : null

      // Use blob URL directly (no need to convert to base64)
      let imageData = ''
      if (activeImage?.blobUrl || activeImage?.preview) {
        imageData = activeImage.blobUrl || activeImage.preview

      }

      if (!accessToken) {
        throw new Error('Access token is required for AI remix')
      }

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
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
        logger.error('API response error:', response.status, errorText)
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
      logger.error('Error remixing caption:', error)
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

      } catch (error) {
        logger.error("Error clearing storage:", error)
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
