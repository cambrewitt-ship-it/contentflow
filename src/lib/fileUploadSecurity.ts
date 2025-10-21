import { NextRequest } from 'next/server';
import logger from '@/lib/logger';

// File type definitions
interface FileType {
  mimeType: string;
  extension: string;
  magicNumbers: number[];
}

// Allowed file types with their magic numbers
const ALLOWED_FILE_TYPES: Record<string, FileType> = {
  'image/jpeg': {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    magicNumbers: [0xFF, 0xD8, 0xFF] // JPEG file signature
  },
  'image/png': {
    mimeType: 'image/png',
    extension: 'png',
    magicNumbers: [0x89, 0x50, 0x4E, 0x47] // PNG file signature
  },
  'image/gif': {
    mimeType: 'image/gif',
    extension: 'gif',
    magicNumbers: [0x47, 0x49, 0x46, 0x38] // GIF file signature
  },
  'image/webp': {
    mimeType: 'image/webp',
    extension: 'webp',
    magicNumbers: [0x52, 0x49, 0x46, 0x46] // WebP file signature (RIFF)
  }
};

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  DOCUMENT: 5 * 1024 * 1024, // 5MB
  AVATAR: 2 * 1024 * 1024, // 2MB
  LOGO: 1 * 1024 * 1024, // 1MB
} as const;

// Suspicious patterns to scan for
const SUSPICIOUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /vbscript:/i,
  /onload=/i,
  /onerror=/i,
  /eval\(/i,
  /document\./i,
  /window\./i,
  /alert\(/i,
  /confirm\(/i,
  /prompt\(/i,
  /\.exe$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.scr$/i,
  /\.pif$/i,
  /\.com$/i,
  /\.vbs$/i,
  /\.js$/i,
  /\.jar$/i,
  /\.php$/i,
  /\.asp$/i,
  /\.jsp$/i,
];

// File validation result
interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileType?: string;
  size: number;
  magicNumberMatch: boolean;
}

// Validate file magic numbers
function validateMagicNumbers(buffer: Buffer, expectedMagicNumbers: number[]): boolean {
  if (buffer.length < expectedMagicNumbers.length) {
    return false;
  }

  for (let i = 0; i < expectedMagicNumbers.length; i++) {
    if (buffer[i] !== expectedMagicNumbers[i]) {
      return false;
    }
  }

  return true;
}

// Scan file content for suspicious patterns
function scanForSuspiciousContent(content: string): { hasSuspiciousContent: boolean; patterns: string[] } {
  const foundPatterns: string[] = [];
  
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      foundPatterns.push(pattern.source);
    }
  }

  return {
    hasSuspiciousContent: foundPatterns.length > 0,
    patterns: foundPatterns
  };
}

// Validate file size
function validateFileSize(size: number, maxSize: number): { isValid: boolean; error?: string } {
  if (size > maxSize) {
    return {
      isValid: false,
      error: `File size ${Math.round(size / 1024 / 1024 * 100) / 100}MB exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024 * 100) / 100}MB`
    };
  }

  if (size === 0) {
    return {
      isValid: false,
      error: 'File is empty'
    };
  }

  return { isValid: true };
}

// Validate file type by magic numbers
function validateFileType(buffer: Buffer, mimeType: string): { isValid: boolean; detectedType?: string; error?: string } {
  const fileType = ALLOWED_FILE_TYPES[mimeType];
  
  if (!fileType) {
    return {
      isValid: false,
      error: `File type ${mimeType} is not allowed`
    };
  }

  const magicNumberMatch = validateMagicNumbers(buffer, fileType.magicNumbers);
  
  if (!magicNumberMatch) {
    return {
      isValid: false,
      error: `File content does not match declared MIME type ${mimeType}`
    };
  }

  return {
    isValid: true,
    detectedType: fileType.mimeType
  };
}

// Generate secure filename
function generateSecureFilename(originalName: string, mimeType: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = ALLOWED_FILE_TYPES[mimeType]?.extension || 'bin';
  
  return `${timestamp}_${randomString}.${extension}`;
}

// Main file validation function
export async function validateFileUpload(
  file: File | Buffer,
  mimeType: string,
  maxSize: number = FILE_SIZE_LIMITS.IMAGE,
  options: {
    scanContent?: boolean;
    generateSecureName?: boolean;
    quarantineSuspicious?: boolean;
  } = {}
): Promise<FileValidationResult> {
  const {
    scanContent = true,
    generateSecureName = true,
    quarantineSuspicious = true
  } = options;

  const result: FileValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    size: 0,
    magicNumberMatch: false
  };

  try {
    // Convert File to Buffer if needed
    let buffer: Buffer;
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = file;
    }

    result.size = buffer.length;

    // Validate file size
    const sizeValidation = validateFileSize(buffer.length, maxSize);
    if (!sizeValidation.isValid) {
      result.isValid = false;
      result.errors.push(sizeValidation.error!);
    }

    // Validate file type by magic numbers
    const typeValidation = validateFileType(buffer, mimeType);
    if (!typeValidation.isValid) {
      result.isValid = false;
      result.errors.push(typeValidation.error!);
    } else {
      result.fileType = typeValidation.detectedType;
      result.magicNumberMatch = true;
    }

    // Scan content for suspicious patterns
    if (scanContent && result.isValid) {
      const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024 * 1024)); // Scan first 1MB
      const scanResult = scanForSuspiciousContent(content);
      
      if (scanResult.hasSuspiciousContent) {
        if (quarantineSuspicious) {
          result.isValid = false;
          result.errors.push(`File contains suspicious content: ${scanResult.patterns.join(', ')}`);
        } else {
          result.warnings.push(`File contains potentially suspicious content: ${scanResult.patterns.join(', ')}`);
        }
      }
    }

    // Log validation results
    if (!result.isValid) {
      logger.warn('File upload validation failed:', {
        mimeType,
        size: result.size,
        errors: result.errors,
        warnings: result.warnings,
        magicNumberMatch: result.magicNumberMatch
      });
    } else if (result.warnings.length > 0) {
      logger.info('File upload validation passed with warnings:', {
        mimeType,
        size: result.size,
        warnings: result.warnings
      });
    }

    return result;

  } catch (error) {
    logger.error('File validation error:', error);
    result.isValid = false;
    result.errors.push('File validation failed due to internal error');
    return result;
  }
}

// Validate base64 image upload
export async function validateBase64ImageUpload(
  base64Data: string,
  mimeType: string,
  maxSize: number = FILE_SIZE_LIMITS.IMAGE
): Promise<FileValidationResult> {
  try {
    // Extract base64 data (remove data:image/...;base64, prefix)
    const base64String = base64Data.split(',')[1] || base64Data;
    const buffer = Buffer.from(base64String, 'base64');
    
    return await validateFileUpload(buffer, mimeType, maxSize);
  } catch (error) {
    logger.error('Base64 image validation error:', error);
    return {
      isValid: false,
      errors: ['Invalid base64 data'],
      warnings: [],
      size: 0,
      magicNumberMatch: false
    };
  }
}

// Generate secure filename for upload
export function generateSecureUploadFilename(originalName: string, mimeType: string): string {
  return generateSecureFilename(originalName, mimeType);
}

// Check if file type is allowed
export function isAllowedFileType(mimeType: string): boolean {
  return mimeType in ALLOWED_FILE_TYPES;
}

// Get file size limit for type
export function getFileSizeLimit(type: 'image' | 'document' | 'avatar' | 'logo'): number {
  return FILE_SIZE_LIMITS[type.toUpperCase() as keyof typeof FILE_SIZE_LIMITS];
}

// Sanitize filename
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special characters with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 100); // Limit length
}

// Extract file extension from filename
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(lastDot + 1).toLowerCase() : '';
}

// Validate file extension matches MIME type
export function validateFileExtension(filename: string, mimeType: string): boolean {
  const extension = getFileExtension(filename);
  const expectedExtension = ALLOWED_FILE_TYPES[mimeType]?.extension;
  
  return expectedExtension ? extension === expectedExtension : false;
}
