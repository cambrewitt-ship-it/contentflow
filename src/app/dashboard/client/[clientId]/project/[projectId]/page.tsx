"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { use } from "react";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { Textarea } from "components/ui/textarea";
import { ArrowLeft, Loader2, Sparkles, RefreshCw } from "lucide-react";
import Link from "next/link";
import { SocialPreview } from "components/social-preview";
import { 
  analyzeImageWithAI, 
  generateCaptionsWithAI, 
  remixCaptionWithAI,
  type AIAnalysisResult,
  type AICaptionResult,
  type AIRemixResult
} from "lib/ai-utils";
import { usePostStore } from "lib/store";

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
  updateImageAIAnalysis: (id: string, analysis: string) => void;
  updateCaption: (id: string, text: string) => void;
  selectCaption: (id: string) => void;
  analyzeImage: (imageId: string, prompt?: string) => Promise<void>;
  generateAICaptions: (imageId: string) => Promise<void>;
  remixCaption: (captionId: string, prompt: string) => Promise<void>;
}

const ContentStoreContext = createContext<ContentStore | null>(null);

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
  aiAnalysis?: string; // Hidden AI analysis data for internal use
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

  const updateImageAIAnalysis = useCallback((id: string, analysis: string) => {
    setUploadedImages(prev => 
      prev.map(img => img.id === id ? { ...img, aiAnalysis: analysis } : img)
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
        ? [] // If clicking the already selected caption, deselect it
        : [id] // Otherwise, select only this caption (single selection)
    );
  }, []);



  const analyzeImage = useCallback(async (imageId: string, prompt?: string) => {
    const image = uploadedImages.find(img => img.id === imageId);
    if (!image) return;

    try {
      const result = await analyzeImageWithAI(image.file, prompt);
      if (result.success && result.analysis) {
        // Store AI analysis separately for internal use (hidden from UI)
        updateImageAIAnalysis(imageId, result.analysis);
        // Don't update the notes field - keep AI analysis hidden
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
    }
  }, [uploadedImages, updateImageAIAnalysis, updateImageNotes]);

  const generateAICaptions = useCallback(async (imageId: string) => {
    const image = uploadedImages.find(img => img.id === imageId);
    if (!image) return;

    try {
      const existingCaptionTexts = captions.map(cap => cap.text);
      
      // Build comprehensive context from both AI analysis and user notes
      const contextParts = [];
      
      if (image.aiAnalysis) {
        contextParts.push(`AI Image Analysis: ${image.aiAnalysis}`);
      }
      
      if (image.notes && image.notes.trim()) {
        contextParts.push(`User Notes: ${image.notes.trim()}`);
      }
      
      const aiContext = contextParts.length > 0 ? contextParts.join('\n\n') + '\n\n' : '';
      
      const result = await generateCaptionsWithAI(image.file, existingCaptionTexts, aiContext);
      
      if (result.success && result.captions && result.captions.length > 0) {
        // Replace the existing placeholder captions with AI-generated ones
        // Keep the same IDs but update the text content
        const updatedCaptions = captions.map((caption, index) => {
          if (index < result.captions!.length) {
            return {
              ...caption,
              text: result.captions![index]
            };
          }
          return caption;
        });
        
        setCaptions(updatedCaptions);
      }
    } catch (error) {
      console.error('AI caption generation failed:', error);
    }
  }, [uploadedImages, captions, setCaptions]);

  const remixCaption = useCallback(async (captionId: string, prompt: string) => {
    // Find the image associated with the current active image
    const activeImage = uploadedImages.find(img => img.id === activeImageId);
    if (!activeImage) return;

    try {
      const existingCaptionTexts = captions.map(cap => cap.text);
      
      // Build comprehensive context from both AI analysis and user notes
      const contextParts = [];
      
      if (activeImage.aiAnalysis) {
        contextParts.push(`AI Image Analysis: ${activeImage.aiAnalysis}`);
      }
      
      if (activeImage.notes && activeImage.notes.trim()) {
        contextParts.push(`User Notes: ${activeImage.notes.trim()}`);
      }
      
      const aiContext = contextParts.length > 0 ? contextParts.join('\n\n') + '\n\n' : '';
      
      const result = await remixCaptionWithAI(activeImage.file, prompt, existingCaptionTexts, aiContext);
      
      if (result.success && result.caption) {
        // Update the existing caption instead of creating a new one
        setCaptions(prev => prev.map(cap => 
          cap.id === captionId 
            ? { ...cap, text: result.caption! }
            : cap
        ));
      }
    } catch (error) {
      console.error('AI caption remix failed:', error);
    }
  }, [uploadedImages, captions, activeImageId, setCaptions]);

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
    updateImageAIAnalysis,
    updateCaption,
    selectCaption,
    analyzeImage,
    generateAICaptions,
    remixCaption
  };

  return (
    <ContentStoreContext.Provider value={store}>
      {children}
    </ContentStoreContext.Provider>
  );
}

export default function ProjectPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { clientId, projectId } = resolvedParams;

  return (
    <ContentStoreProvider>
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          {/* Breadcrumb and Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link 
                href={`/dashboard/client/${resolvedParams.clientId}`}
                className="hover:text-foreground transition-colors"
              >
                Client Dashboard
              </Link>
              <span>&gt;</span>
              <span className="text-foreground font-medium">Content Suite</span>
            </div>
            
            <div className="flex items-center gap-4">
              <Link 
                href={`/dashboard/client/${resolvedParams.clientId}`}
                className="p-2 hover:bg-accent rounded-md transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground">Content Suite</h1>
                <p className="text-muted-foreground mt-2">
                  Upload images, add notes, and craft compelling captions for your social media content.
                </p>
              </div>
              
              {/* Scheduler Navigation Button */}
              <Link 
                href={`/dashboard/client/${resolvedParams.clientId}/project/${resolvedParams.projectId}/scheduler`}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Go to Scheduler
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Column 1: Image Upload + Notes */}
            <ImageUploadColumn />
            
            {/* Column 2: Editable Captions */}
            <CaptionColumn clientId={clientId} projectId={projectId} />
            
            {/* Column 3: Social Preview */}
            <SocialPreviewColumn clientId={clientId} projectId={projectId} />
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
    setActiveImageId,
    analyzeImage
  } = useContentStore();

  const [analyzingImage, setAnalyzingImage] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newImages: UploadedImage[] = Array.from(files).map((file, index) => ({
        id: `img-${Date.now()}-${index}`,
        file,
        preview: URL.createObjectURL(file),
        notes: "",
        aiAnalysis: undefined
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
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAnalyzingImage(image.id);
                          analyzeImage(image.id).finally(() => setAnalyzingImage(null));
                        }}
                        disabled={analyzingImage === image.id}
                        className="flex-1"
                      >
                        {analyzingImage === image.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            AI Analyze
                          </>
                        )}
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Add notes about this image or use AI analysis..."
                      value={image.notes}
                      onChange={(e) => updateImageNotes(image.id, e.target.value)}
                      className="min-h-20"
                    />
                  </div>
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
function CaptionColumn({ clientId, projectId }: { clientId: string; projectId: string }) {
  const { 
    captions, 
    selectedCaptions, 
    updateCaption, 
    selectCaption, 
    generateAICaptions,
    remixCaption,
    uploadedImages,
    activeImageId
  } = useContentStore();

  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [remixingCaption, setRemixingCaption] = useState<string | null>(null);
  const [remixPrompt, setRemixPrompt] = useState('');

  const handleRemixThis = (captionId: string) => {
    setRemixingCaption(captionId);
    setRemixPrompt('');
  };

  const handleAIRemix = async (captionId: string) => {
    if (!remixPrompt.trim()) return;
    
    try {
      await remixCaption(captionId, remixPrompt);
      setRemixingCaption(null);
      setRemixPrompt('');
    } catch (error) {
      console.error('Failed to remix caption:', error);
    }
  };

  const handleAIGenerateCaptions = async () => {
    setGeneratingCaptions(true);
    try {
      // Use the currently active/selected image for AI caption generation
      if (activeImageId) {
        await generateAICaptions(activeImageId);
      } else if (uploadedImages.length > 0) {
        // Fallback to first image if no active image is selected
        await generateAICaptions(uploadedImages[0].id);
      }
    } catch (error) {
      console.error('Failed to generate AI captions:', error);
    } finally {
      setGeneratingCaptions(false);
    }
  };

  const handleSendToScheduler = async (captionText: string) => {
    try {
      if (!activeImageId || !clientId || !projectId) {
        alert('Missing required information. Please ensure an image is selected and you have proper access.');
        return;
      }

      const activeImage = uploadedImages.find(img => img.id === activeImageId);
      if (!activeImage) {
        alert('Selected image not found.');
        return;
      }

      console.log('🚀 Sending content to scheduler...', {
        caption: captionText,
        imageUrl: activeImage.preview,
        clientId,
        projectId,
        notes: activeImage.notes
      });
      
      // Create post object with all required fields
      const newPost = {
        id: Date.now().toString(),
        clientId,
        projectId,
        imageUrl: activeImage.preview,
        caption: captionText,
        mediaType: 'image' as const,
        originalCaption: captionText,
        createdAt: new Date().toISOString(),
        status: 'draft' as const,
        notes: activeImage.notes || '',
      };

      console.log('📝 Created post object:', newPost);
      
      // Add post to store
      const { addPost } = usePostStore.getState();
      addPost(newPost);
      
      console.log('✅ Post successfully added to store');
      
      // Provide visual feedback
      alert('Content sent to scheduler successfully!');
      
      // Navigate to scheduler with the new post
      window.location.href = `/dashboard/client/${clientId}/project/${projectId}/scheduler`;
      
    } catch (error) {
      console.error('❌ Error sending to scheduler:', error);
      alert(`Failed to send content to scheduler: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-card-foreground mb-4">Captions</h2>
        <p className="text-sm text-muted-foreground mb-4">Select one caption to display in the preview. Only one caption can be selected at a time.</p>
        
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
                  type="radio"
                  name="caption-selection"
                  checked={selectedCaptions.includes(caption.id)}
                  onChange={() => selectCaption(caption.id)}
                  className="border-border"
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
              
              <div className="space-y-3">
                {remixingCaption === caption.id && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Describe how you want to remix this caption..."
                      value={remixPrompt}
                      onChange={(e) => setRemixPrompt(e.target.value)}
                      className="min-h-16 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAIRemix(caption.id)}
                        disabled={!remixPrompt.trim()}
                        className="flex-1"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        AI Remix
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRemixingCaption(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemixThis(caption.id)}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 h-4 mr-2" />
                    Remix This
                  </Button>
                  <Button
                    variant={selectedCaptions.includes(caption.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectCaption(caption.id)}
                  >
                    {selectedCaptions.includes(caption.id) ? "Selected" : "Select This"}
                  </Button>
                  
                  {/* Send to Scheduler Button */}
                  {selectedCaptions.includes(caption.id) && uploadedImages.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSendToScheduler(caption.text)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Send to Scheduler
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          <div className="pt-4 border-t">
            <Button
              variant="default"
              size="lg"
              onClick={handleAIGenerateCaptions}
              disabled={generatingCaptions || uploadedImages.length === 0}
              className="w-full"
            >
              {generatingCaptions ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating AI Captions...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate AI Captions
                </>
              )}
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

  const selectedCaption = selectedCaptions.length > 0 ? captions.find(cap => cap.id === selectedCaptions[0])?.text : undefined;

  const handleImageSelect = (imageId: string) => {
    setActiveImageId(imageId);
  };

  return (
    <div className="space-y-6">
      <SocialPreview 
        images={uploadedImages}
        activeImageId={activeImageId}
        onImageSelect={handleImageSelect}
        caption={selectedCaption}
        totalCaptionCount={captions.length}
      />
      
      {/* Scheduler Action Button */}
      {uploadedImages.length > 0 && selectedCaptions.length > 0 && (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-card-foreground mb-3">Ready to Schedule?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Your content is ready! Head to the scheduler to plan your posts.
          </p>
          <Link 
            href={`/dashboard/client/${clientId}/project/${projectId}/scheduler`}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold w-full justify-center shadow-md hover:shadow-lg transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Schedule This Content
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}