"use client";

import { useState, useCallback, useEffect } from "react";
import { use } from "react";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { Textarea } from "components/ui/textarea";
import { ArrowLeft, Loader2, Sparkles, RefreshCw } from "lucide-react";
import Link from "next/link";
import { SocialPreview } from "components/social-preview";
import {
  generateCaptionsWithAI,
  remixCaptionWithAI,
  type AICaptionResult,
  type AIRemixResult,
} from "lib/ai-utils";
import { usePostStore } from "lib/store";
import { ContentStoreProvider, useContentStore } from "lib/contentStore";

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

export default function ProjectPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { clientId, projectId } = resolvedParams;

  return (
    <ContentStoreProvider clientId={clientId}>
      <ProjectPageContent params={{ clientId, projectId }} />
    </ContentStoreProvider>
  );
}

function ProjectPageContent({ params }: { params: { clientId: string; projectId: string } }) {
  const { clientId, projectId } = params;
  const { 
    uploadedImages,
    captions,
    selectedCaptions,
    activeImageId,
    addImage,
    removeImage,
    updateImageNotes,
    updateCaption,
    selectCaption,
    generateAICaptions,
    remixCaption
  } = useContentStore();
  
  const [isSendingToScheduler, setIsSendingToScheduler] = useState(false);

  const handleSendToScheduler = async (
    selectedCaption: string,
    uploadedImages: { preview: string; id: string; file?: File }[],
  ) => {
    console.log(
      "🚀 Starting handleSendToScheduler with caption:",
      selectedCaption,
    );

    if (!selectedCaption || uploadedImages.length === 0) {
      console.error("❌ Missing caption or images");
      alert("Please select a caption and upload at least one image");
      return;
    }

    if (!clientId) {
      console.error("❌ Missing clientId");
      alert("Client ID is missing. Please refresh the page and try again.");
      return;
    }

    console.log("🔍 Validation passed:", { clientId, selectedCaption, imagesCount: uploadedImages.length });

    setIsSendingToScheduler(true);

    try {
      // Convert blob URLs to base64
      const postsToSave = await Promise.all(
        uploadedImages.map(async (image) => {
          let base64Image = image.preview;

          // Convert blob URL to base64
          if (image.preview.startsWith("blob:")) {
            try {
            const response = await fetch(image.preview);
            const blob = await response.blob();
              base64Image = await new Promise<string>((resolve) => {
            const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            } catch (error) {
              console.error("Error converting blob to base64:", error);
            }
          }

          return {
            caption: selectedCaption,
            image_url: base64Image,
            notes: "",
          };
        })
      );

      console.log("📝 Posts to save:", postsToSave);

      // Save each post to the database
      const savePromises = postsToSave.map(async (post) => {
      const response = await fetch("/api/posts/create", {
        method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        body: JSON.stringify({
            client_id: clientId,
            project_id: projectId,
            ...post,
        }),
      });

      if (!response.ok) {
          throw new Error(`Failed to save post: ${response.statusText}`);
        }

        return response.json();
      });

      const savedPosts = await Promise.all(savePromises);
      console.log("✅ All posts saved successfully:", savedPosts);

      // Clear the form
      alert("Content saved successfully! Redirecting to scheduler...");

      // Redirect to scheduler
      window.location.href = `/dashboard/client/${clientId}/new-scheduler?projectId=${projectId}`;

    } catch (error) {
      console.error("❌ Error saving posts:", error);
      alert("Failed to save content. Please try again.");
    } finally {
      setIsSendingToScheduler(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
              <Link
              href={`/dashboard/client/${clientId}`}
              className="mr-6 flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="font-bold">Back to Dashboard</span>
              </Link>
            </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <h1 className="text-lg font-semibold">Project: {projectId}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Image Upload and Caption Generation */}
    <div className="space-y-6">
            {/* Image Upload Section */}
      <div className="bg-card rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4">Upload Images</h2>
        <div className="space-y-4">
                                 <input
              type="file"
              accept="image/*"
              multiple
                   onChange={(e) => {
                     const files = Array.from(e.target.files || []);
                     files.forEach(file => {
                       addImage(file);
                     });
                   }}
                   className="w-full p-2 border rounded"
                 />

          {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
              {uploadedImages.map((image) => (
                      <div key={image.id} className="relative">
                    <img
                      src={image.preview}
                          alt="Uploaded"
                          className="w-full h-32 object-cover rounded"
                        />
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                        >
                          ×
                        </button>
                        <textarea
                          placeholder="Add notes..."
                          value={image.notes}
                          onChange={(e) => updateImageNotes(image.id, e.target.value)}
                          className="w-full mt-2 p-2 text-sm border rounded"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Caption Generation Section */}
            {activeImageId && (
              <div className="bg-card rounded-lg border p-6">
                <h2 className="text-lg font-semibold mb-4">Generate Captions</h2>
                <div className="space-y-4">
                                     <Button
                     onClick={() => {
                       if (activeImageId) {
                         const activeImage = uploadedImages.find(img => img.id === activeImageId);
                         generateAICaptions(activeImageId, activeImage?.notes);
                       }
                     }}
                     className="w-full"
                     disabled={isSendingToScheduler}
                   >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate AI Captions
                  </Button>
                  
                  {captions.length > 0 && (
                    <div className="space-y-2">
                      {captions.map((caption) => (
                        <div
                          key={caption.id}
                          className={`p-3 border rounded cursor-pointer transition-colors ${
                            selectedCaptions.includes(caption.id)
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => selectCaption(caption.id)}
                        >
                          <p className="text-sm">{caption.text}</p>
                          <div className="mt-2">
                            <Input
                              value={caption.text}
                              onChange={(e) => updateCaption(caption.id, e.target.value)}
                              className="text-sm"
                              placeholder="Edit caption..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
                )}
              </div>

                     {/* Right Column - Social Preview */}
           <div className="bg-card rounded-lg border p-6">
             <h2 className="text-lg font-semibold mb-4">Social Preview</h2>
             {uploadedImages.length > 0 && selectedCaptions.length > 0 ? (
               <div className="space-y-4">
                 <SocialPreview
                   caption={captions.find(c => c.id === selectedCaptions[0])?.text || ""}
                   images={uploadedImages.map(img => ({ preview: img.preview, id: img.id, notes: img.notes || "" }))}
                   clientId={clientId}
                   projectId={projectId}
                   activeImageId={activeImageId}
                 />
                    </div>
             ) : (
               <div className="text-center py-8 text-muted-foreground">
                 <p>Upload images and select a caption to see the preview</p>
                  </div>
                )}
          </div>
        </div>

      {/* Action Buttons */}
      {uploadedImages.length > 0 && selectedCaptions.length > 0 && (
          <div className="mt-8 bg-card rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">
            What would you like to do?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Your content is ready! Choose your next step.
          </p>
          
          <div className="space-y-3">
            {/* Post Now Button */}
            <Button
              onClick={() => {
                // TODO: Implement direct posting functionality
                alert('Direct posting coming soon! This will post immediately to your connected social media accounts.');
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              Post Now
            </Button>
            
            {/* Save to Projects Button */}
            <Button
              onClick={() => {
                // TODO: Implement save to projects functionality
                alert('Save to projects coming soon! This will save your content to a project for later use.');
              }}
              variant="outline"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              Save to Projects
            </Button>
            
            {/* Schedule Button */}
            <Button
              onClick={() => {
                const selectedCaption = captions.find(
                  (cap) => cap.id === selectedCaptions[0],
                )?.text;
                if (selectedCaption) {
                  handleSendToScheduler(selectedCaption, uploadedImages);
                }
              }}
              disabled={isSendingToScheduler}
              className="w-full bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSendingToScheduler ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Loading
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2V7a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Schedule
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
