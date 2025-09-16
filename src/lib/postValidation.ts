// Post validation utilities for platform requirements and data consistency

export interface PlatformRequirements {
  maxCaptionLength: number;
  minCaptionLength: number;
  allowedImageFormats: string[];
  maxImageSize: number; // in bytes
  maxImageWidth: number;
  maxImageHeight: number;
  requiredHashtags: number;
  maxHashtags: number;
  allowedMediaTypes: string[];
}

export const PLATFORM_REQUIREMENTS: Record<string, PlatformRequirements> = {
  instagram: {
    maxCaptionLength: 2200,
    minCaptionLength: 1,
    allowedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
    maxImageSize: 8 * 1024 * 1024, // 8MB
    maxImageWidth: 1080,
    maxImageHeight: 1080,
    requiredHashtags: 0,
    maxHashtags: 30,
    allowedMediaTypes: ['image', 'video']
  },
  facebook: {
    maxCaptionLength: 63206,
    minCaptionLength: 1,
    allowedImageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    maxImageSize: 10 * 1024 * 1024, // 10MB
    maxImageWidth: 2048,
    maxImageHeight: 2048,
    requiredHashtags: 0,
    maxHashtags: 50,
    allowedMediaTypes: ['image', 'video']
  },
  twitter: {
    maxCaptionLength: 280,
    minCaptionLength: 1,
    allowedImageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    maxImageSize: 5 * 1024 * 1024, // 5MB
    maxImageWidth: 1200,
    maxImageHeight: 1200,
    requiredHashtags: 0,
    maxHashtags: 10,
    allowedMediaTypes: ['image', 'video']
  },
  linkedin: {
    maxCaptionLength: 3000,
    minCaptionLength: 1,
    allowedImageFormats: ['jpg', 'jpeg', 'png', 'gif'],
    maxImageSize: 5 * 1024 * 1024, // 5MB
    maxImageWidth: 1200,
    maxImageHeight: 627,
    requiredHashtags: 0,
    maxHashtags: 20,
    allowedMediaTypes: ['image', 'video']
  },
  tiktok: {
    maxCaptionLength: 2200,
    minCaptionLength: 1,
    allowedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
    maxImageSize: 10 * 1024 * 1024, // 10MB
    maxImageWidth: 1080,
    maxImageHeight: 1920,
    requiredHashtags: 0,
    maxHashtags: 100,
    allowedMediaTypes: ['image', 'video']
  }
};

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  platformWarnings: Record<string, string[]>;
}

export interface PostData {
  caption: string;
  image_url?: string;
  media_type?: string;
  platforms?: string[];
  tags?: string[];
  ai_settings?: {
    tone?: string;
    style?: string;
    hashtags?: string;
  };
}

export class PostValidator {
  private postData: PostData;
  private platforms: string[];

  constructor(postData: PostData, platforms: string[] = []) {
    this.postData = postData;
    this.platforms = platforms.length > 0 ? platforms : ['instagram', 'facebook', 'twitter'];
  }

  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const platformWarnings: Record<string, string[]> = {};

    // Basic validation
    this.validateBasicFields(errors);
    
    // Platform-specific validation
    this.validatePlatformRequirements(errors, warnings, platformWarnings);
    
    // Image validation
    if (this.postData.image_url) {
      this.validateImage(errors, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      platformWarnings
    };
  }

  private validateBasicFields(errors: string[]): void {
    if (!this.postData.caption || this.postData.caption.trim().length === 0) {
      errors.push('Caption is required');
    }

    if (this.postData.media_type && !['image', 'video'].includes(this.postData.media_type)) {
      errors.push('Media type must be either "image" or "video"');
    }
  }

  private validatePlatformRequirements(
    errors: string[], 
    warnings: string[], 
    platformWarnings: Record<string, string[]>
  ): void {
    for (const platform of this.platforms) {
      const requirements = PLATFORM_REQUIREMENTS[platform];
      if (!requirements) continue;

      const platformErrors: string[] = [];
      const platformWarns: string[] = [];

      // Caption length validation
      if (this.postData.caption) {
        if (this.postData.caption.length > requirements.maxCaptionLength) {
          platformErrors.push(`Caption too long for ${platform} (${this.postData.caption.length}/${requirements.maxCaptionLength} characters)`);
        }
        if (this.postData.caption.length < requirements.minCaptionLength) {
          platformErrors.push(`Caption too short for ${platform} (${this.postData.caption.length}/${requirements.minCaptionLength} characters)`);
        }
      }

      // Hashtag validation
      if (this.postData.tags) {
        if (this.postData.tags.length > requirements.maxHashtags) {
          platformWarns.push(`Too many hashtags for ${platform} (${this.postData.tags.length}/${requirements.maxHashtags})`);
        }
      }

      // AI hashtags validation
      if (this.postData.ai_settings?.hashtags) {
        const hashtagCount = (this.postData.ai_settings.hashtags.match(/#/g) || []).length;
        if (hashtagCount > requirements.maxHashtags) {
          platformWarns.push(`Too many AI hashtags for ${platform} (${hashtagCount}/${requirements.maxHashtags})`);
        }
      }

      if (platformErrors.length > 0) {
        errors.push(...platformErrors);
      }
      if (platformWarns.length > 0) {
        platformWarnings[platform] = platformWarns;
        warnings.push(...platformWarns);
      }
    }
  }

  private validateImage(errors: string[], warnings: string[]): void {
    if (!this.postData.image_url) return;

    try {
      const url = new URL(this.postData.image_url);
      const pathname = url.pathname.toLowerCase();
      const extension = pathname.split('.').pop();

      if (!extension) {
        errors.push('Image URL must have a file extension');
        return;
      }

      // Check if extension is valid for any platform
      const validExtensions = new Set(
        Object.values(PLATFORM_REQUIREMENTS)
          .flatMap(req => req.allowedImageFormats)
      );

      if (!validExtensions.has(extension)) {
        errors.push(`Unsupported image format: ${extension}. Supported formats: ${Array.from(validExtensions).join(', ')}`);
      }

      // Check image dimensions and size (this would require actual image analysis)
      // For now, we'll add a warning that these should be checked
      warnings.push('Image dimensions and file size should be verified before publishing');

    } catch (error) {
      errors.push('Invalid image URL format');
    }
  }

  // Static method for quick validation
  static validatePost(postData: PostData, platforms: string[] = []): ValidationResult {
    const validator = new PostValidator(postData, platforms);
    return validator.validate();
  }
}

// Utility functions for common validations
export function isValidImageUrl(url: string): boolean {
  try {
    new URL(url);
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  } catch {
    return false;
  }
}

export function getMaxCaptionLength(platforms: string[]): number {
  return Math.min(
    ...platforms
      .map(p => PLATFORM_REQUIREMENTS[p]?.maxCaptionLength)
      .filter(Boolean)
  );
}

export function getMinCaptionLength(platforms: string[]): number {
  return Math.max(
    ...platforms
      .map(p => PLATFORM_REQUIREMENTS[p]?.minCaptionLength)
      .filter(Boolean)
  );
}

export function getSupportedImageFormats(platforms: string[]): string[] {
  const formats = new Set<string>();
  platforms.forEach(platform => {
    const requirements = PLATFORM_REQUIREMENTS[platform];
    if (requirements) {
      requirements.allowedImageFormats.forEach(format => formats.add(format));
    }
  });
  return Array.from(formats);
}
