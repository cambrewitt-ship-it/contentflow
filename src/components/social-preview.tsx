import { useRouter } from "next/navigation";
import { usePostStore } from "@/lib/store";

interface SocialPreviewProps {
  imageUrl?: string;
  caption?: string;
  images?: Array<{
    id: string;
    preview: string;
    notes: string;
  }>;
  activeImageId?: string | null;
  onImageSelect?: (imageId: string) => void;
  totalCaptionCount?: number;
  clientId?: string;
  projectId?: string;
}

export function SocialPreview({ 
  imageUrl, 
  caption, 
  images = [], 
  activeImageId, 
  onImageSelect,
  clientId,
  projectId
}: SocialPreviewProps) {
  const router = useRouter();
  const addPostFromContentSuite = usePostStore((state) => state.addPostFromContentSuite);
  
  const activeImage = images.find(img => img.id === activeImageId) || images[0];
  const displayImage = activeImage || (imageUrl ? { id: 'legacy', preview: imageUrl, notes: '' } : null);

  const handleSchedule = () => {
    if (displayImage && caption && clientId && projectId) {
      // Add the post to the Zustand store
      addPostFromContentSuite(
        displayImage.preview,
        caption,
        projectId,
        clientId,
        displayImage.notes
      );
      
      // Navigate to the scheduler page
      router.push(`/dashboard/client/${clientId}/project/${projectId}/scheduler`);
    }
  };

  const canSchedule = displayImage && caption && clientId && projectId;

  return (
    <div className="bg-card rounded-lg border p-6">
      <h2 className="text-xl font-semibold text-card-foreground mb-4">Preview & Actions</h2>
      
      <div className="space-y-6">
        {/* Full Specification Image Display */}
        {displayImage ? (
          <div className="space-y-4">
            <img
              src={displayImage.preview}
              alt="Content preview"
              className="w-full h-auto max-h-96 object-contain rounded-lg border shadow-sm"
            />
            
            {/* Caption Display Underneath Photo */}
            {caption && (
              <div className="bg-background border rounded-lg p-4">
                <h3 className="font-medium text-card-foreground mb-2 text-sm">Selected Caption</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{caption}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <svg className="mx-auto h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Upload an image to see the preview</p>
          </div>
        )}

        {/* Image Thumbnails if multiple images */}
        {images.length > 1 && (
          <div className="space-y-3">
            <h4 className="font-medium text-card-foreground text-sm">All Images</h4>
            <div className="grid grid-cols-3 gap-2">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                    image.id === activeImageId ? 'border-primary' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => onImageSelect?.(image.id)}
                >
                  <img
                    src={image.preview}
                    alt="Image thumbnail"
                    className="w-full h-20 object-cover rounded-md"
                  />
                  {image.id === activeImageId && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      ✓
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-4 border-t">
          {clientId && projectId && (
            <button
              onClick={handleSchedule}
              disabled={!canSchedule}
              className={`w-full py-3 px-4 rounded-md transition-colors font-medium ${
                canSchedule 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {canSchedule ? 'Schedule' : 'Select image and caption to schedule'}
            </button>
          )}
          <button className="w-full bg-secondary text-secondary-foreground py-3 px-4 rounded-md hover:bg-secondary/90 transition-colors font-medium">
            Export Assets
          </button>
        </div>
      </div>
    </div>
  );
}
