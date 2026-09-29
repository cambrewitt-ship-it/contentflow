"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortalProvider, usePortal } from "../../../contexts/PortalContext";
import {
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";


function PortalLayoutContent({ children }: { children: React.ReactNode }) {
  const { client, party, isLoading, error, pageTitle, topBarActions } = usePortal();

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
          {/* Left: CM logo -> home, then the page title */}
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/" className="flex-shrink-0">
              <img
                src="/cm-logo.png"
                alt="CM Logo"
                className="h-10 w-auto cursor-pointer"
              />
            </Link>
            {pageTitle && (
              <h1 className="text-xl font-semibold text-card-foreground truncate border-l border-border pl-4">
                {pageTitle}
              </h1>
            )}
          </div>

          {/* Right: client identity, then page actions (e.g. Refresh) */}
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

            {topBarActions}
          </div>
        </div>
      </header>

      {/* Page Content - Scrollable content area only */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* A full-height page (the Board view) pins this to the viewport so the board gets a fixed height. */}
        <div className="p-6 min-h-full flex flex-col has-[[data-fill-height]]:h-full has-[[data-fill-height]]:pt-0">
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
