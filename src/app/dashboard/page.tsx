"use client";
import { User, Plus } from "lucide-react";
import { Button } from "components/ui/button";
import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 md:p-8 pt-20 md:pt-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <User className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Welcome to ContentFlow
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Pick a client to get started with your social media management workflow.
        </p>
        <div className="text-sm text-muted-foreground space-y-1 mb-8">
          <p>• Upload content and generate AI captions</p>
          <p>• Organize campaigns by client</p>
          <p>• Schedule posts across all platforms</p>
        </div>
        
        {/* Create New Client Button */}
        <Link href="/dashboard/clients/new">
          <Button className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Create New Client
          </Button>
        </Link>
      </div>
    </div>
  );
} 