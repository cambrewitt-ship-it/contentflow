"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { usePortal } from "@/contexts/PortalContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Clock, Image as ImageIcon, MessageSquare } from "lucide-react";
import { PostDetailModal } from "@/components/PostDetailModal";
import logger from "@/lib/logger";

interface ApprovalStep {
  id: string;
  step_order: number;
  label: string | null;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  party: { id: string; name: string; role: string; color: string | null } | null;
}

interface KanbanPost {
  id: string;
  caption: string;
  image_url: string | null;
  scheduled_date: string | null;
  approval_status: string;
  post_type_tag: string | null;
  approval_steps: ApprovalStep[];
}

// Kanban columns derived from pipeline stages
const KANBAN_COLUMNS = [
  { id: "briefing", label: "Briefing", statuses: ["pending"] as const, stepOrder: 1 },
  { id: "in_review", label: "In Review", statuses: ["pending"] as const, stepOrder: null },
  { id: "changes_requested", label: "Changes Requested", statuses: ["changes_requested"] as const, stepOrder: null },
  { id: "approved", label: "Approved", statuses: ["approved"] as const, stepOrder: null },
];

function getColumnForPost(post: KanbanPost): string {
  const steps = post.approval_steps;
  if (steps.length === 0) return "briefing";

  const anyChanges = steps.some(s => s.status === "changes_requested");
  if (anyChanges) return "changes_requested";

  const allApproved = steps.every(s => s.status === "approved");
  if (allApproved) return "approved";

  // Find current active step (first pending)
  const activeStep = steps.find(s => s.status === "pending");
  if (!activeStep) return "approved";

  return activeStep.step_order === 1 ? "briefing" : "in_review";
}

function ApprovalChips({ steps, partyId }: { steps: ApprovalStep[]; partyId?: string | null }) {
  if (steps.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {steps.map(step => {
        const isYou = step.party?.id === partyId;
        return (
          <span
            key={step.id}
            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              step.status === "approved"
                ? "bg-green-100 text-green-700"
                : step.status === "rejected"
                ? "bg-red-100 text-red-700"
                : step.status === "changes_requested"
                ? "bg-amber-100 text-amber-700"
                : "bg-muted text-muted-foreground"
            } ${isYou ? "ring-1 ring-offset-1" : ""}`}
            style={isYou ? { ringColor: step.party?.color ?? "#6366f1" } : {}}
            title={step.party?.name ?? "Agency"}
          >
            {step.status === "approved" ? "✓" : step.status === "rejected" ? "✗" : "·"}{" "}
            {step.party?.name ?? `Step ${step.step_order}`}
          </span>
        );
      })}
    </div>
  );
}

export default function PortalKanbanPage() {
  const { token } = useParams() as { token: string };
  const { party } = usePortal();

  const [posts, setPosts] = useState<KanbanPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<KanbanPost | null>(null);

  const fetchPosts = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/calendar?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load posts");
        return;
      }
      // Flatten posts from the by-date structure
      const allPosts: KanbanPost[] = Object.values(data.posts as Record<string, KanbanPost[]>).flat();
      // Only show posts that have a workflow pipeline
      const pipelinePosts = allPosts.filter(p => p.approval_steps?.length > 0);
      setPosts(pipelinePosts);
    } catch (err) {
      logger.error("Kanban fetch error:", err);
      setError("Failed to load posts");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">{error}</div>
    );
  }

  const columns = KANBAN_COLUMNS.map(col => ({
    ...col,
    posts: posts.filter(p => getColumnForPost(p) === col.id),
  }));

  return (
    <div className="h-full">
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        {columns.map(col => (
          <div key={col.id} className="flex-shrink-0 w-72">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-foreground">{col.label}</h3>
              <Badge variant="secondary" className="text-xs">
                {col.posts.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {col.posts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                  No posts
                </p>
              )}
              {col.posts.map(post => (
                <Card
                  key={post.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedPost(post)}
                >
                  <CardContent className="p-3">
                    {/* Thumbnail */}
                    {post.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.image_url}
                        alt="Post media"
                        className="w-full h-28 object-cover rounded-md mb-2"
                      />
                    ) : (
                      <div className="w-full h-16 bg-muted rounded-md mb-2 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex gap-1 mb-2">
                      {post.post_type_tag && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            post.post_type_tag === "pr_event"
                              ? "border-purple-300 text-purple-700 bg-purple-50"
                              : "border-sky-300 text-sky-700 bg-sky-50"
                          }`}
                        >
                          {post.post_type_tag === "pr_event" ? "PR Event" : "Social"}
                        </Badge>
                      )}
                      {post.scheduled_date && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {new Date(post.scheduled_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </Badge>
                      )}
                    </div>

                    {/* Caption preview */}
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {post.caption}
                    </p>

                    {/* Approval chips */}
                    <ApprovalChips steps={post.approval_steps} partyId={party?.id} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          postType="calendar_scheduled"
          portalToken={token}
          party={party}
          onClose={() => setSelectedPost(null)}
          onStepActioned={() => {
            setSelectedPost(null);
            fetchPosts();
          }}
        />
      )}
    </div>
  );
}
