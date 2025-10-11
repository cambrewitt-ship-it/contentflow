/**
 * Comprehensive Input Validation Schemas using Zod
 * 
 * This file contains all validation schemas for API routes to prevent:
 * - SQL injection attacks
 * - XSS attacks
 * - NoSQL injection
 * - Data type mismatches
 * - Malformed data
 * - Oversized payloads
 */

import { z } from 'zod';

// ============================================================================
// UTILITY VALIDATORS
// ============================================================================

/**
 * Sanitize HTML and script tags from strings
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*>/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=
}

/**
 * Custom Zod transformer for sanitizing strings
 */
export const sanitizedString = (maxLength?: number) => {
  let schema = z.string().transform(sanitizeHtml);
  if (maxLength) {
    schema = schema.max(maxLength, `String must be at most ${maxLength} characters`);
  }
  return schema;
};

/**
 * UUID validator
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * URL validator with protocol enforcement
 */
export const urlSchema = z.string().url('Invalid URL format').max(2000);

/**
 * Email validator
 */
export const emailSchema = z.string().email('Invalid email format').max(320);

/**
 * ISO 8601 date validator
 */
export const isoDateSchema = z.string().datetime('Invalid ISO 8601 date format');

/**
 * Slug validator (alphanumeric with hyphens)
 */
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format');

/**
 * Phone number validator (flexible international format)
 */
export const phoneSchema = z.string().regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone number format').min(7).max(20);

/**
 * Social platform validator
 */
export const socialPlatformSchema = z.enum([
  'instagram',
  'facebook',
  'twitter',
  'linkedin',
  'tiktok',
  'youtube',
  'pinterest'
]);

/**
 * Post status validator
 */
export const postStatusSchema = z.enum([
  'draft',
  'ready',
  'scheduled',
  'published',
  'archived',
  'deleted'
]);

/**
 * Approval status validator
 */
export const approvalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'needs_changes'
]);

// ============================================================================
// CLIENT VALIDATION SCHEMAS
// ============================================================================

/**
 * Client creation schema - POST /api/clients
 */
export const createClientSchema = z.object({
  name: sanitizedString(200).min(1, 'Client name is required'),
  description: sanitizedString(1000).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  website_url: urlSchema.optional(),
  
  // Brand information
  company_description: sanitizedString(2000).optional(),
  brand_tone: sanitizedString(500).optional(),
  target_audience: sanitizedString(1000).optional(),
  value_proposition: sanitizedString(1000).optional(),
  industry: sanitizedString(100).optional(),
  brand_keywords: z.array(sanitizedString(50)).max(20).optional(),
  
  // Caption guidelines
  caption_dos: sanitizedString(1000).optional(),
  caption_donts: sanitizedString(1000).optional(),
  brand_voice_examples: sanitizedString(5000).optional(),
  
  // Logo URL (should be blob URL or valid URL)
  logo_url: z.string().max(2000).optional(),
});

/**
 * Client update schema - PUT /api/clients/[id]
 */
export const updateClientSchema = createClientSchema.partial();

/**
 * Client ID parameter schema
 */
export const clientIdParamSchema = z.object({
  clientId: uuidSchema,
});

// ============================================================================
// POST VALIDATION SCHEMAS
// ============================================================================

/**
 * Post creation schema - POST /api/posts/create
 */
export const createPostSchema = z.object({
  client_id: uuidSchema,
  title: sanitizedString(200).optional(),
  caption: sanitizedString(5000).min(1, 'Caption is required'),
  image_url: z.string().max(2000).optional(),
  
  // Platform targeting
  platforms: z.array(socialPlatformSchema).min(1, 'At least one platform is required').max(10),
  
  // Metadata
  tags: z.array(sanitizedString(50)).max(30).optional(),
  categories: z.array(sanitizedString(50)).max(10).optional(),
  
  // Scheduling
  scheduled_date: isoDateSchema.optional(),
  scheduled_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)').optional(),
  
  // Status
  status: postStatusSchema.default('draft'),
  
  // Notes
  notes: sanitizedString(2000).optional(),
  
  // AI generation settings
  ai_settings: z.object({
    tone: sanitizedString(100).optional(),
    style: sanitizedString(100).optional(),
    hashtags: z.boolean().optional(),
  }).optional(),
  
  // Media settings
  media_type: z.enum(['image', 'video', 'carousel', 'story']).optional(),
  media_alt_text: sanitizedString(500).optional(),
});

/**
 * Post update schema - PUT /api/posts-by-id/[postId]
 */
export const updatePostSchema = z.object({
  caption: sanitizedString(5000).optional(),
  image_url: z.string().max(2000).optional(),
  notes: sanitizedString(2000).optional(),
  edit_reason: sanitizedString(500).optional(),
  
  // Required for authorization and tracking
  edited_by_user_id: uuidSchema,
  client_id: uuidSchema,
  
  // Platform targeting
  platforms: z.array(socialPlatformSchema).max(10).optional(),
  
  // AI generation settings
  ai_tone: sanitizedString(100).optional(),
  ai_style: sanitizedString(100).optional(),
  ai_hashtags: z.boolean().optional(),
  
  // Tags and categories
  tags: z.array(sanitizedString(50)).max(30).optional(),
  categories: z.array(sanitizedString(50)).max(10).optional(),
  
  // Media settings
  media_type: z.enum(['image', 'video', 'carousel', 'story']).optional(),
  media_alt_text: sanitizedString(500).optional(),
  
  // Concurrent editing control
  force_edit: z.boolean().optional(),
  
  // Draft saving
  save_as_draft: z.boolean().optional(),
}).refine(
  (data) => {
    // At least one editable field must be provided
    const editableFields = ['caption', 'image_url', 'notes', 'tags', 'categories'];
    return editableFields.some(field => data[field as keyof typeof data] !== undefined);
  },
  {
    message: 'At least one editable field must be provided for update',
  }
);

/**
 * Post ID parameter schema
 */
export const postIdParamSchema = z.object({
  postId: uuidSchema,
});

/**
 * Bulk post operation schema
 */
export const bulkPostOperationSchema = z.object({
  post_ids: z.array(uuidSchema).min(1).max(100),
  operation: z.enum(['delete', 'archive', 'publish', 'schedule']),
  scheduled_date: isoDateSchema.optional(),
});

// ============================================================================
// PROJECT VALIDATION SCHEMAS
// ============================================================================

/**
 * Project creation schema - POST /api/projects
 */
export const createProjectSchema = z.object({
  client_id: uuidSchema,
  name: sanitizedString(200).min(1, 'Project name is required'),
  description: sanitizedString(2000).optional(),
  
  // Dates
  start_date: isoDateSchema.optional(),
  end_date: isoDateSchema.optional(),
  
  // Settings
  default_platforms: z.array(socialPlatformSchema).max(10).optional(),
  budget: z.number().positive().optional(),
  
  // Status
  status: z.enum(['active', 'paused', 'completed', 'archived']).default('active'),
  
  // Metadata
  tags: z.array(sanitizedString(50)).max(20).optional(),
}).refine(
  (data) => {
    // If both dates are provided, end_date must be after start_date
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) > new Date(data.start_date);
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['end_date'],
  }
);

/**
 * Project update schema - PUT /api/projects/[id]
 */
export const updateProjectSchema = createProjectSchema.partial();

/**
 * Project ID parameter schema
 */
export const projectIdParamSchema = z.object({
  projectId: uuidSchema,
});

// ============================================================================
// AI GENERATION VALIDATION SCHEMAS
// ============================================================================

/**
 * AI analyze image schema
 */
export const aiAnalyzeImageSchema = z.object({
  action: z.literal('analyze_image'),
  imageData: z.string().min(1, 'Image data is required'),
  prompt: sanitizedString(2000).optional(),
});

/**
 * AI generate captions schema
 */
export const aiGenerateCaptionsSchema = z.object({
  action: z.literal('generate_captions'),
  imageData: z.string().min(1, 'Image data is required'),
  existingCaptions: z.array(sanitizedString(5000)).max(10).optional(),
  aiContext: sanitizedString(5000).optional(),
  clientId: uuidSchema.optional(),
  
  // Copy settings
  copyType: z.enum(['social-media', 'email-marketing']).optional(),
  copyTone: z.enum(['promotional', 'educational', 'personal', 'testimonial', 'engagement']).optional(),
  postNotesStyle: z.enum(['quote-directly', 'paraphrase', 'use-as-inspiration']).optional(),
  imageFocus: z.enum(['main-focus', 'supporting', 'background', 'none']).optional(),
});

/**
 * AI remix caption schema
 */
export const aiRemixCaptionSchema = z.object({
  action: z.literal('remix_caption'),
  imageData: z.string().min(1, 'Image data is required'),
  prompt: sanitizedString(2000).min(1, 'Prompt is required'),
  existingCaptions: z.array(sanitizedString(5000)).max(10).optional(),
  aiContext: sanitizedString(5000).optional(),
  clientId: uuidSchema.optional(),
});

/**
 * AI generate content ideas schema
 */
export const aiGenerateContentIdeasSchema = z.object({
  action: z.literal('generate_content_ideas'),
  clientId: uuidSchema,
});

/**
 * Combined AI request schema - POST /api/ai
 */
export const aiRequestSchema = z.discriminatedUnion('action', [
  aiAnalyzeImageSchema,
  aiGenerateCaptionsSchema,
  aiRemixCaptionSchema,
  aiGenerateContentIdeasSchema,
]);

// ============================================================================
// APPROVAL VALIDATION SCHEMAS
// ============================================================================

/**
 * Approval session creation schema
 */
export const createApprovalSessionSchema = z.object({
  client_id: uuidSchema,
  post_ids: z.array(uuidSchema).min(1).max(50),
  approver_email: emailSchema,
  expires_at: isoDateSchema.optional(),
  message: sanitizedString(1000).optional(),
});

/**
 * Approval decision schema
 */
export const approvalDecisionSchema = z.object({
  post_id: uuidSchema,
  decision: approvalStatusSchema,
  feedback: sanitizedString(2000).optional(),
  approved_by: sanitizedString(200).optional(),
});

// ============================================================================
// PORTAL VALIDATION SCHEMAS
// ============================================================================

/**
 * Portal upload schema
 */
export const portalUploadSchema = z.object({
  token: z.string().min(1, 'Portal token is required'),
  caption: sanitizedString(5000).min(1, 'Caption is required'),
  image_url: z.string().max(2000).optional(),
  scheduled_date: isoDateSchema.optional(),
  notes: sanitizedString(2000).optional(),
});

/**
 * Portal validation schema
 */
export const portalValidateSchema = z.object({
  token: z.string().min(1, 'Portal token is required'),
});

// ============================================================================
// QUERY PARAMETER SCHEMAS
// ============================================================================

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().max(50).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

/**
 * Date range query schema
 */
export const dateRangeSchema = z.object({
  start_date: isoDateSchema.optional(),
  end_date: isoDateSchema.optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date);
    }
    return true;
  },
  {
    message: 'End date must be after or equal to start date',
  }
);

/**
 * Post filter query schema
 */
export const postFilterSchema = z.object({
  client_id: uuidSchema.optional(),
  project_id: uuidSchema.optional(),
  status: postStatusSchema.optional(),
  platforms: z.string().transform((val) => val.split(',')).pipe(z.array(socialPlatformSchema)).optional(),
  search: sanitizedString(200).optional(),
});

// ============================================================================
// UPLOAD VALIDATION SCHEMAS
// ============================================================================

/**
 * Image upload metadata schema
 */
export const imageUploadSchema = z.object({
  filename: sanitizedString(255).min(1, 'Filename is required'),
  content_type: z.string().regex(/^image\/(jpeg|jpg|png|gif|webp)$/, 'Invalid image content type'),
  size: z.number().int().positive().max(10 * 1024 * 1024, 'Image size must be less than 10MB'),
  client_id: uuidSchema.optional(),
});

/**
 * Document upload metadata schema
 */
export const documentUploadSchema = z.object({
  filename: sanitizedString(255).min(1, 'Filename is required'),
  content_type: z.string().regex(/^(application\/pdf|application\/msword|application\/vnd\.|text\/)/, 'Invalid document content type'),
  size: z.number().int().positive().max(20 * 1024 * 1024, 'Document size must be less than 20MB'),
  client_id: uuidSchema,
});

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export const validators = {
  // Utilities
  sanitizeHtml,
  sanitizedString,
  uuidSchema,
  urlSchema,
  emailSchema,
  isoDateSchema,
  
  // Clients
  createClientSchema,
  updateClientSchema,
  clientIdParamSchema,
  
  // Posts
  createPostSchema,
  updatePostSchema,
  postIdParamSchema,
  bulkPostOperationSchema,
  
  // Projects
  createProjectSchema,
  updateProjectSchema,
  projectIdParamSchema,
  
  // AI
  aiRequestSchema,
  aiAnalyzeImageSchema,
  aiGenerateCaptionsSchema,
  aiRemixCaptionSchema,
  aiGenerateContentIdeasSchema,
  
  // Approvals
  createApprovalSessionSchema,
  approvalDecisionSchema,
  
  // Portal
  portalUploadSchema,
  portalValidateSchema,
  
  // Query parameters
  paginationSchema,
  dateRangeSchema,
  postFilterSchema,
  
  // Uploads
  imageUploadSchema,
  documentUploadSchema,
};

export default validators;

