"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PenSquare, Calendar, Bot, Menu } from "lucide-react";

interface MobileBottomNavProps {
  clientId: string;
  onMenuClick: () => void;
}

// Thumb-reachable tab bar for a client's main screens. Mobile only.
export default function MobileBottomNav({ clientId, onMenuClick }: MobileBottomNavProps) {
  const pathname = usePathname();
  const base = `/dashboard/client/${clientId}`;

  const tabs = [
    { label: "Dashboard", href: base, icon: LayoutDashboard, active: pathname === base },
    { label: "Create", href: `${base}/content-suite`, icon: PenSquare, active: !!pathname?.startsWith(`${base}/content-suite`) },
    { label: "Calendar", href: `${base}/calendar`, icon: Calendar, active: !!pathname?.startsWith(`${base}/calendar`) },
    { label: "Agent", href: `${base}/autopilot`, icon: Bot, active: pathname === `${base}/autopilot` },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 pb-[env(safe-area-inset-bottom)]"
      aria-label="Client navigation"
    >
      <div className="grid grid-cols-5 h-16">
        {tabs.map(({ label, href, icon: Icon, active }) => (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              active ? "text-blue-600" : "text-gray-500 active:text-gray-900"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-gray-500 active:text-gray-900"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
