# Route Analysis: Dynamic Segment Conflicts

## Current Route Structure with Dynamic Segments

### API Routes

```
src/app/api/
├── approval-sessions/
│   └── [sessionId]/
│       └── posts/
│           └── route.ts
├── clients/
│   └── [clientId]/
│       ├── activity-logs/
│       ├── activity-summary/
│       ├── analyze-website/
│       ├── brand-documents/
│       ├── data/
│       ├── logo/
│       ├── mark-viewed/
│       ├── posts/                    ✅ (moved from /api/posts/[clientId])
│       ├── route.ts
│       ├── scrape-website/
│       └── uploads/
│           └── [uploadId]/
│               └── route.ts
├── late/
│   └── get-accounts/
│       └── [clientId]/
│           └── route.ts
├── posts/
│   └── [postId]/
│       └── tags/
│           ├── [tagId]/
│           │   └── route.ts          ✅ Uses [postId] and [tagId] - OK
│           └── route.ts              ✅ Uses [postId] - OK
├── posts-by-id/
│   └── [postId]/
│       ├── draft/
│       ├── editing-session/
│       ├── revisions/
│       └── route.ts
├── projects/
│   └── [projectId]/
│       ├── route.ts
│       ├── scheduled-posts/
│       │   ├── [postId]/
│       │   │   ├── confirm/
│       │   │   └── move/
│       │   └── route.ts
│       └── unscheduled-posts/
├── tags/
│   ├── [clientId]/
│   │   └── route.ts                  ❌ CONFLICT #1
│   ├── [tagId]/
│   │   └── route.ts                  ❌ CONFLICT #1
│   └── route.ts                      (POST - creates tag)
```

### Page Routes

```
src/app/
├── approval/
│   └── [token]/
│       └── page.tsx
├── dashboard/
│   └── client/
│       └── [clientId]/
│           ├── approval-board/
│           ├── calendar/
│           ├── content-suite/
│           ├── dashboard-v2/
│           ├── facebook-page-selection/
│           ├── new-scheduler/
│           ├── page.tsx
│           ├── projects/
│           ├── project/
│           │   └── [projectId]/
│           │       └── page.tsx
│           └── test/
└── portal/
    └── [token]/
        └── page.tsx
```

## Identified Conflicts

### ❌ CONFLICT #1: `/api/tags/[clientId]` vs `/api/tags/[tagId]`

**Location:** Same path level under `/api/tags/`

**Current Routes:**
- `/api/tags/[clientId]/route.ts` - GET tags for a client
- `/api/tags/[tagId]/route.ts` - PUT/DELETE a specific tag

**Problem:** Next.js cannot distinguish between `clientId` and `tagId` at the same path level.

**Usage:**
- `/api/tags/${clientId}` - Called from `TagDropdownModal.tsx` to fetch tags for a client
- `/api/tags/${tagId}` - Used for updating/deleting tags (needs to be found)

## Proposed Solution

### Principle: Tags belong to clients, so tag operations should be under clients

**Restructuring Plan:**

1. **Move `/api/tags/[clientId]` → `/api/clients/[clientId]/tags`**
   - This route gets all tags for a client
   - Makes logical sense: tags are a resource of clients
   - Update reference in `TagDropdownModal.tsx`

2. **Move `/api/tags/[tagId]` → `/api/clients/[clientId]/tags/[tagId]`**
   - This route updates/deletes a specific tag
   - Tags belong to clients, so this nesting makes sense
   - Need to find all references and update them

3. **Keep `/api/tags/route.ts` (POST) as is**
   - Creates a new tag (takes client_id in body)
   - Could optionally move to `/api/clients/[clientId]/tags` but POST at root is fine

### Final Structure After Fix:

```
src/app/api/
├── clients/
│   └── [clientId]/
│       ├── tags/                     ✅ NEW
│       │   ├── [tagId]/              ✅ NEW
│       │   │   └── route.ts
│       │   └── route.ts            ✅ NEW (moved from /api/tags/[clientId])
│       └── ... (other routes)
└── tags/
    └── route.ts                      ✅ KEEP (POST - creates tag)
```

## Files That Need Updates

### Route Files to Move:
1. `src/app/api/tags/[clientId]/route.ts` → `src/app/api/clients/[clientId]/tags/route.ts`
   - **Current:** GET tags for a client
   - **New:** GET tags for a client (same functionality, better location)
   
2. `src/app/api/tags/[tagId]/route.ts` → `src/app/api/clients/[clientId]/tags/[tagId]/route.ts`
   - **Current:** PUT/DELETE a specific tag (gets client_id from tag in DB)
   - **New:** PUT/DELETE a specific tag (clientId in path, verify tag belongs to client)
   - **Note:** Route will need to verify `tag.client_id === clientId` for security

### Code References to Update:
1. `src/components/TagDropdownModal.tsx` (line 84)
   - **Current:** `/api/tags/${clientId}`
   - **New:** `/api/clients/${clientId}/tags`

### Route Implementation Changes Needed:
- `/api/clients/[clientId]/tags/[tagId]/route.ts` needs to:
  - Accept both `clientId` and `tagId` in params
  - Verify the tag belongs to the specified client
  - This adds an extra security check (tag must belong to the client in the path)

## Summary

- **Total Conflicts Found:** 1
- **Conflicts Fixed:** 0 (pending approval)
- **Routes to Move:** 2
- **Files to Update:** 1+ (need to search for all tag update/delete references)
