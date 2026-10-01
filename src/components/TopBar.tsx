"use client";

import { Button } from "@/components/ui/button";
import { 
  Settings, 
  User,
  Menu
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUIThemeStyles } from "@/hooks/useUITheme";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import ClientViewToggle from "@/components/ClientViewToggle";
// import CreditBadge from "@/components/CreditBadge"; // Temporarily hidden - can be restored later

interface TopBarProps {
  className?: string;
  /** Opens the navigation drawer on mobile. */
  onMenuClick?: () => void;
}

export default function TopBar({ className = "", onMenuClick }: TopBarProps) {
  const { user } = useAuth();
  const { getThemeClasses } = useUIThemeStyles();
  const pathname = usePathname();

  // On a client's pages, the Dashboard / Content Suite / Calendar toggle lives here.
  const clientMatch = pathname?.match(/^\/dashboard\/client\/([^/]+)(?:\/([^/]+))?/);
  const clientId = clientMatch?.[1];
  const clientSection = clientMatch?.[2];
  const activeView =
    !clientSection ? 'dashboard' : clientSection === 'content-suite' || clientSection === 'calendar' ? clientSection : undefined;

  return (
    <div className={getThemeClasses(
      `bg-white border-b border-gray-200 px-3 py-2 md:px-6 md:py-4 flex items-center justify-between gap-2 ${className}`,
      `glass-card border-b border-white/20 px-3 py-2 md:px-6 md:py-4 flex items-center justify-between ${className}`
    )}>
      {/* Left side - Logo/Brand */}
      <div className="flex items-center flex-1 min-w-0 gap-1">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden -ml-1 p-2 rounded-md text-gray-700 hover:bg-gray-100 active:bg-gray-200"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className={getThemeClasses(
          "text-base md:text-xl font-bold text-gray-900 truncate",
          "text-base md:text-xl font-bold glass-text-primary truncate"
        )}>
          Content Manager
        </h1>
      </div>

      {/* Center - client view toggle (mobile uses the bottom nav instead) */}
      <div className="hidden md:flex items-center justify-center">
        {clientId && <ClientViewToggle clientId={clientId} activeView={activeView} />}
      </div>

      {/* Right side - Profile Menu */}
      <div className="flex items-center gap-2 md:gap-4 md:flex-1 justify-end flex-shrink-0">
        {/* <CreditBadge className="hidden sm:inline-flex" /> */} {/* Temporarily hidden - can be restored later */}
        <NotificationBell />
        {/* Profile Info */}
        <Link href="/settings" className="flex items-center space-x-3" aria-label="Account settings">
          <div className={getThemeClasses(
            "w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center",
            "w-8 h-8 glass-card rounded-full flex items-center justify-center"
          )}>
            <User className={getThemeClasses(
              "w-4 h-4 text-blue-700",
              "w-4 h-4 glass-text-primary"
            )} />
          </div>
          <div className="hidden lg:block">
            <p className={getThemeClasses(
              "text-sm font-medium text-gray-900",
              "text-sm font-medium glass-text-primary"
            )}>
              {user?.email?.split('@')[0] || 'User'}
            </p>
            <p className={getThemeClasses(
              "text-xs text-gray-500",
              "text-xs glass-text-muted"
            )}>
              {user?.email || ''}
            </p>
          </div>
        </Link>

        {/* Settings Button */}
        <Link href="/settings" className="hidden md:block">
          <Button 
            variant="outline" 
            size="sm"
            className={getThemeClasses(
              "flex items-center space-x-2",
              "flex items-center space-x-2 glass-button"
            )}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </Link>

      </div>
    </div>
  );
}
