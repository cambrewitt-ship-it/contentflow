"use client";
import { useState, useEffect } from "react";
import { use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Input } from "components/ui/input";
import { Textarea } from "components/ui/textarea";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "components/ui/dropdown-menu";
import { Loader2, Upload, Trash2, Globe, Plus, MoreHorizontal, Calendar, FileText, AlertCircle, UserX } from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  description?: string;
  website?: string;
  industry?: string;
  founded_date?: string;
  created_at: string;
}

export default function ClientDashboard({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newProjectDialog, setNewProjectDialog] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", status: "Draft" });

  // Sample projects data
  const projects = [
    {
      id: 1,
      name: "July Content",
      status: "Active",
      postCount: 8,
      lastUpdated: "2 days ago",
      description: "Monthly content calendar for July"
    },
    {
      id: 2,
      name: "Christmas Campaign",
      status: "Draft",
      postCount: 15,
      lastUpdated: "5 days ago",
      description: "Holiday season promotional content"
    }
  ];

  const statusColors = {
    Draft: "bg-gray-100 text-gray-800",
    Active: "bg-green-100 text-green-800",
    Review: "bg-blue-100 text-blue-800",
    Completed: "bg-purple-100 text-purple-800"
  };

  // Fetch client data via API
  useEffect(() => {
    async function fetchClient() {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 Fetching client data for ID:', clientId);
        
        const response = await fetch(`/api/clients/${clientId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Client not found');
          }
          throw new Error(`Failed to fetch client: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Client data fetched:', data);
        
        setClient(data.client);
        setWebsite(data.client.website || "");
        setAbout(data.client.description || "");
        
      } catch (err) {
        console.error('❌ Error fetching client:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch client data');
      } finally {
        setLoading(false);
      }
    }

    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    // TODO: Implement save to API
    await new Promise((r) => setTimeout(r, 1200));
    setSaving(false);
  };

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    for (const file of selected) {
      setUploading(true);
      setUploadProgress(0);
      // Simulate upload progress
      for (let i = 1; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise((r) => setTimeout(r, 20));
      }
      setFiles((prev) => [...prev, file]);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle drag & drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    for (const file of dropped) {
      setUploading(true);
      setUploadProgress(0);
      for (let i = 1; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise((r) => setTimeout(r, 20));
      }
      setFiles((prev) => [...prev, file]);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handle project creation
  const handleCreateProject = () => {
    if (newProject.name.trim()) {
      // TODO: Implement project creation
      setNewProject({ name: "", description: "", status: "Draft" });
      setNewProjectDialog(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-700">Loading client data...</h2>
        <p className="text-gray-500">Please wait while we fetch the client information.</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Client</h1>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Client not found state
  if (!client) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <UserX className="h-8 w-8 text-yellow-600" />
        </div>
        <h1 className="text-2xl font-bold text-yellow-600 mb-4">Client Not Found</h1>
        <p className="text-gray-600 mb-4">The client with ID "{clientId}" could not be found.</p>
        <Link href="/dashboard">
          <Button variant="outline">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-2 md:px-8 w-full">
      {/* Header */}
      <div className="flex items-center gap-6 mb-10">
        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-3xl">
          {client.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {client.name}
            </h1>
            {client.industry && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {client.industry}
              </Badge>
            )}
          </div>
          {client.website && (
            <a
              href={`https://${client.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:underline text-sm mt-1"
            >
              <Globe className="w-4 h-4" />
              {client.website}
            </a>
          )}
          {client.founded_date && (
            <p className="text-sm text-muted-foreground mt-1">
              Founded {new Date(client.founded_date).getFullYear()}
            </p>
          )}
          <div className="text-muted-foreground text-sm mt-2 max-w-xl">
            {client.description || 'No description provided'}
          </div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Left: Company Info */}
        <Card>
          <CardHeader>
            <CardTitle>Website & Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleSave();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Website</label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  type="url"
                  placeholder="Website URL"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Company Information
                </label>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter company description..."
                />
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  Save Changes
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Social Media Platforms Bar */}
        <div className="col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Media Platforms</h3>
          <div className="flex justify-between items-center">
            <button className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">f</span>
              </div>
              <span className="text-xs text-gray-600">Facebook</span>
            </button>
            
            <button className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">IG</span>
              </div>
              <span className="text-xs text-gray-600">Instagram</span>
            </button>
            
            <button className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">X</span>
              </div>
              <span className="text-xs text-gray-600">X</span>
            </button>
            
            <button className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">in</span>
              </div>
              <span className="text-xs text-gray-600">LinkedIn</span>
            </button>
            
            <button className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">TT</span>
              </div>
              <span className="text-xs text-gray-600">TikTok</span>
            </button>
            
            <button className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">YT</span>
              </div>
              <span className="text-xs text-gray-600">YouTube</span>
            </button>
            
            <button className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">T</span>
              </div>
              <span className="text-xs text-gray-600">Threads</span>
            </button>
          </div>
        </div>

        {/* Right: Tone of Voice Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Tone of Voice Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${uploading ? "border-primary bg-primary/10" : "hover:border-primary/60"}`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <input
                id="fileInput"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="mx-auto mb-2 text-primary" />
              <div className="font-medium">Upload brand documents, tone of voice guides, logos, etc.</div>
              <div className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, PNG, JPG</div>
              {uploading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-primary">
                  <Loader2 className="animate-spin h-4 w-4" />
                  Uploading... {uploadProgress}%
                </div>
              )}
            </div>
            {/* File List */}
            <div className="mt-6 space-y-2">
              {files.length === 0 && (
                <div className="text-sm text-muted-foreground text-center">No files uploaded yet.</div>
              )}
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-muted rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium truncate max-w-[180px]">{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteFile(idx)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Section */}
      <div className="border-t border-border pt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Projects</h2>
          <Dialog open={newProjectDialog} onOpenChange={setNewProjectDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Project Name *</label>
                  <Input
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    placeholder="Enter project name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="Project description (optional)"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={newProject.status}
                    onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
                    className="w-full p-2 border border-input rounded-md bg-background"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Review">Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateProject} className="flex-1">
                    Create Project
                  </Button>
                  <Button variant="outline" onClick={() => setNewProjectDialog(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate mb-1">
                      {project.name}
                    </h3>
                    <Badge className={statusColors[project.status as keyof typeof statusColors]}>
                      {project.status}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>{project.postCount} posts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Updated {project.lastUpdated}</span>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {project.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}