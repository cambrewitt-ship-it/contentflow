'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, X, ImageIcon, Video, Upload, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadMediaToBlob } from '@/lib/blobUpload';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];
const MAX_FILES = 50;
const UPLOAD_THROTTLE_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postGalleryItems(
  clientId: string,
  token: string,
  items: Array<{ mediaUrl: string; fileName: string; mediaType: 'image' | 'video'; userContext?: string }>
) {
  const maxAttempts = 4;
  let attempt = 0;

  while (true) {
    const response = await fetch('/api/media-gallery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ clientId, items }),
    });

    const responseText = await response.text();
    let data: any;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = { error: responseText };
    }

    if (response.ok && data?.success) {
      return;
    }

    const errorMessage = data?.error || data?.message || 'Upload failed';
    const isRateLimit = response.status === 429 || errorMessage.toLowerCase().includes('too many requests');

    if (!isRateLimit || attempt >= maxAttempts - 1) {
      throw new Error(errorMessage);
    }

    const retryDelay = 1000 * Math.pow(2, attempt);
    attempt += 1;
    await sleep(retryDelay);
  }
}

interface SelectedFile {
  id: string;
  file: File;
  preview: string;
  context: string;
  showContext: boolean;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
}

interface MediaUploadDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
}

export default function MediaUploadDialog({
  clientId,
  open,
  onOpenChange,
  onUploadComplete,
}: MediaUploadDialogProps) {
  const { getAccessToken } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [uploadingFile, setUploadingFile] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);
      const valid = fileArray.filter(f => ACCEPTED_TYPES.includes(f.type));
      const rejected = fileArray.length - valid.length;

      if (rejected > 0) {
        setError(
          `${rejected} file${rejected !== 1 ? 's' : ''} rejected — only JPEG, PNG, GIF, WebP, MP4, MOV, and WebM are supported.`
        );
      }

      const remaining = MAX_FILES - selectedFiles.length;
      const toAdd = valid.slice(0, remaining);

      setSelectedFiles(prev => [
        ...prev,
        ...toAdd.map(file => ({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
          context: '',
          showContext: false,
          status: 'pending',
        } as SelectedFile)),
      ]);
    },
    [selectedFiles.length]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setSelectedFiles(prev => {
      const removed = prev.find(f => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const updateContext = (id: string, context: string) => {
    setSelectedFiles(prev => prev.map(f => (f.id === id ? { ...f, context } : f)));
  };

  const toggleContext = (id: string) => {
    setSelectedFiles(prev =>
      prev.map(f => (f.id === id ? { ...f, showContext: !f.showContext } : f))
    );
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError(null);
    setSuccess(false);
    setProgress({ current: 0, total: selectedFiles.length });
    setUploadingFile('');

    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error('Authentication is required to upload media. Please sign in again.');
      }

      const items: Array<{ mediaUrl: string; fileName: string; mediaType: 'image' | 'video'; userContext?: string }> = [];
      let completed = 0;
      const failedFiles: string[] = [];
      let firstErrorMessage: string | null = null;

      for (const fileItem of selectedFiles) {
        setUploadingFile(fileItem.file.name);
        setSelectedFiles(prev =>
          prev.map(f =>
            f.id === fileItem.id ? { ...f, status: 'uploading' } : f
          )
        );

        try {
          const uploadResult = await uploadMediaToBlob(fileItem.file, fileItem.file.name, token || undefined);

          items.push({
            mediaUrl: uploadResult.url,
            fileName: fileItem.file.name,
            mediaType: uploadResult.mediaType,
            userContext: fileItem.context || undefined,
          });

          setSelectedFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id ? { ...f, status: 'uploaded' } : f
            )
          );
        } catch (uploadError) {
          const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
          if (!firstErrorMessage) {
            firstErrorMessage = message;
          }
          failedFiles.push(fileItem.file.name);
          setSelectedFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id ? { ...f, status: 'failed' } : f
            )
          );
        }

        completed += 1;
        setProgress({ current: completed, total: selectedFiles.length });

        if (completed < selectedFiles.length) {
          await sleep(UPLOAD_THROTTLE_MS);
        }
      }

      if (items.length > 0) {
        await postGalleryItems(clientId, token, items);
      }

      if (items.length === 0) {
        throw new Error(firstErrorMessage || 'Upload failed for all files.');
      }

      if (failedFiles.length > 0) {
        setError(`${failedFiles.length} file${failedFiles.length === 1 ? '' : 's'} failed to upload. ${firstErrorMessage || ''}`);
      } else {
        setSuccess(true);
      }

      setTimeout(() => {
        if (items.length > 0) {
          onUploadComplete();
        }
        if (failedFiles.length === 0) {
          onOpenChange(false);
          setSelectedFiles([]);
          setProgress({ current: 0, total: 0 });
          setSuccess(false);
        }
        setUploadingFile('');
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      if (message.toLowerCase().includes('too many requests') || message.includes('429')) {
        setError('Upload rate limited. Please wait a few seconds and try again.');
      } else {
        setError(message);
      }

      setSelectedFiles(prev =>
        prev.map(f =>
          f.status === 'uploading' ? { ...f, status: 'failed' } : f
        )
      );
    } finally {
      setUploading(false);
      setUploadingFile('');
    }
  };

  const handleClose = () => {
    if (uploading) return;
    selectedFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setSelectedFiles([]);
    setError(null);
    setSuccess(false);
    setProgress({ current: 0, total: 0 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Upload to Media Gallery</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-xs text-gray-500 mt-1">or click to browse</p>
            <p className="text-xs text-gray-400 mt-2">
              JPEG, PNG, GIF, WebP · MP4, MOV, WebM · Max {MAX_FILES} files
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Upload complete! AI analysis will run in the background.
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Uploading {progress.current} of {progress.total}
                {uploadingFile ? ` — ${uploadingFile}` : ''}
              </p>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              {progress.total > 20 && (
                <p className="text-xs text-gray-500 mt-1">
                  Large uploads may take several minutes. Please keep this window open.
                </p>
              )}
            </div>
          )}

          {/* File previews */}
          {selectedFiles.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedFiles.map(sf => (
                  <div key={sf.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="relative aspect-square bg-gray-100">
                      {sf.file.type.startsWith('video/') ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                          <Video className="h-8 w-8 text-white opacity-70" />
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sf.preview}
                          alt={sf.file.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(sf.id)}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black/60 rounded p-0.5">
                        {sf.file.type.startsWith('video/') ? (
                          <Video className="h-3 w-3 text-white" />
                        ) : (
                          <ImageIcon className="h-3 w-3 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs text-gray-700 truncate font-medium">{sf.file.name}</p>
                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                          sf.status === 'uploading'
                            ? 'text-blue-600'
                            : sf.status === 'uploaded'
                            ? 'text-green-600'
                            : sf.status === 'failed'
                            ? 'text-red-600'
                            : 'text-gray-500'
                        }`}>
                          {sf.status === 'uploading'
                            ? 'Uploading'
                            : sf.status === 'uploaded'
                            ? 'Uploaded'
                            : sf.status === 'failed'
                            ? 'Failed'
                            : 'Pending'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleContext(sf.id)}
                        className="text-xs text-blue-600 hover:underline mt-1"
                      >
                        {sf.showContext ? 'Hide context' : '+ Add context'}
                      </button>
                      {sf.showContext && (
                        <Input
                          value={sf.context}
                          onChange={e => updateContext(sf.id, e.target.value)}
                          placeholder="Describe this photo..."
                          className="mt-1 h-7 text-xs"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || selectedFiles.length === 0}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload All ({selectedFiles.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
