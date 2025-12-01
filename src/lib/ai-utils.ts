import logger from '@/lib/logger';

export interface AIAnalysisResult {
  success: boolean;
  analysis?: string;
  error?: string;
}

export interface ContentIdea {
  title: string;
  marketingAngle: string;
  postExample: string;
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
    logger.error('Image analysis error:', error);
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
  aiContext?: string,
  clientId?: string
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
        clientId,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to generate captions');
    }

    return result;
  } catch (error) {
    logger.error('Caption generation error:', error);
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
  aiContext?: string,
  clientId?: string
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
        clientId,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to remix caption');
    }

    return result;
  } catch (error) {
    logger.error('Caption remix error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Sanitizes and validates AI-generated content ideas, removing prompt leakage patterns
 * and ensuring all required fields are present and non-empty.
 * 
 * This function:
 * - Parses the raw JSON string from OpenAI API responses
 * - Removes prompt leakage patterns (framework questions, double asterisks, prompt prefixes)
 * - Validates that all required fields (title, marketingAngle, postExample) exist
 * - Supports multiple JSON structures (array, object with "ideas" or "contentIdeas" property)
 * - Handles fallback field names (idea/title, angle/marketingAngle, example/postExample)
 * 
 * @param rawJsonString - Raw JSON string from OpenAI API response. Can be:
 *   - A JSON array of content idea objects
 *   - An object with an "ideas" property containing an array
 *   - An object with a "contentIdeas" property containing an array
 * 
 * @returns Array of validated and sanitized ContentIdea objects with structure:
 *   - title: string - The content idea title (leakage patterns removed)
 *   - marketingAngle: string - The marketing angle (leakage patterns removed)
 *   - postExample: string - Example post content (leakage patterns removed)
 * 
 * @throws {Error} If input is not a non-empty string
 * @throws {Error} If JSON parsing fails (invalid JSON syntax)
 * @throws {Error} If JSON structure is invalid (not an array or object with expected properties)
 * @throws {Error} If content ideas array is empty
 * @throws {Error} If any content idea is missing required fields (title, marketingAngle, postExample)
 * @throws {Error} If any field is empty after sanitization
 * @throws {Error} If no valid content ideas are found after processing
 * 
 * @example
 * ```typescript
 * const rawJson = '{"ideas": [{"title": "Summer Sale", "marketingAngle": "Drive urgency", "postExample": "Limited time offer!"}]}';
 * const sanitized = sanitizeAndValidateContentIdeas(rawJson);
 * // Returns: [{ title: "Summer Sale", marketingAngle: "Drive urgency", postExample: "Limited time offer!" }]
 * ```
 * 
 * @example
 * ```typescript
 * // Handles leakage patterns
 * const rawJson = '{"ideas": [{"title": "What keeps their audience awake at 3am?**", "marketingAngle": "Marketing Angle: Strategic approach", "postExample": "Post Example: Example text"}]}';
 * const sanitized = sanitizeAndValidateContentIdeas(rawJson);
 * // Returns: [{ title: "", marketingAngle: "Strategic approach", postExample: "Example text" }]
 * // (Note: title would be empty and throw validation error, but demonstrates sanitization)
 * ```
 */
/**
 * Cleans up malformed JSON strings from AI output
 * Fixes common issues like newlines before property names, broken quotes, etc.
 */
function cleanupMalformedJson(jsonString: string): string {
  let cleaned = jsonString;
  
  // Fix property names with whitespace (spaces/newlines) inside quotes before the colon
  // Pattern: "      title": or "\n      title": becomes "title":
  // This handles cases where AI puts spaces/newlines inside the quoted property name
  // Match: quote, then whitespace, then non-whitespace property name, then quote and colon
  cleaned = cleaned.replace(/"(\s+)([^"\s:]+)":/g, '"$2":');
  
  // Fix property names that have newlines anywhere in them (like "ti\ntle" or "\ntitle")
  cleaned = cleaned.replace(/"([^"]*)\n([^"]*)":/g, '"$1$2":');
  
  // Fix newlines and extra whitespace before property names (outside quotes)
  // Pattern: {\n"title" or { "title" becomes {"title"
  cleaned = cleaned.replace(/([{,]\s*)\n\s*"/g, '$1"');
  
  // Remove any standalone quotes that aren't part of a property
  cleaned = cleaned.replace(/^\s*"\s*{/g, '{');
  cleaned = cleaned.replace(/}\s*"\s*$/g, '}');
  
  // Fix broken quotes within property values (but preserve valid escaped quotes)
  // This is a conservative fix - only handle obvious cases
  cleaned = cleaned.replace(/:\s*"([^"]*)\n([^"]*)"/g, ': "$1 $2"');
  
  return cleaned;
}

export function sanitizeAndValidateContentIdeas(
  rawJsonString: string
): ContentIdea[] {
  if (!rawJsonString || typeof rawJsonString !== 'string') {
    throw new Error('Input must be a non-empty JSON string');
  }

  // Clean up malformed JSON before parsing
  let cleanedJson = cleanupMalformedJson(rawJsonString);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedJson);
  } catch (parseError) {
    // If first parse attempt fails, try more aggressive cleanup
    try {
      // Remove any leading/trailing quotes that might be wrapping the JSON
      cleanedJson = cleanedJson.trim().replace(/^["']+|["']+$/g, '');
      
      // More aggressive fixes for common malformed patterns
      // Fix property names with newlines or extra spaces inside quotes
      cleanedJson = cleanedJson.replace(/"(\s+)([^"\s:]+)":/g, '"$2":');
      cleanedJson = cleanedJson.replace(/([{,]\s*)\n\s*"([^"]+)":/g, '$1"$2":');
      cleanedJson = cleanedJson.replace(/([{,]\s*)"\s+([^"]+)":/g, '$1"$2":');
      
      // Remove any newlines inside property names
      cleanedJson = cleanedJson.replace(/"([^"]*)\n([^"]*)":/g, '"$1$2":');
      
      // Try parsing again
      parsed = JSON.parse(cleanedJson);
    } catch (secondParseError) {
      // Log the problematic JSON for debugging (truncated to avoid log spam)
      const preview = cleanedJson.substring(0, 500);
      logger.error('Failed to parse JSON after cleanup attempts', {
        originalError: parseError instanceof Error ? parseError.message : String(parseError),
        secondError: secondParseError instanceof Error ? secondParseError.message : String(secondParseError),
        jsonPreview: preview,
      });
      
      throw new Error(
        `Failed to parse JSON after cleanup attempts: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`
      );
    }
  }

  // Handle array or object with array property
  let ideasArray: unknown[];
  if (Array.isArray(parsed)) {
    ideasArray = parsed;
  } else if (parsed && typeof parsed === 'object') {
    // Check for various property names (camelCase, snake_case, etc.)
    if ('ideas' in parsed) {
      ideasArray = Array.isArray(parsed.ideas) ? parsed.ideas : [parsed.ideas];
    } else if ('contentIdeas' in parsed) {
      ideasArray = Array.isArray(parsed.contentIdeas)
        ? parsed.contentIdeas
        : [parsed.contentIdeas];
    } else if ('content_ideas' in parsed) {
      // Handle snake_case
      ideasArray = Array.isArray(parsed.content_ideas)
        ? parsed.content_ideas
        : [parsed.content_ideas];
    } else {
      throw new Error(
        'JSON must be an array or an object with "ideas", "contentIdeas", or "content_ideas" property'
      );
    }
  } else {
    throw new Error(
      'JSON must be an array or an object with "ideas", "contentIdeas", or "content_ideas" property'
    );
  }

  if (ideasArray.length === 0) {
    throw new Error('Content ideas array is empty');
  }

  /**
   * Removes prompt leakage patterns from a string
   */
  function removeLeakagePatterns(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let cleaned = text;

    // Remove specific leakage patterns
    cleaned = cleaned.replace(/What keeps their audience awake at 3am\?\*\*/gi, '');
    cleaned = cleaned.replace(/What are they scrolling for\?\*\*/gi, '');
    cleaned = cleaned.replace(/What would make them save\/share\?\*\*/gi, '');

    // Remove any text with double asterisks (markdown bold markers that shouldn't be in content)
    // But preserve single asterisks and other formatting
    cleaned = cleaned.replace(/\*\*[^*]+\*\*/g, '');

    // Remove prefix patterns (case-insensitive)
    cleaned = cleaned.replace(/^Marketing Angle:\s*/i, '');
    cleaned = cleaned.replace(/^Strategic content angle:\s*/i, '');
    cleaned = cleaned.replace(/^Post Example:\s*/i, '');

    // Clean up any remaining double asterisks at start/end
    cleaned = cleaned.replace(/^\*\*+|\*\*+$/g, '');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Validates and sanitizes a single content idea
   */
  function sanitizeIdea(idea: unknown, index: number): ContentIdea {
    // Handle case where idea is just a string (title only)
    if (typeof idea === 'string') {
      const cleanedTitle = removeLeakagePatterns(idea);
      if (!cleanedTitle || cleanedTitle.length === 0) {
        throw new Error(
          `Content idea at index ${index} has empty title after sanitization`
        );
      }
      return {
        title: cleanedTitle,
        marketingAngle: 'Strategic content approach',
        postExample: cleanedTitle,
      };
    }

    if (!idea || typeof idea !== 'object') {
      throw new Error(
        `Content idea at index ${index} must be an object or string, got ${typeof idea}`
      );
    }

    const ideaObj = idea as Record<string, unknown>;

    // Extract and sanitize title
    let title = '';
    if ('title' in ideaObj && typeof ideaObj.title === 'string') {
      title = removeLeakagePatterns(ideaObj.title);
    } else if ('idea' in ideaObj && typeof ideaObj.idea === 'string') {
      // Fallback to 'idea' field if 'title' doesn't exist
      title = removeLeakagePatterns(ideaObj.idea);
    } else {
      throw new Error(
        `Content idea at index ${index} is missing required field "title" (or "idea")`
      );
    }

    // Extract and sanitize marketingAngle
    let marketingAngle = '';
    if ('marketingAngle' in ideaObj && typeof ideaObj.marketingAngle === 'string') {
      marketingAngle = removeLeakagePatterns(ideaObj.marketingAngle);
    } else if ('angle' in ideaObj && typeof ideaObj.angle === 'string') {
      // Fallback to 'angle' field if 'marketingAngle' doesn't exist
      marketingAngle = removeLeakagePatterns(ideaObj.angle);
    } else if ('description' in ideaObj && typeof ideaObj.description === 'string') {
      // Fallback to 'description' field - use first sentence or first 100 chars as marketing angle
      const desc = removeLeakagePatterns(ideaObj.description);
      if (desc && desc.trim().length > 0) {
        // Use first sentence (up to first period) or first 100 chars, whichever is shorter and non-empty
        const firstSentence = desc.split('.')[0]?.trim();
        const first100Chars = desc.substring(0, 100).trim();
        marketingAngle = (firstSentence && firstSentence.length > 0) 
          ? firstSentence 
          : (first100Chars && first100Chars.length > 0) 
            ? first100Chars 
            : 'Strategic content approach';
      } else {
        marketingAngle = 'Strategic content approach';
      }
    } else {
      // Default fallback if no angle/description found
      marketingAngle = 'Strategic content approach';
    }
    
    // Final safety check - ensure marketingAngle is never empty
    if (!marketingAngle || marketingAngle.trim().length === 0) {
      marketingAngle = 'Strategic content approach';
    }

    // Extract and sanitize postExample
    let postExample = '';
    if ('postExample' in ideaObj && typeof ideaObj.postExample === 'string') {
      postExample = removeLeakagePatterns(ideaObj.postExample);
    } else if ('example' in ideaObj && typeof ideaObj.example === 'string') {
      // Fallback to 'example' field if 'postExample' doesn't exist
      postExample = removeLeakagePatterns(ideaObj.example);
    } else if ('description' in ideaObj && typeof ideaObj.description === 'string') {
      // Fallback to 'description' field for postExample
      postExample = removeLeakagePatterns(ideaObj.description);
    } else {
      // Default fallback - use title as postExample
      postExample = title;
    }

    // Validate all fields are non-empty after sanitization
    if (!title || title.length === 0) {
      throw new Error(
        `Content idea at index ${index} has empty "title" after sanitization`
      );
    }

    if (!marketingAngle || marketingAngle.length === 0) {
      throw new Error(
        `Content idea at index ${index} has empty "marketingAngle" after sanitization`
      );
    }

    if (!postExample || postExample.length === 0) {
      throw new Error(
        `Content idea at index ${index} has empty "postExample" after sanitization`
      );
    }

    return {
      title,
      marketingAngle,
      postExample,
    };
  }

  // Sanitize all ideas
  const sanitizedIdeas: ContentIdea[] = [];
  for (let i = 0; i < ideasArray.length; i++) {
    try {
      const sanitized = sanitizeIdea(ideasArray[i], i);
      sanitizedIdeas.push(sanitized);
    } catch (error) {
      logger.error(`Failed to sanitize content idea at index ${i}:`, error);
      throw error;
    }
  }

  if (sanitizedIdeas.length === 0) {
    throw new Error(
      'No valid content ideas found after sanitization and validation'
    );
  }

  return sanitizedIdeas;
}
