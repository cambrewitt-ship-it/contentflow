"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Image as ImageIcon,
  FileText,
  Video,
  Calendar,
  Check,
  Inbox,
} from "lucide-react";
import logger from "@/lib/logger";

interface InboxUpload {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  status: string;
  notes: string | null;
  target_date: string | null;
  created_at: string;
  uploaded_by_party: {
    id: string;
    name: string;
    role: string;
    color: string | null;
  } | null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ fileType }: { fileType: string }) {
  if (fileType.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
  if (fileType.startsWith("video/")) return <Video className="h-5 w-5 text-muted-foreground" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

export default function ContentInboxPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const { getAccessToken } = useAuth();

  const [uploads, setUploads] = useState<InboxUpload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingInUse, setMarkingInUse] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/client-uploads?client_id=${clientId}&status=unassigned,pending`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setUploads(data.uploads ?? []);
      } else {
        setError(data.error ?? "Failed to load inbox");
      }
    } catch (err) {
      logger.error("Inbox fetch error:", err);
      setError("Failed to load inbox");
    } finally {
      setIsLoading(false);
    }
  }, [clientId, getAccessToken]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const handleMarkInUse = async (uploadId: string) => {
    setMarkingInUse(uploadId);
    try {
      const token = await getAccessToken();
      await fetch(`/api/client-uploads/${uploadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "in_use" }),
      });
      setUploads(prev => prev.filter(u => u.id !== uploadId));
    } catch (err) {
      logger.error("Mark in use error:", err);
    } finally {
      setMarkingInUse(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">Content Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Files uploaded by portal parties, waiting to be assigned to posts.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading inbox...
        </div>
      )}

      {!isLoading && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!isLoading && !error && uploads.length === 0 && (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-10 text-center">
          Inbox is empty — no unassigned uploads from portal parties.
        </p>
      )}

      {!isLoading && uploads.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {uploads.map(upload => (
            <Card key={upload.id} className="overflow-hidden">
              {upload.file_type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={upload.file_url}
                  alt={upload.file_name}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-28 bg-muted flex items-center justify-center">
                  <FileIcon fileType={upload.file_type} />
                </div>
              )}

              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-medium truncate">{upload.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(upload.file_size)}</p>

                {upload.notes && (
                  <p className="text-xs text-foreground bg-muted rounded px-2 py-1.5 whitespace-pre-wrap">
                    {upload.notes}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 items-center">
                  {upload.target_date && (
                    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(upload.target_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Badge>
                  )}
                  {upload.uploaded_by_party ? (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: upload.uploaded_by_party.color ?? "#6366f1" }}
                    >
                      {upload.uploaded_by_party.name}
                    </span>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Portal</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {new Date(upload.created_at).toLocaleDateString()}
                  </span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={() => handleMarkInUse(upload.id)}
                  disabled={markingInUse === upload.id}
                >
                  {markingInUse === upload.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Mark as In Use
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
