"use client";

import { Button } from "@/components/ui/button";
import { 
  Settings, 
  User
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUIThemeStyles } from "@/hooks/useUITheme";
import Link from "next/link";
// import CreditBadge from "@/components/CreditBadge"; // Temporarily hidden - can be restored later

interface TopBarProps {
  className?: string;
}

export default function TopBar({ className = "" }: TopBarProps) {
  const { user } = useAuth();
  const { getThemeClasses } = useUIThemeStyles();

  return (
    <div className={getThemeClasses(
      `bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between ${className}`,
      `glass-card border-b border-white/20 px-6 py-4 flex items-center justify-between ${className}`
    )}>
      {/* Left side - Logo/Brand */}
      <div className="flex items-center">
        <h1 className={getThemeClasses(
          "text-xl font-bold text-gray-900",
          "text-xl font-bold glass-text-primary"
        )}>
          Content Manager
        </h1>
      </div>

      {/* Right side - Profile Menu */}
      <div className="flex items-center space-x-4">
        {/* <CreditBadge className="hidden sm:inline-flex" /> */} {/* Temporarily hidden - can be restored later */}
        {/* Profile Info */}
        <div className="flex items-center space-x-3">
          <div className={getThemeClasses(
            "w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center",
            "w-8 h-8 glass-card rounded-full flex items-center justify-center"
          )}>
            <User className={getThemeClasses(
              "w-4 h-4 text-blue-700",
              "w-4 h-4 glass-text-primary"
            )} />
          </div>
          <div className="hidden sm:block">
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
        </div>

        {/* Settings Button */}
        <Link href="/settings">
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
