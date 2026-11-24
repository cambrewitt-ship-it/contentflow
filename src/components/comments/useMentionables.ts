"use client";

import { useEffect, useState } from "react";
import type { Mentionable } from "@/lib/mentions";
import logger from "@/lib/logger";

type Source =
  | { portalToken: string }
  | { clientId: string | null | undefined; getAccessToken: () => string | null };

/** People who can be @mentioned on this client's posts. */
export function useMentionables(source: Source): Mentionable[] {
  const [mentionables, setMentionables] = useState<Mentionable[]>([]);
  const portalToken = "portalToken" in source ? source.portalToken : null;
  const clientId = "clientId" in source ? source.clientId : null;
  const getAccessToken = "getAccessToken" in source ? source.getAccessToken : null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        let res: Response;
        if (portalToken) {
          res = await fetch(`/api/portal/members/mentionables?token=${encodeURIComponent(portalToken)}`);
        } else if (clientId && getAccessToken) {
          const token = getAccessToken();
          if (!token) return;
          res = await fetch(`/api/clients/${clientId}/mentionables`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } else {
          return;
        }
        const data = await res.json();
        if (!cancelled && res.ok) setMentionables(data.mentionables ?? []);
      } catch (err) {
        logger.error("Mentionables fetch error:", err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // getAccessToken is usually an inline function — don't refetch on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalToken, clientId]);

  return mentionables;
}
