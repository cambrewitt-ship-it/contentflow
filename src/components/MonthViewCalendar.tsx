'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useMemo } from 'react'

interface Post {
  id: string;
  scheduled_date?: string;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'needs_attention' | 'draft';
  image_url?: string;
  caption?: string;
}

interface MonthViewCalendarProps {
  posts: Post[];
  loading?: boolean;
}

export function MonthViewCalendar({ posts, loading = false }: MonthViewCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Get calendar data for current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    // First day of the month
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()
    
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

  // Get status color for a post
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500'
      case 'rejected':
        return 'bg-red-500'
      case 'needs_attention':
        return 'bg-orange-500'
      case 'pending':
        return 'bg-yellow-500'
      case 'draft':
        return 'bg-gray-500'
      default:
        return 'bg-blue-500'
    }
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

  // Navigate to previous month
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  // Navigate to next month
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  // Go to current month
  const goToToday = () => {
    setCurrentDate(new Date())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mr-3"></div>
        <span className="text-gray-600">Loading calendar...</span>
      </div>
    )
  }

  // Get current week range
  const getCurrentWeekRange = () => {
    const today = new Date()
    const currentDay = today.getDay()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - currentDay)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(today.getDate() + (6 - currentDay))
    return { startOfWeek, endOfWeek }
  }

  // Check if a day is in current week
  const isInCurrentWeek = (day: number | null) => {
    if (!day) return false
    
    const today = new Date()
    const { startOfWeek, endOfWeek } = getCurrentWeekRange()
    const checkDate = new Date(calendarData.year, calendarData.month, day)
    
    return (
      checkDate >= startOfWeek &&
      checkDate <= endOfWeek &&
      checkDate.getMonth() === today.getMonth() &&
      checkDate.getFullYear() === today.getFullYear()
    )
  }

  return (
    <>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4 px-6">
        <h3 className="text-lg font-bold text-gray-800">
          {monthNames[calendarData.month]} {calendarData.year}
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={previousMonth}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-all hover:shadow-sm"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm hover:shadow-md"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-all hover:shadow-sm"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-1.5 mb-2 px-6">
        {daysOfWeek.map(day => (
          <div
            key={day}
            className="text-center text-xs font-bold text-gray-700 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1.5 px-6 pb-4">
        {calendarData.days.map((day, index) => {
          const dayPosts = getPostsForDay(day)
          const today = isToday(day)
          const inCurrentWeek = isInCurrentWeek(day)
          
          return (
            <div
              key={index}
              className={`
                relative min-h-[50px] p-2 border-2 rounded-lg transition-all
                ${day ? 'hover:bg-gray-50 hover:border-gray-400 hover:shadow-md cursor-pointer' : 'bg-gray-50 border-transparent'}
                ${today ? 'bg-blue-100 border-blue-500 shadow-md ring-2 ring-blue-200' : inCurrentWeek ? 'bg-blue-50 border-blue-200' : 'border-gray-200'}
              `}
            >
              {day && (
                <>
                  {/* Day Number */}
                  <div className={`
                    text-sm font-bold mb-1
                    ${today ? 'text-blue-700' : 'text-gray-800'}
                  `}>
                    {day}
                  </div>
                  
                  {/* Post Thumbnails */}
                  {dayPosts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {dayPosts.slice(0, 4).map((post, idx) => (
                        <div
                          key={post.id}
                          className="relative group"
                        >
                          <div className="w-6 h-6 rounded border-2 overflow-hidden shadow-sm">
                            {post.image_url ? (
                              <img
                                src={post.image_url}
                                alt={post.caption || 'Post'}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = '/api/placeholder/24/24';
                                }}
                              />
                            ) : (
                              <div className={`w-full h-full ${getStatusColor(post.approval_status)} flex items-center justify-center`}>
                                <div className="w-2 h-2 rounded-full bg-white"></div>
                              </div>
                            )}
                          </div>
                          {/* Status indicator */}
                          <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${getStatusColor(post.approval_status)}`}></div>
                        </div>
                      ))}
                      {dayPosts.length > 4 && (
                        <div className="w-6 h-6 rounded border-2 border-gray-300 bg-gray-100 flex items-center justify-center">
                          <div className="text-[8px] text-gray-600 font-bold">
                            +{dayPosts.length - 4}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend - Compact Bottom Section */}
      <div className="px-6 pb-4 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
            <span className="text-[10px] font-semibold text-gray-700">Approved</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm"></div>
            <span className="text-[10px] font-semibold text-gray-700">Pending</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm"></div>
            <span className="text-[10px] font-semibold text-gray-700">Needs Attention</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
            <span className="text-[10px] font-semibold text-gray-700">Rejected</span>
          </div>
        </div>
      </div>
    </>
  )
}

