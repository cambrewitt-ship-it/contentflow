'use client'

import { useState, useCallback, useEffect } from 'react'
import { use } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { ArrowLeft, Loader2, Plus, Calendar, Edit3, X, User, Settings, ChevronDown, Lightbulb, Clock, RefreshCw, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { MediaUploadColumn } from './MediaUploadColumn'
import { CaptionGenerationColumn } from './CaptionGenerationColumn'
import { SocialPreviewColumn } from './SocialPreviewColumn'
import { ContentIdeasColumn } from './ContentIdeasColumn'
import { ContentStoreProvider } from '@/lib/contentStore'
import { useAuth } from '@/contexts/AuthContext'

interface Project {
  id: string
  name: string
  description: string
  status: string
  created_at: string
  content_metadata?: {
    posts?: Array<{
      id: string;
      images?: Array<{
        id: string;
        notes?: string;
        preview: string;
      }>;
      captions?: Array<{
        id: string;
        text: string;
        isSelected: boolean;
      }>;
      selectedCaption?: string;
      postNotes?: string;
      activeImageId?: string;
      createdAt?: string;
    }>;
  };
}

interface Client {
  id: string
  name: string
  logo_url?: string
}

interface PageProps {
  params: Promise<{ clientId: string }>
}

import { useContentStore } from '@/lib/contentStore'

export default function ContentSuitePage({ params }: PageProps) {
  const { clientId } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { getAccessToken } = useAuth()
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<any>(null)
  const [loadingPost, setLoadingPost] = useState(false)
  const [updatingPost, setUpdatingPost] = useState(false)
  
  // Existing state
  const [isSendingToScheduler, setIsSendingToScheduler] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null) // For tagging posts with project
  const [addingToProject, setAddingToProject] = useState<string | null>(null)
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)
  const [preloadedContent, setPreloadedContent] = useState<{
    image: string;
    notes: string;
    fileName: string;
    uploadId: string | null;
    scheduledDate?: string;
    scheduledTime?: string;
  } | null>(null)
  
  // Client state
  const [client, setClient] = useState<Client | null>(null)
  const [clientLoading, setClientLoading] = useState(true)
  const [clientRetryCount, setClientRetryCount] = useState(0)

  // Fetch client data
  const fetchClient = useCallback(async () => {
    if (!clientId) return
    
    try {
      setClientLoading(true)
      const accessToken = getAccessToken()
      
      if (!accessToken) {
        if (clientRetryCount < 5) { // Maximum 5 retries
          console.log(`⏳ Access token not ready yet, retry ${clientRetryCount + 1}/5...`)
          setClientRetryCount(prev => prev + 1)
          setTimeout(() => {
            fetchClient()
          }, 1000) // Retry after 1 second
          return
        } else {
          console.warn('⚠️ Max retries reached for access token, proceeding without client data')
          setClient(null)
          setClientLoading(false)
          return
        }
      }

      // Reset retry count on successful access token retrieval
      setClientRetryCount(0)

      const response = await fetch(`/api/clients/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch client: ${response.statusText}`)
      }

      const data = await response.json()
      setClient(data.client)
      console.log('✅ Client data fetched:', data.client)
      console.log('🔍 Client logo URL:', data.client?.logo_url)
      
    } catch (error) {
      console.error('❌ Error fetching client:', error)
      // Set client to null on error so the component can still render
      setClient(null)
    } finally {
      setClientLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, clientRetryCount, getAccessToken])

  // Fetch post data for editing
  const fetchPostForEditing = useCallback(async (postId: string) => {
    if (!clientId) return
    
    try {
      setLoadingPost(true)
      console.log('🔍 Fetching post for editing:', postId)
      
      const response = await fetch(`/api/posts-by-id/${postId}?client_id=${clientId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Post not found')
        }
        throw new Error(`Failed to fetch post: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.post) {
        setEditingPost(data.post)
        console.log('✅ Post fetched for editing:', data.post)
      } else {
        throw new Error('No post data received')
      }
    } catch (error) {
      console.error('❌ Error fetching post for editing:', error)
      alert(`Failed to load post for editing: ${error instanceof Error ? error.message : String(error)}`)
      // Redirect back to calendar on error
      router.push(`/dashboard/client/${clientId}/calendar`)
    } finally {
      setLoadingPost(false)
    }
  }, [clientId, router])

  // Fetch projects for the client
  useEffect(() => {
    async function fetchProjects() {
      if (!clientId) return
      
      try {
        setProjectsLoading(true)
        const response = await fetch(`/api/projects?clientId=${clientId}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status}`)
        }
        
        const data = await response.json()
        if (data.success) {
          setProjects(data.projects)
        } else {
          throw new Error(data.error || 'Failed to load projects')
        }
      } catch (error) {
        console.error('Error fetching projects:', error)
        // Could add error state here if needed
      } finally {
        setProjectsLoading(false)
      }
    }

    if (clientId) {
      fetchProjects()
    }
  }, [clientId])

  // Fetch client data when clientId changes
  useEffect(() => {
    setClientRetryCount(0) // Reset retry count when clientId changes
    fetchClient()
  }, [clientId, fetchClient])

  // Check for editPostId URL parameter
  useEffect(() => {
    const editPostId = searchParams?.get('editPostId')
    if (editPostId) {
      setEditingPostId(editPostId)
      setIsEditing(true)
      fetchPostForEditing(editPostId)
    }
  }, [searchParams, clientId, fetchPostForEditing])

  // Check for content inbox pre-load parameters
  useEffect(() => {
    const uploadId = searchParams?.get('uploadId')
    
    if (uploadId) {
      // Try to get preloaded content from sessionStorage first
      const storedContent = sessionStorage.getItem('preloadedContent')
      if (storedContent) {
        try {
          const imageData = JSON.parse(storedContent)
          console.log('🔄 Pre-loading content from sessionStorage:', imageData)
          setPreloadedContent({
            image: imageData.image,
            notes: imageData.notes || '',
            fileName: imageData.fileName,
            uploadId: imageData.uploadId || uploadId,
            scheduledDate: imageData.scheduledDate,
            scheduledTime: imageData.scheduledTime
          })
          // Clear the sessionStorage after use
          sessionStorage.removeItem('preloadedContent')
          return
        } catch (error) {
          console.error('Error parsing stored content:', error)
        }
      }
      
      // Fallback to URL parameters (for backward compatibility)
      const image = searchParams?.get('image')
      const notes = searchParams?.get('notes')
      const fileName = searchParams?.get('fileName')
      
      if (image && fileName) {
        console.log('🔄 Pre-loading content from URL params:', { image, notes, fileName, uploadId })
        setPreloadedContent({
          image,
          notes: notes || '',
          fileName,
          uploadId: uploadId || null
        })
      }
    }
  }, [searchParams])

  // Create new project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      setCreatingProject(true)
      const accessToken = getAccessToken()
      
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          name: newProjectName.trim(),
          description: newProjectDescription.trim()
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.statusText}`)
      }
      
      const data = await response.json()
      if (data.success) {
        setProjects(prev => [data.project, ...prev])
        setSelectedProjectId(data.project.id) // Auto-select the newly created project
        setNewProjectName("")
        setNewProjectDescription("")
        setShowNewProjectForm(false)
        console.log('✅ Project created successfully:', data.project)
      } else {
        throw new Error(data.error || 'Failed to create project')
      }
    } catch (err) {
      console.error('❌ Error creating project:', err)
      alert(`Failed to create project: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCreatingProject(false)
    }
  }

  // Handle updating an existing post
  const handleUpdatePost = async (
    selectedCaption: string,
    uploadedImages: { preview: string; id: string; file?: File }[]
  ) => {
    if (!editingPostId || !clientId) return
    
    try {
      setUpdatingPost(true)
      console.log('🔄 Updating post:', editingPostId)
      
      // Get the actual caption from content store if selectedCaption is empty
      const finalCaption = selectedCaption?.trim() || editingPost?.caption || ''
      
      if (!finalCaption.trim()) {
        throw new Error('Caption is required to update the post')
      }
      
      console.log('📝 Final caption for update:', finalCaption)
      
      // Handle image conversion from base64 to blob URL if needed
      let imageUrl = uploadedImages[0]?.preview || editingPost?.image_url
      
      console.log('🔍 Image URL type check:', {
        hasImage: !!imageUrl,
        isBase64: imageUrl?.startsWith('data:image/'),
        isBlob: imageUrl?.startsWith('blob:'),
        isHttps: imageUrl?.startsWith('https://'),
        length: imageUrl?.length,
        preview: imageUrl?.substring(0, 100) + '...'
      })
      
      if (imageUrl && imageUrl.startsWith('data:image/')) {
        console.log('🔄 Converting base64 image to blob URL...')
        try {
          // Extract MIME type from base64 string
          const mimeType = imageUrl.match(/data:([^;]+)/)?.[1] || 'image/jpeg'
          console.log('📝 Detected MIME type:', mimeType)
          
          // Upload to Vercel Blob via API
          const filename = `post-${editingPostId}-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`
          console.log('📤 Uploading to blob with filename:', filename)
          
          const accessToken = getAccessToken()
          
          const uploadResponse = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              imageData: imageUrl,
              filename: filename
            })
          })
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json()
            imageUrl = uploadResult.url
            console.log('✅ Image converted to blob URL:', imageUrl)
          } else {
            const errorData = await uploadResponse.json()
            console.error('❌ Upload failed:', errorData)
            throw new Error(errorData.error || 'Upload failed')
          }
        } catch (error) {
          console.error('❌ Error converting image:', error)
          console.warn('⚠️ Using original image URL')
        }
      } else {
        console.log('ℹ️ Image is not base64, using as-is:', imageUrl?.substring(0, 100))
      }
      
      // Prepare the update data
      const updateData = {
        client_id: clientId,
        edited_by_user_id: clientId, // Using clientId as user ID for now
        caption: finalCaption,
        image_url: imageUrl,
        platforms: ['instagram', 'facebook', 'twitter'], // Default platforms
        edit_reason: 'Updated via content suite',
        // Only include media_type for main posts table, not calendar tables
        ...(editingPost?.scheduled_date ? {} : { media_type: 'image' }),
        // Include AI settings if available
        ai_settings: editingPost?.ai_settings || {},
        // Include tags and categories if available
        tags: editingPost?.tags || [],
        categories: editingPost?.categories || []
      }
      
      const response = await fetch(`/api/posts-by-id/${editingPostId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to update post: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('✅ Post updated successfully:', data)
      
      // Redirect back to calendar with success message and refresh flag
      router.push(`/dashboard/client/${clientId}/calendar?projectId=${editingPost?.project_id}&success=Post updated successfully&refresh=true`)
      
    } catch (error) {
      console.error('❌ Error updating post:', error)
      alert(`Failed to update post: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setUpdatingPost(false)
    }
  }

  // Handle canceling edit
  const handleCancelEdit = () => {
    if (editingPost?.project_id) {
      router.push(`/dashboard/client/${clientId}/calendar?projectId=${editingPost.project_id}`)
    } else {
      router.push(`/dashboard/client/${clientId}/calendar`)
    }
  }

  const handleSendToScheduler = async (
    selectedCaption: string,
    uploadedImages: { preview: string; id: string; file?: File }[]
  ) => {
    // If editing, update the post instead of sending to scheduler
    if (isEditing) {
      await handleUpdatePost(selectedCaption, uploadedImages)
      return
    }
    
    console.log('Adding to calendar - caption length:', selectedCaption?.length || 0, 'images count:', uploadedImages.length, 'project_id:', selectedProjectId)
    
    // Validate we have required content
    if (!selectedCaption || selectedCaption.trim() === '') {
      alert('Please provide a caption for your post')
      return
    }
    
    if (uploadedImages.length === 0) {
      alert('Please upload an image for your post')
      return
    }
    
    setIsSendingToScheduler(true)
    
    try {
      // Get the active image
      const activeImage = uploadedImages[0] // Use first image for now
      
      // Check if this upload came from a specific date in the calendar
      const hasScheduledDate = preloadedContent?.scheduledDate && preloadedContent?.scheduledTime
      
      if (hasScheduledDate) {
        // Add to scheduled posts (replacing the client upload on the same day)
        console.log('Adding to scheduled posts on date:', preloadedContent?.scheduledDate)
        
        const scheduledPostData = {
          client_id: clientId,
          project_id: selectedProjectId,
          caption: selectedCaption,
          image_url: activeImage.preview,
          scheduled_date: preloadedContent?.scheduledDate,
          scheduled_time: preloadedContent?.scheduledTime,
          post_notes: '',
        }
        
        console.log('Sending scheduled post to calendar API:', { 
          ...scheduledPostData, 
          image_url: activeImage.preview?.substring(0, 50) + '...' 
        })
        
        // Add to calendar_scheduled_posts via API
        const accessToken = getAccessToken()
        
        const response = await fetch('/api/calendar/scheduled', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            scheduledPost: scheduledPostData
          })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Failed to add scheduled post: ${response.status}`)
        }
        
        const result = await response.json()
        console.log('✅ Post added to scheduled calendar:', result)
      } else {
        // Add to unscheduled posts (default behavior)
        console.log('Adding to unscheduled posts')
        
        const postData = {
          client_id: clientId,
          project_id: selectedProjectId,
          caption: selectedCaption,
          image_url: activeImage.preview,
          post_notes: '',
        }
        
        console.log('Sending post to calendar API:', { 
          ...postData, 
          image_url: activeImage.preview?.substring(0, 50) + '...' 
        })
        
        // Add to calendar_unscheduled_posts via API
        const accessToken = getAccessToken()
        
        const response = await fetch('/api/calendar/unscheduled', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(postData)
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Failed to add to calendar: ${response.status}`)
        }
        
        const result = await response.json()
        console.log('✅ Post added to unscheduled calendar:', result)
      }
      
      // If this was created from a client upload, delete the upload
      if (preloadedContent?.uploadId) {
        try {
          console.log('🗑️ Deleting processed client upload:', preloadedContent.uploadId)
          const deleteResponse = await fetch(`/api/clients/${clientId}/uploads/${preloadedContent.uploadId}`, {
            method: 'DELETE'
          })
          
          if (deleteResponse.ok) {
            console.log('✅ Client upload deleted successfully')
          } else {
            console.error('⚠️ Failed to delete client upload, but post was added to calendar')
          }
        } catch (error) {
          console.error('⚠️ Error deleting client upload:', error)
          // Don't fail the whole operation if delete fails
        }
      }
      
      // Redirect to calendar
      router.push(`/dashboard/client/${clientId}/calendar?refresh=true`)
      
    } catch (error) {
      console.error('❌ Error adding to calendar:', error)
      alert(`Failed to add post to calendar: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSendingToScheduler(false)
    }
  }

  return (
    <ContentStoreProvider clientId={clientId}>
      <ContentSuiteContent 
        clientId={clientId}
        client={client}
        projects={projects}
        projectsLoading={projectsLoading}
        setProjects={setProjects}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        handleSendToScheduler={handleSendToScheduler}
        isSendingToScheduler={isSendingToScheduler}
        addingToProject={addingToProject}
        setAddingToProject={setAddingToProject}
        showNewProjectForm={showNewProjectForm}
        setShowNewProjectForm={setShowNewProjectForm}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        newProjectDescription={newProjectDescription}
        setNewProjectDescription={setNewProjectDescription}
        creatingProject={creatingProject}
        handleCreateProject={handleCreateProject}
        // Editing props
        isEditing={isEditing}
        editingPost={editingPost}
        loadingPost={loadingPost}
        updatingPost={updatingPost}
        handleCancelEdit={handleCancelEdit}
        // Preloaded content props
        preloadedContent={preloadedContent}
      />
    </ContentStoreProvider>
  )
}

// Props interface for ContentSuiteContent
interface ContentSuiteContentProps {
  clientId: string
  client: Client | null
  projects: Project[]
  projectsLoading: boolean
  setProjects: (projects: Project[]) => void
  selectedProjectId: string | null
  setSelectedProjectId: (projectId: string | null) => void
  handleSendToScheduler: (selectedCaption: string, uploadedImages: { preview: string; id: string; file?: File }[]) => Promise<void>
  isSendingToScheduler: boolean
  addingToProject: string | null
  setAddingToProject: (projectId: string | null) => void
  showNewProjectForm: boolean
  setShowNewProjectForm: (show: boolean) => void
  newProjectName: string
  setNewProjectName: (name: string) => void
  newProjectDescription: string
  setNewProjectDescription: (description: string) => void
  creatingProject: boolean
  handleCreateProject: () => Promise<void>
  isEditing: boolean
  editingPost: any
  loadingPost: boolean
  updatingPost: boolean
  handleCancelEdit: () => void
  preloadedContent: {
    image: string;
    notes: string;
    fileName: string;
    uploadId: string | null;
    scheduledDate?: string;
    scheduledTime?: string;
  } | null
}

// Separate component that has access to the content store context
function ContentSuiteContent({
  clientId,
  client,
  projects,
  projectsLoading,
  setProjects,
  selectedProjectId,
  setSelectedProjectId,
  handleSendToScheduler,
  isSendingToScheduler,
  addingToProject,
  setAddingToProject,
  showNewProjectForm,
  setShowNewProjectForm,
  newProjectName,
  setNewProjectName,
  newProjectDescription,
  setNewProjectDescription,
  creatingProject,
  handleCreateProject,
  // Editing props
  isEditing,
  editingPost,
  loadingPost,
  updatingPost,
  handleCancelEdit,
  // Preloaded content props
  preloadedContent
}: ContentSuiteContentProps) {
  const { getAccessToken } = useAuth()
  const { 
    uploadedImages, 
    captions, 
    selectedCaptions, 
    postNotes, 
    activeImageId, 
    clearAll,
    setUploadedImages,
    setCaptions,
    setSelectedCaptions,
    setPostNotes,
    setActiveImageId
  } = useContentStore()
  const { contentIdeas, setContentIdeas } = useContentStore()
  
  const { user } = useAuth()
  
  // State for refreshing content ideas
  const [refreshingIdeas, setRefreshingIdeas] = useState(false)
  const [showCreditDialog, setShowCreditDialog] = useState(false)

  // Function to refresh/generate new content ideas
  const handleRefreshIdeas = async () => {
    if (!clientId) {
      alert('Client ID not found. Please refresh the page and try again.')
      return
    }

    setRefreshingIdeas(true)
    try {
      const accessToken = getAccessToken()
      
      if (!accessToken) {
        throw new Error('Authentication required. Please log in and try again.')
      }

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'generate_content_ideas',
          clientId: clientId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }))
        const errorMessage = errorData.error || `Server error (${response.status})`
        
        // Check if it's an insufficient credits error
        if (errorMessage.includes('Insufficient AI credits') || errorMessage.includes('credit')) {
          setShowCreditDialog(true)
          setRefreshingIdeas(false)
          return
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()

      if (data.success && data.ideas && Array.isArray(data.ideas)) {
        if (data.ideas.length === 0) {
          alert('No content ideas were generated. Please try again.')
          return
        }

        setContentIdeas(data.ideas)
        console.log('Content ideas refreshed successfully:', data.ideas)
      } else {
        throw new Error('Invalid response format from server')
      }
    } catch (error) {
      console.error('Failed to refresh content ideas:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      alert(`Failed to refresh content ideas: ${errorMessage}`)
    } finally {
      setRefreshingIdeas(false)
    }
  }

  // Helper function to get selected caption from store
  const getSelectedCaption = () => {
    if (selectedCaptions.length > 0) {
      const selectedCaption = captions.find(cap => cap.id === selectedCaptions[0])
      return selectedCaption?.text || ''
    }
    return ''
  }

  // Function to update content store with custom caption before saving
  const updateContentStoreForSaving = (customCaption?: string) => {
    if (customCaption && customCaption.trim()) {
      // Update the content store with the custom caption
      const captionId = selectedCaptions[0] || 'custom-caption-1'
      let updatedCaptions = captions.map(cap => 
        cap.id === captionId ? { ...cap, text: customCaption } : cap
      )
      
      // If no caption exists, create a new one
      if (updatedCaptions.length === 0 || !captions.find(cap => cap.id === captionId)) {
        updatedCaptions = [
          ...updatedCaptions,
          {
            id: captionId,
            text: customCaption
          }
        ]
      }
      
      // Update the content store
      setCaptions(updatedCaptions)
      if (!selectedCaptions.includes(captionId)) {
        setSelectedCaptions([captionId])
      }
    }
  }

  // State to track custom caption from SocialPreviewColumn
  const [customCaptionFromPreview, setCustomCaptionFromPreview] = useState('')
  

  // Handle custom caption changes from SocialPreviewColumn
  const handleCustomCaptionChange = (customCaption: string) => {
    setCustomCaptionFromPreview(customCaption)
  }


  // Clear all content when component mounts (reload) - but not when editing
  useEffect(() => {
    if (!isEditing) {
      clearAll();
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-populate form when editing post
  useEffect(() => {
    if (isEditing && editingPost && !loadingPost) {
      console.log('🔄 Pre-populating form with post data:', editingPost);
      
      // Set caption
      if (editingPost.caption) {
        const captionId = "edit-caption-1";
        setCaptions([{
          id: captionId,
          text: editingPost.caption
        }]);
        setSelectedCaptions([captionId]);
      }
      
      // Set image if available
      if (editingPost.image_url) {
        // Create a mock file for the existing image
        const mockFile = new File([], 'existing-image.jpg', { type: 'image/jpeg' });
        const imageId = "edit-image-1";
        
        setUploadedImages([{
          id: imageId,
          file: mockFile,
          preview: editingPost.image_url,
          notes: editingPost.notes || ''
        }]);
        setActiveImageId(imageId);
      }
      
      // Set post notes
      if (editingPost.notes) {
        setPostNotes(editingPost.notes);
      }
    }
  }, [isEditing, editingPost, loadingPost]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-load content from content inbox
  useEffect(() => {
    if (preloadedContent && !isEditing) {
      console.log('🔄 Pre-loading content from inbox:', preloadedContent);
      
      // Set image
      if (preloadedContent.image) {
        // Create a mock file for the uploaded image
        const mockFile = new File([], preloadedContent.fileName, { type: 'image/jpeg' });
        const imageId = "inbox-image-1";
        
        setUploadedImages([{
          id: imageId,
          file: mockFile,
          preview: preloadedContent.image,
          notes: preloadedContent.notes
        }]);
        setActiveImageId(imageId);
      }
      
      // Set post notes from client
      if (preloadedContent.notes) {
        setPostNotes(preloadedContent.notes);
      }
    }
  }, [preloadedContent, isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAddToProject = async (post: any, projectId: string) => {
    console.log('handleAddToProject called with post ID:', post?.id, 'project ID:', projectId);
    
    if (!projectId) {
      console.error('No project selected');
      alert('Please select a project first');
      return;
    }
    
    // Set loading state for this specific project
    setAddingToProject(projectId);
    
    // Get access token at the start of the function
    const accessToken = getAccessToken();
    
    try {
      let imageData = post.generatedImage;
      
      // Convert base64 to blob URL if needed
      if (imageData && imageData.startsWith('data:image/')) {
        try {
          console.log('🔄 Converting base64 image to blob URL for project...')
          
          // Extract MIME type from base64 string
          const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg'
          
          // Upload to Vercel Blob via API
          const filename = `project-${projectId}-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`
          
          const uploadResponse = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              imageData: imageData,
              filename: filename
            })
          })
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json()
            imageData = uploadResult.url
            console.log('✅ Image converted to blob URL for project:', imageData)
          } else {
            const errorData = await uploadResponse.json()
            console.error('❌ Upload failed for project:', errorData)
            throw new Error(errorData.error || 'Upload failed')
          }
        } catch (error) {
          console.error('❌ Error converting image for project:', error)
          console.warn('⚠️ Using original image data')
        }
      }
      // Only convert blob URLs, not base64 strings
      else if (imageData && imageData.startsWith('blob:')) {
        try {
          const response = await fetch(imageData);
          const blob = await response.blob();
          const reader = new FileReader();
          
          imageData = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Blob conversion failed, using existing data:', error);
          // If blob conversion fails, continue without image
          imageData = null;
        }
      }
      
      // Add to project with converted or existing image
      const response = await fetch('/api/projects/add-post', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          projectId,
          post: {
            ...post,
            clientId: clientId, // Make sure clientId is included
            generatedImage: imageData
          }
        })
      });
      
      if (response.ok) {
        alert('Post added to project successfully!');
        // Clear all content after successful add
        clearAll();
      } else {
        const error = await response.text();
        alert('Failed to add post: ' + error);
      }
      
    } catch (error) {
      console.error('Failed to add to project:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error adding post to project: ${errorMessage}`);
    } finally {
      // Clear loading state
      setAddingToProject(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Merged Header - Single Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section - Back Button + Title */}
          <div className="flex items-center space-x-4">
            <Link
              href={`/dashboard/client/${clientId}`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-2xl font-bold text-gray-700">
                {isEditing ? 'Edit Post' : 'Content Suite'}
              </h1>
              {isEditing && (
                <p className="text-sm text-gray-500">
                  Edit your scheduled post content
                </p>
              )}
            </div>
          </div>
          
          {/* Right Section - Action Buttons + User Profile */}
          <div className="flex items-center space-x-4">
            {/* Action Button */}
            {isEditing ? (
              <Button
                onClick={handleCancelEdit}
                variant="outline"
                className="text-gray-700"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel Edit
              </Button>
            ) : (
              <Link
                href={`/dashboard/client/${clientId}/calendar`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm hover:shadow-md transition-all duration-300"
              >
                <Calendar className="w-4 h-4 mr-2" />
                View Calendar
              </Link>
            )}
            
            {/* User Profile Info */}
            <div className="flex items-center space-x-3 border-l border-gray-300 pl-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-700" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.email || ''}
                  </p>
                </div>
              </div>
              
              {/* Settings Button */}
              <Link href="/settings">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="Profile Settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Banner */}
      {isEditing && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="flex items-center">
            <Edit3 className="w-5 h-5 text-blue-600 mr-2" />
            <p className="text-sm text-blue-800">
              <strong>Editing scheduled post</strong> - Changes will update your calendar and may require reapproval
            </p>
          </div>
        </div>
      )}

      {/* Edit Instructions */}
      {isEditing && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
            <p className="text-sm text-green-800">
              <strong>Update Mode:</strong> Use the &quot;Update Post&quot; button below to save your changes. This will update the existing post in your calendar.
            </p>
          </div>
        </div>
      )}

      {/* Pre-loaded Content Banner */}
      {preloadedContent && !isEditing && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
            <p className="text-sm text-blue-800">
              <strong>Content Pre-loaded:</strong> Image and notes from client inbox are ready. Generate captions and add to a project to create your post.
            </p>
          </div>
        </div>
      )}

      {/* Loading State for Post */}
      {loadingPost && (
        <div className="bg-white border-b border-gray-200 px-6 py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-600">Loading post for editing...</span>
          </div>
        </div>
      )}

      {/* Top Section: Content Ideas and Add to Calendar Cards */}
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <div className="grid grid-cols-3 gap-6 mb-2">
          {/* Content Ideas Section - spans 2 columns */}
          <div className="col-span-2">
            <ContentIdeasColumn />
          </div>
          
          {/* Add to Calendar Card - third column */}
          <div>
            {/* Action Buttons Section - Only show when not editing */}
            {!isEditing && (
              <div className="bg-white rounded-lg border border-gray-200 flex h-[116px]">
                <div className="w-full flex flex-col gap-3 px-6 py-4">
                  {/* Add to Calendar Button */}
                  <Button
                    onClick={() => {
                      // Use custom caption from preview if available, otherwise use selected caption
                      const caption = customCaptionFromPreview.trim() || getSelectedCaption()
                      handleSendToScheduler(caption, uploadedImages)
                    }}
                    disabled={isSendingToScheduler || (!customCaptionFromPreview.trim() && !getSelectedCaption())}
                    className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    {isSendingToScheduler ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-5 h-5 mr-2" />
                        Add to Calendar
                      </>
                    )}
                  </Button>
                  
                  {/* Project Selector */}
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-between text-left font-normal"
                        >
                          {selectedProjectId 
                            ? projects.find(p => p.id === selectedProjectId)?.name || 'Select Project'
                            : 'No Project'
                          }
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-full min-w-[200px]" align="start">
                        <DropdownMenuItem 
                          onClick={() => setSelectedProjectId(null)}
                          className={!selectedProjectId ? 'bg-accent' : ''}
                        >
                          No Project
                        </DropdownMenuItem>
                        {projects.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            {projects.map((project) => (
                              <DropdownMenuItem 
                                key={project.id} 
                                onClick={() => setSelectedProjectId(project.id)}
                                className={selectedProjectId === project.id ? 'bg-accent' : ''}
                              >
                                {project.name}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setShowNewProjectForm(true)}
                          className="text-blue-600 focus:text-blue-600"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          New Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-width Generated Ideas Section */}
      {contentIdeas.length > 0 && (
        <div className="w-full">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-800">Generated Ideas</h2>
              </div>
              <Button
                onClick={handleRefreshIdeas}
                disabled={refreshingIdeas}
                variant="outline"
                className="flex items-center gap-2 bg-white hover:bg-gray-50"
              >
                {refreshingIdeas ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Refresh Ideas
                  </>
                )}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contentIdeas.map((idea, index) => (
                <div key={index} className="border rounded-lg p-3 transition-all hover:border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 h-full">
                  <div className="space-y-2">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 font-semibold text-sm">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">{idea.idea}</h3>
                      </div>
                    </div>
                    <div className="space-y-3 ml-2">
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 text-purple-500 mt-0.5">
                          <Lightbulb className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-gray-800 mb-0.5">Marketing Angle</p>
                          <p className="text-sm text-gray-600">{idea.angle}</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 text-green-500 mt-0.5">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-gray-800 mb-0.5">Post Example</p>
                          <p className="text-sm text-gray-600">{idea.timing}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Three Columns */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-3 gap-6 items-stretch">
          {/* Content Suite Columns */}
          <div className="flex h-full">
            <MediaUploadColumn />
          </div>
          <div className="flex h-full">
            <CaptionGenerationColumn />
          </div>

          {/* Column 3: Social Preview */}
          <div className="flex h-full">
            <SocialPreviewColumn
              clientId={clientId}
              handleSendToScheduler={handleSendToScheduler}
              isSendingToScheduler={isSendingToScheduler || updatingPost}
              isEditing={isEditing}
              updatingPost={updatingPost}
              onCustomCaptionChange={handleCustomCaptionChange}
            />
          </div>
        </div>
      </div>

      {/* Create New Project Modal */}
      {!isEditing && (
        <Dialog open={showNewProjectForm} onOpenChange={setShowNewProjectForm}>
          <DialogContent className="bg-white/90">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Enter project description..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewProjectForm(false)
                  setNewProjectName("")
                  setNewProjectDescription("")
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateProject}
                disabled={creatingProject}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {creatingProject ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Insufficient Credits Dialog for Refresh Ideas */}
      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Out of Credits
            </DialogTitle>
            <DialogDescription>
              Failed to refresh content ideas: Insufficient AI credits. You have 0 credits remaining - Please upgrade your plan or wait until next month.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowCreditDialog(false)
                window.location.href = '/pricing'
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Upgrade Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
