// API Response Types
export interface ApiError {
  error: string;
  message?: string;
  details?: string;
  code?: string;
}

export interface ApiSuccess<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Client Types
export interface Client {
  id: string;
  name: string;
  description?: string;
  website?: string;
  company_description?: string;
  website_url?: string;
  brand_tone?: string;
  target_audience?: string;
  industry?: string;
  brand_keywords?: string[];
  brand_guidelines_summary?: string;
  core_products_services?: string;
  value_proposition?: string;
  caption_dos?: string;
  caption_donts?: string;
  founded_date?: string;
  late_profile_id?: string;
  created_at: string;
  updated_at: string;
}

// Post Types
export interface Post {
  id: string;
  client_id: string;
  project_id?: string;
  caption: string;
  image_url?: string;
  media_type?: string;
  status: 'draft' | 'ready' | 'scheduled' | 'published';
  notes?: string;
  late_media_url?: string;
  created_at: string;
  updated_at: string;
}

// Project Types
export interface Project {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'completed';
  created_at: string;
  updated_at: string;
  postCount?: number;
  lastUpdated?: string;
}

// Brand Document Types
export interface BrandDocument {
  id: string;
  client_id: string;
  filename: string;
  original_filename?: string;
  file_type: string;
  file_size: number;
  file_path?: string;
  processing_status?: string;
  created_at: string;
  updated_at: string;
}

// Website Scrape Types
export interface WebsiteScrape {
  id: string;
  client_id: string;
  url: string;
  title?: string;
  meta_description?: string;
  content?: string;
  status: 'pending' | 'completed' | 'failed';
  scrape_status?: string;
  page_title?: string;
  scraped_content?: string;
  scraped_at?: string;
  created_at: string;
  updated_at: string;
}

// Uploaded Image Types
export interface UploadedImage {
  id: string;
  preview: string;
  file?: File;
  caption?: string;
  notes?: string;
}

// Caption Types
export interface Caption {
  id: string;
  text: string;
  isSelected?: boolean;
}

// Form Data Types
export interface SchedulePostData {
  postId: string;
  platforms: string[];
  accountIds: string[];
  scheduledDate: string;
  scheduledTime: string;
}

export interface CreatePostData {
  imageUrl: string;
  caption: string;
  notes?: string;
}

export interface ClientFormData {
  name: string;
  description?: string;
  company_description?: string;
  website_url?: string;
  brand_tone?: string;
  target_audience?: string;
  industry?: string;
  brand_keywords?: string;
  caption_dos?: string;
  caption_donts?: string;
}

// LATE API Types
export interface LateAccount {
  _id: string;
  platform: string;
  username?: string;
  accountId?: string;
  status?: string;
}

export interface LatePlatform {
  platform: string;
  accountId: string;
}

export interface LatePostRequest {
  content: string;
  platforms: LatePlatform[];
  scheduledFor: string;
  timezone: string;
  mediaItems: Array<{
    type: string;
    url: string;
  }>;
}

// Scheduled Post Types
export interface ScheduledPost {
  id: string;
  client_id: string;
  post_id: string;
  scheduled_time: string;
  account_ids: string[];
  status: string;
  late_post_id?: string;
  created_at: string;
  updated_at: string;
}

// OAuth Message Types
export interface OAuthMessage {
  type: 'success' | 'error';
  message: string;
}

// Debug Info Types
export interface DebugInfo {
  message: string;
  timestamp: string;
  details?: string;
  error?: string;
}

// Navigation Types
export interface NavigationItem {
  name: string;
  href: string;
  active?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

// File Upload Types
export interface FileUploadResponse {
  success: boolean;
  file?: BrandDocument;
  error?: string;
}

// Website Scrape Response Types
export interface WebsiteScrapeResponse {
  success: boolean;
  scrape?: WebsiteScrape;
  error?: string;
}

// Website Analysis Types
export interface WebsiteAnalysis {
  business_description: string;
  industry_category: string;
  core_products_services: string[];
  target_audience: string;
  value_proposition: string;
  brand_tone: string;
}

export interface WebsiteAnalysisResponse {
  success: boolean;
  analysis: WebsiteAnalysis;
  source: {
    url: string;
    scrapeId: string;
    analyzedAt: string;
  };
}

// Generic API Response Types
export interface ClientsResponse extends ApiResponse {
  clients?: Client[];
}

export interface ClientResponse extends ApiResponse {
  client?: Client;
}

export interface PostsResponse extends ApiResponse {
  posts?: Post[];
}

export interface ProjectsResponse extends ApiResponse {
  projects?: Project[];
}

export interface BrandDocumentsResponse extends ApiResponse {
  documents?: BrandDocument[];
}

export interface WebsiteScrapesResponse extends ApiResponse {
  scrapes?: WebsiteScrape[];
}

// Utility Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingStateData<T> {
  data: T | null;
  loading: LoadingState;
  error: string | null;
}
