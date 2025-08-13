"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { Card, CardContent } from "components/ui/card";
import { Search, Settings, Menu, X } from "lucide-react";

// Sample client data
const clients = [
  {
    id: 1,
    name: "Coastal Coffee Co.",
    industry: "Food & Beverage",
    avatar: "☕",
    color: "bg-orange-100 text-orange-600"
  },
  {
    id: 2,
    name: "TechStart Solutions",
    industry: "Technology",
    avatar: "⚡",
    color: "bg-blue-100 text-blue-600"
  },
  {
    id: 3,
    name: "Bloom Skincare",
    industry: "Beauty & Wellness",
    avatar: "🌸",
    color: "bg-pink-100 text-pink-600"
  },
  {
    id: 4,
    name: "Urban Fitness",
    industry: "Health & Fitness",
    avatar: "💪",
    color: "bg-green-100 text-green-600"
  },
  {
    id: 5,
    name: "Green Valley Foods",
    industry: "Food & Beverage",
    avatar: "🥗",
    color: "bg-emerald-100 text-emerald-600"
  }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.industry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClientClick = (clientId: number) => {
    setSelectedClient(clientId);
    setSidebarOpen(false);
    router.push(`/dashboard/client/${clientId}`);
  };

  const handleSettingsClick = () => {
    alert("Settings - Coming Soon!");
  };

  return (
    <div className="flex h-screen bg-background">
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

      {/* Left Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-40
        w-80 bg-card border-r border-border flex flex-col
        transform transition-transform duration-300 ease-in-out
        shadow-lg md:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">ContentFlow</h1>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">← Back</Link>
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Client List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 ${
                selectedClient === client.id ? 'ring-2 ring-primary shadow-lg' : ''
              }`}
              onClick={() => handleClientClick(client.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${client.color}`}>
                    {client.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">
                      {client.name}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {client.industry}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Settings */}
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleSettingsClick}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
} 