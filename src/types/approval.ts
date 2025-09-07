// Client approval session interface
export interface ClientApprovalSession {
  id: string;
  project_id: string;
  client_id: string;
  share_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Post approval interface
export interface PostApproval {
  id: string;
  session_id: string;
  post_id: string;
  post_type: 'scheduled' | 'planner_scheduled';
  approval_status: 'pending' | 'approved' | 'rejected';
  client_comments?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

// Combined interface for board display
export interface ApprovalBoardPost {
  id: string;
  caption: string;
  image_url: string;
  scheduled_time: string;
  scheduled_date: string;
  post_type: 'scheduled' | 'planner_scheduled';
  approval?: PostApproval;
}

// Enhanced interface with new database fields
export interface EnhancedApprovalBoardPost extends ApprovalBoardPost {
  approval_status: 'pending' | 'approved' | 'rejected' | 'needs_attention';
  needs_attention: boolean;
  client_feedback?: string;
  original_caption?: string; // To track if client edited
}

// Week data structure for board display
export interface WeekData {
  weekStart: Date;
  weekLabel: string; // "W/C 8th September"
  posts: ApprovalBoardPost[];
}

// API request/response types
export interface CreateSessionRequest {
  project_id: string;
  client_id: string;
  expires_in_days?: number;
}

export interface CreateSessionResponse {
  session: ClientApprovalSession;
  share_url: string;
}

export interface UpdateApprovalRequest {
  post_id: string;
  post_type: 'scheduled' | 'planner_scheduled';
  approval_status: 'approved' | 'rejected' | 'needs_attention';
  client_comments?: string;
  edited_caption?: string; // New field for caption changes
}
