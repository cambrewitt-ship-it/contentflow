'use client'

import { useRouter } from 'next/navigation'
import { LayoutDashboard, Plus, Calendar } from 'lucide-react'

type View = 'dashboard' | 'content-suite' | 'calendar'

interface ClientViewToggleProps {
  clientId: string
  activeView: View
}

export default function ClientViewToggle({ clientId, activeView }: ClientViewToggleProps) {
  const router = useRouter()

  const views: { id: View; label: string; icon: React.ReactNode; href: string }[] = [
    {
      id: 'dashboard',
      label: 'Brand Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      href: `/dashboard/client/${clientId}`,
    },
    {
      id: 'content-suite',
      label: 'Content Suite',
      icon: <Plus className="w-4 h-4" />,
      href: `/dashboard/client/${clientId}/content-suite`,
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: <Calendar className="w-4 h-4" />,
      href: `/dashboard/client/${clientId}/calendar`,
    },
  ]

  return (
    <div className="flex items-center justify-center py-3">
      <div className="inline-flex items-center bg-gray-100 rounded-lg p-1 gap-1">
        {views.map((view) => {
          const isActive = activeView === view.id
          return (
            <button
              key={view.id}
              onClick={() => router.push(view.href)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {view.icon}
              {view.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
