'use client'

import { use, useState, createContext, useContext, useCallback, useEffect } from 'react'
import { Button } from 'components/ui/button'
import { Loader2 } from 'lucide-react'
import { ImageUploadColumn } from './ImageUploadColumn'
import { CaptionGenerationColumn } from './CaptionGenerationColumn'
import { SocialPreviewColumn } from './SocialPreviewColumn'
import {
  generateCaptionsWithAI,
  remixCaptionWithAI,
  type AICaptionResult,
  type AIRemixResult,
} from 'lib/ai-utils'

// Global store context
interface ContentStore {
  clientId: string;
  uploadedImages: UploadedImage[];
  captions: Caption[];
  selectedCaptions: string[];
  activeImageId: string | null;
  hasHydrated: boolean;
  postNotes: string;
  setUploadedImages: (images: UploadedImage[]) => void;
  setCaptions: (captions: Caption[]) => void;
  setSelectedCaptions: (captions: string[]) => void;
  setActiveImageId: (id: string | null) => void;
  setPostNotes: (notes: string) => void;
  addImage: (image: UploadedImage) => void;
  removeImage: (id: string) => void;
  updateImageNotes: (id: string, notes: string) => void;
  updateCaption: (id: string, text: string) => void;
  selectCaption: (id: string) => void;
  generateAICaptions: (imageId: string, postNotes?: string) => Promise<void>;
  remixCaption: (captionId: string, prompt: string) => Promise<void>;
}

const ContentStoreContext = createContext<ContentStore | null>(null);

export const useContentStore = () => {
  const context = useContext(ContentStoreContext);
  if (!context) {
    throw new Error("useContentStore must be used within ContentStoreProvider");
  }
  return context;
};

export interface Caption {
  id: string;
  text: string;
}

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  notes: string;
}

interface PageProps {
  params: Promise<{ clientId: string }>
}

// Store provider component
function ContentStoreProvider({ 
  children, 
  clientId 
}: { 
  children: React.ReactNode; 
  clientId: string;
}) {
  // Default values
  const defaultCaptions: Caption[] = [
    {
      id: "1",
      text: "Ready to create amazing content? Let's make something special! ✨",
    },
    {
      id: "2",
      text: "Your brand story deserves to be told. Let's craft the perfect message together. 🚀",
    },
    {
      id: "3",
      text: "From concept to creation, we're here to bring your vision to life. 💫",
    },
  ];

  // Initialize state with default values
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [captions, setCaptions] = useState<Caption[]>(defaultCaptions);
  const [selectedCaptions, setSelectedCaptions] = useState<string[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [postNotes, setPostNotes] = useState<string>('');



  // Helper function to convert blob URL to base64 data URL
  const convertBlobToBase64 = useCallback(
    async (blobUrl: string): Promise<string> => {
      try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error("Error converting blob to base64:", error);
        return blobUrl;
      }
    },
    [],
  );

  // Add image function
  const addImage = useCallback(async (image: UploadedImage) => {
    // Ensure we have a valid File object first
    if (!(image.file instanceof File)) {
      console.error("❌ Invalid file object received:", image.file);
      alert("Error: Invalid image file. Please re-upload the image.");
      return;
    }

    console.log("✅ Adding image with valid file:", {
      id: image.id,
      fileName: image.file.name,
      fileSize: image.file.size,
      fileType: image.file.type
    });

    // For now, let's keep the original image without base64 conversion
    // This should preserve the File object properly
    setUploadedImages((prev) => [...prev, image]);
    
    // Set as active image if it's the first one
    if (uploadedImages.length === 0) {
      setActiveImageId(image.id);
    }
  }, [uploadedImages.length]);

  // Remove image function
  const removeImage = useCallback((id: string) => {
    setUploadedImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
    if (activeImageId === id) {
      setActiveImageId(uploadedImages.length > 1 ? uploadedImages[0]?.id || null : null);
    }
  }, [activeImageId, uploadedImages.length]);

  // Update image notes function
  const updateImageNotes = useCallback((id: string, notes: string) => {
    setUploadedImages(prev => 
      prev.map(img => img.id === id ? { ...img, notes } : img)
    );
  }, []);

  // Update caption function
  const updateCaption = useCallback((id: string, text: string) => {
    setCaptions(prev => 
      prev.map(cap => cap.id === id ? { ...cap, text } : cap)
    );
  }, []);

  // Select caption function - only allow 1 selection at a time
  const selectCaption = useCallback((id: string) => {
    setSelectedCaptions(prev => 
      prev.includes(id) 
        ? [] // If clicking the same caption, deselect it
        : [id] // Otherwise, select only this caption
    );
  }, []);

  // Generate AI captions function
  const generateAICaptions = useCallback(async (imageId: string, postNotes?: string) => {
    const image = uploadedImages.find((img) => img.id === imageId);
    if (!image) return;

    // Debug: Check file object
    console.log("🔍 Image file object:", {
      id: image.id,
      fileType: typeof image.file,
      isFile: image.file instanceof File,
      fileConstructor: image.file?.constructor?.name,
      fileKeys: image.file ? Object.keys(image.file) : 'No file'
    });

    // Ensure we have a valid File object
    if (!(image.file instanceof File)) {
      console.error("❌ Invalid file object for AI processing:", image.file);
      alert("Error: Invalid image file. Please re-upload the image.");
      return;
    }

    try {
      const existingCaptionTexts = captions.map((cap) => cap.text);

      // Build comprehensive context from user notes
      const contextParts = [];

      // Use Post Notes if provided, otherwise fall back to image notes
      if (postNotes && postNotes.trim()) {
        contextParts.push(`User Notes: ${postNotes.trim()}`);
        console.log("🎯 Using Post Notes for AI:", postNotes.trim());
      } else if (image.notes && image.notes.trim()) {
        contextParts.push(`User Notes: ${image.notes.trim()}`);
        console.log("🎯 Using image notes for AI:", image.notes.trim());
      } else {
        console.log("⚠️ No notes provided for AI generation");
      }

      const aiContext =
        contextParts.length > 0 ? contextParts.join("\n\n") + "\n\n" : "";

      const result = await generateCaptionsWithAI(
        image.file,
        existingCaptionTexts,
        aiContext,
        clientId,
      );

      if (result.success && result.captions && result.captions.length > 0) {
        // Replace the existing placeholder captions with AI-generated ones
        // Keep the same IDs but update the text content
        const updatedCaptions = captions.map((caption, index) => {
          if (index < result.captions!.length) {
            return {
              ...caption,
              text: result.captions![index],
            };
          }
          return caption;
        });

        setCaptions(updatedCaptions);
      }
    } catch (error) {
      console.error("AI caption generation failed:", error);
    }
  }, [uploadedImages, captions, setCaptions, clientId]);

  // Remix caption function
  const remixCaption = useCallback(async (captionId: string, prompt: string) => {
    // Find the image associated with the current active image
    const activeImage = uploadedImages.find(
      (img) => img.id === activeImageId,
    );
    if (!activeImage) return;

    // Debug: Check file object
    console.log("🔍 Remix - Image file object:", {
      id: activeImage.id,
      fileType: typeof activeImage.file,
      isFile: activeImage.file instanceof File,
      fileConstructor: activeImage.file?.constructor?.name,
      fileKeys: activeImage.file ? Object.keys(activeImage.file) : 'No file'
    });

    // Ensure we have a valid File object
    if (!(activeImage.file instanceof File)) {
      console.error("❌ Invalid file object for AI remix:", activeImage.file);
      alert("Error: Invalid image file. Please re-upload the image.");
      return;
    }

    try {
      const existingCaptionTexts = captions.map((cap) => cap.text);

      // Build comprehensive context from user notes
      const contextParts = [];

      if (activeImage.notes && activeImage.notes.trim()) {
        contextParts.push(`User Notes: ${activeImage.notes.trim()}`);
      }

      const aiContext =
        contextParts.length > 0 ? contextParts.join("\n\n") + "\n\n" : "";

      const result = await remixCaptionWithAI(
        activeImage.file,
        prompt,
        existingCaptionTexts,
        aiContext,
        clientId,
      );

      if (result.success && result.caption) {
        // Update the specific caption with the remixed version
        setCaptions(prev =>
          prev.map((cap) =>
            cap.id === captionId
              ? { ...cap, text: result.caption! }
              : cap
          ),
        );
      }
    } catch (error) {
      console.error("AI caption remix failed:", error);
    }
  }, [activeImageId, uploadedImages, captions, setCaptions, clientId]);

  // Hydration effect
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const store: ContentStore = {
    clientId,
    uploadedImages,
    captions,
    selectedCaptions,
    activeImageId,
    hasHydrated,
    postNotes,
    setUploadedImages,
    setCaptions,
    setSelectedCaptions,
    setActiveImageId,
    setPostNotes,
    addImage,
    removeImage,
    updateImageNotes,
    updateCaption,
    selectCaption,
    generateAICaptions,
    remixCaption,
  };

  return (
    <ContentStoreContext.Provider value={store}>
      {children}
    </ContentStoreContext.Provider>
  );
}

export default function ContentSuitePage({ params }: PageProps) {
  const { clientId } = use(params)
  const [isSendingToScheduler, setIsSendingToScheduler] = useState(false)

  const convertBlobToBase64 = async (blobUrl: string): Promise<string> => {
    try {
      const response = await fetch(blobUrl)
      const blob = await response.blob()
      return await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Error converting blob to base64:', error)
      return blobUrl
    }
  }

  // AI Caption Generation function
  const handleGenerateAICaptions = async (prompt: string) => {
    try {
      console.log('🚀 Starting AI caption generation from main component...');
      console.log('📝 Post Notes:', prompt);
      console.log('🆔 Client ID:', clientId);

      // Get the current state from the store
      const store = document.querySelector('[data-content-store]')?.getAttribute('data-store');
      if (!store) {
        throw new Error('Content store not accessible');
      }

      // For now, let's use a simpler approach - we'll implement this properly in the next step
      console.log('✅ AI caption generation would be called here with:', { prompt, clientId });
      
      // TODO: Implement actual AI call
      alert('AI Caption Generation is ready to implement! This will use your brand context and Post Notes to generate captions.');
      
    } catch (error) {
      console.error('❌ AI caption generation failed:', error);
      alert(`Failed to generate captions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // AI Caption Remix function
  const handleRemixCaption = async (captionId: string, prompt: string) => {
    try {
      console.log('🔄 Starting caption remix from main component...');
      console.log('📝 Remix prompt:', prompt);
      console.log('🆔 Client ID:', clientId);

      // TODO: Implement actual AI remix call
      alert('AI Caption Remix is ready to implement! This will use your brand context and Post Notes to improve captions.');
      
    } catch (error) {
      console.error('❌ Caption remix failed:', error);
      alert(`Failed to remix caption: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const handleSendToScheduler = async (
    selectedCaption: string,
    uploadedImages: { preview: string; id: string; file?: File }[],
  ) => {
    console.log(
      "🚀 Starting handleSendToScheduler with caption:",
      selectedCaption,
    )

    if (!selectedCaption || uploadedImages.length === 0) {
      console.error("❌ Missing caption or images")
      alert("Please select a caption and upload at least one image")
      return
    }

    if (!clientId) {
      console.error("❌ Missing clientId")
      alert("Client ID is missing. Please refresh the page and try again.")
      return
    }

    console.log("🔍 Validation passed:", { clientId, selectedCaption, imagesCount: uploadedImages.length })

    setIsSendingToScheduler(true)

    try {
      // Convert blob URLs to base64
      const postsToSave = await Promise.all(
        uploadedImages.map(async (image) => {
          let base64Image = image.preview

          // Convert blob URL to base64
          if (image.preview.startsWith('blob:')) {
            base64Image = await convertBlobToBase64(image.preview)
          }

          return {
            clientId,
            projectId: 'quick-create', // Use a special project ID for direct content
            caption: selectedCaption,
            image: base64Image,
            status: 'ready'
          }
        })
      )

      console.log("📝 Posts prepared:", postsToSave.length)

      // Save posts to database
      const response = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          posts: postsToSave,
          status: 'ready'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create posts')
      }

      const result = await response.json()
      console.log("✅ Posts saved successfully:", result)

      // Redirect to scheduler
      window.location.href = `/dashboard/client/${clientId}/new-scheduler`

    } catch (error) {
      console.error("❌ Error creating posts:", error)
      alert(`Failed to create posts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSendingToScheduler(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Content Suite</h1>
          <p className="text-muted-foreground mt-2">
            Create, edit, and prepare your social media content
          </p>
        </div>

        {/* Main Content */}
        <ContentStoreProvider clientId={clientId}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Image Upload */}
            <ImageUploadColumn />
            
            {/* Column 2: Caption Generation */}
            <CaptionGenerationColumn />
            
            {/* Column 3: Social Preview & Actions */}
            <SocialPreviewColumn
              clientId={clientId}
              handleSendToScheduler={handleSendToScheduler}
              isSendingToScheduler={isSendingToScheduler}
            />
          </div>
        </ContentStoreProvider>
      </div>
    </div>
  )
}
