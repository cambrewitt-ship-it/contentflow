'use client'

import { ChevronLeft, ChevronRight, Calendar, Upload } from 'lucide-react'
import { useState, useMemo } from 'react'

interface Post {
  id: string;
  scheduled_date?: string;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'needs_attention' | 'draft';
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

interface MonthViewCalendarProps {
  posts: Post[];
  uploads?: {[key: string]: Upload[]};
  loading?: boolean;
  onDateClick?: (date: Date) => void;
}

export function MonthViewCalendar({ posts, uploads = {}, loading = false, onDateClick }: MonthViewCalendarProps) {
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

  // Get uploads for a specific day
  const getUploadsForDay = (day: number | null) => {
    if (!day) return []
    
    const dateStr = `${calendarData.year}-${String(calendarData.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return uploads[dateStr] || []
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

  // Get border color for a day based on post statuses and uploads
  const getDayBorderColor = (day: number | null) => {
    if (!day) return ''
    
    const dayPosts = getPostsForDay(day)
    const dayUploads = getUploadsForDay(day)
    
    // If there are uploads, show thick blue border
    if (dayUploads.length > 0) {
      return 'border-blue-500 border-4 rounded-3xl'
    }
    
    // Only posts, no uploads
    if (dayPosts.length > 0) {
      const statuses = dayPosts.map(post => post.approval_status)
      
      // Priority order: rejected > needs_attention > pending > draft > approved
      if (statuses.includes('rejected')) {
        return 'border-red-500 border-3 rounded-3xl'
      }
      if (statuses.includes('needs_attention')) {
        return 'border-orange-500 border-3 rounded-3xl'
      }
      if (statuses.includes('pending')) {
        return 'border-yellow-500 border-3 rounded-3xl'
      }
      if (statuses.includes('draft')) {
        return 'border-gray-500 border-3 rounded-3xl'
      }
      if (statuses.includes('approved')) {
        return 'border-green-500 border-3 rounded-3xl'
      }
    }
    
    return ''
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

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6 px-6 pt-6">
        <h2 className="text-5xl font-bold text-gray-800">
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
            {monthNames[calendarData.month]} {calendarData.year}
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
      <div className="grid grid-cols-7 gap-1 mb-2 px-6">
        {daysOfWeek.map((day, index) => {
          const isWeekend = index === 5 || index === 6; // Saturday (index 5) and Sunday (index 6)
          return (
            <div
              key={day}
              className={`text-center text-sm font-medium py-3 border-2 border-transparent ${
                isWeekend ? 'text-gray-500 bg-gray-100' : 'text-gray-600'
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 px-6 pb-6">
        {calendarData.days.map((day, index) => {
          const dayPosts = getPostsForDay(day)
          const dayUploads = getUploadsForDay(day)
          const today = isToday(day)
          const inCurrentWeek = isInCurrentWeek(day)
          const borderColor = getDayBorderColor(day)
          
          // Calculate which column this day is in (0-6, where 5=Saturday, 6=Sunday)
          const columnIndex = index % 7;
          const isWeekendColumn = columnIndex === 5 || columnIndex === 6;
          
          return (
            <div
              key={index}
              className={`
                relative min-h-[120px] p-3 transition-all
                ${day ? 'hover:bg-blue-50 hover:border-blue-400 cursor-pointer' : 'bg-gray-50'}
                ${today ? 'bg-gray-100' : ''}
                ${dayUploads.length > 0 ? 'bg-blue-50' : ''}
                ${isWeekendColumn && day ? 'bg-gray-50/50' : ''}
                ${borderColor || 'border-2 border-gray-300'}
              `}
              title={day ? 'Click to view week' : ''}
              onClick={() => {
                if (day && onDateClick) {
                  const clickedDate = new Date(calendarData.year, calendarData.month, day);
                  onDateClick(clickedDate);
                }
              }}
            >
              {day && (
                <>
                  {/* Day Number */}
                  <div className={`
                    text-lg font-medium mb-2 flex items-center gap-2
                    ${today ? 'text-blue-600' : isWeekendColumn ? 'text-gray-500' : 'text-gray-900'}
                  `}>
                    {today ? (
                      <div className="w-8 h-8 border-2 border-blue-500 rounded-3xl bg-white text-blue-600 flex items-center justify-center text-sm font-bold">
                        {day}
                      </div>
                    ) : (
                      day
                    )}
                    
                    {/* Status Text */}
                    {(() => {
                      const dayPosts = getPostsForDay(day)
                      const dayUploads = getUploadsForDay(day)
                      
                      // Priority: Uploads > Post Status
                      if (dayUploads.length > 0) {
                        return (
                          <span className="text-xs font-medium text-blue-400 bg-blue-100 px-2 py-1 rounded-full">
                            UPLOAD
                          </span>
                        )
                      }
                      
                      if (dayPosts.length > 0) {
                        const statuses = dayPosts.map(post => post.approval_status)
                        
                        // Priority order: rejected > needs_attention > pending > draft > approved
                        if (statuses.includes('rejected')) {
                          return (
                            <span className="text-xs font-medium text-red-400 bg-red-100 px-2 py-1 rounded-full">
                              REJECTED
                            </span>
                          )
                        }
                        if (statuses.includes('needs_attention')) {
                          return (
                            <span className="text-xs font-medium text-orange-400 bg-orange-100 px-2 py-1 rounded-full">
                              NEEDS ATTENTION
                            </span>
                          )
                        }
                        if (statuses.includes('pending')) {
                          return (
                            <span className="text-xs font-medium text-yellow-400 bg-yellow-100 px-2 py-1 rounded-full">
                              PENDING
                            </span>
                          )
                        }
                        if (statuses.includes('draft')) {
                          return (
                            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                              DRAFT
                            </span>
                          )
                        }
                        if (statuses.includes('approved')) {
                          return (
                            <span className="text-xs font-medium text-green-400 bg-green-100 px-2 py-1 rounded-full">
                              APPROVED
                            </span>
                          )
                        }
                      }
                      
                      return null
                    })()}
                  </div>
                  
                  {/* Event Indicators - Photo Thumbnails */}
                  {(dayPosts.length > 0 || dayUploads.length > 0) && (
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {/* Display posts */}
                        {dayPosts.slice(0, 4).map((post, idx) => (
                          <div
                            key={post.id}
                            className="relative w-8 h-8 rounded border border-gray-200 overflow-hidden"
                          >
                            {post.image_url ? (
                              <img
                                src={post.image_url}
                                alt={post.caption ? post.caption.substring(0, 20) : 'Post'}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to a placeholder if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `
                                      <div class="w-full h-full bg-gray-200 flex items-center justify-center">
                                        <svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                                        </svg>
                                      </div>
                                    `;
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                                </svg>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {/* Display uploads with blue upload icon */}
                        {dayUploads.slice(0, 4 - dayPosts.length).map((upload, idx) => (
                          <div
                            key={upload.id}
                            className="relative w-8 h-8 rounded border border-blue-300 overflow-hidden bg-blue-50"
                          >
                            {upload.file_type.startsWith('image/') ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={upload.file_url}
                                  alt={upload.file_name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.innerHTML = `
                                        <div class="w-full h-full bg-blue-100 flex items-center justify-center">
                                          <svg class="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                                          </svg>
                                        </div>
                                      `;
                                    }
                                  }}
                                />
                                {/* Blue upload icon overlay */}
                                <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                  <Upload className="w-2 h-2 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                                <div className="text-center">
                                  <Upload className="w-3 h-3 text-blue-500 mx-auto mb-0.5" />
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mx-auto"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {/* Show count for remaining items */}
                        {(dayPosts.length + dayUploads.length) > 4 && (
                          <div className="w-8 h-8 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-xs text-gray-500 font-medium">
                            +{(dayPosts.length + dayUploads.length) - 4}
                          </div>
                        )}
                      </div>
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

