'use client'

import { useState, useMemo } from 'react'

interface Post {
  id: string;
  scheduled_date?: string;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'needs_attention' | 'draft';
  image_url?: string;
  caption?: string;
}

interface CompactMonthCalendarProps {
  posts: Post[];
  loading?: boolean;
}

export function CompactMonthCalendar({ posts, loading = false }: CompactMonthCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ]

  const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  // Get calendar data for current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    // First day of the month
    const firstDay = new Date(year, month, 1)
    // Convert Sunday (0) to Monday (0) start
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7
    
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    
    // Create array of days
    const days = []
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }
    
    return { days, year, month }
  }, [currentDate])

  // Group posts by date
  const postsByDate = useMemo(() => {
    const grouped: Record<string, Post[]> = {}
    
    posts.forEach(post => {
      if (post.scheduled_date) {
        const date = post.scheduled_date
        if (!grouped[date]) {
          grouped[date] = []
        }
        grouped[date].push(post)
      }
    })
    
    return grouped
  }, [posts])

  // Get posts for a specific day
  const getPostsForDay = (day: number | null) => {
    if (!day) return []
    
    const dateStr = `${calendarData.year}-${String(calendarData.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return postsByDate[dateStr] || []
  }

  // Check if a day is today
  const isToday = (day: number | null) => {
    if (!day) return false
    
    const today = new Date()
    return (
      day === today.getDate() &&
      calendarData.month === today.getMonth() &&
      calendarData.year === today.getFullYear()
    )
  }

  // Get border color for a day based on post statuses
  const getDayBorderColor = (day: number | null) => {
    if (!day) return ''
    
    const dayPosts = getPostsForDay(day)
    if (dayPosts.length === 0) return ''
    
    // Determine the most critical status for the day
    const statuses = dayPosts.map(post => post.approval_status)
    
    // Priority order: rejected > needs_attention > pending > draft > approved
    if (statuses.includes('rejected')) {
      return 'border-red-500 border-2 rounded-3xl'
    }
    if (statuses.includes('needs_attention')) {
      return 'border-orange-500 border-2 rounded-3xl'
    }
    if (statuses.includes('pending')) {
      return 'border-gray-500 border-2 rounded-3xl'
    }
    if (statuses.includes('draft')) {
      return 'border-gray-500 border-2 rounded-3xl'
    }
    if (statuses.includes('approved')) {
      return 'border-green-500 border-2 rounded-3xl'
    }
    
    return ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mr-3"></div>
        <span className="text-gray-600">Loading calendar...</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Month Header */}
      <div className="text-center mb-6">
        <h3 className="text-5xl font-bold text-gray-400 uppercase tracking-wide">
          {monthNames[calendarData.month]}
        </h3>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {daysOfWeek.map((day, index) => (
          <div
            key={index}
            className="text-center text-base font-bold text-gray-800 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarData.days.map((day, index) => {
          const dayPosts = getPostsForDay(day)
          const today = isToday(day)
          const borderColor = getDayBorderColor(day)
          
          return (
            <div
              key={index}
              className={`
                relative aspect-square flex items-center justify-center text-xl font-bold transition-all
                ${day ? 'text-gray-800 hover:bg-gray-50 cursor-pointer' : 'text-transparent'}
                ${today ? 'bg-blue-500/50 border-2 border-blue-600 text-white rounded-3xl shadow-lg shadow-blue-300' : ''}
                ${borderColor}
              `}
            >
              {day && (
                <>
                  {day}
                  {/* Event indicators - small dots for posts */}
                  {dayPosts.length > 0 && !today && (
                    <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex space-x-1">
                      {dayPosts.slice(0, 3).map((_, idx) => (
                        <div
                          key={idx}
                          className="w-1.5 h-1.5 bg-red-500 rounded-full"
                        />
                      ))}
                      {dayPosts.length > 3 && (
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
