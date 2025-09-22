"use client";

import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Input } from "components/ui/input";
import { Textarea } from "components/ui/textarea";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "components/ui/dropdown-menu";
import { 
  Loader2, 
  Upload, 
  Trash2, 
  Globe, 
  Plus, 
  MoreHorizontal, 
  Calendar, 
  FileText, 
  AlertCircle, 
  UserX,
  Search,
  Edit3,
  Save,
  File,
  Image,
  FileText as FileTextIcon,
  Archive
} from "lucide-react";
import Link from "next/link";
import { Client, Project } from 'types/api';


export default function ClientDashboardV2({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('Technology');
  const [foundedDate, setFoundedDate] = useState('2020');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  console.log('🎬 ClientDashboardV2 component rendering for clientId:', clientId);

  // Fetch client data from Supabase
  useEffect(() => {
    console.log('🔥 useEffect triggered for clientId:', clientId);
    fetchClient()
  }, [clientId])
  
  const fetchClient = async () => {
    console.log('🔍 fetchClient called')
    setLoading(true)
    
    // Create Supabase client with environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    console.log('📊 About to query Supabase')
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
    
    console.log('📊 Supabase response - success:', !error, 'count:', data?.length || 0)
    
    if (data && data.length > 0) {
      console.log('✅ Client found:', data[0])
      const clientData = data[0];
      setClient(clientData);
      setWebsite(clientData.website || '');
      setDescription(clientData.description || '');
    } else {
      console.log('❌ No client found')
      setError('No client found with this ID');
    }
    
    setLoading(false)
  }

  // Save client data to Supabase
  const handleSave = async () => {
    if (!client) return;
    
    try {
      setSaving(true);
      console.log('💾 Saving client data to Supabase - website length:', website?.length || 0, 'description length:', description?.length || 0);
      
      // Create Supabase client with environment variables
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      const { error } = await supabase
        .from('clients')
        .update({ 
          website, 
          description,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId);
      
      if (error) {
        console.error('❌ Error saving client data:', error);
        throw new Error(`Failed to save: ${error.message}`);
      }
      
      console.log('✅ Client data saved successfully');
      setEditing(false);
      
      // Update local client state
      setClient(prev => prev ? { ...prev, website, description } : null);
      
    } catch (err) {
      console.error('❌ Error saving client data:', err);
      alert(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // File upload handlers
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

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.includes('pdf')) return <FileTextIcon className="w-4 h-4" />;
    if (type.includes('word') || type.includes('document')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Error check for clientId
  if (!clientId) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error: Missing Client ID</h1>
        <p className="text-gray-600">The client ID parameter is required but was not provided.</p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    console.log('⏳ Rendering loading state for clientId:', clientId);
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
    console.log('❌ Rendering error state for clientId:', clientId, 'Error:', error);
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
    console.log('🚫 Rendering "Client not found" state for clientId:', clientId);
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <UserX className="h-8 w-8 text-yellow-600" />
        </div>
        <h1 className="text-2xl font-bold text-yellow-600 mb-4">Client Not Found</h1>
        <p className="text-gray-600 mb-4">The client with ID &quot;{clientId}&quot; could not be found.</p>
        <Link href="/dashboard">
          <Button variant="outline">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  console.log('🎉 Rendering client dashboard with data for clientId:', clientId, 'Client:', client);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-start gap-8">
            {/* Client Avatar */}
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-3xl font-bold text-gray-600 flex-shrink-0">
              {client.name ? client.name.charAt(0).toUpperCase() : 'C'}
            </div>
            
            {/* Client Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 mb-4">
                <h1 className="text-3xl font-bold text-gray-700">{client.name}</h1>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {industry}
                </Badge>
              </div>
              
              {/* Website & Founded Date */}
              <div className="flex items-center gap-6 mb-4">
                {website && (
                  <a
                    href={`https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    <Globe className="w-4 h-4" />
                    <span className="text-sm font-medium">{website}</span>
                  </a>
                )}
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Founded {foundedDate}</span>
                </div>
              </div>
              
              {/* Description */}
              <div className="flex items-start gap-3">
                <p className="text-gray-600 text-base leading-relaxed flex-1">
                  {description || 'No company description provided. Click edit to add one.'}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(!editing)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* Left Column: Website & Contact */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="card-title-26 flex items-center justify-between">
                <span>Website & Contact</span>
                {editing && (
                  <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    size="sm"
                    className="bg-black hover:bg-gray-800"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website URL</label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Enter website URL"
                  disabled={!editing}
                  className="disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Information</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your company, mission, and values..."
                  rows={6}
                  disabled={!editing}
                  className="disabled:bg-gray-50 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Tone of Voice Documents */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="card-title-26">Tone of Voice Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Upload Dropzone */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  uploading ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="mx-auto mb-3 text-gray-400 w-8 h-8" />
                <div className="font-medium text-gray-700 mb-1">
                  Drop files here or click to upload
                </div>
                <div className="text-sm text-gray-500">
                  Upload brand guidelines, tone of voice, style guides, etc.
                </div>
                {uploading && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                    <Loader2 className="animate-spin w-4 h-4" />
                    Uploading... {uploadProgress}%
                  </div>
                )}
              </div>

              {/* File List */}
              <div className="mt-6 space-y-3">
                {files.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Archive className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No documents uploaded yet</p>
                    <p className="text-xs text-gray-400">Upload your first document to get started</p>
                  </div>
                ) : (
                  files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="text-gray-500">
                          {getFileIcon(file)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFile(idx)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section: Projects */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="card-title-26">Projects</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {projects.length} project{projects.length !== 1 ? 's' : ''} total
                </p>
              </div>
              <Button className="bg-black hover:bg-gray-800">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-gray-200 focus:border-gray-300"
                />
              </div>
            </div>

            {/* Projects List */}
            {projects.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No projects yet</h3>
                <p className="text-gray-500 mb-6">
                  Create your first project to start organizing your content and campaigns.
                </p>
                <Button className="bg-black hover:bg-gray-800">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <div key={project.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <h4 className="font-medium text-gray-700 mb-2">{project.name}</h4>
                    <p className="text-sm text-gray-500 mb-3">{project.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{project.postCount || 0} posts</span>
                      <span>Updated {project.lastUpdated || 'recently'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
