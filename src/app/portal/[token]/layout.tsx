"use client";

import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button } from "components/ui/button";
import { Card } from "components/ui/card";
import { PortalProvider, usePortal } from "../../../contexts/PortalContext";
import { 
  Upload, 
  CheckCircle, 
  Calendar, 
  LogOut, 
  AlertCircle,
  Loader2 
} from "lucide-react";


function PortalLayoutContent({ children, token }: { children: React.ReactNode; token: string }) {
  const { client, isLoading, error, logout } = usePortal();
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { id: 'upload', label: 'Content Upload', icon: Upload, path: '/upload' },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle, path: '/approvals' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, path: '/calendar' },
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Client Info */}
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-semibold text-lg">
                  {client.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-card-foreground">
                  {client.name}
                </h1>
                <p className="text-sm text-muted-foreground">Client Portal</p>
              </div>
            </div>

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 pb-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname?.includes(tab.path) ?? false;
              
              return (
                <Button
                  key={tab.id}
                  variant={isActive ? "default" : "ghost"}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  onClick={() => {
                    const newPath = `/portal/${token}${tab.path}`;
                    router.push(newPath);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Welcome Message */}
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20">
            <h2 className="text-2xl font-semibold text-card-foreground mb-2">
              Welcome to your Content Portal
            </h2>
            <p className="text-muted-foreground">
              Manage your content, review approvals, and view your content calendar all in one place.
            </p>
          </div>

          {/* Page Content */}
          <div className="min-h-[400px]">
            {children}
          </div>
        </div>
      </main>
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
