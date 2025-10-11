# Input Validation & Sanitization Guide

## Overview

This guide demonstrates how to implement comprehensive input validation using Zod across all API routes to prevent:
- **SQL Injection** attacks
- **XSS (Cross-Site Scripting)** attacks  
- **NoSQL Injection** attacks
- **Data type mismatches**
- **Malformed data**
- **Oversized payloads**

---

## 🔒 Security Enhancements Implemented

### 1. **Zod Schema Validation** (`src/lib/validators.ts`)
- Type-safe input validation
- HTML/script tag sanitization
- String length enforcement
- Email, URL, UUID, and date format validation
- Enum validation for restricted values

### 2. **Validation Middleware** (`src/lib/validationMiddleware.ts`)
- Reusable validation utilities
- Automatic error formatting
- Body, query, and URL parameter validation
- Request size limiting
- Authentication token validation

### 3. **Request Size Limits** (`next.config.ts`)
- Global 10MB body size limit
- Per-route customizable limits
- Content Security Policy headers

---

## 📚 Implementation Examples

### Example 1: POST /api/clients/create (Client Creation)

#### ❌ BEFORE (Vulnerable)

```typescript
export async function POST(req: NextRequest) {
  try {
    // NO VALIDATION - accepts any malicious input!
    const body = await req.json();
    const { name, company_description, website_url } = body;

    // NO LENGTH CHECKS - accepts infinite strings
    // NO HTML SANITIZATION - vulnerable to XSS
    // NO TYPE VALIDATION - could crash with wrong types
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }

    // Directly insert unsanitized data into database
    const { data: client, error } = await supabase
      .from('clients')
      .insert([{ name, company_description, website_url }])
      .select()
      .single();

    return NextResponse.json({ success: true, client });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Security Issues:**
- ❌ No input validation
- ❌ No HTML sanitization (XSS vulnerability)
- ❌ No length limits (DoS vulnerability)
- ❌ No type checking
- ❌ No URL validation
- ❌ No authentication check
- ❌ Accepts unlimited payload sizes

#### ✅ AFTER (Secure)

```typescript
import { validateApiRequest } from '../../../../lib/validationMiddleware';
import { createClientSchema } from '../../../../lib/validators';

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Comprehensive input validation with Zod
    const validation = await validateApiRequest(req, {
      body: createClientSchema.extend({
        brand_color: z.string().max(50).optional(),
        skipLateProfile: z.boolean().optional(),
      }),
      checkAuth: true, // ✅ Automatically validates auth token
      maxBodySize: 5 * 1024 * 1024, // ✅ 5MB limit
    });

    if (!validation.success) {
      console.error('❌ Validation failed');
      return validation.response; // Returns formatted error
    }

    const { body, token } = validation.data;
    console.log('✅ Request validated and sanitized');

    // All inputs are now:
    // ✅ Type-safe
    // ✅ HTML-sanitized
    // ✅ Length-constrained
    // ✅ Format-validated
    
    const { name, company_description, website_url } = body;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token!);
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    // Safe to insert - all data is validated and sanitized
    const { data: client, error } = await supabase
      .from('clients')
      .insert([{
        name,
        company_description,
        website_url,
        user_id: user.id,
      }])
      .select()
      .single();

    return NextResponse.json({ success: true, client });
  } catch (error) {
    return handleApiError(error, { route: '/api/clients/create' });
  }
}
```

**Security Improvements:**
- ✅ Input validation with Zod schemas
- ✅ HTML sanitization prevents XSS
- ✅ String length limits (200-5000 chars)
- ✅ URL format validation
- ✅ Email format validation
- ✅ Authentication enforcement
- ✅ 5MB payload size limit
- ✅ Type-safe with TypeScript

---

### Example 2: PUT /api/posts-by-id/[postId] (Post Update)

#### ❌ BEFORE (Vulnerable)

```typescript
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();
    
    // NO VALIDATION on postId - could be any string!
    // NO VALIDATION on body - accepts anything!
    
    const { caption, image_url, notes, edited_by_user_id, client_id } = body;
    
    // Basic check but no sanitization
    if (!caption && !image_url && !notes) {
      return NextResponse.json({ 
        error: 'At least one field required' 
      }, { status: 400 });
    }

    // Directly update with unsanitized data
    const { data, error } = await supabase
      .from('posts')
      .update({ caption, image_url, notes })
      .eq('id', postId) // SQL injection risk if postId is malicious
      .eq('client_id', client_id)
      .select()
      .single();

    return NextResponse.json({ success: true, post: data });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
```

**Security Issues:**
- ❌ No UUID validation on postId
- ❌ No caption length limits
- ❌ No HTML sanitization
- ❌ No platform validation
- ❌ No type checking
- ❌ Unlimited payload size

#### ✅ AFTER (Secure)

```typescript
import { validateApiRequest } from '../../../../lib/validationMiddleware';
import { updatePostSchema, postIdParamSchema } from '../../../../lib/validators';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    // SECURITY: Comprehensive input validation with Zod
    const validation = await validateApiRequest(request, {
      body: updatePostSchema, // ✅ Validates all post fields
      params: postIdParamSchema, // ✅ Validates UUID format
      paramsObject: params,
      maxBodySize: 10 * 1024 * 1024, // ✅ 10MB limit for images
    });

    if (!validation.success) {
      console.error('❌ Validation failed');
      return validation.response;
    }

    const { body, params: validatedParams } = validation.data;
    const { postId } = validatedParams!; // ✅ Guaranteed valid UUID
    
    console.log('✅ Request validated successfully');
    
    // All inputs are now:
    // ✅ Type-safe
    // ✅ HTML-sanitized (caption, notes)
    // ✅ Length-constrained (caption max 5000 chars)
    // ✅ Platform enum validated
    // ✅ UUID format validated
    
    const { caption, image_url, notes, edited_by_user_id, client_id } = body;

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Fetch current post for validation
    const { data: currentPost, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId) // ✅ Safe - postId is validated UUID
      .single();

    // Authorization check
    if (currentPost.client_id !== client_id) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 403 });
    }

    // Safe to update - all data validated
    const { data: updatedPost, error } = await supabase
      .from('posts')
      .update({
        caption,
        image_url,
        notes,
        last_edited_by: edited_by_user_id,
        last_edited_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('client_id', client_id)
      .select()
      .single();

    return NextResponse.json({ 
      success: true, 
      post: updatedPost 
    });
  } catch (error) {
    return handleApiError(error, { 
      route: '/api/posts-by-id/[postId]' 
    });
  }
}
```

**Security Improvements:**
- ✅ UUID validation on postId parameter
- ✅ Caption sanitization (HTML/script tags removed)
- ✅ Caption length limit (max 5000 chars)
- ✅ Platform enum validation
- ✅ Image URL format validation
- ✅ Type-safe arrays (tags, categories)
- ✅ 10MB payload limit

---

### Example 3: POST /api/ai (AI Content Generation)

#### ❌ BEFORE (Vulnerable)

```typescript
export async function POST(request: NextRequest) {
  try {
    const { action, imageData, prompt, clientId } = await request.json();

    // NO VALIDATION - accepts any action!
    // NO SANITIZATION on prompt - XSS risk!
    // NO IMAGE DATA VALIDATION - could be malicious!
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    switch (action) {
      case 'analyze_image':
        return await analyzeImage(imageData, prompt);
      
      case 'generate_captions':
        return await generateCaptions(imageData);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
```

**Security Issues:**
- ❌ No action validation (could send arbitrary actions)
- ❌ No prompt sanitization
- ❌ No image data validation
- ❌ No clientId UUID validation
- ❌ Unlimited payload (could send 100MB base64 image)
- ❌ No type safety

#### ✅ AFTER (Secure)

```typescript
import { validateApiRequest } from '../../../lib/validationMiddleware';
import { aiRequestSchema } from '../../../lib/validators';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Comprehensive input validation with Zod
    const validation = await validateApiRequest(request, {
      body: aiRequestSchema, // ✅ Discriminated union validates by action
      maxBodySize: 10 * 1024 * 1024, // ✅ 10MB limit (for base64 images)
    });

    if (!validation.success) {
      console.error('❌ AI request validation failed');
      return validation.response;
    }

    const body = validation.data.body!;
    console.log('✅ AI request validated:', { action: body.action });

    // All inputs are now:
    // ✅ Action is type-safe enum
    // ✅ Prompt is sanitized (max 2000 chars)
    // ✅ ClientId is valid UUID
    // ✅ Image data format validated
    // ✅ Copy settings validated

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured' 
      }, { status: 500 });
    }

    // TypeScript knows exact shape based on action
    switch (body.action) {
      case 'analyze_image':
        // TypeScript knows: body has imageData and optional prompt
        return await analyzeImage(body.imageData, body.prompt);
      
      case 'generate_captions':
        // TypeScript knows: body has all caption generation fields
        return await generateCaptions(
          body.imageData,
          body.existingCaptions,
          body.aiContext,
          body.clientId,
          body.copyType,
          body.copyTone,
          body.postNotesStyle,
          body.imageFocus
        );
      
      case 'remix_caption':
        return await remixCaption(
          body.imageData,
          body.prompt,
          body.existingCaptions,
          body.aiContext,
          body.clientId
        );
      
      case 'generate_content_ideas':
        // TypeScript knows: body has clientId
        return await generateContentIdeas(body.clientId);
      
      default:
        // This will never execute due to discriminated union
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 });
    }
  } catch (error) {
    return handleApiError(error, { 
      route: '/api/ai',
      operation: 'ai_request' 
    });
  }
}
```

**Security Improvements:**
- ✅ Action validated with discriminated union
- ✅ Prompt sanitized (HTML/script removed, max 2000 chars)
- ✅ ClientId validated as UUID
- ✅ Image data format validated
- ✅ Copy type/tone validated as enums
- ✅ 10MB payload limit
- ✅ Full type safety with TypeScript

---

## 🛠️ How to Apply to Other Routes

### Step 1: Import Required Utilities

```typescript
import { validateApiRequest } from '../../../lib/validationMiddleware';
import { yourSchema } from '../../../lib/validators';
```

### Step 2: Replace Manual Validation

```typescript
// ❌ BEFORE
const body = await request.json();
if (!body.field) {
  return NextResponse.json({ error: 'Field required' }, { status: 400 });
}

// ✅ AFTER
const validation = await validateApiRequest(request, {
  body: yourSchema,
  checkAuth: true, // Optional: validates Bearer token
  maxBodySize: 5 * 1024 * 1024, // Optional: custom size limit
});

if (!validation.success) {
  return validation.response; // Formatted error with all validation issues
}

const { body, token } = validation.data;
// Use body safely - it's validated and sanitized
```

### Step 3: Use Validated Data

```typescript
// All fields are now:
// ✅ Type-safe (TypeScript knows exact types)
// ✅ Sanitized (HTML/scripts removed)
// ✅ Validated (format, length, enum values checked)

const { name, email, description } = body;

// Safe to use in database operations
await supabase.from('table').insert({ name, email, description });
```

---

## 📋 Available Validators

### Common Validators
- `uuidSchema` - UUID format validation
- `emailSchema` - Email format validation (max 320 chars)
- `urlSchema` - URL format validation (max 2000 chars)
- `isoDateSchema` - ISO 8601 date validation
- `sanitizedString(maxLength)` - String with HTML sanitization

### Entity Schemas
- `createClientSchema` - Client creation
- `updateClientSchema` - Client update
- `createPostSchema` - Post creation
- `updatePostSchema` - Post update
- `createProjectSchema` - Project creation
- `updateProjectSchema` - Project update

### AI Schemas
- `aiRequestSchema` - AI generation requests (discriminated union)
- `aiAnalyzeImageSchema` - Image analysis
- `aiGenerateCaptionsSchema` - Caption generation
- `aiRemixCaptionSchema` - Caption remixing
- `aiGenerateContentIdeasSchema` - Content ideas

### Query Schemas
- `paginationSchema` - Pagination params
- `dateRangeSchema` - Date range queries
- `postFilterSchema` - Post filtering

---

## 🔐 Security Best Practices

### 1. **Always Validate Input**
```typescript
// ❌ DON'T trust user input
const body = await request.json();
await db.insert(body); // Dangerous!

// ✅ DO validate first
const validation = await validateApiRequest(request, { body: schema });
if (!validation.success) return validation.response;
await db.insert(validation.data.body); // Safe!
```

### 2. **Sanitize HTML Content**
```typescript
// Automatically done by sanitizedString()
const schema = z.object({
  comment: sanitizedString(500), // Removes <script> tags
});
```

### 3. **Enforce Length Limits**
```typescript
const schema = z.object({
  title: sanitizedString(200),      // Max 200 chars
  description: sanitizedString(2000), // Max 2000 chars
  caption: sanitizedString(5000),     // Max 5000 chars
});
```

### 4. **Validate UUIDs**
```typescript
// ❌ DON'T accept any string
const { userId } = await params;

// ✅ DO validate UUID format
const validation = await validateApiRequest(request, {
  params: z.object({ userId: uuidSchema }),
  paramsObject: params,
});
```

### 5. **Use Enums for Restricted Values**
```typescript
const schema = z.object({
  status: z.enum(['draft', 'published', 'archived']), // Only these values
  platform: socialPlatformSchema, // Predefined platforms
});
```

### 6. **Limit Payload Sizes**
```typescript
const validation = await validateApiRequest(request, {
  body: schema,
  maxBodySize: 5 * 1024 * 1024, // 5MB limit
});
```

### 7. **Validate Authentication**
```typescript
const validation = await validateApiRequest(request, {
  body: schema,
  checkAuth: true, // Automatically checks Bearer token
});

const { token } = validation.data;
// Use token to get user
```

---

## 🧪 Testing Validation

### Test Invalid Input
```typescript
// Test with missing required field
const response = await fetch('/api/clients/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* missing name */ }),
});

// Should return 400 with validation errors
expect(response.status).toBe(400);
const error = await response.json();
expect(error.validation_errors).toBeDefined();
```

### Test XSS Prevention
```typescript
// Test with script tag
const response = await fetch('/api/posts/create', {
  method: 'POST',
  body: JSON.stringify({
    caption: '<script>alert("XSS")</script>Hello',
  }),
});

const post = await response.json();
// Script tags should be removed
expect(post.caption).not.toContain('<script>');
expect(post.caption).toBe('Hello');
```

### Test Length Limits
```typescript
// Test with oversized string
const response = await fetch('/api/clients/create', {
  method: 'POST',
  body: JSON.stringify({
    name: 'A'.repeat(300), // Exceeds 200 char limit
  }),
});

expect(response.status).toBe(400);
const error = await response.json();
expect(error.message).toContain('at most 200 characters');
```

---

## 📊 Error Response Format

All validation errors return a consistent format:

```json
{
  "error": "Validation Error",
  "message": "Validation failed: name - String must be at most 200 characters",
  "validation_errors": [
    {
      "path": ["name"],
      "message": "String must be at most 200 characters"
    },
    {
      "path": ["email"],
      "message": "Invalid email format"
    }
  ]
}
```

---

## 🎯 Summary

### Before Implementation
- ❌ No input validation
- ❌ XSS vulnerabilities
- ❌ No length limits
- ❌ Type unsafe
- ❌ No sanitization
- ❌ Unlimited payload sizes

### After Implementation
- ✅ Comprehensive Zod validation
- ✅ HTML sanitization (prevents XSS)
- ✅ String length enforcement
- ✅ Type-safe with TypeScript
- ✅ Format validation (email, URL, UUID, dates)
- ✅ Request size limits (10MB global, customizable per-route)
- ✅ Enum validation for restricted values
- ✅ Consistent error responses
- ✅ Authentication enforcement

---

## 📖 Additional Resources

- **Validators**: `src/lib/validators.ts` - All Zod schemas
- **Middleware**: `src/lib/validationMiddleware.ts` - Validation utilities
- **Config**: `next.config.ts` - Request size limits and security headers
- **Zod Documentation**: https://zod.dev/

---

## 🚀 Next Steps

1. Apply validation to remaining API routes
2. Add unit tests for validation logic
3. Monitor validation errors in production
4. Update validation schemas as requirements change
5. Document custom validators for your team

**Remember**: Never trust user input. Always validate, sanitize, and enforce limits!

