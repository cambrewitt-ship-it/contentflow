"use client";
import { User, Plus } from "lucide-react";
import { Button } from "components/ui/button";
import Link from "next/link";
import UIThemeToggle from "components/UIThemeToggle";
import { useUIThemeStyles } from "hooks/useUITheme";

export default function Dashboard() {
  const { getThemeClasses, isAlternative } = useUIThemeStyles();

  return (
    <div className="flex-1 flex items-center justify-center p-8 md:p-8 pt-20 md:pt-8">
      <div className={getThemeClasses(
        "text-center max-w-md",
        "text-center max-w-md"
      )}>
        <div className={getThemeClasses(
          "w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6",
          "w-16 h-16 glass-card rounded-full flex items-center justify-center mx-auto mb-6"
        )}>
          <User className={getThemeClasses(
            "h-8 w-8 text-primary",
            "h-8 w-8 glass-text-primary"
          )} />
        </div>
        <h1 className={getThemeClasses(
          "text-3xl font-bold text-foreground mb-4",
          "text-3xl font-bold glass-text-primary mb-4"
        )}>
          Welcome to Content Manager
        </h1>
        <p className={getThemeClasses(
          "text-lg text-muted-foreground mb-8",
          "text-lg glass-text-secondary mb-8"
        )}>
          Pick a client to get started with your social media management workflow.
        </p>
        <div className={getThemeClasses(
          "text-sm text-muted-foreground space-y-1 mb-8",
          "text-sm glass-text-muted space-y-1 mb-8"
        )}>
          <p>• Upload content and generate AI captions</p>
          <p>• Organize campaigns by client</p>
          <p>• Schedule posts across all platforms</p>
        </div>
        
        {/* Create New Client Button */}
        <Link href="/dashboard/clients/new">
          <Button className={getThemeClasses(
            "w-full",
            "w-full glass-button glass-button-primary"
          )}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Client
          </Button>
        </Link>
        
        {/* UI Theme Toggle */}
        <div className="mt-8">
          <UIThemeToggle />
        </div>
      </div>
    </div>
  );
} 