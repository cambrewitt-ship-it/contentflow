"use client";
import { useState } from "react";
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "components/ui/button";
import Sidebar from "components/Sidebar";
import TopBar from "components/TopBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
          {/* Top Bar - Always visible */}
          <div className="flex-shrink-0">
            <TopBar />
          </div>
          
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
          {/* Top Bar */}
          <div className="flex-shrink-0">
            <TopBar />
          </div>
          
          {/* Page Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
} 