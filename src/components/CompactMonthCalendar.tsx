'use client'

import { useState, useMemo } from 'react'

interface Post {
  id: string;
  scheduled_date?: string;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'needs_attention' | 'draft';
  late_status?: 'pending' | 'scheduled' | 'published' | 'failed';
  image_url?: string;
  caption?: string;
}

interface Upload {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CompactMonthCalendarProps {
  posts: Post[];
  uploads?: {[key: string]: Upload[]};
  loading?: boolean;
}

export function CompactMonthCalendar({ posts, uploads = {}, loading = false }: CompactMonthCalendarProps) {
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

  // Get uploads for a specific day
  const getUploadsForDay = (day: number | null) => {
    if (!day) return []
    
    const dateStr = `${calendarData.year}-${String(calendarData.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return uploads[dateStr] || []
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

  // Check if a day has pending posts
  const hasPendingPosts = (day: number | null) => {
    if (!day) return false
    
    const dayPosts = getPostsForDay(day)
    return dayPosts.some(post => post.approval_status === 'pending' || !post.approval_status)
  }

  // Check if a day has published posts
  const hasPublishedPosts = (day: number | null) => {
    if (!day) return false
    
    const dayPosts = getPostsForDay(day)
    const today = new Date()
    const dayDate = new Date(calendarData.year, calendarData.month, day)
    
    const hasPublished = dayPosts.some(post => {
      // Check if post is explicitly marked as published
      if (post.late_status === 'published') {
        return true
      }
      
      // Check if post is scheduled and the scheduled date is today or in the past
      if (post.late_status === 'scheduled' && post.scheduled_date) {
        const scheduledDate = new Date(post.scheduled_date + 'T00:00:00')
        return scheduledDate <= today
      }
      
      return false
    })
    
    
    return hasPublished
  }

  // Check if a day has posts that need attention
  const hasNeedsAttentionPosts = (day: number | null) => {
    if (!day) return false
    
    const dayPosts = getPostsForDay(day)
    return dayPosts.some(post => post.approval_status === 'needs_attention')
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
          const dayUploads = getUploadsForDay(day)
          const today = isToday(day)
          const borderColor = getDayBorderColor(day)
          const hasContent = dayPosts.length > 0 || dayUploads.length > 0
          const hasPending = hasPendingPosts(day)
          const hasPublished = hasPublishedPosts(day)
          const hasNeedsAttention = hasNeedsAttentionPosts(day)
          
          
          return (
            <div
              key={index}
              className={`
                relative aspect-square flex items-center justify-center text-xl font-bold transition-all
                ${day ? 'text-gray-800 hover:bg-gray-50 cursor-pointer' : 'text-transparent'}
                ${hasNeedsAttention ? 'bg-orange-100 border-2 border-orange-300 rounded-3xl' : ''}
                ${hasPublished && !hasNeedsAttention ? 'bg-green-100 border-2 border-green-300 rounded-3xl' : ''}
                ${hasPending && !hasNeedsAttention && !hasPublished ? 'bg-gray-100 border-2 border-gray-300 rounded-3xl' : ''}
                ${hasContent && !hasPending && !hasPublished && !hasNeedsAttention ? 'bg-blue-100 border-2 border-blue-300 rounded-3xl' : ''}
                ${!hasContent && today ? 'bg-white border-2 border-gray-600 text-gray-800 rounded-3xl shadow-lg shadow-gray-300' : ''}
                ${borderColor}
              `}
            >
              {day && (
                <>
                  {day}
                  {/* Event indicators - small dots for posts and uploads */}
                  {hasContent && !today && (
                    <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex space-x-1">
                      {(dayPosts.length + dayUploads.length) <= 3 ? (
                        <>
                          {dayPosts.slice(0, 3).map((_, idx) => (
                            <div
                              key={`post-${idx}`}
                              className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                            />
                          ))}
                          {dayUploads.slice(0, 3 - dayPosts.length).map((_, idx) => (
                            <div
                              key={`upload-${idx}`}
                              className="w-1.5 h-1.5 bg-green-500 rounded-full"
                            />
                          ))}
                        </>
                      ) : (
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Color Key/Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm font-medium text-gray-700 mb-3">Calendar Legend</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-orange-100 border-2 border-orange-300 rounded-full"></div>
            <span className="text-gray-600">Needs Attention</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded-full"></div>
            <span className="text-gray-600">Published/Scheduled</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded-full"></div>
            <span className="text-gray-600">Pending Approval</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded-full"></div>
            <span className="text-gray-600">Client Uploads</span>
          </div>
        </div>
      </div>
    </div>
  )
}
