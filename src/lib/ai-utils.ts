export interface AIAnalysisResult {
  success: boolean;
  analysis?: string;
  error?: string;
}

export interface AICaptionResult {
  success: boolean;
  captions?: string[];
  error?: string;
}

export interface AIRemixResult {
  success: boolean;
  caption?: string;
  error?: string;
}

// Convert File to base64 data URL for API transmission
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Analyze image using AI
export async function analyzeImageWithAI(
  imageFile: File, 
  prompt?: string
): Promise<AIAnalysisResult> {
  try {
    const imageData = await fileToDataURL(imageFile);
    
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'analyze_image',
        imageData,
        prompt,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to analyze image');
    }

    return result;
  } catch (error) {
    console.error('Image analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Generate captions using AI
export async function generateCaptionsWithAI(
  imageFile: File,
  existingCaptions: string[] = [],
  aiContext?: string
): Promise<AICaptionResult> {
  try {
    const imageData = await fileToDataURL(imageFile);
    
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generate_captions',
        imageData,
        existingCaptions,
        aiContext,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to generate captions');
    }

    return result;
  } catch (error) {
    console.error('Caption generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Remix caption using AI
export async function remixCaptionWithAI(
  imageFile: File,
  prompt: string,
  existingCaptions: string[] = [],
  aiContext?: string
): Promise<AIRemixResult> {
  try {
    const imageData = await fileToDataURL(imageFile);
    
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'remix_caption',
        imageData,
        prompt,
        existingCaptions,
        aiContext,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to remix caption');
    }

    return result;
  } catch (error) {
    console.error('Caption remix error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
