'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, User, CreditCard, Home } from 'lucide-react';
import { useEffect } from 'react';

const tabs = [
  {
    name: 'Profile',
    href: '/settings/profile',
    icon: User,
  },
  {
    name: 'Subscription & Billing',
    href: '/settings/billing',
    icon: CreditCard,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header with CM Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <Link href="/dashboard" className="block">
              <img 
                src="/cm-logo.png" 
                alt="CM Logo" 
                className="h-24 w-auto object-contain transition-all duration-300 cursor-pointer hover:opacity-80"
              />
            </Link>
          </div>
        </div>
        
        {/* Sidebar Content */}
        <div className="flex-1 p-4">
          <div className="space-y-2">
            {/* Dashboard Link */}
            <Link href="/dashboard">
              <Button variant="outline" className="w-full justify-start mb-4">
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>

            {/* Settings Header */}
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Settings
              </h3>
            </div>

            {/* Settings Navigation */}
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || 
                (pathname === '/settings' && tab.href === '/settings/profile');
              const Icon = tab.icon;
              
              return (
                <Link key={tab.name} href={tab.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    className={`
                      w-full justify-start
                      ${isActive ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:bg-gray-100'}
                    `}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.name}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Navigation Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </Button>
            </div>
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>

          {/* Tab Content */}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

