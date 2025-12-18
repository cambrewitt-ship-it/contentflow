'use client'

import { useState, useCallback, useEffect } from 'react'
import { use } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { ArrowLeft, Loader2, Plus, Calendar, Edit3, X, User, Settings, ChevronDown, Lightbulb, Clock, RefreshCw, AlertCircle, CheckCircle, Check, Image as ImageIcon, Video as VideoIcon, Brain, Send } from 'lucide-react'
import Link from 'next/link'
import { SocialPreviewColumn } from './SocialPreviewColumn'
import { ContentIdeasColumn } from './ContentIdeasColumn'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContentStoreProvider, ContentFocus, CopyTone } from '@/lib/contentStore'
import { useAuth } from '@/contexts/AuthContext'
import { SchedulePostModal, Platform } from '@/components/SchedulePostModal'

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
  
  // Message state for success/error notifications
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  
  // Connected accounts for scheduling
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([])
  
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
        const accessToken = getAccessToken()
        
        const response = await fetch(`/api/projects?clientId=${clientId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
        
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

  // Fetch connected accounts for scheduling
  useEffect(() => {
    async function fetchConnectedAccounts() {
      if (!clientId) return
      
      try {
        const accessToken = getAccessToken()
        
        const response = await fetch(`/api/late/get-accounts/${clientId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new Error(`Failed to fetch accounts: ${response.status}`)
        }
        
        const data = await response.json()
        setConnectedAccounts(data.accounts || [])
      } catch (error) {
        console.error('Error fetching connected accounts:', error)
      }
    }

    if (clientId) {
      fetchConnectedAccounts()
    }
  }, [clientId, getAccessToken])

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
    const scheduledDate = searchParams?.get('scheduledDate')
    
    // Check if scheduledDate is provided (from calendar + button)
    if (scheduledDate && !uploadId) {
      console.log('🔄 Pre-loading scheduled date from URL params:', scheduledDate)
      setPreloadedContent({
        image: '',
        notes: '',
        fileName: '',
        uploadId: null,
        scheduledDate: scheduledDate,
        scheduledTime: undefined
      })
      return
    }
    
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
            scheduledDate: imageData.scheduledDate || scheduledDate,
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
          uploadId: uploadId || null,
          scheduledDate: scheduledDate || undefined,
          scheduledTime: undefined
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
    uploadedImages: { preview: string; id: string; file?: File; blobUrl?: string }[]
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
    uploadedImages: { preview: string; id: string; file?: File; blobUrl?: string }[]
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
      
      // Get the proper image URL - prefer blobUrl (Vercel Blob) over preview
      // This prevents storing huge base64 data in the database
      let imageUrl = activeImage.blobUrl || activeImage.preview
      
      // Validate that we have a proper URL, not base64 data
      if (!imageUrl) {
        throw new Error('No image URL available. Please wait for the image to finish uploading.')
      }
      
      // Check if we have a valid HTTPS URL (either from blobUrl or preview)
      const isValidUrl = imageUrl.startsWith('https://')
      
      if (!isValidUrl) {
        // Image hasn't been uploaded to blob storage yet
        if (imageUrl.startsWith('data:')) {
          console.error('❌ Image is base64 data - blob upload may have failed or is pending')
          // Calculate approximate size for user feedback
          const base64Size = Math.round((imageUrl.length * 3) / 4 / (1024 * 1024))
          throw new Error(`Image is still processing (${base64Size}MB). Large images take longer to upload. Please wait a moment and try again.`)
        }
        
        if (imageUrl.startsWith('blob:')) {
          console.error('❌ Image is still a temporary blob URL - waiting for Vercel Blob upload')
          throw new Error('Image is still uploading to cloud storage. For large images (10MB+), this may take 10-30 seconds. Please wait and try again.')
        }
        
        // Unknown format - reject for safety
        console.error('❌ Unknown image URL format:', imageUrl.substring(0, 50))
        throw new Error('Invalid image format. Please re-upload the image.')
      }
      
      console.log('✅ Using image URL:', imageUrl.substring(0, 80) + '...')
      
      // Check if this upload came from a specific date in the calendar
      const hasScheduledDate = preloadedContent?.scheduledDate
      
      if (hasScheduledDate) {
        // Add to scheduled posts on the specified date
        // If no time is provided, use a default time of 12:00 PM
        const scheduledTime = preloadedContent?.scheduledTime || '12:00 PM'
        
        console.log('Adding to scheduled posts on date:', preloadedContent?.scheduledDate, 'at time:', scheduledTime)
        
        const scheduledPostData = {
          client_id: clientId,
          project_id: selectedProjectId,
          caption: selectedCaption,
          image_url: imageUrl,
          scheduled_date: preloadedContent?.scheduledDate,
          scheduled_time: scheduledTime,
          post_notes: '',
        }
        
        console.log('Sending scheduled post to calendar API:', { 
          ...scheduledPostData, 
          image_url: imageUrl.substring(0, 50) + '...' 
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
          image_url: imageUrl,
          post_notes: '',
        }
        
        console.log('Sending post to calendar API:', { 
          ...postData, 
          image_url: imageUrl.substring(0, 50) + '...' 
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
      
      // Show success message and stay on page instead of navigating
      setMessage({ type: 'success', text: 'Successfully added to calendar!' })
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setMessage(null)
      }, 5000)
      
      // Optional: Clear the form or reset state here if desired
      // This allows users to add multiple posts without navigation
      
    } catch (error) {
      console.error('❌ Error adding to calendar:', error)
      setMessage({ 
        type: 'error', 
        text: `Failed to add post to calendar: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
      
      // Auto-hide error message after 7 seconds
      setTimeout(() => {
        setMessage(null)
      }, 7000)
    } finally {
      setIsSendingToScheduler(false)
    }
  }

  // Convert connected accounts to Platform[] format for modal
  const availablePlatforms: Platform[] = connectedAccounts.map(acc => {
    // Extract just the platform name (remove "Account" suffix if present)
    let platformName = acc.name || ''
    if (platformName.toLowerCase().endsWith(' account')) {
      platformName = platformName.slice(0, -8) // Remove " Account" suffix
    }
    // If no name or still empty, use platform type capitalized
    if (!platformName) {
      platformName = acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1)
    }
    return {
      id: acc._id,
      name: platformName,
      type: acc.platform as Platform['type']
    }
  })

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
        // Message state
        message={message}
        // Schedule modal props
        isScheduleModalOpen={isScheduleModalOpen}
        setIsScheduleModalOpen={setIsScheduleModalOpen}
        availablePlatforms={availablePlatforms}
        connectedAccounts={connectedAccounts}
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
  handleSendToScheduler: (selectedCaption: string, uploadedImages: { preview: string; id: string; file?: File; blobUrl?: string }[]) => Promise<void>
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
  message: { type: 'success' | 'error'; text: string } | null
  isScheduleModalOpen: boolean
  setIsScheduleModalOpen: (open: boolean) => void
  availablePlatforms: Platform[]
  connectedAccounts: any[]
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
  preloadedContent,
  // Message state
  message,
  // Schedule modal props
  isScheduleModalOpen,
  setIsScheduleModalOpen,
  availablePlatforms,
  connectedAccounts
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
    setActiveImageId,
    addImage,
    removeImage,
    contentFocus,
    setContentFocus,
    copyTone,
    setCopyTone,
    copyType,
    setCopyType,
    generateAICaptions,
    remixCaption,
    selectCaption,
    updateCaption
  } = useContentStore()
  const { contentIdeas, setContentIdeas } = useContentStore()
  
  const { user } = useAuth()
  
  // State for refreshing content ideas
  const [refreshingIdeas, setRefreshingIdeas] = useState(false)
  const [showCreditDialog, setShowCreditDialog] = useState(false)
  
  // State for caption generation
  const [generatingCaptions, setGeneratingCaptions] = useState(false)
  const [remixingCaption, setRemixingCaption] = useState<string | null>(null)
  const [bounceHelperText, setBounceHelperText] = useState(false)
  
  // State for scheduling
  const [isScheduling, setIsScheduling] = useState(false)

  // Handler for scheduling posts via modal
  const handleScheduleFromModal = async (date: string, time: string, platform: Platform) => {
    if (!uploadedImages || uploadedImages.length === 0) {
      alert('Please upload an image first')
      return
    }

    const selectedCaption = selectedCaptions.length > 0
      ? captions.find(cap => cap.id === selectedCaptions[0])?.text
      : ''

    if (!selectedCaption || selectedCaption.trim() === '') {
      alert('Please provide a caption for your post')
      return
    }

    setIsScheduling(true)
    try {
      const accessToken = getAccessToken()
      
      // Get the active image
      const activeImage = uploadedImages[0]
      let imageUrl = activeImage.blobUrl || activeImage.preview

      // Validate image URL
      if (!imageUrl) {
        throw new Error('No image URL available. Please wait for the image to finish uploading.')
      }

      if (!imageUrl.startsWith('https://')) {
        if (imageUrl.startsWith('data:')) {
          const base64Size = Math.round((imageUrl.length * 3) / 4 / (1024 * 1024))
          throw new Error(`Image is still processing (${base64Size}MB). Please wait and try again.`)
        }
        if (imageUrl.startsWith('blob:')) {
          throw new Error('Image is still uploading. Please wait and try again.')
        }
        throw new Error('Invalid image format. Please re-upload the image.')
      }

      // Step 1: Upload image to LATE
      console.log('Uploading image to LATE...')
      let imageData = imageUrl
      
      // Convert blob URL to base64 if needed
      if (imageUrl.startsWith('blob:')) {
        try {
          const response = await fetch(imageUrl)
          const blob = await response.blob()
          const reader = new FileReader()
          imageData = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
        } catch (error) {
          console.error('Blob conversion failed:', error)
          throw new Error('Failed to process image')
        }
      }

      const mediaResponse = await fetch('/api/late/upload-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ imageBlob: imageData })
      })

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text()
        console.error('Media upload error:', errorText)
        throw new Error('Failed to upload image to LATE')
      }

      const { lateMediaUrl } = await mediaResponse.json()
      console.log('✅ Image uploaded to LATE successfully')

      // Step 2: Format date and time for LATE API
      // Convert time from HH:MM format to 24-hour format
      const [hours, minutes] = time.split(':')
      const hour24 = parseInt(hours, 10)
      const minute24 = parseInt(minutes, 10)
      
      const scheduledDateTime = new Date(date)
      scheduledDateTime.setHours(hour24, minute24, 0, 0)
      
      const scheduledDateStr = scheduledDateTime.toISOString().split('T')[0]
      const scheduledTimeStr = `${hour24.toString().padStart(2, '0')}:${minute24.toString().padStart(2, '0')}:00`
      const scheduledDateTimeStr = `${scheduledDateStr}T${scheduledTimeStr}`

      // Step 3: Find the account for the selected platform
      const selectedAccount = connectedAccounts.find(acc => 
        acc._id === platform.id || (acc.platform === platform.type && acc._id === platform.id)
      )

      if (!selectedAccount) {
        throw new Error(`No account found for ${platform.name}`)
      }

      // Step 4: Add to calendar database FIRST (so we have a real UUID postId)
      const scheduledTime = `${hour24.toString().padStart(2, '0')}:${minute24.toString().padStart(2, '0')}`
      const scheduledPostData = {
        client_id: clientId,
        project_id: selectedProjectId,
        caption: selectedCaption,
        image_url: imageUrl,
        scheduled_date: date,
        scheduled_time: scheduledTime,
        post_notes: '',
      }

      const calendarResponse = await fetch('/api/calendar/scheduled', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          scheduledPost: scheduledPostData
        })
      })

      if (!calendarResponse.ok) {
        const errorData = await calendarResponse.json()
        console.error('Failed to add to calendar:', errorData)
        throw new Error('Failed to create calendar scheduled post')
      }

      const calendarResult = await calendarResponse.json()
      const calendarPostId = calendarResult.post?.id
      
      if (!calendarPostId) {
        throw new Error('Failed to get post ID from calendar response')
      }

      console.log('✅ Post added to calendar database with ID:', calendarPostId)

      // Step 5: Schedule via LATE API using the real UUID postId
      console.log('Scheduling post via LATE API...')
      const scheduleResponse = await fetch('/api/late/schedule-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          postId: calendarPostId,
          caption: selectedCaption,
          lateMediaUrl: lateMediaUrl,
          scheduledDateTime: scheduledDateTimeStr,
          selectedAccounts: [selectedAccount],
          clientId: clientId
        })
      })

      if (!scheduleResponse.ok) {
        if (scheduleResponse.status === 403) {
          const errorBody = await scheduleResponse.json().catch(() => null)
          const errorMessage =
            errorBody?.error ||
            'Social media posting is not available on the free plan. Please upgrade to post to social media.'
          alert(errorMessage)
          return
        }

        const errorText = await scheduleResponse.text()
        console.error('LATE scheduling error:', errorText)
        throw new Error('Failed to schedule post via LATE')
      }

      const scheduleResult = await scheduleResponse.json()
      console.log('✅ Post scheduled successfully via LATE API')

      // Close modal and show success
      setIsScheduleModalOpen(false)
      // Note: message state is in parent, so we'll use alert for now
      alert(`Post scheduled successfully for ${date} at ${time} to ${platform.name}!`)

    } catch (error) {
      console.error('Error scheduling post:', error)
      alert(`Failed to schedule post: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsScheduling(false)
    }
  }

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

  // Get active image for caption generation
  const activeImage = uploadedImages.find(img => img.id === activeImageId)
  const isVideoSelected = activeImage?.mediaType === 'video'

  // Handler for generating AI captions
  const handleGenerateCaptions = async () => {
    if (!activeImage) {
      alert('Please select media first')
      return
    }

    // For videos, require post notes since we can't analyze video content
    if (isVideoSelected && !postNotes.trim()) {
      alert('Post Notes are required when generating captions for videos. Please add notes describing your video content.')
      return
    }

    setGeneratingCaptions(true)
    try {
      const accessToken = getAccessToken()
      if (!accessToken) {
        throw new Error('Authentication required. Please log in again.')
      }

      // For videos: Generate captions based only on post notes (no visual analysis)
      // For images: Generate captions with AI vision analysis + post notes
      if (isVideoSelected) {
        await generateAICaptions(activeImage.id, postNotes.trim(), copyType, accessToken)
      } else {
        const aiContext = postNotes?.trim() || 'Generate engaging social media captions for this content.'
        await generateAICaptions(activeImage.id, aiContext, copyType, accessToken)
      }
    } catch (error) {
      console.error('Failed to generate captions:', error)
      if (error instanceof Error && error.message === 'INSUFFICIENT_CREDITS') {
        setShowCreditDialog(true)
      } else {
        alert(`Failed to generate captions: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      setGeneratingCaptions(false)
    }
  }

  // Handler for remixing captions
  const handleRemixCaption = async (captionId: string) => {
    if (!activeImage) {
      alert('Please select an image first')
      return
    }

    setRemixingCaption(captionId)
    try {
      const accessToken = getAccessToken()
      if (!accessToken) {
        throw new Error('Authentication required. Please log in again.')
      }

      await remixCaption(captionId, accessToken)
    } catch (error) {
      console.error('Failed to remix caption:', error)
      alert(`Failed to remix caption: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setRemixingCaption(null)
    }
  }

  // Helper functions for Content Focus and Copy Tone
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

  // Media upload handlers
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      for (const file of Array.from(files)) {
        // Accept both images and videos
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
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
      // Accept both images and videos
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        await addImage(file)
      }
    }
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

      {/* Success/Error Message Banner */}
      {message && (
        <div className={`border-b px-6 py-4 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center max-w-7xl mx-auto">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />
            )}
            <span className={`font-medium ${
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {message.text}
            </span>
          </div>
        </div>
      )}

      {/* Top Section: Content Ideas - Full Width */}
      <div className="w-full">
        <div className="px-6 py-4">
          <ContentIdeasColumn />
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-extrabold text-gray-800 mb-0.5">Marketing Angle</p>
                          <p className="text-sm text-gray-600 break-words whitespace-normal">{idea.angle}</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 text-green-500 mt-0.5">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-extrabold text-gray-800 mb-0.5">Post Example</p>
                          <p className="text-sm text-gray-600 break-words whitespace-normal">{idea.timing}</p>
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

      {/* Main Content: Two Columns (2/3 and 1/3) */}
      <div className="w-full">
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {/* Left Column: 2/3 width - Contains All Left Side Elements in One Card */}
            <div className="col-span-2 flex">
              {/* Consolidated Card - All Left Side Elements */}
              <Card className="flex flex-col overflow-hidden w-full h-full min-h-[600px]">
                <CardHeader>
                  <CardTitle className="card-title-26">Content Creation</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col overflow-y-auto">
                  {/* Top Section - Natural Height */}
                  <div className="space-y-6">
                    {/* Upload Media Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-700 mb-4">Upload Media</h3>
                  {/* Top Row: Square Upload Box + Thumbnails + Dropdowns */}
                  <div className="grid grid-cols-[200px_1fr_320px] gap-4 mb-4 items-start">
                    {/* Square Upload Box on Left */}
                    <div
                      className="rounded-2xl p-4 text-center transition-colors cursor-pointer w-[200px] h-[200px] flex flex-col items-center justify-center bg-gradient-to-br from-blue-700/90 to-blue-400/90"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('media-upload-v2')?.click()}
                    >
                      <div className="text-[100px] font-light text-white leading-none">+</div>
                      <input
                        id="media-upload-v2"
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleMediaUpload}
                        className="hidden"
                      />
                    </div>

                    {/* Uploaded Media Thumbnails - To the right of upload box */}
                    <div className="flex gap-3 flex-wrap items-start min-w-0">
                      {uploadedImages.map((media) => {
                        // Check if image is still uploading (no blobUrl yet and preview is temporary)
                        const isUploading = !media.blobUrl && (media.preview?.startsWith('blob:') || media.preview?.startsWith('data:'))
                        
                        return (
                          <div
                            key={media.id}
                            className={`relative w-24 h-24 border-2 rounded-lg cursor-pointer transition-all flex-shrink-0 ${
                              activeImageId === media.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            } ${isUploading ? 'opacity-70' : ''}`}
                            onClick={() => setActiveImageId(media.id)}
                          >
                            {/* Upload Progress Indicator */}
                            {isUploading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md z-20">
                                <div className="flex flex-col items-center">
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  <span className="text-white text-xs mt-1">Uploading...</span>
                                </div>
                              </div>
                            )}
                            
                            {/* Media Type Indicator */}
                            <div className="absolute top-1 left-1 z-10 bg-black/60 rounded-full p-1 flex items-center justify-center">
                              {media.mediaType === 'video' ? (
                                <>
                                  <VideoIcon className="w-3 h-3 text-white" />
                                  <span className="sr-only">Video</span>
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="w-3 h-3 text-white" />
                                  <span className="sr-only">Image</span>
                                </>
                              )}
                            </div>

                            {/* Media Preview - Show thumbnail for videos, image for images */}
                            <img
                              src={media.mediaType === 'video' ? (media.videoThumbnail || media.preview) : media.preview}
                              alt={media.mediaType === 'video' ? "Video thumbnail" : "Uploaded content"}
                              className="w-full h-full object-cover rounded-md"
                            />
                            
                            {/* Play icon overlay for videos */}
                            {media.mediaType === 'video' && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
                                <div className="bg-white/90 rounded-full p-2">
                                  <svg className="w-4 h-4 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </div>
                              </div>
                            )}

                            {/* Remove button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeImage(media.id)
                              }}
                              className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors z-10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    {/* Dropdowns on Right - Fixed position */}
                    <div className="flex flex-col gap-4 w-[320px] flex-shrink-0">
                      {/* Copy Type (moved to top) */}
                      <div className="flex items-center gap-4">
                        <h4 className="text-lg font-semibold text-gray-700 whitespace-nowrap w-32 flex-shrink-0 text-right">Copy Type</h4>
                        <div className="flex-1 min-w-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-full px-3 justify-between">
                                <span className="text-lg font-semibold text-left flex-1 min-w-0 whitespace-nowrap">
                                  {copyType === 'social-media' ? 'Social Media' : 'Email Marketing'}
                                </span>
                                <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => setCopyType('social-media')}
                                className={copyType === 'social-media' ? 'bg-accent' : ''}
                              >
                                <span className="text-lg font-semibold">Social Media</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setCopyType('email-marketing')}
                                className={copyType === 'email-marketing' ? 'bg-accent' : ''}
                              >
                                <span className="text-lg font-semibold">Email Marketing</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Content Focus */}
                      <div className="flex items-center gap-4">
                        <h4 className="text-lg font-semibold text-gray-700 whitespace-nowrap w-32 flex-shrink-0 text-right">Content Focus</h4>
                        <div className="flex-1 min-w-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-full px-3 justify-between">
                                <span className="text-lg font-semibold text-left flex-1 min-w-0 whitespace-nowrap">{getContentFocusDisplayText(contentFocus)}</span>
                                <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => setContentFocus('main-focus')}
                                className={contentFocus === 'main-focus' ? 'bg-accent' : ''}
                              >
                                <span className="text-lg font-semibold">Main focus</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setContentFocus('supporting')}
                                className={contentFocus === 'supporting' ? 'bg-accent' : ''}
                              >
                                <span className="text-lg font-semibold">Supporting</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setContentFocus('background')}
                                className={contentFocus === 'background' ? 'bg-accent' : ''}
                              >
                                <span className="text-lg font-semibold">Background</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Copy Tone */}
                      <div className="flex items-center gap-4">
                        <h4 className="text-lg font-semibold text-gray-700 whitespace-nowrap w-32 flex-shrink-0 text-right">Copy Tone</h4>
                        <div className="flex-1 min-w-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-full px-3 justify-between">
                                <span className="text-lg font-semibold text-left flex-1 min-w-0 whitespace-nowrap">{getCopyToneDisplayText(copyTone)}</span>
                                <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => setCopyTone('promotional')}
                                className={copyTone === 'promotional' ? 'bg-accent' : ''}
                              >
                                <span className="text-lg font-semibold">Promotional</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setCopyTone('educational')}
                                className={copyTone === 'educational' ? 'bg-accent' : ''}
                              >
                                <span className="text-lg font-semibold">Educational</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setCopyTone('personal')}
                                className={copyTone === 'personal' ? 'bg-accent' : ''}
                              >
                                <span className="text-lg font-semibold">Personal</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setCopyTone('testimonial')}
                                className={copyTone === 'testimonial' ? 'bg-accent' : ''}
                              >
                                <span className="text-lg font-semibold">Testimonial</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setCopyTone('engagement')}
                                className={copyTone === 'engagement' ? 'bg-accent' : ''}
                              >
                                <span className="text-lg font-semibold">Engagement</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>

                  </div>

                  {/* Upload media message - left aligned above border line */}
                  {!activeImage && (
                    <p className={`text-xs text-gray-500 mb-1 -mt-4 transition-transform duration-300 ${bounceHelperText ? 'animate-bounce' : ''}`}>
                      Upload media to enable caption generation
                    </p>
                  )}

                  {/* ChatGPT-style Input: Post Notes + Generate Button */}
                  <div className="border-t border-gray-200 pt-6">
                    {/* Video Notice */}
                    {isVideoSelected && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <VideoIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-blue-800">
                            <p className="font-medium mb-1">Video Selected</p>
                            <p>AI will generate captions based on your <strong>Post Notes only</strong>. Video visual analysis is not available. Please ensure your Post Notes describe the video content.</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Warning if video but no notes */}
                    {isVideoSelected && !postNotes.trim() && (
                      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-amber-800">
                            <p className="font-medium">Post Notes Required</p>
                            <p>Add Post Notes below to describe your video before generating captions.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ChatGPT-style unified input container */}
                    <div className="relative flex items-end gap-2 border-2 border-gray-300 rounded-3xl bg-white focus-within:border-blue-500 focus-within:shadow-lg transition-all">
                      <Textarea
                        value={postNotes}
                        onChange={(e) => setPostNotes(e.target.value)}
                        placeholder="Add notes, context, or instructions for your post..."
                        className="h-14 min-h-[56px] max-h-[200px] resize-none border-0 focus:outline-none focus:ring-0 shadow-none rounded-3xl pr-36 pt-[18px] pb-[18px] pl-4 leading-5"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            if (!generatingCaptions && activeImage && !(isVideoSelected && !postNotes.trim())) {
                              handleGenerateCaptions()
                            }
                          }
                        }}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                        <Button
                          onClick={() => {
                            const isDisabled = generatingCaptions || !activeImage || (isVideoSelected && !postNotes.trim())
                            if (isDisabled && !activeImage) {
                              // Trigger bounce animation
                              setBounceHelperText(true)
                              setTimeout(() => setBounceHelperText(false), 600)
                            } else if (!isDisabled) {
                              handleGenerateCaptions()
                            }
                          }}
                          disabled={generatingCaptions || !activeImage || (isVideoSelected && !postNotes.trim())}
                          className="h-9 px-6 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:bg-blue-400 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-2 font-semibold text-sm"
                          title={generatingCaptions ? 'Generating...' : `Generate ${copyType === 'social-media' ? 'Social Media' : 'Email Marketing'} Copy`}
                        >
                          {generatingCaptions ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Brain className="w-4 h-4 text-white" />
                              Generate Text
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Helper text */}
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 text-center">
                        AI will analyze your image and Post Notes to generate captions
                      </p>
                      {isVideoSelected && postNotes.trim() && (
                        <p className="text-xs text-gray-500 text-center">
                          Captions will be generated from your Post Notes
                        </p>
                      )}
                    </div>
                  </div>

                  {/* OR divider */}
                    <div className="flex items-center my-6">
                      <div className="flex-1 border-t border-gray-300"></div>
                      <span className="px-4 text-sm font-bold text-gray-700">OR</span>
                      <div className="flex-1 border-t border-gray-300"></div>
                    </div>
                  </div>

                  {/* Bottom Section - Caption Cards */}
                  <div>
                    {/* Caption boxes */}
                    <div className="w-full flex justify-center">
                      {(() => {
                        const firstCaption = captions.length > 0 ? captions[0] : { id: 'custom-caption-1', text: '' }
                        const displayCaptions = captions.length > 0 ? captions.slice(0, 3) : [firstCaption]
                        const isEmptyBox = captions.length === 0
                        const isSingleCaption = displayCaptions.length === 1
                        
                        return (
                          <div className={`grid gap-3 w-full ${isSingleCaption ? 'grid-cols-1 max-w-md' : 'grid-cols-1 md:grid-cols-3 max-w-5xl'}`}>
                            {displayCaptions.map((caption, index) => {
                              const isFirstEmpty = isEmptyBox && index === 0
                              
                              return (
                                <div
                                  key={caption.id}
                                  className={`border rounded-lg p-3 transition-all ${
                                    selectedCaptions.includes(caption.id)
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200'
                                  }`}
                                >
                                  {isFirstEmpty || caption.id === 'custom-caption-1' ? (
                                    <div className="flex flex-col items-center justify-center py-8">
                                      <Textarea
                                        value={caption.text}
                                        onChange={(e) => {
                                          const newText = e.target.value
                                          
                                          if (isFirstEmpty) {
                                            const newCaption = {
                                              id: 'custom-caption-1',
                                              text: newText
                                            }
                                            setCaptions([newCaption])
                                            if (newText.trim()) {
                                              selectCaption('custom-caption-1')
                                            }
                                          } else {
                                            updateCaption(caption.id, newText)
                                            if (newText.trim() && !selectedCaptions.includes(caption.id)) {
                                              selectCaption(caption.id)
                                            }
                                          }
                                        }}
                                        placeholder="Type your own caption..."
                                        className="min-h-[60px] resize-none border-2 border-blue-500 bg-white focus:outline-none focus:ring-0 focus:shadow-lg focus:border-blue-500 p-2 text-sm text-gray-700 rounded-md break-words w-full"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex items-center justify-center mt-4">
                                        <Button
                                          size="sm"
                                          variant={selectedCaptions.includes(caption.id) ? "default" : "outline"}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            selectCaption(caption.id)
                                          }}
                                          disabled={!caption.text.trim() || isFirstEmpty}
                                          className={`text-xs ${
                                            selectedCaptions.includes(caption.id)
                                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                              : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                                          }`}
                                        >
                                          {selectedCaptions.includes(caption.id) ? (
                                            <>
                                              <Check className="w-3 h-3 mr-1" />
                                              Selected
                                            </>
                                          ) : (
                                            'Select'
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <Textarea
                                        value={caption.text}
                                        onChange={(e) => {
                                          const newText = e.target.value
                                          updateCaption(caption.id, newText)
                                          if (newText.trim() && !selectedCaptions.includes(caption.id)) {
                                            selectCaption(caption.id)
                                          }
                                        }}
                                        placeholder={`Type your ${copyType === 'social-media' ? 'caption' : 'email copy'} here...`}
                                        className="min-h-[60px] resize-none border-2 border-blue-500 bg-white focus:outline-none focus:ring-0 focus:shadow-lg focus:border-blue-500 p-2 text-sm text-gray-700 rounded-md break-words w-full"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex items-center justify-between">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleRemixCaption(caption.id)
                                          }}
                                          disabled={remixingCaption === caption.id || !caption.text.trim()}
                                          className="text-xs"
                                        >
                                          <RefreshCw className={`w-3 h-3 mr-1 ${remixingCaption === caption.id ? 'animate-spin' : ''}`} />
                                          {remixingCaption === caption.id ? 'Remixing...' : 'Remix'}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant={selectedCaptions.includes(caption.id) ? "default" : "outline"}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            selectCaption(caption.id)
                                          }}
                                          disabled={!caption.text.trim()}
                                          className={`text-xs ${
                                            selectedCaptions.includes(caption.id)
                                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                              : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                                          }`}
                                        >
                                          {selectedCaptions.includes(caption.id) ? (
                                            <>
                                              <Check className="w-3 h-3 mr-1" />
                                              Selected
                                            </>
                                          ) : (
                                            'Select'
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: 1/3 width - Social Preview */}
            <div className="col-span-1 flex h-full">
              <SocialPreviewColumn
                clientId={clientId}
                handleSendToScheduler={handleSendToScheduler}
                isSendingToScheduler={isSendingToScheduler || updatingPost}
                isEditing={isEditing}
                updatingPost={updatingPost}
                onCustomCaptionChange={handleCustomCaptionChange}
                projects={projects}
                selectedProjectId={selectedProjectId}
                setSelectedProjectId={setSelectedProjectId}
                showNewProjectForm={showNewProjectForm}
                setShowNewProjectForm={setShowNewProjectForm}
                getSelectedCaption={getSelectedCaption}
                customCaptionFromPreview={customCaptionFromPreview}
                onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
              />
            </div>

            {/* Schedule Post Modal */}
            <SchedulePostModal
              isOpen={isScheduleModalOpen}
              onClose={() => setIsScheduleModalOpen(false)}
              onSchedule={handleScheduleFromModal}
              availablePlatforms={availablePlatforms}
              isScheduling={isScheduling}
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
