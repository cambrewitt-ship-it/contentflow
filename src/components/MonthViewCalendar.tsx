'use client'

import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
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

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <Calendar className="w-5 h-5 text-gray-600" />
          <div className="flex items-center space-x-1">
            <button className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
              Day
            </button>
            <button className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
              Week
            </button>
            <button className="px-3 py-1 text-sm font-medium text-gray-900 bg-gray-100 rounded">
              Month
            </button>
            <button className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
              Year
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6 px-6 pt-6">
        <h2 className="text-3xl font-bold text-gray-900">
          {monthNames[calendarData.month]} {calendarData.year}
        </h2>
        <div className="flex items-center space-x-1">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-px mb-2 px-6">
        {daysOfWeek.map(day => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-600 py-3"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px px-6 pb-6">
        {calendarData.days.map((day, index) => {
          const dayPosts = getPostsForDay(day)
          const today = isToday(day)
          const inCurrentWeek = isInCurrentWeek(day)
          
          return (
            <div
              key={index}
              className={`
                relative min-h-[120px] p-3 border border-gray-200 transition-all
                ${day ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50'}
                ${today ? 'bg-white' : ''}
              `}
            >
              {day && (
                <>
                  {/* Day Number */}
                  <div className={`
                    text-lg font-medium mb-2
                    ${today ? 'text-red-600' : 'text-gray-900'}
                  `}>
                    {today ? (
                      <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-bold">
                        {day}
                      </div>
                    ) : (
                      day
                    )}
                  </div>
                  
                  {/* Event Indicators */}
                  {dayPosts.length > 0 && (
                    <div className="space-y-1">
                      {dayPosts.slice(0, 3).map((post, idx) => (
                        <div
                          key={post.id}
                          className="flex items-center space-x-2 bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="truncate">
                            {post.caption ? post.caption.substring(0, 20) + '...' : 'Post'}
                          </span>
                        </div>
                      ))}
                      {dayPosts.length > 3 && (
                        <div className="text-xs text-gray-500 font-medium">
                          +{dayPosts.length - 3} more
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
    </div>
  )
}

