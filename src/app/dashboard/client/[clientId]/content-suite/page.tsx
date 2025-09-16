'use client'

import { useState, useCallback, useEffect } from 'react'
import { use } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from 'components/ui/button'
import { Input } from 'components/ui/input'
import { Textarea } from 'components/ui/textarea'
import { ArrowLeft, Loader2, Sparkles, RefreshCw, Plus, FolderOpen, Calendar, Edit3, X } from 'lucide-react'
import Link from 'next/link'
import { ImageUploadColumn } from './ImageUploadColumn'
import { CaptionGenerationColumn } from './CaptionGenerationColumn'
import { SocialPreviewColumn } from './SocialPreviewColumn'
import { generateCaptionsWithAI, remixCaptionWithAI, type AICaptionResult, type AIRemixResult } from 'lib/ai-utils'
import { ContentStoreProvider, type Caption, type UploadedImage } from 'lib/contentStore'

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

interface PageProps {
  params: Promise<{ clientId: string }>
}

import { useContentStore } from 'lib/contentStore'

export default function ContentSuitePage({ params }: PageProps) {
  const { clientId } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  
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
  const [addingToProject, setAddingToProject] = useState<string | null>(null)
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)

  // Check for editPostId URL parameter
  useEffect(() => {
    const editPostId = searchParams?.get('editPostId')
    if (editPostId) {
      setEditingPostId(editPostId)
      setIsEditing(true)
      fetchPostForEditing(editPostId)
    }
  }, [searchParams, clientId])

  // Fetch post data for editing
  const fetchPostForEditing = async (postId: string) => {
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
      // Redirect back to planner on error
      router.push(`/dashboard/client/${clientId}/planner`)
    } finally {
      setLoadingPost(false)
    }
  }

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

  // Create new project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      setCreatingProject(true)
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      
      // Prepare the update data
      const updateData = {
        client_id: clientId,
        edited_by_user_id: clientId, // Using clientId as user ID for now
        caption: selectedCaption,
        image_url: uploadedImages[0]?.preview || editingPost?.image_url,
        platforms: ['instagram', 'facebook', 'twitter'], // Default platforms
        edit_reason: 'Updated via content suite',
        media_type: 'image',
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
      
      // Redirect back to planner with success message and refresh flag
      router.push(`/dashboard/client/${clientId}/planner?projectId=${editingPost?.project_id}&success=Post updated successfully&refresh=true`)
      
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
      router.push(`/dashboard/client/${clientId}/planner?projectId=${editingPost.project_id}`)
    } else {
      router.push(`/dashboard/client/${clientId}/planner`)
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
    
    // TODO: Implement scheduler functionality for new posts
    console.log('Sending to scheduler - caption length:', selectedCaption?.length || 0, 'images count:', uploadedImages.length)
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
  handleCancelEdit
}: {
  clientId: string
  projects: Project[]
  projectsLoading: boolean
  setProjects: (projects: Project[]) => void
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
  handleCreateProject: () => void
  // Editing props
  isEditing: boolean
  editingPost: any
  loadingPost: boolean
  updatingPost: boolean
  handleCancelEdit: () => void
}) {
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

  // Function to update content store with custom caption before saving
  const updateContentStoreForSaving = (customCaption?: string) => {
    if (customCaption && customCaption.trim()) {
      // Update the content store with the custom caption
      const captionId = selectedCaptions[0] || 'custom-caption-1'
      const updatedCaptions = captions.map(cap => 
        cap.id === captionId ? { ...cap, text: customCaption } : cap
      )
      
      // If no caption exists, create a new one
      if (updatedCaptions.length === 0 || !captions.find(cap => cap.id === captionId)) {
        updatedCaptions.push({
          id: captionId,
          text: customCaption
        })
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
  const [isCaptionConfirmed, setIsCaptionConfirmed] = useState(false)

  // Handle custom caption changes from SocialPreviewColumn
  const handleCustomCaptionChange = (customCaption: string) => {
    setCustomCaptionFromPreview(customCaption)
  }

  // Handle caption confirmation changes from SocialPreviewColumn
  const handleCaptionConfirmationChange = (confirmed: boolean) => {
    setIsCaptionConfirmed(confirmed)
  }

  // Clear all content when component mounts (reload) - but not when editing
  useEffect(() => {
    if (!isEditing) {
      clearAll();
    }
  }, [isEditing]);

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
  }, [isEditing, editingPost, loadingPost, setCaptions, setSelectedCaptions, setUploadedImages, setActiveImageId, setPostNotes]);

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
    
    try {
      let imageData = post.generatedImage;
      
      // Only convert blob URLs, not base64 strings
      if (imageData && imageData.startsWith('blob:')) {
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
        headers: { 'Content-Type': 'application/json' },
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
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? 'Edit Post' : 'Content Suite'}
              </h1>
              <p className="text-sm text-gray-500">
                {isEditing ? 'Edit your scheduled post content' : 'Create and manage your social media content'}
              </p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
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
                href={`/dashboard/client/${clientId}`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                View All Projects
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Edit Banner */}
      {isEditing && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="flex items-center">
            <Edit3 className="w-5 h-5 text-blue-600 mr-2" />
            <p className="text-sm text-blue-800">
              <strong>Editing scheduled post</strong> - Changes will update your planner and may require reapproval
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
                              
                              // Check if caption is confirmed (required for custom captions)
                              const hasCustomCaption = customCaptionFromPreview && customCaptionFromPreview.trim() !== '';
                              const isCaptionReady = !hasCustomCaption || isCaptionConfirmed;
                              
                              if (!isCaptionReady) {
                                alert('Please confirm your custom caption before adding to project');
                                return;
                              }
                              
                              // Create post object from current content store state
                              // Use custom caption if available, otherwise use selected caption from content store
                              const selectedCaptionText = captions.find(c => c.id === selectedCaptions[0])?.text || '';
                              const finalCaption = customCaptionFromPreview || selectedCaptionText;
                              const currentImage = uploadedImages.find(img => img.id === activeImageId) || uploadedImages[0];
                              
                              console.log('📝 Adding to project - Final Caption:', finalCaption);
                              console.log('📝 Custom caption from preview:', customCaptionFromPreview);
                              console.log('📝 Selected caption from store:', selectedCaptionText);
                              console.log('📝 Content store captions:', captions);
                              console.log('📝 Selected captions:', selectedCaptions);
                              console.log('📝 Caption confirmed:', isCaptionConfirmed);
                              
                              const post = {
                                clientId: clientId,
                                caption: finalCaption,
                                generatedImage: currentImage?.preview || '',
                                notes: postNotes || ''
                              };
                              
                              handleAddToProject(post, project.id);
                            }}
                            disabled={addingToProject === project.id || (!!customCaptionFromPreview && !isCaptionConfirmed)}
                            className={`p-1.5 rounded transition-colors flex items-center justify-center ${
                              addingToProject === project.id 
                                ? 'opacity-50 cursor-not-allowed text-gray-300' 
                                : (!!customCaptionFromPreview && !isCaptionConfirmed)
                                ? 'opacity-50 cursor-not-allowed text-gray-300'
                                : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
                            }`}
                            title={
                              !!customCaptionFromPreview && !isCaptionConfirmed
                                ? "Please confirm your custom caption first"
                                : "Add current content to this project"
                            }
                          >
                          {addingToProject === project.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
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
                <p className="text-xs text-gray-400 mt-1 mb-4">
                  Create your first project to get started
                </p>
                <Button
                  onClick={() => setShowNewProjectForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* New Project Form */}
        {showNewProjectForm && (
          <div className="mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Create New Project</h2>
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
              </div>
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
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCreateProject}
                    disabled={!newProjectName.trim() || creatingProject}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {creatingProject ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1: Image Upload */}
          <ImageUploadColumn />

          {/* Column 2: Caption Generation */}
          <CaptionGenerationColumn />

          {/* Column 3: Social Preview */}
          <SocialPreviewColumn
            clientId={clientId}
            handleSendToScheduler={handleSendToScheduler}
            isSendingToScheduler={isSendingToScheduler || updatingPost}
            isEditing={isEditing}
            updatingPost={updatingPost}
            onCustomCaptionChange={handleCustomCaptionChange}
            onCaptionConfirmationChange={handleCaptionConfirmationChange}
          />
        </div>
      </div>
    </div>
  )
}

// Export the hook and types for use in other components

