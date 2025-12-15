'use client'

import { useState, useEffect } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2, Plus, FolderOpen, Calendar, Edit3, Trash2, Eye } from 'lucide-react'
import Link from 'next/link'
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

interface PageProps {
  params: Promise<{ clientId: string }>
}

export default function ProjectsPage({ params }: PageProps) {
  const { clientId } = use(params)
  const router = useRouter()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const { getAccessToken } = useAuth()
  
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

  // Filter projects based on search term
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-background">
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
              <h1 className="text-2xl font-bold text-gray-700">Projects</h1>
              <p className="text-sm text-gray-500">
                Manage and organize your content projects
              </p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setShowNewProjectForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search and Stats */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {projectsLoading ? 'Loading...' : `${filteredProjects.length} of ${projects.length} project${projects.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>

        {/* New Project Form */}
        {showNewProjectForm && (
          <div className="mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-700">Create New Project</h2>
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

        {/* Projects List */}
        {projectsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-500">Loading projects...</span>
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="space-y-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <FolderOpen className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <h3 className="text-lg font-semibold text-gray-700 truncate">
                        {project.name}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {project.status || 'Active'}
                      </span>
                    </div>
                    
                    {project.description && (
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                      {project.content_metadata?.posts && project.content_metadata.posts.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <Eye className="w-4 h-4" />
                          <span>{project.content_metadata.posts.length} post{project.content_metadata.posts.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <Link
                      href={`/dashboard/client/${clientId}/calendar?projectId=${project.id}`}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      View Calendar
                    </Link>
                    <Link
                      href={`/dashboard/client/${clientId}/content-suite`}
                      className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Content
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              {searchTerm ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? `No projects match "${searchTerm}". Try adjusting your search.`
                : 'Create your first project to get started with content management.'
              }
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setShowNewProjectForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Project
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
