export interface ScheduledPost {
  id: string;
  caption: string;
  image_url: string;
  scheduled_date: string;
  scheduled_time: string;
  late_status?: 'pending' | 'scheduled' | 'published' | 'failed';
  late_post_id?: string;
  platforms_scheduled?: string[];
}

export interface ConnectedAccount {
  _id: string;
  platform: string;
  name: string;
  accountId?: string;
}

export interface Project {
  id: string;
  name: string;
  client_id: string;
  description?: string;
  status: string;
}

export interface Client {
  id: string;
  name: string;
  description?: string;
  company_description?: string;
  website_url?: string;
}
