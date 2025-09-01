'use client'

import React from 'react'
import { createContext, useContext, useState, useEffect } from 'react'

export interface Caption {
  id: string
  text: string
}

export interface UploadedImage {
  id: string
  file: File
  preview: string
  notes?: string
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
  addImage: (file: File) => void
  removeImage: (id: string) => void
  updateImageNotes: (id: string, notes: string) => void
  updateCaption: (id: string, text: string) => void
  selectCaption: (id: string) => void
  generateAICaptions: (imageId: string, notes?: string) => Promise<void>
  remixCaption: (captionId: string) => Promise<void>
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
          const parsedImages = JSON.parse(savedImages)
          setUploadedImages(parsedImages)
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
      localStorage.setItem(getStorageKey("uploadedImages"), JSON.stringify(uploadedImages))
      localStorage.setItem(getStorageKey("captions"), JSON.stringify(captions))
      localStorage.setItem(getStorageKey("selectedCaptions"), JSON.stringify(selectedCaptions))
      localStorage.setItem(getStorageKey("activeImageId"), activeImageId || "")
      localStorage.setItem(getStorageKey("postNotes"), postNotes)
    }
  }, [hasHydrated, uploadedImages, captions, selectedCaptions, activeImageId, postNotes])

  const addImage = (file: File) => {
    const id = `img-${Date.now()}`
    const preview = URL.createObjectURL(file)
    const newImage: UploadedImage = { id, file, preview }
    setUploadedImages(prev => [...prev, newImage])
    setActiveImageId(id)
  }

  const removeImage = (id: string) => {
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

      // Convert blob URL to base64 if needed
      let imageData = image.preview
      if (image.preview.startsWith('blob:')) {
        try {
          console.log('Converting blob URL to base64...')
          const response = await fetch(image.preview)
          const blob = await response.blob()
          const reader = new FileReader()
          
          imageData = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          
          console.log('Successfully converted to base64, length:', imageData.length)
        } catch (error) {
          console.error('Failed to convert blob URL to base64:', error)
          throw new Error('Failed to process image for AI')
        }
      }

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

      // Convert blob URL to base64 if needed
      let imageData = ''
      if (activeImage?.preview) {
        if (activeImage.preview.startsWith('blob:')) {
          try {
            console.log('Converting blob URL to base64 for remix...')
            const response = await fetch(activeImage.preview)
            const blob = await response.blob()
            const reader = new FileReader()
            
            imageData = await new Promise((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
            
            console.log('Successfully converted to base64 for remix, length:', imageData.length)
          } catch (error) {
            console.error('Failed to convert blob URL to base64 for remix:', error)
            // Continue without image data rather than failing completely
          }
        } else {
          imageData = activeImage.preview
        }
      }

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'remix_caption',
          imageData: imageData,
          prompt: `Please remix this caption: "${caption.text}"`,
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
  }

  return (
    <ContentStoreContext.Provider value={value}>
      {children}
    </ContentStoreContext.Provider>
  )
}
