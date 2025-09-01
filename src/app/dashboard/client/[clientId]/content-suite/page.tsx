'use client'

import { useState, useCallback, useEffect } from 'react'
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

