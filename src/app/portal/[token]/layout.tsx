"use client";

import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortalProvider, usePortal } from "../../../contexts/PortalContext";
import { 
  LogOut, 
  AlertCircle,
  Loader2 
} from "lucide-react";


function PortalLayoutContent({ children, token }: { children: React.ReactNode; token: string }) {
  const { client, isLoading, error, logout } = usePortal();
  const pathname = usePathname();
  const router = useRouter();

  const tabs: Array<{ id: string; label: string; icon: any; path: string }> = [
    // All navigation tabs have been removed as their corresponding pages were deleted
  ];

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2">Validating Access</h2>
          <p className="text-muted-foreground">Please wait while we verify your portal access...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-destructive">Access Denied</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="w-full"
          >
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-destructive">Invalid Access</h2>
          <p className="text-muted-foreground mb-6">Unable to validate your portal access.</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="w-full"
          >
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* CSS Grid Layout */}
      <div className="grid grid-cols-[256px_1fr] h-full">
        {/* Left Sidebar - Fixed width */}
        <div className="bg-card border-r border-border shadow-sm flex flex-col overflow-hidden">
          {/* Logo Section */}
          <div className="p-6 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-center">
              <img 
                src="/cm-logo.png" 
                alt="CM Logo" 
                className="h-12 w-auto"
              />
            </div>
          </div>

          {/* Client Info */}
          <div className="p-6 border-b border-border flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-semibold text-lg">
                  {client.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">
                  {client.name}
                </h2>
                <p className="text-sm text-muted-foreground">Client Portal</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 p-4 overflow-y-auto">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = pathname?.includes(tab.path) ?? false;
                
                return (
                  <Button
                    key={tab.id}
                    variant={isActive ? "default" : "ghost"}
                    className={`w-full justify-start flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                    onClick={() => {
                      const newPath = `/portal/${token}${tab.path}`;
                      router.push(newPath);
                    }}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Logout Button */}
          <div className="p-4 border-t border-border flex-shrink-0">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>

        {/* Main Content Area - Always visible header */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          {/* Header - Always visible */}
          <header className="bg-card border-b border-border shadow-sm flex-shrink-0">
            <div className="px-6 py-4">
              <h1 className="text-2xl font-semibold text-card-foreground">
                {tabs.find(tab => pathname?.includes(tab.path))?.label || 'Content Portal'}
              </h1>
            </div>
          </header>

          {/* Page Content - Scrollable content area only */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-6 min-h-[400px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const token = params?.token as string;

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-destructive">Invalid Portal Access</h2>
          <p className="text-muted-foreground mb-6">No portal token provided.</p>
        </Card>
      </div>
    );
  }

  return (
    <PortalProvider token={token}>
      <PortalLayoutContent token={token}>
        {children}
      </PortalLayoutContent>
    </PortalProvider>
  );
}
