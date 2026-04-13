"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import logger from "@/lib/logger";

interface ApprovalStep {
  id: string;
  step_order: number;
  label: string | null;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  actioned_by: string | null;
  actioned_at: string | null;
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
  client_id: string;
}

const COLUMNS = [
  { id: "briefing", label: "Briefing" },
  { id: "in_review", label: "In Review" },
  { id: "changes_requested", label: "Changes Requested" },
  { id: "approved", label: "Approved" },
  { id: "no_pipeline", label: "No Pipeline" },
] as const;

type ColumnId = typeof COLUMNS[number]["id"];

function getColumn(post: KanbanPost): ColumnId {
  const steps = post.approval_steps;
  if (!steps || steps.length === 0) return "no_pipeline";
  if (steps.some(s => s.status === "changes_requested")) return "changes_requested";
  if (steps.every(s => s.status === "approved")) return "approved";
  const active = steps.find(s => s.status === "pending");
  return active?.step_order === 1 ? "briefing" : "in_review";
}

function StepChips({ steps }: { steps: ApprovalStep[] }) {
  if (!steps.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {steps.map(step => (
        <span
          key={step.id}
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            step.status === "approved" ? "bg-green-100 text-green-700" :
            step.status === "rejected" ? "bg-red-100 text-red-700" :
            step.status === "changes_requested" ? "bg-amber-100 text-amber-700" :
            "bg-muted text-muted-foreground"
          }`}
          title={step.party?.name ?? "Agency"}
        >
          {step.status === "approved" ? "✓" : step.status === "rejected" ? "✗" : "·"}{" "}
          {step.party?.name ?? `Step ${step.step_order}`}
        </span>
      ))}
    </div>
  );
}

// Agency-side step action for agency-owned steps (no party)
function AgencyStepAction({
  postId,
  postType,
  step,
  getHeaders,
  onActioned,
}: {
  postId: string;
  postType: string;
  step: ApprovalStep;
  getHeaders: () => Promise<Record<string, string>>;
  onActioned: () => void;
}) {
  const [isActioning, setIsActioning] = useState(false);

  const handleAction = async (action: "approved" | "changes_requested") => {
    setIsActioning(true);
    try {
      const headers = await getHeaders();
      await fetch(`/api/posts/${postId}/agency-step`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          step_id: step.id,
          action,
          actioned_by: "Agency",
          post_type: postType,
        }),
      });
      onActioned();
    } catch (err) {
      logger.error("Agency step action error:", err);
    } finally {
      setIsActioning(false);
    }
  };

  return (
    <div className="flex gap-1 mt-2">
      <Button
        size="sm"
        className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700 text-white"
        onClick={() => handleAction("approved")}
        disabled={isActioning}
      >
        {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : "✓ Done"}
      </Button>
    </div>
  );
}

export default function AgencyKanbanPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const { getAccessToken } = useAuth();

  const [posts, setPosts] = useState<KanbanPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(async () => {
    const token = await getAccessToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [getAccessToken]);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/agency/kanban?client_id=${clientId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load posts");
        return;
      }
      setPosts(data.posts ?? []);
    } catch (err) {
      logger.error("Agency kanban fetch error:", err);
      setError("Failed to load posts");
    } finally {
      setIsLoading(false);
    }
  }, [clientId, getAccessToken]);

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
    return <div className="p-6 text-destructive text-sm">{error}</div>;
  }

  const columns = COLUMNS.map(col => ({
    ...col,
    posts: posts.filter(p => getColumn(p) === col.id),
  }));

  return (
    <div className="p-6 h-full">
      <h1 className="text-2xl font-semibold mb-6">Kanban Board</h1>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <div key={col.id} className="flex-shrink-0 w-72">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <Badge variant="secondary" className="text-xs">{col.posts.length}</Badge>
            </div>
            <div className="space-y-3">
              {col.posts.length === 0 && (
                <p className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                  No posts
                </p>
              )}
              {col.posts.map(post => {
                const activeStep = post.approval_steps?.find(
                  s => s.status === "pending" && !s.party
                );
                return (
                  <Card key={post.id} className="text-xs">
                    <CardContent className="p-3">
                      {post.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.image_url}
                          alt="Post"
                          className="w-full h-24 object-cover rounded-md mb-2"
                        />
                      ) : (
                        <div className="w-full h-14 bg-muted rounded-md mb-2 flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex gap-1 mb-1.5">
                        {post.post_type_tag && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              post.post_type_tag === "pr_event"
                                ? "border-purple-300 text-purple-700"
                                : "border-sky-300 text-sky-700"
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
                      <p className="text-muted-foreground line-clamp-2 mb-1">
                        {post.caption}
                      </p>
                      <StepChips steps={post.approval_steps ?? []} />
                      {/* Agency action if the active step has no party (agency-owned step) */}
                      {activeStep && (
                        <AgencyStepAction
                          postId={post.id}
                          postType="calendar_scheduled"
                          step={activeStep}
                          getHeaders={getHeaders}
                          onActioned={fetchPosts}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
