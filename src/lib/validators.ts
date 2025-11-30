/**
 * Validation and sanitization utilities using Zod
 */

import { z } from 'zod';

// ============================================================================
// UTILITY VALIDATORS
// ============================================================================

/**
 * Sanitizes HTML content by removing dangerous tags and attributes
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe tags and their content
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove object tags and their content
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    // Remove embed tags and their content
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    // Remove applet tags and their content
    .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
    // Remove dangerous event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocols
    .replace(/javascript:/gi, '')
    // Remove vbscript: protocols
    .replace(/vbscript:/gi, '')
    // Remove data: protocols that could contain scripts
    .replace(/data:text\/html/gi, 'data:text/plain')
    .replace(/data:application\/javascript/gi, 'data:text/plain');
}

/**
 * Creates a sanitized string validator with length limits
 * @param maxLength - Maximum allowed length
 * @param minLength - Minimum required length (default: 1)
 * @returns Zod string schema with sanitization
 */
function sanitizedString(maxLength: number, minLength: number = 1) {
  return z.string()
    .min(minLength, `String must be at least ${minLength} characters`)
    .max(maxLength, `String must be at most ${maxLength} characters`)
    .transform(sanitizeHtml)
    .refine(val => val.length >= minLength, {
      message: `String must be at least ${minLength} characters after sanitization`
    });
}

/**
 * Creates an optional sanitized string validator that allows empty strings
 * @param maxLength - Maximum allowed length
 * @returns Zod string schema with sanitization that allows empty strings
 */
function optionalSanitizedString(maxLength: number) {
  return z.string()
    .max(maxLength, `String must be at most ${maxLength} characters`)
    .transform(sanitizeHtml)
    .optional();
}

/**
 * Validates UUID v4 format
 * @param uuid - String to validate
 * @returns true if valid UUID v4, false otherwise
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  // UUID v4 regex pattern
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(uuid);
}

/**
 * Cleans and validates a UUID
 * @param uuid - UUID string to sanitize
 * @returns Sanitized UUID if valid, null otherwise
 */
export function sanitizeUUID(uuid: string | null | undefined): string | null {
  if (!uuid) {
    return null;
  }

  // Trim whitespace
  const trimmed = uuid.trim();

  // Validate format
  if (!isValidUUID(trimmed)) {
    return null;
  }

  // Return lowercase normalized UUID
  return trimmed.toLowerCase();
}

/**
 * Validates email format
 * @param email - Email string to validate
 * @returns true if valid email format, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 compliant email regex (simplified but robust)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email) && email.length <= 254; // Max email length per RFC
}

/**
 * Removes dangerous characters from filenames
 * Prevents directory traversal and other file system attacks
 * @param filename - Filename to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed';
  }

  // Remove path separators and dangerous characters
  let sanitized = filename
    .replace(/[\/\\]/g, '') // Remove forward and back slashes
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove invalid Windows filename chars
    .replace(/^\.+/, '') // Remove leading dots
    .trim();

  // If filename is empty after sanitization, use default
  if (!sanitized || sanitized.length === 0) {
    return 'unnamed';
  }

  // Limit length (max 255 characters for most filesystems)
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, 255 - ext.length);
    sanitized = name + ext;
  }

  return sanitized;
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

// Common validation schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z.string().email('Invalid email format').max(320, 'Email too long');
export const urlSchema = z.string().url('Invalid URL format').max(2000, 'URL too long');
export const isoDateSchema = z.string().datetime('Invalid ISO date format');
export const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format').max(20);

// Platform and enum schemas
export const socialPlatformSchema = z.enum(['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube']);
export const postStatusSchema = z.enum(['draft', 'ready', 'scheduled', 'published', 'archived', 'deleted']);
export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'needs_revision']);
export const mediaTypeSchema = z.enum(['image', 'video', 'gif', 'carousel']);

// AI request schemas
export const copyTypeSchema = z.enum(['social-media', 'email-marketing']);
export const copyToneSchema = z.enum(['promotional', 'educational', 'personal', 'testimonial', 'engagement']);
export const postNotesStyleSchema = z.enum(['quote-directly', 'paraphrase', 'use-as-inspiration']);
export const imageFocusSchema = z.enum(['main-focus', 'supporting', 'background', 'none']);

// ============================================================================
// ENTITY SCHEMAS
// ============================================================================

// Client schemas
export const createClientSchema = z.object({
  name: sanitizedString(200, 1),
  company_description: optionalSanitizedString(5000),
  website_url: urlSchema.optional(),
  brand_tone: optionalSanitizedString(1000),
  target_audience: optionalSanitizedString(2000),
  value_proposition: optionalSanitizedString(2000),
  caption_dos: optionalSanitizedString(2000),
  caption_donts: optionalSanitizedString(2000),
  brand_voice_examples: optionalSanitizedString(5000),
  brand_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
});

export const updateClientSchema = createClientSchema.partial();

// Post schemas
export const updatePostSchema = z.object({
  caption: sanitizedString(5000).optional(),
  image_url: urlSchema.optional(),
  notes: sanitizedString(2000).optional(),
  edit_reason: sanitizedString(500).optional(),
  edited_by_user_id: uuidSchema.optional(),
  client_id: uuidSchema.optional(),
  platforms: z.array(socialPlatformSchema).optional(),
  // AI generation settings
  ai_tone: copyToneSchema.optional(),
  ai_style: sanitizedString(100).optional(),
  ai_hashtags: z.array(sanitizedString(50)).max(30).optional(),
  // Tags and categories
  tags: z.array(sanitizedString(50)).max(20).optional(),
  categories: z.array(sanitizedString(100)).max(10).optional(),
  // Media settings
  media_type: mediaTypeSchema.optional(),
  media_alt_text: sanitizedString(200).optional(),
  // Concurrent editing
  force_edit: z.boolean().optional(),
  // Draft saving
  save_as_draft: z.boolean().optional(),
});

// Parameter schemas
export const postIdParamSchema = z.object({
  postId: uuidSchema,
});

// AI request schema (discriminated union)
export const aiRequestSchema = z.discriminatedUnion('action', [
  // Image analysis
  z.object({
    action: z.literal('analyze_image'),
    imageData: z.string().min(1, 'Image data is required'),
    prompt: sanitizedString(2000).optional(),
  }),
  
  // Caption generation
  z.object({
    action: z.literal('generate_captions'),
    imageData: z.string().min(1, 'Image data is required'),
    existingCaptions: z.array(sanitizedString(5000)).max(10).optional(),
    aiContext: sanitizedString(2000).optional(),
    clientId: uuidSchema.optional(),
    copyType: copyTypeSchema.optional(),
    copyTone: copyToneSchema.optional(),
    postNotesStyle: postNotesStyleSchema.optional(),
    imageFocus: imageFocusSchema.optional(),
  }),
  
  // Caption remixing
  z.object({
    action: z.literal('remix_caption'),
    imageData: z.string().optional(), // Optional - remix can work without image
    prompt: sanitizedString(2000),
    existingCaptions: z.array(sanitizedString(5000)).max(10).optional(),
    aiContext: sanitizedString(2000).optional(),
    clientId: uuidSchema.optional(),
  }),
  
  // Content ideas generation
  z.object({
    action: z.literal('generate_content_ideas'),
    clientId: uuidSchema,
  }),
]);

// ============================================================================
// QUERY AND FILTER SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
});

export const postFilterSchema = z.object({
  status: postStatusSchema.optional(),
  platforms: z.array(socialPlatformSchema).optional(),
  tags: z.array(sanitizedString(50)).optional(),
  categories: z.array(sanitizedString(100)).optional(),
  clientId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
}).merge(paginationSchema).merge(dateRangeSchema);

// ============================================================================
// UPLOAD SCHEMAS
// ============================================================================

export const imageUploadSchema = z.object({
  filename: sanitizedString(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  size: z.number().int().max(10 * 1024 * 1024, 'Image must be less than 10MB'),
  altText: sanitizedString(200).optional(),
});

export const documentUploadSchema = z.object({
  filename: sanitizedString(255),
  contentType: z.enum(['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  size: z.number().int().max(20 * 1024 * 1024, 'Document must be less than 20MB'),
});

// ============================================================================
// EXPORTS
// ============================================================================

// All schemas are exported individually above
// This section is kept for documentation purposes
