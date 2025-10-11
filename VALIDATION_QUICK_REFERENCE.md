# Input Validation Quick Reference Card

## 🚀 Quick Start

### Basic Pattern (Copy & Paste)

```typescript
import { validateApiRequest } from '../../../lib/validationMiddleware';
import { yourSchema } from '../../../lib/validators';

export async function POST(request: NextRequest) {
  try {
    const validation = await validateApiRequest(request, {
      body: yourSchema,
      checkAuth: true, // Optional: validates Bearer token
      maxBodySize: 5 * 1024 * 1024, // Optional: 5MB limit
    });

    if (!validation.success) {
      return validation.response;
    }

    const { body, token } = validation.data;
    
    // Use body safely - it's validated and sanitized
    
  } catch (error) {
    return handleApiError(error, { route: '/api/your-route' });
  }
}
```

---

## 📋 Common Validators

### Primitives
```typescript
import { 
  uuidSchema,           // UUID format
  emailSchema,          // Email (max 320 chars)
  urlSchema,            // URL (max 2000 chars)
  isoDateSchema,        // ISO 8601 date
  sanitizedString,      // String with HTML removal
} from '../../../lib/validators';

// Usage in schemas
z.object({
  id: uuidSchema,
  email: emailSchema,
  website: urlSchema,
  date: isoDateSchema,
  name: sanitizedString(200), // Max 200 chars
})
```

### Entity Schemas
```typescript
import {
  createClientSchema,   // Client creation
  updateClientSchema,   // Client update
  createPostSchema,     // Post creation
  updatePostSchema,     // Post update
  aiRequestSchema,      // AI requests (discriminated union)
} from '../../../lib/validators';
```

---

## 🛠️ Common Patterns

### 1. Validate Body Only
```typescript
const validation = await validateApiRequest(request, {
  body: createClientSchema,
});
```

### 2. Validate Body + Auth
```typescript
const validation = await validateApiRequest(request, {
  body: createPostSchema,
  checkAuth: true,
});

const { body, token } = validation.data;
// Use token for Supabase auth
```

### 3. Validate URL Params
```typescript
const validation = await validateApiRequest(request, {
  params: z.object({ postId: uuidSchema }),
  paramsObject: params,
});

const { postId } = validation.data.params!;
```

### 4. Validate Body + Params
```typescript
const validation = await validateApiRequest(request, {
  body: updatePostSchema,
  params: z.object({ postId: uuidSchema }),
  paramsObject: params,
});

const { body, params: validatedParams } = validation.data;
```

### 5. Validate Query Params
```typescript
const validation = await validateApiRequest(request, {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

const { page, limit } = validation.data.query!;
```

---

## 🎨 Custom Validators

### Simple Object
```typescript
const schema = z.object({
  name: sanitizedString(200).min(1, 'Name is required'),
  email: emailSchema,
  age: z.number().int().positive().max(120),
});
```

### With Optional Fields
```typescript
const schema = z.object({
  name: sanitizedString(200),
  email: emailSchema.optional(),
  phone: z.string().optional(),
});
```

### With Arrays
```typescript
const schema = z.object({
  tags: z.array(sanitizedString(50)).max(20),
  platforms: z.array(socialPlatformSchema).min(1),
});
```

### With Enums
```typescript
const schema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});
```

### With Nested Objects
```typescript
const schema = z.object({
  user: z.object({
    name: sanitizedString(200),
    email: emailSchema,
  }),
  settings: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.boolean(),
  }),
});
```

### With Refinements
```typescript
const schema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  }
);
```

---

## 🔍 Error Handling

### Standard Error Response
```json
{
  "error": "Validation Error",
  "message": "Validation failed: name - String must be at most 200 characters",
  "validation_errors": [
    {
      "path": ["name"],
      "message": "String must be at most 200 characters"
    }
  ]
}
```

### Check for Success
```typescript
const validation = await validateApiRequest(request, { body: schema });

if (!validation.success) {
  // validation.response contains formatted error
  return validation.response;
}

// Continue with validated data
const { body } = validation.data;
```

---

## 🔒 Security Features

### HTML Sanitization
```typescript
// Input:  "<script>alert(1)</script>Hello"
// Output: "Hello"

const schema = z.object({
  comment: sanitizedString(500), // Automatically removes HTML
});
```

### Length Enforcement
```typescript
const schema = z.object({
  title: sanitizedString(200),       // Max 200 chars
  description: sanitizedString(2000), // Max 2000 chars
  caption: sanitizedString(5000),     // Max 5000 chars
});
```

### Format Validation
```typescript
const schema = z.object({
  email: emailSchema,     // Valid email format
  url: urlSchema,         // Valid URL with protocol
  uuid: uuidSchema,       // Valid UUID v4
  date: isoDateSchema,    // Valid ISO 8601 date
});
```

### Size Limits
```typescript
// Per-route size limits
const validation = await validateApiRequest(request, {
  body: schema,
  maxBodySize: 5 * 1024 * 1024, // 5MB
});

// Default is 10MB (set in next.config.ts)
```

---

## 📏 Recommended Size Limits

| Content Type | Max Size | Schema |
|-------------|----------|--------|
| Text content | 5MB | Most routes |
| With images (base64) | 10MB | `/api/ai`, `/api/posts` |
| File uploads | 10-20MB | Upload routes |
| Title/Name | 200 chars | `sanitizedString(200)` |
| Description | 2000 chars | `sanitizedString(2000)` |
| Caption/Content | 5000 chars | `sanitizedString(5000)` |

---

## 🧪 Testing Snippets

### Test XSS Prevention
```bash
curl -X POST http://localhost:3000/api/posts/create \
  -H "Content-Type: application/json" \
  -d '{"caption":"<script>alert(1)</script>Hello"}'
# Expected: "Hello" (script removed)
```

### Test Length Limits
```bash
curl -X POST http://localhost:3000/api/clients/create \
  -H "Content-Type: application/json" \
  -d '{"name":"'$(printf 'A%.0s' {1..300})'"}'
# Expected: 400 error
```

### Test UUID Validation
```bash
curl -X GET http://localhost:3000/api/posts-by-id/not-a-uuid
# Expected: 400 "Invalid UUID format"
```

---

## 📊 Available Schemas Reference

### Client Schemas
- `createClientSchema` - Create client (name, email, brand info)
- `updateClientSchema` - Update client (partial)
- `clientIdParamSchema` - URL param { clientId: uuid }

### Post Schemas
- `createPostSchema` - Create post (caption, platforms, etc.)
- `updatePostSchema` - Update post (partial, requires edited_by_user_id)
- `postIdParamSchema` - URL param { postId: uuid }
- `bulkPostOperationSchema` - Bulk operations on posts

### Project Schemas
- `createProjectSchema` - Create project
- `updateProjectSchema` - Update project (partial)
- `projectIdParamSchema` - URL param { projectId: uuid }

### AI Schemas
- `aiRequestSchema` - Discriminated union of all AI actions
- `aiAnalyzeImageSchema` - Image analysis
- `aiGenerateCaptionsSchema` - Caption generation
- `aiRemixCaptionSchema` - Caption remixing
- `aiGenerateContentIdeasSchema` - Content ideas

### Utility Schemas
- `paginationSchema` - { page, limit, sort_by, sort_order }
- `dateRangeSchema` - { start_date, end_date }
- `postFilterSchema` - Post filtering params
- `imageUploadSchema` - Image upload metadata (max 10MB)
- `documentUploadSchema` - Document upload metadata (max 20MB)

---

## 💡 Pro Tips

### 1. Reuse Schemas
```typescript
// Define once
export const userSchema = z.object({
  name: sanitizedString(200),
  email: emailSchema,
});

// Use in multiple places
const createSchema = userSchema.extend({ password: z.string().min(8) });
const updateSchema = userSchema.partial();
```

### 2. Compose Schemas
```typescript
const baseSchema = z.object({
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

const userSchema = baseSchema.extend({
  name: sanitizedString(200),
  email: emailSchema,
});
```

### 3. Transform Data
```typescript
const schema = z.object({
  email: z.string().transform(s => s.toLowerCase()),
  tags: z.string().transform(s => s.split(',')),
});
```

### 4. Conditional Validation
```typescript
const schema = z.object({
  type: z.enum(['email', 'phone']),
  value: z.string(),
}).refine(
  (data) => {
    if (data.type === 'email') {
      return emailSchema.safeParse(data.value).success;
    }
    return phoneSchema.safeParse(data.value).success;
  },
  { message: 'Invalid format for selected type' }
);
```

---

## 🎯 Checklist for New Routes

When adding validation to a new route:

- [ ] Import `validateApiRequest` from validationMiddleware
- [ ] Import or create appropriate schema
- [ ] Add validation at start of handler
- [ ] Check `!validation.success` and return error response
- [ ] Use validated data from `validation.data`
- [ ] Set appropriate `maxBodySize` if needed
- [ ] Add `checkAuth: true` if authentication required
- [ ] Test with invalid input
- [ ] Test with XSS payload
- [ ] Test with oversized payload

---

## 📚 Full Documentation

- **Complete Guide**: `INPUT_VALIDATION_GUIDE.md`
- **Implementation Summary**: `VALIDATION_IMPLEMENTATION_SUMMARY.md`
- **All Validators**: `src/lib/validators.ts`
- **All Middleware**: `src/lib/validationMiddleware.ts`

---

**Remember**: Always validate, sanitize, and enforce limits! 🔒

