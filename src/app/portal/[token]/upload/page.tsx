"use client";

import { useState, useEffect, useRef } from 'react';
import { usePortal } from "../../../../contexts/PortalContext";
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { Textarea } from "components/ui/textarea";
import { Upload, File, Image, Loader2, RefreshCw, Trash2, CheckCircle, AlertCircle } from "lucide-react";

interface Upload {
  id: string;
  client_id: string;
  project_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function PortalUploadPage() {
  const { client } = usePortal();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUploads = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = window.location.pathname.split('/')[2];
      const response = await fetch(`/api/portal/upload?token=${encodeURIComponent(token)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch uploads');
      }

      const data = await response.json();
      setUploads(data.uploads || []);
    } catch (err) {
      console.error('Error fetching uploads:', err);
      setError(err instanceof Error ? err.message : 'Failed to load uploads');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return;

    setUploading(true);
    const token = window.location.pathname.split('/')[2];

    try {
      for (const file of Array.from(files)) {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Upload to portal
        const response = await fetch('/api/portal/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileUrl: base64,
            notes: ''
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }

      // Refresh uploads list
      await fetchUploads();
    } catch (err) {
      console.error('Error uploading files:', err);
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <File className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-600" />;
    }
    return <File className="h-8 w-8 text-gray-600" />;
  };

  const handleEditNotes = (uploadId: string, currentNotes: string) => {
    setEditingNotes(uploadId);
    setTempNotes(currentNotes || '');
  };

  const handleSaveNotes = async (uploadId: string) => {
    try {
      const token = window.location.pathname.split('/')[2];
      
      const response = await fetch('/api/portal/upload', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          uploadId,
          notes: tempNotes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update notes');
      }

      // Update local state
      setUploads(prev => prev.map(upload => 
        upload.id === uploadId 
          ? { ...upload, notes: tempNotes }
          : upload
      ));

      setEditingNotes(null);
      setTempNotes('');
    } catch (err) {
      console.error('Error updating notes:', err);
      alert('Failed to update notes');
    }
  };

  const handleCancelEdit = () => {
    setEditingNotes(null);
    setTempNotes('');
  };

  useEffect(() => {
    if (client) {
      fetchUploads();
    }
  }, [client]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading uploads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive mb-4">{error}</div>
        <Button onClick={fetchUploads} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-card-foreground">Content Upload</h2>
          <p className="text-muted-foreground">
            Upload images and files for content creation
          </p>
        </div>
        <Button onClick={fetchUploads} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="py-8">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">Upload Content</h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop files here, or click to select files
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mb-4"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
            />
            <p className="text-sm text-muted-foreground">
              Supports images, PDFs, and documents up to 10MB each
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Uploads List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Content</h3>
        
        {uploads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <File className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-muted-foreground">No content uploaded yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Upload some images to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uploads.map((upload) => (
              <Card key={upload.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(upload.status)}
                      {getStatusBadge(upload.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(upload.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Image Display */}
                  {upload.file_type.startsWith('image/') ? (
                    <div className="relative">
                      <img
                        src={upload.file_url}
                        alt={upload.file_name}
                        className="w-full h-48 object-cover rounded-lg border"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden w-full h-48 bg-gray-100 rounded-lg border flex items-center justify-center">
                        <div className="text-center">
                          <Image className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500">Image preview unavailable</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-gray-100 rounded-lg border flex items-center justify-center">
                      <div className="text-center">
                        {getFileIcon(upload.file_type)}
                        <p className="text-sm text-gray-500 mt-2">{upload.file_name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(upload.file_size)}</p>
                      </div>
                    </div>
                  )}

                  {/* File Info */}
                  <div>
                    <h4 className="font-medium text-sm truncate mb-1">
                      {upload.file_name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(upload.file_size)} • {upload.file_type}
                    </p>
                  </div>

                  {/* Notes Section */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Post Notes
                    </label>
                    {editingNotes === upload.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          placeholder="Add notes about this content..."
                          className="min-h-[80px]"
                        />
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveNotes(upload.id)}
                            className="flex-1"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div 
                          className="min-h-[80px] p-3 border rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleEditNotes(upload.id, upload.notes || '')}
                        >
                          {upload.notes ? (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {upload.notes}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">
                              Click to add notes about this content...
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditNotes(upload.id, upload.notes || '')}
                          className="w-full"
                        >
                          {upload.notes ? 'Edit Notes' : 'Add Notes'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    {upload.file_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(upload.file_url, '_blank')}
                        className="flex-1"
                      >
                        View Full Size
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}