"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { use } from "react";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { Textarea } from "components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SocialPreview } from "components/social-preview";
import { useRouter } from 'next/navigation';
import { usePostStore } from 'lib/store';
import React, { useMemo } from 'react';

// Global store context
interface ContentStore {
  uploadedImages: UploadedImage[];
  captions: Caption[];
  selectedCaptions: string[];
  activeImageId: string | null;
  setUploadedImages: (images: UploadedImage[]) => void;
  setCaptions: (captions: Caption[]) => void;
  setSelectedCaptions: (captions: string[]) => void;
  setActiveImageId: (id: string | null) => void;
  addImage: (image: UploadedImage) => void;
  removeImage: (id: string) => void;
  updateImageNotes: (id: string, notes: string) => void;
  updateCaption: (id: string, text: string) => void;
  selectCaption: (id: string) => void;
  generateCaptions: () => void;
}

const ContentStoreContext = createContext<ContentStore | null>(null);

// Custom hook to use the store
const useContentStore = () => {
  const context = useContext(ContentStoreContext);
  if (!context) {
    throw new Error("useContentStore must be used within ContentStoreProvider");
  }
  return context;
};

interface Caption {
  id: string;
  text: string;
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  notes: string;
}

interface PageProps {
  params: Promise<{
    clientId: string;
    projectId: string;
  }>;
}

// Store provider component
function ContentStoreProvider({ children }: { children: React.ReactNode }) {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [captions, setCaptions] = useState<Caption[]>([
    { id: "1", text: "Ready to create amazing content? Let's make something special! ✨" },
    { id: "2", text: "Your brand story deserves to be told. Let's craft the perfect message together. 🚀" },
    { id: "3", text: "From concept to creation, we're here to bring your vision to life. 💫" }
  ]);
  const [selectedCaptions, setSelectedCaptions] = useState<string[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

  const addImage = useCallback((image: UploadedImage) => {
    setUploadedImages(prev => [...prev, image]);
    // Set as active image if it's the first one
    if (uploadedImages.length === 0) {
      setActiveImageId(image.id);
    }
  }, [uploadedImages.length]);

  const removeImage = useCallback((id: string) => {
    setUploadedImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      const newImages = prev.filter(img => img.id !== id);
      
      // If we're removing the active image, set a new active one
      if (activeImageId === id) {
        setActiveImageId(newImages.length > 0 ? newImages[0].id : null);
      }
      
      return newImages;
    });
  }, [activeImageId]);

  const updateImageNotes = useCallback((id: string, notes: string) => {
    setUploadedImages(prev => 
      prev.map(img => img.id === id ? { ...img, notes } : img)
    );
  }, []);

  const updateCaption = useCallback((id: string, text: string) => {
    setCaptions(prev => 
      prev.map(cap => cap.id === id ? { ...cap, text } : cap)
    );
  }, []);

  const selectCaption = useCallback((id: string) => {
    setSelectedCaptions(prev => 
      prev.includes(id) 
        ? prev.filter(captionId => captionId !== id)
        : [...prev, id]
    );
  }, []);

  const generateCaptions = useCallback(() => {
    // Stub caption generation with placeholder text
    const newCaptions: Caption[] = [
      { id: `gen-${Date.now()}-1`, text: "🎯 Fresh perspective alert! This content is about to change the game. Ready to make waves? 🌊" },
      { id: `gen-${Date.now()}-2`, text: "✨ When creativity meets strategy, magic happens. This is your moment to shine! ✨" },
      { id: `gen-${Date.now()}-3`, text: "🚀 Innovation meets inspiration. Let's create something that speaks volumes without saying a word. 💭" }
    ];
    
    setCaptions(prev => [...prev, ...newCaptions]);
  }, []);

  const store: ContentStore = {
    uploadedImages,
    captions,
    selectedCaptions,
    activeImageId,
    setUploadedImages,
    setCaptions,
    setSelectedCaptions,
    setActiveImageId,
    addImage,
    removeImage,
    updateImageNotes,
    updateCaption,
    selectCaption,
    generateCaptions
  };

  return (
    <ContentStoreContext.Provider value={store}>
      {children}
    </ContentStoreContext.Provider>
  );
}

export default function ContentSuitePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const key = `${resolvedParams.clientId}:${resolvedParams.projectId}`;

  const getPostsInStore = usePostStore(s => s.getPostsByProjectAndClient);
  const addPostToStore = usePostStore(s => s.addPostFromContentSuite);

  function handleScheduleClick() {
    // Try to detect common local variables used for posts
    const possibleNames = ['projectPosts','selectedPosts','posts','currentPosts','compiledPosts'];
    let currentLocalPosts = null;
    for (const name of possibleNames) {
      // Cursor: check the file's scope for the variable name; if found, set currentLocalPosts to it.
      // If you cannot detect any of these names in the file scope, STOP and return the single line:
      // MISSING_LOCAL_POSTS_VAR
      if (typeof eval(name) !== 'undefined') {
        currentLocalPosts = eval(name);
        break;
      }
    }
    if (!currentLocalPosts) {
      // Stop and return marker so the developer can tell us the exact variable name.
      throw new Error('MISSING_LOCAL_POSTS_VAR');
    }

    const existing = getPostsInStore(resolvedParams.projectId, resolvedParams.clientId) || [];
    const existingIds = new Set(existing.map(p => p.id));

    (currentLocalPosts || []).forEach((p: any) => {
      if (!existingIds.has(p.id)) {
        addPostToStore(p.imageUrl, p.caption, resolvedParams.projectId, resolvedParams.clientId, p.notes || '');
      }
    });

    router.push(`/dashboard/client/${resolvedParams.clientId}/project/${resolvedParams.projectId}/scheduler`);
  }

  return (
    <ContentStoreProvider>
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          {/* Breadcrumb and Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link 
                href={`/dashboard/client/${resolvedParams.clientId}/project/${resolvedParams.projectId}`}
                className="hover:text-foreground transition-colors"
              >
                Project
              </Link>
              <span>&gt;</span>
              <span className="text-foreground font-medium">Content Suite</span>
            </div>
            
            <div className="flex items-center gap-4">
              <Link 
                href={`/dashboard/client/${resolvedParams.clientId}/project/${resolvedParams.projectId}`}
                className="p-2 hover:bg-accent rounded-md transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Content Suite</h1>
                <p className="text-muted-foreground mt-2">
                  Upload images, add notes, and craft compelling captions for your social media content.
                </p>
              </div>
              <button type="button" onClick={handleScheduleClick} className="btn">
                Schedule
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Column 1: Image Upload + Notes */}
            <ImageUploadColumn />
            
            {/* Column 2: Editable Captions */}
            <CaptionColumn />
            
            {/* Column 3: Social Preview */}
            <SocialPreviewColumn clientId={resolvedParams.clientId} projectId={resolvedParams.projectId} />
          </div>
        </div>
      </div>
    </ContentStoreProvider>
  );
}

// Column 1: Image Upload + Notes
function ImageUploadColumn() {
  const { 
    uploadedImages, 
    addImage, 
    removeImage, 
    updateImageNotes,
    activeImageId,
    setActiveImageId
  } = useContentStore();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newImages: UploadedImage[] = Array.from(files).map((file, index) => ({
        id: `img-${Date.now()}-${index}`,
        file,
        preview: URL.createObjectURL(file),
        notes: ""
      }));
      newImages.forEach(addImage);
    }
  };

  const handleImageClick = (imageId: string) => {
    setActiveImageId(imageId);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-card-foreground mb-4">Image Upload</h2>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
            />
            <label 
              htmlFor="image-upload" 
              className="cursor-pointer block"
            >
              <div className="text-muted-foreground mb-2">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">
                Click to upload images or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, GIF up to 10MB
              </p>
            </label>
          </div>

          {uploadedImages.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-card-foreground">Uploaded Images</h3>
              {uploadedImages.map((image) => (
                <div key={image.id} className="space-y-3">
                  <div 
                    className={`relative group cursor-pointer rounded-lg border-2 transition-all ${
                      image.id === activeImageId ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleImageClick(image.id)}
                  >
                    <img
                      src={image.preview}
                      alt="Uploaded content"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(image.id);
                      }}
                    >
                      ×
                    </Button>
                    {image.id === activeImageId && (
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
                        ✓
                      </div>
                    )}
                  </div>
                  <Textarea
                    placeholder="Add notes about this image..."
                    value={image.notes}
                    onChange={(e) => updateImageNotes(image.id, e.target.value)}
                    className="min-h-20"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Column 2: Editable Captions
function CaptionColumn() {
  const { 
    captions, 
    selectedCaptions, 
    updateCaption, 
    selectCaption, 
    generateCaptions 
  } = useContentStore();

  const handleRemixThis = (captionId: string) => {
    // TODO: Implement AI caption remixing for specific caption
    console.log(`Remixing caption ${captionId}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-card-foreground mb-4">Captions</h2>
        
        <div className="space-y-4">
          {captions.map((caption) => (
            <div 
              key={caption.id} 
              className={`space-y-3 p-4 rounded-lg border-2 transition-all ${
                selectedCaptions.includes(caption.id) 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCaptions.includes(caption.id)}
                  onChange={() => selectCaption(caption.id)}
                  className="rounded border-border"
                />
                <span className="text-sm text-muted-foreground">Caption {caption.id}</span>
                {selectedCaptions.includes(caption.id) && (
                  <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                    Selected
                  </span>
                )}
              </div>
              
              <Textarea
                value={caption.text}
                onChange={(e) => updateCaption(caption.id, e.target.value)}
                placeholder="Enter your caption..."
                className="min-h-24"
              />
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemixThis(caption.id)}
                  className="flex-1"
                >
                  Remix This
                </Button>
                <Button
                  variant={selectedCaptions.includes(caption.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => selectCaption(caption.id)}
                >
                  {selectedCaptions.includes(caption.id) ? "Selected" : "Select"}
                </Button>
              </div>
            </div>
          ))}
          
          <div className="pt-4 border-t">
            <Button
              variant="default"
              size="lg"
              onClick={generateCaptions}
              className="w-full"
            >
              Generate New Captions
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Column 3: Social Preview
function SocialPreviewColumn({ clientId, projectId }: { clientId: string; projectId: string }) {
  const { 
    uploadedImages, 
    captions, 
    selectedCaptions, 
    activeImageId,
    setActiveImageId
  } = useContentStore();

  const selectedCaption = captions.find(cap => cap.id === selectedCaptions[selectedCaptions.length - 1])?.text;

  const handleImageSelect = (imageId: string) => {
    setActiveImageId(imageId);
  };

  return (
    <SocialPreview 
      images={uploadedImages}
      activeImageId={activeImageId}
      onImageSelect={handleImageSelect}
      caption={selectedCaption}
      totalCaptionCount={captions.length}
      clientId={clientId}
      projectId={projectId}
    />
  );
}
