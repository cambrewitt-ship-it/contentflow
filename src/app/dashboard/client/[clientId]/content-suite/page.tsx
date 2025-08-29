'use client'

import { useState, createContext, useContext, useCallback, useEffect } from 'react'
import { use } from 'react'
import { Button } from 'components/ui/button'
import { Input } from 'components/ui/input'
import { Textarea } from 'components/ui/textarea'
import { ArrowLeft, Loader2, Sparkles, RefreshCw, Plus, FolderOpen, Calendar } from 'lucide-react'
import Link from 'next/link'
import { ImageUploadColumn } from './ImageUploadColumn'
import { CaptionGenerationColumn } from './CaptionGenerationColumn'
import { SocialPreviewColumn } from './SocialPreviewColumn'
import { generateCaptionsWithAI, remixCaptionWithAI, type AICaptionResult, type AIRemixResult } from 'lib/ai-utils'

// Global store context
interface ContentStore {
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
  generateAICaptions: (imageId: string, postNotes?: string) => Promise<void>
  remixCaption: (captionId: string) => Promise<void>
}

const ContentStoreContext = createContext<ContentStore | null>(null)

const useContentStore = () => {
  const context = useContext(ContentStoreContext)
  if (!context) {
    throw new Error('useContentStore must be used within ContentStoreProvider')
  }
  return context
}

interface Caption {
  id: string
  text: string
}

interface UploadedImage {
  id: string
  file: File
  preview: string
  notes?: string
}

interface Project {
  id: string
  name: string
  description: string
  status: string
  created_at: string
  content_metadata?: any
}

interface PageProps {
  params: Promise<{ clientId: string }>
}

const getStorageKey = (key: string) => `contentflow_${key}`

// Store provider component
function ContentStoreProvider({ children, clientId }: { children: React.ReactNode; clientId: string }) {
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
        const savedImages = localStorage.getItem(
          getStorageKey("uploadedImages"),
        )
        const savedCaptions = localStorage.getItem(getStorageKey("captions"))
        const savedSelectedCaptions = localStorage.getItem(
          getStorageKey("selectedCaptions"),
        )
        const savedActiveImageId = localStorage.getItem(
          getStorageKey("activeImageId"),
        )
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
      localStorage.setItem(
        getStorageKey("uploadedImages"),
        JSON.stringify(uploadedImages),
      )
      localStorage.setItem(
        getStorageKey("captions"),
        JSON.stringify(captions),
      )
      localStorage.setItem(
        getStorageKey("selectedCaptions"),
        JSON.stringify(selectedCaptions),
      )
      localStorage.setItem(
        getStorageKey("activeImageId"),
        activeImageId || "",
      )
      localStorage.setItem(
        getStorageKey("postNotes"),
        postNotes,
      )
    }
  }, [uploadedImages, captions, selectedCaptions, activeImageId, postNotes, hasHydrated])

  // Helper function to convert blob to base64
  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Add image function
  const addImage = useCallback(async (file: File) => {
    const id = Math.random().toString(36).substr(2, 9)
    
    // Create base64 immediately
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    
    const newImage: UploadedImage = {
      id,
      file,
      preview: base64, // Store base64 instead of blob URL
      notes: "",
    }

    setUploadedImages((prev) => {
      const newImages = [...prev, newImage]
      
      // Set the first uploaded image as active
      if (newImages.length === 1) {
        setActiveImageId(newImage.id)
      }
      
      return newImages
    })
  }, [])

  // Remove image function
  const removeImage = useCallback((id: string) => {
    setUploadedImages((prev) => {
      const newImages = prev.filter((img) => img.id !== id)

      // If we're removing the active image, set a new active one
      if (activeImageId === id) {
        setActiveImageId(newImages.length > 0 ? newImages[0].id : null)
      }

      return newImages
    })
  }, [activeImageId])

  const updateImageNotes = useCallback((id: string, notes: string) => {
    setUploadedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, notes } : img)),
    )
  }, [])

  const updateCaption = useCallback((id: string, text: string) => {
    setCaptions((prev) =>
      prev.map((cap) => (cap.id === id ? { ...cap, text } : cap)),
    )
  }, [])

  const selectCaption = useCallback((id: string) => {
    // Select caption function - only allow 1 selection at a time
    setSelectedCaptions(prev =>
      prev.includes(id)
        ? [] // If clicking the same caption, deselect it
        : [id] // Otherwise, select only this caption
    )
  }, [])

  // Generate AI captions function
  const generateAICaptions = useCallback(async (imageId: string, postNotes?: string) => {
    const image = uploadedImages.find((img) => img.id === imageId)
    if (!image) return

    try {
      // Convert file to base64 for AI processing
      const base64Image = await convertBlobToBase64(image.file)
      
      const result = await generateCaptionsWithAI(
        image.file,
        [],
        postNotes || ''
      )

      if (result.success && result.captions) {
        const newCaptions: Caption[] = result.captions.map((caption, index) => ({
          id: Math.random().toString(36).substr(2, 9),
          text: caption,
        }))

        setCaptions(newCaptions)
        setSelectedCaptions([]) // Clear selection when new captions are generated
      }
    } catch (error) {
      console.error('Error generating AI captions:', error)
    }
  }, [uploadedImages, postNotes])

  // Remix caption function
  const remixCaption = useCallback(async (captionId: string) => {
    const caption = captions.find((cap) => cap.id === captionId)
    if (!caption || !activeImageId) return

    try {
      const image = uploadedImages.find((img) => img.id === activeImageId)
      if (!image) return

      // Convert file to base64 for AI processing
      const base64Image = await convertBlobToBase64(image.file)
      
      const result = await remixCaptionWithAI(
        image.file,
        caption.text,
        [],
        postNotes || ''
      )

      if (result.success && result.caption) {
        // Update the existing caption
        setCaptions((prev) =>
          prev.map((cap) =>
            cap.id === captionId ? { ...cap, text: result.caption || cap.text } : cap
          )
        )
      }
    } catch (error) {
      console.error('Error remixing caption:', error)
    }
  }, [captions, activeImageId, uploadedImages, postNotes])

  // Store object
  const store: ContentStore = {
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
    <ContentStoreContext.Provider value={store}>
      {children}
    </ContentStoreContext.Provider>
  )
}

export default function ContentSuitePage({ params }: PageProps) {
  const { clientId } = use(params)
  const [isSendingToScheduler, setIsSendingToScheduler] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

  // Fetch projects for the client
  useEffect(() => {
    async function fetchProjects() {
      if (!clientId) return
      
      try {
        setProjectsLoading(true)
        const response = await fetch(`/api/projects?clientId=${clientId}`)
        
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setProjects(data.projects)
          }
        }
      } catch (error) {
        console.error('Error fetching projects:', error)
      } finally {
        setProjectsLoading(false)
      }
    }

    if (clientId) {
      fetchProjects()
    }
  }, [clientId])

  const handleSendToScheduler = async (
    selectedCaption: string,
    uploadedImages: { preview: string; id: string; file?: File }[]
  ) => {
    // TODO: Implement scheduler functionality
    console.log('Sending to scheduler:', { selectedCaption, uploadedImages })
    setIsSendingToScheduler(true)
    
    // Simulate API call
    setTimeout(() => {
      setIsSendingToScheduler(false)
      alert('Scheduler functionality coming soon!')
    }, 1000)
  }

  return (
    <ContentStoreProvider clientId={clientId}>
      <ContentSuiteContent 
        clientId={clientId}
        projects={projects}
        projectsLoading={projectsLoading}
        setProjects={setProjects}
        handleSendToScheduler={handleSendToScheduler}
        isSendingToScheduler={isSendingToScheduler}
      />
    </ContentStoreProvider>
  )
}

// Separate component that has access to the content store context
function ContentSuiteContent({ 
  clientId, 
  projects, 
  projectsLoading, 
  setProjects,
  handleSendToScheduler,
  isSendingToScheduler 
}: {
  clientId: string
  projects: Project[]
  projectsLoading: boolean
  setProjects: (projects: Project[]) => void
  handleSendToScheduler: (selectedCaption: string, uploadedImages: { preview: string; id: string; file?: File }[]) => Promise<void>
  isSendingToScheduler: boolean
}) {
  const { uploadedImages, captions, selectedCaptions, postNotes, activeImageId } = useContentStore()

  const handleAddToProject = async (projectId: string, projectName: string) => {
    try {
      const selectedCaptionText = captions.find(c => c.id === selectedCaptions[0])?.text || '';
      
      console.log('Sending to API:', {
        project_id: projectId,
        client_id: clientId,
        caption: selectedCaptionText,
        image_url: uploadedImages[0]?.preview ? 'Has image' : 'No image',
        post_notes: uploadedImages[0]?.notes || ''
      });
      
      const response = await fetch('/api/planner/unscheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          client_id: clientId,
          caption: selectedCaptionText,
          image_url: uploadedImages[0]?.preview || '',
          post_notes: uploadedImages[0]?.notes || ''
        })
      });

      const text = await response.text();
      console.log('API Response:', response.status, text);
      
      if (!response.ok) throw new Error(`API failed: ${text}`);
      
      alert(`Added to ${projectName}!`);
    } catch (error) {
      console.error('Full error:', error);
      alert('Failed to add to project - check console');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href={`/dashboard/client/${clientId}`}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Content Suite</h1>
              <p className="text-sm text-gray-500">Create and manage your social media content</p>
            </div>
          </div>
          
          {/* Projects Quick Access */}
          <div className="flex items-center space-x-3">
            <Link
              href={`/dashboard/client/${clientId}`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              View All Projects
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* My Projects Section */}
        <div className="mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">My Projects</h2>
              <span className="text-sm text-gray-500">
                {projectsLoading ? 'Loading...' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            
            {projectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading projects...</span>
              </div>
            ) : projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {project.name}
                        </h3>
                        {project.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        <div className="flex items-center mt-2 text-xs text-gray-400">
                          <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                          {project.content_metadata?.posts && project.content_metadata.posts.length > 0 && (
                            <span className="ml-2">
                              • {project.content_metadata.posts.length} post{project.content_metadata.posts.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/dashboard/client/${clientId}/planner?projectId=${project.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Calendar className="w-3 h-3 mr-1.5" />
                          Planner
                        </Link>
                                                   <button
                             onClick={(e) => {
                               e.stopPropagation();
                               handleAddToProject(project.id, project.name);
                             }}
                             className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                             title="Add current content to this project"
                           >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No projects yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Save your first content to create a project
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1: Image Upload */}
          <ImageUploadColumn />

          {/* Column 2: Caption Generation */}
          <CaptionGenerationColumn />

          {/* Column 3: Social Preview */}
          <SocialPreviewColumn
            clientId={clientId}
            handleSendToScheduler={handleSendToScheduler}
            isSendingToScheduler={isSendingToScheduler}
          />
        </div>
      </div>
    </div>
  )
}

// Export the hook and types for use in other components
export { useContentStore, type Caption, type UploadedImage }
