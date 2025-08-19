"use client";
import { useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Input } from "components/ui/input";
import { Textarea } from "components/ui/textarea";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "components/ui/dropdown-menu";
import { Loader2, Upload, Trash2, Globe, Plus, MoreHorizontal, Calendar, FileText } from "lucide-react";

// LateConnectButton component
function LateConnectButton({ platform }: { platform: string }) {
  const [loading, setLoading] = useState(false);

  async function startConnect() {
    setLoading(true);
    try {
      const res = await fetch('/api/late/start-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      });
      const { connectUrl } = await res.json();
      window.location.href = connectUrl;
    } catch (e) {
      console.error(e);
      alert('Error starting connect flow');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={startConnect} disabled={loading}>
      {loading ? `Connecting ${platform}…` : `Connect ${platform}`}
    </Button>
  );
}

const initialData = {
  logo: "☕",
  name: "Coastal Coffee Co.",
  website: "www.coastalcoffee.com",
  description:
    "Premium artisanal coffee roasters focusing on sustainable, locally-sourced beans with a coastal lifestyle brand.",
};

// Sample projects data
const initialProjects = [
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
  },
  {
    id: 3,
    name: "Summer Sale Promo",
    status: "Completed",
    postCount: 6,
    lastUpdated: "1 week ago",
    description: "Summer sale promotional campaign"
  },
  {
    id: 4,
    name: "Brand Awareness",
    status: "Review",
    postCount: 10,
    lastUpdated: "yesterday",
    description: "Brand awareness campaign"
  }
];

const statusColors = {
  Draft: "bg-gray-100 text-gray-800",
  Active: "bg-green-100 text-green-800",
  Review: "bg-blue-100 text-blue-800",
  Completed: "bg-purple-100 text-purple-800"
};

export default function ClientDashboard() {
  const [website, setWebsite] = useState(initialData.website);
  const [about, setAbout] = useState(initialData.description);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [projects, setProjects] = useState(initialProjects);
  const [newProjectDialog, setNewProjectDialog] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", status: "Draft" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  // Extract clientId from pathname
  const clientId = pathname.split("/").filter(Boolean)[2];

  // Simulate save
  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSaving(false);
  };

  // Simulate file upload
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drag & drop
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

  // Project functions
  const handleCreateProject = () => {
    if (newProject.name.trim()) {
      const project = {
        id: Date.now(),
        name: newProject.name,
        status: newProject.status,
        postCount: 0,
        lastUpdated: "just now",
        description: newProject.description
      };
      setProjects((prev) => [...prev, project]);
      setNewProject({ name: "", description: "", status: "Draft" });
      setNewProjectDialog(false);
    }
  };

  const handleProjectClick = (project: typeof initialProjects[0]) => {
    router.push(`/dashboard/client/${clientId}/project/${project.id}/content-suite`);
  };

  const handleProjectAction = (action: string, project: typeof initialProjects[0]) => {
    switch (action) {
      case "edit":
        alert(`Edit ${project.name} - Coming Soon!`);
        break;
      case "duplicate":
        const duplicated = {
          ...project,
          id: Date.now(),
          name: `${project.name} (Copy)`,
          lastUpdated: "just now"
        };
        setProjects((prev) => [...prev, duplicated]);
        break;
      case "delete":
        if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
          setProjects((prev) => prev.filter((p) => p.id !== project.id));
        }
        break;
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-2 md:px-8 w-full">
      {/* Header */}
      <div className="flex items-center gap-6 mb-10">
        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-3xl">
          {initialData.logo}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {initialData.name}
            </h1>
          </div>
          <a
            href={`https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:underline text-sm mt-1"
          >
            <Globe className="w-4 h-4" />
            {website}
          </a>
          <div className="text-muted-foreground text-sm mt-2 max-w-xl">
            {initialData.description}
          </div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Left: Company Info */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
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
                <label className="block text-sm font-medium mb-1">About</label>
                <Textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={5}
                  placeholder="Company description or notes"
                  required
                />
              </div>
              <Button type="submit" disabled={saving} className="w-full mt-2">
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin h-4 w-4" /> Saving...
                  </span>
                ) : (
                  "Save"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Brand Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${uploading ? "border-primary bg-primary/10" : "hover:border-primary/60"}`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
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

      {/* LATE API Connections Section */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Social Media Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <h4 className="font-medium mb-2">Instagram</h4>
                <LateConnectButton platform="instagram" />
              </div>
              <div className="text-center">
                <h4 className="font-medium mb-2">Facebook</h4>
                <LateConnectButton platform="facebook" />
              </div>
              <div className="text-center">
                <h4 className="font-medium mb-2">Twitter</h4>
                <LateConnectButton platform="twitter" />
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground text-center">
              Connect your social media accounts to enable automated posting via LATE API
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
              onClick={() => handleProjectClick(project)}
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
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleProjectAction("edit", project); }}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleProjectAction("duplicate", project); }}>
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); handleProjectAction("delete", project); }}
                        className="text-destructive"
                      >
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