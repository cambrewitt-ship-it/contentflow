export interface ThreadComment {
  id: string;
  author_name: string;
  author_type: "agency" | "portal_party";
  content: string;
  created_at: string;
  parent_comment_id?: string | null;
  member_id?: string | null;
  user_id?: string | null;
  party: { id: string; name: string; role: string; color: string | null } | null;
  member?: { id: string; name: string; color: string | null } | null;
}

/** What the composer is replying to (null = new top-level comment). */
export interface ReplyTarget {
  commentId: string;
  authorName: string;
}
