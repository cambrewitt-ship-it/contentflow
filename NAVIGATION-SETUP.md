# Navigation Setup: Client Dashboard → Content Suite → Scheduler

## Overview
This document describes the new navigation flow that allows users to seamlessly move from the client dashboard to create content and then schedule posts.

## Navigation Flow
```
Client Dashboard → Content Suite → Scheduler
     ↓                ↓           ↓
  View Clients    Create Posts  Schedule Posts
  Manage Projects Upload Media  Select Accounts
  Connect Social  Generate     Set Times
  Media Accounts  Captions     Publish
```

## New Features Added

### 1. Project Management
- **Create Projects**: Users can create new projects for each client
- **Project List**: View all active projects for a client
- **Project Details**: Each project shows name, description, and creation date

### 2. Quick Actions
- **Create Content Button**: Prominent button in the header for quick access
- **Smart Navigation**: 
  - Single project: Direct navigation to Content Suite
  - Multiple projects: Project selection modal
  - No projects: Create new project form

### 3. Enhanced Navigation
- **Content Suite Access**: Direct navigation to `/dashboard/client/[clientId]/project/[projectId]`
- **Scheduler Access**: Direct navigation to `/dashboard/client/[clientId]/project/[projectId]/scheduler`
- **Context Preservation**: Client ID maintained throughout navigation

## Database Setup

### Required Tables

#### 1. Projects Table
```sql
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. Update Scheduled Posts Table
```sql
-- Add account_ids column for LATE API integration
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS account_ids JSONB DEFAULT '[]';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_account_ids ON scheduled_posts USING GIN (account_ids);
```

### Database Setup Commands
Run the SQL commands in `database-setup.sql` to set up all required tables and policies.

## API Endpoints

### Projects API
- **GET** `/api/projects?clientId={clientId}` - Fetch projects for a client
- **POST** `/api/projects` - Create a new project

### Connected Accounts API
- **GET** `/api/late/get-accounts/{clientId}` - Fetch connected social media accounts

## User Experience

### Single Project Scenario
1. User sees "Create Content" button in header
2. Clicking navigates directly to Content Suite
3. User creates posts and moves to Scheduler
4. Posts are scheduled with selected social accounts

### Multiple Projects Scenario
1. User sees "Create Content" button in header
2. Clicking shows project selection modal
3. User chooses existing project or creates new one
4. Navigation proceeds to Content Suite
5. User creates posts and moves to Scheduler

### No Projects Scenario
1. User sees "Create Your First Project" button
2. Clicking shows project creation form
3. User creates first project
4. Navigation proceeds to Content Suite

## File Structure
```
src/
├── app/
│   ├── api/
│   │   ├── projects/
│   │   │   └── route.ts          # Project CRUD operations
│   │   └── late/
│   │       └── get-accounts/
│   │           └── [clientId]/
│   │               └── route.ts  # Fetch connected accounts
│   └── dashboard/
│       └── client/
│           └── [clientId]/
│               ├── page.tsx      # Client dashboard (updated)
│               └── project/
│                   └── [projectId]/
│                       ├── page.tsx (Content Suite)
│                       └── scheduler/
│                           └── scheduler-client.tsx  # Post scheduling
├── lib/
│   └── store.ts                  # Updated for account-based scheduling
└── components/
    └── ui/                       # UI components
```

## Benefits

### 1. Streamlined Workflow
- **One-click access** to content creation
- **Context preservation** throughout the journey
- **Logical progression** from creation to scheduling

### 2. Better Organization
- **Project-based structure** for content management
- **Clear separation** of concerns
- **Scalable architecture** for multiple clients/projects

### 3. Enhanced User Experience
- **Intuitive navigation** with visual cues
- **Smart defaults** based on project count
- **Consistent interface** across all sections

### 4. LATE API Integration Ready
- **Account-based scheduling** instead of platform-based
- **Connected accounts display** in scheduler
- **Proper data structure** for API calls

## Next Steps

### Phase 1: Basic Navigation ✅
- [x] Project management system
- [x] Navigation to Content Suite
- [x] Navigation to Scheduler
- [x] Project creation workflow

### Phase 2: Enhanced Features
- [ ] Project editing and deletion
- [ ] Project templates
- [ ] Bulk project operations
- [ ] Project analytics

### Phase 3: Advanced Integration
- [ ] LATE API publishing
- [ ] Multi-platform scheduling
- [ ] Content performance tracking
- [ ] Automated workflows

## Testing

### Manual Testing Checklist
- [ ] Create new project
- [ ] Navigate to Content Suite
- [ ] Navigate to Scheduler
- [ ] Project selection modal (multiple projects)
- [ ] Error handling (no projects)
- [ ] URL parameter preservation

### API Testing
- [ ] Project creation endpoint
- [ ] Project fetching endpoint
- [ ] Connected accounts endpoint
- [ ] Error responses
- [ ] Authentication/authorization

## Troubleshooting

### Common Issues
1. **Projects not loading**: Check database connection and RLS policies
2. **Navigation errors**: Verify route structure and parameters
3. **API failures**: Check environment variables and Supabase configuration

### Debug Steps
1. Check browser console for errors
2. Verify API endpoint responses
3. Check database table structure
4. Validate environment variables
5. Review RLS policies
