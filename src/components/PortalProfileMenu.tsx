"use client";

import { useState } from "react";
import { Bell, BellOff, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePortal } from "@/contexts/PortalContext";
import logger from "@/lib/logger";

/** Avatar in the portal top bar: who's signed in, email notifications, switch person. */
export function PortalProfileMenu({ token }: { token: string }) {
  const { member, setMember, signOutMember } = usePortal();
  const [isSaving, setIsSaving] = useState(false);

  if (!member) return null;

  const toggleNotifications = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/portal/members/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email_notifications: !member.email_notifications }),
      });
      const data = await res.json();
      if (res.ok) setMember(data.member);
    } catch (err) {
      logger.error("Failed to update notification setting:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 w-8 md:h-9 md:w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white shadow-sm"
          style={{ backgroundColor: member.color ?? "#6366f1" }}
          title={`Signed in as ${member.name}`}
        >
          {member.name.charAt(0).toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold truncate">{member.name}</p>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSaving}
          onSelect={e => {
            e.preventDefault();
            toggleNotifications();
          }}
        >
          {member.email_notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          <span className="flex-1">Email me when I&apos;m tagged</span>
          <span className="text-xs text-muted-foreground">{member.email_notifications ? "On" : "Off"}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOutMember()}>
          <LogOut className="h-4 w-4" />
          Not {member.name.split(" ")[0]}? Switch person
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
