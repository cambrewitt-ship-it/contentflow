"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortalProvider, usePortal } from "../../../contexts/PortalContext";
import {
  LogOut,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";


function PortalLayoutContent({ children }: { children: React.ReactNode }) {
  const { client, party, isLoading, error, logout } = usePortal();
  const router = useRouter();

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
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Top Bar */}
      <header className="bg-card border-b border-border shadow-sm flex-shrink-0">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: CM logo -> home */}
          <Link href="/" className="flex-shrink-0">
            <img
              src="/cm-logo.png"
              alt="CM Logo"
              className="h-10 w-auto cursor-pointer"
            />
          </Link>

          {/* Right: client identity */}
          <div className="flex items-center gap-4 min-w-0">
            {party && (
              <div
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: party.color ?? '#6366f1' }}
              >
                <span>{party.name}</span>
              </div>
            )}

            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-semibold text-card-foreground truncate">
                {client.name}
              </span>
              {client.logo_url ? (
                <img
                  src={client.logo_url}
                  alt={`${client.name} logo`}
                  className="h-10 w-10 rounded-lg object-contain bg-white border border-border flex-shrink-0"
                />
              ) : (
                <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-foreground font-semibold text-lg">
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 flex-shrink-0"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page Content - Scrollable content area only */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-6 min-h-[400px]">
          {children}
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
      <PortalLayoutContent>
        {children}
      </PortalLayoutContent>
    </PortalProvider>
  );
}
