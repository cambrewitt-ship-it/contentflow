"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user && pathname?.startsWith('/dashboard')) {
      console.log('🔒 Not authenticated, redirecting to login...');
      router.push('/auth/login');
    }
  }, [user, loading, router, pathname]);

  // Show loading state while checking authentication OR if not authenticated
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{loading ? 'Loading...' : 'Redirecting to login...'}</p>
        </div>
      </div>
    );
  }
  
  // Hide TopBar for pages that have their own merged headers
  const hideTopBar = pathname?.includes('/calendar') || pathname?.includes('/content-suite');

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-background/80 backdrop-blur-sm"
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Desktop Layout - CSS Grid */}
      <div className="hidden md:grid md:grid-cols-[auto_1fr] md:h-full">
        {/* Left Sidebar */}
        <div className={`
          transform transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
        `}>
          <Sidebar 
            collapsed={sidebarCollapsed} 
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          {/* Top Bar - Conditionally visible */}
          {!hideTopBar && (
            <div className="flex-shrink-0">
              <TopBar />
            </div>
          )}
          
          {/* Page Content - Scrollable content area only */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>

      {/* Mobile Layout - Overlay Sidebar */}
      <div className="md:hidden h-full relative">
        {/* Mobile Sidebar Overlay */}
        <div className={`
          fixed inset-y-0 left-0 z-40
          transform transition-all duration-300 ease-in-out
          shadow-lg
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
        `}>
          <Sidebar 
            collapsed={sidebarCollapsed} 
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Main Content */}
        <div className="flex flex-col h-full">
          {/* Top Bar - Conditionally visible */}
          {!hideTopBar && (
            <div className="flex-shrink-0">
              <TopBar />
            </div>
          )}
          
          {/* Page Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
} 