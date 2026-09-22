'use client'

import { useContentStore } from '@/lib/contentStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, X, FolderOpen, Calendar, Clock, Check, AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Plus, Send } from 'lucide-react'
import { 
  FacebookIcon, 
  InstagramIcon, 
  TwitterIcon, 
  LinkedInIcon, 
  TikTokIcon, 
  YouTubeIcon, 
  ThreadsIcon 
} from '@/components/social-icons'
import React, { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'

const PREVIEW_PLATFORM_LABELS: Record<string, string> = {
  facebook:  'Facebook',
  instagram: 'Instagram',
  twitter:   'Twitter / X',
  linkedin:  'LinkedIn',
  tiktok:    'TikTok',
}

interface ConnectedAccount {
  _id: string;
  platform: string;
  name: string;
  accountId?: string;
  profilePicture?: string;
  username?: string;
  additionalData?: any;
}

interface Project {
  id: string
  name: string
  description: string
  status: string
  created_at: string
}

interface SocialPreviewColumnProps {
  clientId: string
  clientName?: string
  clientLogo?: string
  handleSendToScheduler: (
    selectedCaption: string,
    uploadedImages: { preview: string; id: string; file?: File; blobUrl?: string }[]
  ) => Promise<void>
  isSendingToScheduler: boolean
  // Editing props
  isEditing?: boolean
  updatingPost?: boolean
  // Custom caption change handler
  onCustomCaptionChange?: (customCaption: string) => void
  // Add to Calendar props
  projects?: Project[]
  selectedProjectId?: string | null
  setSelectedProjectId?: (projectId: string | null) => void
  showNewProjectForm?: boolean
  setShowNewProjectForm?: (show: boolean) => void
  getSelectedCaption?: () => string
  customCaptionFromPreview?: string
  onOpenScheduleModal?: () => void
}

export function SocialPreviewColumn({
  clientId,
  clientName,
  clientLogo,
  handleSendToScheduler,
  isSendingToScheduler,
  isEditing = false,
  updatingPost = false,
  onCustomCaptionChange,
  projects = [],
  selectedProjectId = null,
  setSelectedProjectId,
  showNewProjectForm = false,
  setShowNewProjectForm,
  getSelectedCaption,
  customCaptionFromPreview = '',
  onOpenScheduleModal,
}: SocialPreviewColumnProps) {
  const { getAccessToken } = useAuth()
  const {
    uploadedImages,
    captions,
    selectedCaptions,
    activeImageId,
    postNotes,
    copyType,
    setCaptions,
    setSelectedCaptions,
    setActiveImageId,
  } = useContentStore()

  // Scheduling state
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('12:00 PM')
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [showPlanRestrictionDialog, setShowPlanRestrictionDialog] = useState(false)
  const [planRestrictionMessage, setPlanRestrictionMessage] = useState(
    'Social media posting is not available on the free plan. Please upgrade to post to social media.'
  )

  // Custom caption state
  const [customCaption, setCustomCaption] = useState('')
  const [captionConfirmed, setCaptionConfirmed] = useState(false)

  // Connected accounts state
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)

  // Platform preview state
  const [selectedPreviewPlatform, setSelectedPreviewPlatform] = useState<string>('facebook')
  const [currentAccountData, setCurrentAccountData] = useState<{
    name: string;
    profilePicture: string;
    username?: string;
  } | null>(null)

  const selectedCaption =
    selectedCaptions.length > 0
      ? captions.find((cap) => cap.id === selectedCaptions[0])?.text
      : undefined

  // Use custom caption if provided, otherwise use selected AI caption
  const displayCaption = customCaption.trim() || selectedCaption || ''

  // Sync custom caption with selected AI caption when it changes
  // Always sync when a new caption is selected to override previous selection
  useEffect(() => {
    if (selectedCaption) {
      setCustomCaption(selectedCaption)
      setCaptionConfirmed(false) // Reset confirmation when AI caption is selected
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaption])

  // Call parent component when custom caption changes
  useEffect(() => {
    if (onCustomCaptionChange && customCaption) {
      onCustomCaptionChange(customCaption)
    }
  }, [customCaption, onCustomCaptionChange])

  // Handle caption confirmation (blur or enter)
  const handleCaptionConfirm = () => {
    if (customCaption.trim()) {
      // Update the content store immediately when caption is confirmed
      updateContentStoreForSaving()
      setCaptionConfirmed(true)
      // Notify parent component of the confirmed caption
      if (onCustomCaptionChange) {
        onCustomCaptionChange(customCaption.trim())
      }
    }
  }

  // Only update content store when we're about to save/update a post
  // This prevents the custom caption from appearing in the AI captions section during live editing
  const updateContentStoreForSaving = () => {
    if (customCaption && customCaption !== selectedCaption) {
      // Update the content store with the custom caption only when saving
      const captionId = selectedCaptions[0] || 'custom-caption-1'
      let updatedCaptions = captions.map(cap => 
        cap.id === captionId ? { ...cap, text: customCaption } : cap
      )

      // If no caption exists, create a new one
      if (updatedCaptions.length === 0 || !captions.find(cap => cap.id === captionId)) {
        updatedCaptions = [...updatedCaptions, {
          id: captionId,
          text: customCaption
        }]
      }

      // Update the content store
      setCaptions(updatedCaptions)
      if (!selectedCaptions.includes(captionId)) {
        setSelectedCaptions([captionId])
      }
    }
  }

  // Fetch connected accounts on component mount
  const fetchConnectedAccounts = useCallback(async () => {
    try {
      setIsLoadingAccounts(true)
      const accessToken = getAccessToken()
      
      const response = await fetch(`/api/late/get-accounts/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.status}`)
      }
      const data = await response.json()
      setConnectedAccounts(data.accounts || [])
      console.log('Connected accounts count:', data.accounts?.length || 0)
    } catch (error: any) {
      console.error('Error fetching accounts:', error)
      setScheduleError(error instanceof Error ? error.message : 'Failed to load connected accounts')
    } finally {
      setIsLoadingAccounts(false)
    }
  }, [clientId, getAccessToken])

  useEffect(() => {
    fetchConnectedAccounts()
  }, [clientId, fetchConnectedAccounts])

  // Fetch account data when platform changes
  const fetchAccountDataForPlatform = useCallback(async (platform: string) => {
    console.log(`🔍 Fetching ${platform} account data for client:`, clientId)
    console.log(`📋 Available connected accounts:`, connectedAccounts)
    console.log(`🔎 Looking for platform: "${platform}"`)

    try {
      // Find the account for the selected platform
      const platformAccount = connectedAccounts.find((acc: ConnectedAccount) => acc.platform === platform)

      if (platformAccount) {
        console.log(`✅ Found ${platform} account:`, platformAccount)
        console.log(`📝 Account name: "${platformAccount.name}"`)
        console.log(`📝 Account ID: "${platformAccount.accountId}"`)
        console.log(`📝 Username: "${platformAccount.username}"`)

        // Use the actual account name, or accountId as fallback, or a better default
        const accountName = platformAccount.name ||
          platformAccount.accountId ||
          `Your ${platform.charAt(0).toUpperCase() + platform.slice(1)} Page`

        setCurrentAccountData({
          name: accountName,
          profilePicture: platformAccount.profilePicture || '/default-avatar.svg',
          username: platformAccount.username || platformAccount.accountId
        })
        return
      } else {
        console.log(`❌ No ${platform} account found in connected accounts`)
      }

      // If no account found, set default data for the platform
      console.log(`⚠️ Setting default ${platform} data`)
      setCurrentAccountData({
        name: `Your ${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`,
        profilePicture: '/default-avatar.svg'
      })

    } catch (error: any) {
      console.error(`💥 Error fetching ${platform} account data:`, error)
      // Set default data if fetch fails
      setCurrentAccountData({
        name: `Your ${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`,
        profilePicture: '/default-avatar.svg'
      })
    }
  }, [clientId, connectedAccounts])

  useEffect(() => {
    if (connectedAccounts.length > 0) {
      fetchAccountDataForPlatform(selectedPreviewPlatform)
    }
  }, [selectedPreviewPlatform, connectedAccounts, fetchAccountDataForPlatform])

  const openScheduleModal = () => {
    // Set default date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setScheduleDate(tomorrow.toISOString().split('T')[0])
    setScheduleTime('12:00 PM')
    setShowScheduleModal(true)
    setScheduleError(null)
  }

  const handleSchedulePost = async () => {
    // Always update content store before saving (for both new posts and edits)
    updateContentStoreForSaving()

    // If editing, use the handleSendToScheduler function
    if (isEditing) {
      await handleSendToScheduler(displayCaption, uploadedImages)
      return
    }

    if (!scheduleDate || !scheduleTime) {
      setScheduleError('Please select both date and time')
      return
    }

    if (!displayCaption || uploadedImages.length === 0) {
      setScheduleError('Please ensure you have both a caption and image selected')
      return
    }

    if (selectedPlatforms.size === 0) {
      setScheduleError('Please select at least one platform to schedule to')
      return
    }

    setIsScheduling(true)
    setScheduleError(null)

    try {
      // Parse the date and time
      const [time, period] = scheduleTime.split(' ')
      const [hours, minutes] = time.split(':')
      let hour24 = parseInt(hours, 10)

      if (period === 'PM' && hour24 !== 12) {
        hour24 += 12
      } else if (period === 'AM' && hour24 === 12) {
        hour24 = 0
      }

      const scheduledDateTime = new Date(scheduleDate)
      scheduledDateTime.setHours(hour24, parseInt(minutes, 10), 0, 0)

      // Format for LATE API (YYYY-MM-DDTHH:MM:SS)
      const scheduledDateStr = scheduledDateTime.toISOString().split('T')[0]
      const scheduledTimeStr = `${hour24.toString().padStart(2, '0')}:${minutes}:00`
      const scheduledDateTimeStr = `${scheduledDateStr}T${scheduledTimeStr}`

      console.log('🚀 Content Suite Scheduling - Using LATE API approach:')
      console.log('  - Caption:', displayCaption.substring(0, 50) + '...')
      console.log('  - Scheduled DateTime:', scheduledDateTimeStr)
      console.log('  - Selected Platforms:', Array.from(selectedPlatforms))

      // Get selected accounts
      const selectedAccounts = connectedAccounts.filter(account =>
        selectedPlatforms.has(account.platform)
      )

      if (selectedAccounts.length === 0) {
        throw new Error('No valid accounts selected')
      }

      // Step 1: Upload image to LATE
      console.log('Uploading image to LATE...')
      const activeImage = uploadedImages.find(img => img.id === activeImageId) || uploadedImages[0]
      let imageData = activeImage.preview

      // Convert blob URL to base64 if needed
      if (imageData.startsWith('blob:')) {
        try {
          const response = await fetch(imageData)
          const blob = await response.blob()
          const reader = new FileReader()

          imageData = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
        } catch (error) {
          console.error('Blob conversion failed:', error)
          throw new Error('Failed to process image')
        }
      }

      const accessToken = getAccessToken()

      const mediaResponse = await fetch('/api/late/upload-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ imageBlob: imageData })
      })

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text()
        console.error('Media upload error:', errorText)
        throw new Error('Failed to upload image to LATE')
      }

      const { lateMediaUrl } = await mediaResponse.json()
      console.log('✅ Image uploaded to LATE successfully')

      // Step 2: Add to calendar database FIRST (so we have a real UUID postId)
      const scheduledDate = scheduledDateTime.toISOString().split('T')[0]
      const scheduledTime = `${hour24.toString().padStart(2, '0')}:${minutes}:00`
      const scheduledPostData = {
        client_id: clientId,
        project_id: selectedProjectId || null,
        caption: displayCaption,
        image_url: lateMediaUrl, // Use the LATE media URL for the calendar post
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        post_notes: '',
      }

      const calendarResponse = await fetch('/api/calendar/scheduled', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          scheduledPost: scheduledPostData
        })
      })

      if (!calendarResponse.ok) {
        const errorData = await calendarResponse.json()
        console.error('Failed to add to calendar:', errorData)
        throw new Error('Failed to create calendar scheduled post')
      }

      const calendarResult = await calendarResponse.json()
      const calendarPostId = calendarResult.post?.id
      
      if (!calendarPostId) {
        throw new Error('Failed to get post ID from calendar response')
      }

      console.log('✅ Post added to calendar database with ID:', calendarPostId)

      // Step 3: Schedule via LATE API using the real UUID postId
      const lateRequestBody = {
        postId: calendarPostId,
        caption: displayCaption,
        lateMediaUrl: lateMediaUrl,
        scheduledDateTime: scheduledDateTimeStr,
        selectedAccounts: selectedAccounts,
        clientId: clientId
      }

      console.log('Scheduling post via LATE API...')
      const accessToken2 = getAccessToken()

      const response = await fetch('/api/late/schedule-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken2}`
        },
        body: JSON.stringify(lateRequestBody)
      })

      if (!response.ok) {
        if (response.status === 403) {
          const errorBody = await response.json().catch(() => null)
          const errorMessage =
            errorBody?.error ||
            'Social media posting is not available on the free plan. Please upgrade to post to social media.'
          setPlanRestrictionMessage(errorMessage)
          setShowPlanRestrictionDialog(true)
          setShowScheduleModal(false)
          return
        }

        const errorText = await response.text()
        console.error('LATE scheduling error:', errorText)
        throw new Error('Failed to schedule post via LATE')
      }

      await response.json()
      console.log('✅ Post scheduled successfully via LATE API')

      // Show success message
      const platformNames = selectedAccounts.map(acc => acc.platform).join(', ')
      alert(`Post scheduled successfully for ${scheduledDateTime.toLocaleString()} to ${platformNames}!`)

      // Close modal and reset form
      setShowScheduleModal(false)
      setScheduleDate('')
      setScheduleTime('12:00 PM')
      setSelectedPlatforms(new Set())

    } catch (error: any) {
      console.error('Error scheduling post:', error)
      setScheduleError(error instanceof Error ? error.message : 'Failed to schedule post')
    } finally {
      setIsScheduling(false)
    }
  }

  // Client avatar for social previews - shows logo or initials
  const renderClientAvatar = (size: 'sm' | 'md') => {
    const sizeClass = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
    const textClass = size === 'sm' ? 'text-xs' : 'text-sm'
    if (clientLogo) {
      return (
        <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0`}>
          <img src={clientLogo} alt={clientName || 'Client'} className="w-full h-full object-cover" />
        </div>
      )
    }
    const initials = clientName ? clientName.charAt(0).toUpperCase() : '?'
    return (
      <div className={`${sizeClass} rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0`}>
        <span className={`text-white font-semibold ${textClass}`}>{initials}</span>
      </div>
    )
  }

  const previewDisplayName = clientName || currentAccountData?.name

  // Platform-specific preview components
  const renderFacebookPreview = () => (
    <div className="bg-white max-w-sm mx-auto overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Facebook Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          {renderClientAvatar('md')}
          <div className="ml-3">
            <div className="font-semibold text-gray-900 text-sm">
              {previewDisplayName || 'Your Page'}
            </div>
            <div className="flex items-center text-xs text-gray-500">
              <span role="img" aria-label="globe">🌐</span>
              <span className="ml-1">Just now</span>
            </div>
          </div>
        </div>
        <div className="text-gray-400 text-lg">⋯</div>
      </div>

      {/* Facebook Caption */}
      <div className="px-4 pb-3">
        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
          {displayCaption}
        </p>
      </div>

      {/* Facebook Media (Image or Video Thumbnail) */}
      {activeImageId && (() => {
        const activeMedia = uploadedImages.find(img => img.id === activeImageId);
        const isVideo = activeMedia?.mediaType === 'video';
        // For videos, use thumbnail; for images, use the actual image
        const mediaSrc = isVideo
          ? (activeMedia?.videoThumbnail || activeMedia?.preview)
          : (activeMedia?.blobUrl || activeMedia?.preview);

        // Don't render if no valid source
        if (!mediaSrc) return null;

        return (
          <div className="relative flex items-center justify-center bg-gray-50">
            <img
              src={mediaSrc}
              alt={isVideo ? "Video thumbnail" : "Post content"}
              className="w-full object-contain"
              style={{ maxHeight: '400px' }}
            />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="bg-white/90 rounded-full p-4">
                  <svg className="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}
            {renderCarouselControls()}
          </div>
        );
      })()}

      {/* Facebook Engagement Stats */}
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center">
            <div className="flex -space-x-1">
              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
              </svg>
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <span className="ml-2">436</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>54 Comments</span>
            <span>8 Shares</span>
          </div>
        </div>
      </div>

      {/* Facebook Action Buttons */}
      <div className="px-2 py-2 border-t border-gray-100">
        <div className="flex items-center justify-around">
          <button className="flex items-center justify-center py-2 px-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-1">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            <span className="text-sm font-medium">Like</span>
          </button>
          <button className="flex items-center justify-center py-2 px-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-1">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
            </svg>
            <span className="text-sm font-medium">Comment</span>
          </button>
          <button className="flex items-center justify-center py-2 px-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-1">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
            </svg>
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>
      </div>
    </div>
  )

  const renderInstagramPreview = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto">
      {/* Instagram Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center">
          {renderClientAvatar('sm')}
          <div className="ml-3">
            <div className="font-semibold text-gray-900 text-sm">
              {previewDisplayName || 'your_account'}
            </div>
          </div>
        </div>
        <div className="text-gray-400 text-lg">⋯</div>
      </div>

      {/* Instagram Media (Image or Video Thumbnail) */}
      {activeImageId && (() => {
        const activeMedia = uploadedImages.find(img => img.id === activeImageId);
        const isVideo = activeMedia?.mediaType === 'video';
        const mediaSrc = isVideo
          ? (activeMedia?.videoThumbnail || activeMedia?.preview)
          : (activeMedia?.blobUrl || activeMedia?.preview);

        // Don't render if no valid source
        if (!mediaSrc) return null;

        return (
          <div className="relative flex items-center justify-center bg-gray-50 aspect-square">
            <img
              src={mediaSrc}
              alt={isVideo ? "Video thumbnail" : "Post content"}
              className="max-w-full max-h-full w-auto h-auto object-contain"
            />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="bg-white/90 rounded-full p-3">
                  <svg className="w-6 h-6 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}
            {renderCarouselControls()}
          </div>
        );
      })()}

      {/* Instagram Actions */}
      <div className="px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-4">
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>

        {/* Likes Count */}
        <div className="mb-2">
          <span className="font-semibold text-gray-900 text-sm">237 likes</span>
        </div>

        {/* Instagram Caption */}
        <div className="text-sm">
          <span className="font-semibold text-gray-900 mr-2">
            {previewDisplayName || 'your_account'}
          </span>
          <span className="text-gray-900 whitespace-pre-wrap break-words overflow-hidden">
            {displayCaption}
          </span>
        </div>
      </div>
    </div>
  )

  const renderTwitterPreview = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto">
      {/* Twitter Header */}
      <div className="flex items-center p-3 border-b border-gray-100">
        {renderClientAvatar('md')}
        <div className="ml-3 flex-1">
          <div className="font-semibold text-gray-900 text-sm">
            {previewDisplayName || 'Your Account'}
          </div>
          <div className="text-xs text-gray-500">@{currentAccountData?.username || 'yourhandle'}</div>
        </div>
        <div className="text-gray-400">⋯</div>
      </div>

      {/* Twitter Content */}
      <div className="p-3">
        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
          {displayCaption}
        </p>

        {/* Twitter Media (Image or Video Thumbnail) */}
        {activeImageId && (() => {
          const activeMedia = uploadedImages.find(img => img.id === activeImageId);
          const isVideo = activeMedia?.mediaType === 'video';
          const mediaSrc = isVideo
            ? (activeMedia?.videoThumbnail || activeMedia?.preview)
            : (activeMedia?.blobUrl || activeMedia?.preview);

          // Don't render if no valid source
          if (!mediaSrc) return null;

          return (
            <div className="mt-3 rounded-lg overflow-hidden relative flex items-center justify-center bg-gray-50" style={{ minHeight: '192px' }}>
              <img
                src={mediaSrc}
                alt={isVideo ? "Video thumbnail" : "Post content"}
                className="w-full h-auto max-h-48 object-contain"
              />
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="bg-white/90 rounded-full p-2">
                    <svg className="w-5 h-5 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
              {renderCarouselControls(true)}
            </div>
          );
        })()}
      </div>

      {/* Twitter Actions */}
      <div className="px-3 py-2 border-t border-gray-100">
        <div className="flex items-center justify-center text-gray-500 text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="ml-1">104</span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="ml-1">78</span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span className="ml-1 text-pink-500">24</span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderEmailPreview = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-lg mx-auto">
      {/* Email Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-semibold" role="img" aria-label="email">📧</span>
            </div>
            <div className="ml-3">
              <div className="font-semibold text-gray-900 text-sm">Email Marketing</div>
              <div className="text-xs text-gray-500">Professional email preview</div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Content */}
      <div className="p-4">
        {/* Email Media (Image or Video Thumbnail) */}
        {activeImageId && (() => {
          const activeMedia = uploadedImages.find(img => img.id === activeImageId);
          const isVideo = activeMedia?.mediaType === 'video';
          const mediaSrc = isVideo
            ? (activeMedia?.videoThumbnail || activeMedia?.preview)
            : (activeMedia?.blobUrl || activeMedia?.preview);

          // Don't render if no valid source
          if (!mediaSrc) return null;

          return (
            <div className="mb-4 relative flex items-center justify-center bg-gray-50 rounded-lg" style={{ minHeight: '256px' }}>
              <img
                src={mediaSrc}
                alt={isVideo ? "Video thumbnail" : "Email content"}
                className="w-full h-auto max-h-64 object-contain rounded-lg"
              />
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                  <div className="bg-white/90 rounded-full p-3">
                    <svg className="w-6 h-6 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Email Copy */}
        <div className="text-gray-900 leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
          {displayCaption}
        </div>
      </div>
    </div>
  )

  // Multiple uploads form a carousel; arrows step the active photo so the thumbnails stay in sync
  const renderCarouselControls = (small = false) => {
    const total = uploadedImages.length
    const index = uploadedImages.findIndex(img => img.id === activeImageId)
    if (total < 2 || index < 0) return null
    const go = (delta: number) => setActiveImageId(uploadedImages[(index + delta + total) % total].id)
    const btn = small ? 'w-6 h-6' : 'w-7 h-7'
    const chev = small ? 'w-3.5 h-3.5' : 'w-4 h-4'
    return (
      <>
        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => go(-1)}
          className={`absolute left-2 top-1/2 -translate-y-1/2 ${btn} rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10`}
        >
          <ChevronLeft className={chev} />
        </button>
        <button
          type="button"
          aria-label="Next photo"
          onClick={() => go(1)}
          className={`absolute right-2 top-1/2 -translate-y-1/2 ${btn} rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10`}
        >
          <ChevronRight className={chev} />
        </button>
        {!small && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full z-10">
            {index + 1}/{total}
          </div>
        )}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {uploadedImages.map((img, i) => (
            <button
              key={img.id}
              type="button"
              aria-label={`Show photo ${i + 1}`}
              onClick={() => setActiveImageId(img.id)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/50'}`}
            />
          ))}
        </div>
      </>
    )
  }

  // Resolves the active upload to a renderable source (video posts use their thumbnail)
  const getActiveMedia = () => {
    if (!activeImageId) return { src: null as string | null, isVideo: false }
    const activeMedia = uploadedImages.find(img => img.id === activeImageId)
    const isVideo = activeMedia?.mediaType === 'video'
    const src = isVideo
      ? (activeMedia?.videoThumbnail || activeMedia?.preview)
      : (activeMedia?.blobUrl || activeMedia?.preview)
    return { src: src || null, isVideo }
  }

  // LinkedIn pages use a square logo rather than a circular avatar
  const renderClientSquareLogo = () => {
    if (clientLogo) {
      return (
        <div className="w-12 h-12 rounded-[4px] overflow-hidden flex-shrink-0 bg-white">
          <img src={clientLogo} alt={clientName || 'Client'} className="w-full h-full object-cover" />
        </div>
      )
    }
    return (
      <div className="w-12 h-12 rounded-[4px] flex-shrink-0 bg-[#0A66C2] flex items-center justify-center">
        {clientName
          ? <span className="text-white font-semibold text-lg">{clientName.charAt(0).toUpperCase()}</span>
          : <LinkedInIcon size={24} className="text-white" />}
      </div>
    )
  }

  const renderLinkedInPreview = () => {
    const { src: mediaSrc, isVideo } = getActiveMedia()
    return (
      <div className="bg-white max-w-sm mx-auto overflow-hidden rounded-lg border border-[#e0dfdc]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', color: 'rgba(0,0,0,0.9)' }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
          <div className="flex items-start gap-2 min-w-0">
            {renderClientSquareLogo()}
            <div className="min-w-0 pt-0.5">
              <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.3' }} className="truncate">
                {previewDisplayName || 'Your Company'}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)', lineHeight: '1.3' }} className="truncate">
                Your industry
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)', lineHeight: '1.3' }} className="flex items-center gap-1">
                <span>Just now</span>
                <span>·</span>
                <svg viewBox="0 0 16 16" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" className="w-3 h-3">
                  <circle cx="8" cy="8" r="6.5" /><ellipse cx="8" cy="8" rx="2.8" ry="6.5" /><line x1="1.5" y1="8" x2="14.5" y2="8" />
                </svg>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 pt-1">
            <svg viewBox="0 0 20 20" fill="rgba(0,0,0,0.6)" className="w-5 h-5"><circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="16" cy="10" r="1.6" /></svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
        </div>

        {/* Post text */}
        <div className="px-3 pb-2">
          {displayCaption ? (
            <p style={{ fontSize: '14px', lineHeight: '1.42857' }} className="whitespace-pre-wrap break-words line-clamp-3">
              {displayCaption}
              <span style={{ color: 'rgba(0,0,0,0.6)' }}> …see more</span>
            </p>
          ) : (
            <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.45)' }} className="italic">Your post text will appear here...</p>
          )}
        </div>

        {/* Media */}
        {mediaSrc ? (
          <div className="relative flex items-center justify-center bg-gray-50">
            <img src={mediaSrc} alt={isVideo ? 'Video thumbnail' : 'Post content'} className="w-full object-cover" style={{ maxHeight: '300px' }} />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="bg-white/90 rounded-full p-3">
                  <svg className="w-6 h-6 text-gray-800" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>
            )}
            {renderCarouselControls()}
          </div>
        ) : (
          <div className="h-44 bg-gray-200 flex items-center justify-center">
            <span className="text-gray-500 text-sm">No Image</span>
          </div>
        )}

        {/* Social counts */}
        <div className="px-3 py-2 flex items-center justify-between" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1">
              <div className="w-[18px] h-[18px] rounded-full bg-[#378FE9] flex items-center justify-center ring-1 ring-white">
                <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5"><path d="M9.5 21H6a1 1 0 01-1-1v-9a1 1 0 011-1h3.5v11zM20.9 11.4l-1.5 8A2 2 0 0117.4 21H11V9.6l3.2-6.4a1 1 0 011.8.1c.5 1.2.7 2.6.4 4L15.9 9h3.2a2 2 0 011.8 2.4z" /></svg>
              </div>
              <div className="w-[18px] h-[18px] rounded-full bg-[#DF704D] flex items-center justify-center ring-1 ring-white">
                <svg viewBox="0 0 16 16" fill="white" className="w-2.5 h-2.5"><path fillRule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z" /></svg>
              </div>
              <div className="w-[18px] h-[18px] rounded-full bg-[#F5BB5C] flex items-center justify-center ring-1 ring-white">
                <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5"><path d="M9 21h6v-1H9v1zm3-20a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-3.3A7 7 0 0012 1z" /></svg>
              </div>
            </div>
            <span>139K</span>
          </div>
          <div className="flex items-center gap-2">
            <span>12K comments</span>
            <span>·</span>
            <span>6K reposts</span>
          </div>
        </div>

        {/* Action bar */}
        <div className="px-1 py-0.5 border-t border-[#e0dfdc]">
          <div className="flex">
            {([
              { kind: 'Like',    path: <><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" /><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></> },
              { kind: 'Comment', path: <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /> },
              { kind: 'Repost',  path: <><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></> },
              { kind: 'Share',   path: <><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></> },
            ]).map((item) => (
              <button key={item.kind} className="flex-1 flex items-center justify-center gap-1 py-2 hover:bg-[#f3f2ef] rounded transition-colors">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">{item.path}</svg>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.6)' }}>{item.kind}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderTikTokPreview = () => {
    const { src: mediaSrc, isVideo } = getActiveMedia()
    return (
      <div className="relative max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '440px' }}>
        {/* Media */}
        {mediaSrc ? (
          <img src={mediaSrc} alt={isVideo ? 'Video thumbnail' : 'Post content'} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[#111111] flex items-center justify-center">
            <div className="w-[84px] h-[68px] rounded-2xl border-2 border-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/45" />
        {renderCarouselControls(true)}

        {/* Top bar */}
        <div className="absolute top-2.5 left-3 right-3 flex items-center justify-center">
          <span className="text-white/60 text-[11px] font-semibold">Following</span>
          <span className="text-white/30 text-[11px] mx-1.5">|</span>
          <span className="text-white text-[11px] font-bold">For You</span>
          <svg className="absolute right-0 w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.4-4.4" /></svg>
        </div>

        {/* Right action rail */}
        <div className="absolute right-2 bottom-[84px] flex flex-col items-center gap-3.5">
          <div className="flex flex-col items-center gap-0.5">
            <svg className="w-7 h-7 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
            <span className="text-white text-[10px] font-semibold drop-shadow">2.5M</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <svg className="w-7 h-7 drop-shadow" viewBox="0 0 24 24">
              <path fill="white" d="M20.5 2.5h-17A1.5 1.5 0 002 4v12.5A1.5 1.5 0 003.5 18H6v3.3c0 .7.8 1.1 1.4.6l4.9-3.9h8.2a1.5 1.5 0 001.5-1.5V4a1.5 1.5 0 00-1.5-1.5z" />
              <circle cx="8" cy="10" r="1.3" fill="black" /><circle cx="12" cy="10" r="1.3" fill="black" /><circle cx="16" cy="10" r="1.3" fill="black" />
            </svg>
            <span className="text-white text-[10px] font-semibold drop-shadow">342</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <svg className="w-7 h-7 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24"><path d="M21.7 11.2L13 3.3c-.5-.5-1.4-.1-1.4.6v3.8C5.9 8.2 2 12.6 2 18.4c0 .9 1.1 1.2 1.6.5 1.9-2.8 4.5-4.3 8-4.4v3.8c0 .7.9 1.1 1.4.6l8.7-7.9c.3-.3.3-.8 0-1.1z" /></svg>
            <span className="text-white text-[10px] font-semibold drop-shadow">13.1K</span>
          </div>
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-[#3a3a3a] to-black flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-white" />
            <svg className="absolute -left-1.5 -top-0.5 w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
          </div>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-[42px] left-0 right-12 px-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            {renderClientAvatar('sm')}
            <span className="text-white text-xs font-bold drop-shadow">{previewDisplayName || '@yourtiktok'}</span>
          </div>
          {displayCaption && <p className="text-white text-[11px] font-semibold leading-snug line-clamp-3 drop-shadow">{displayCaption}</p>}
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
            <div className="h-[3px] flex-1 rounded-full bg-white/25 overflow-hidden"><div className="h-full w-2/3 bg-white/60 rounded-full" /></div>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="absolute bottom-0 left-0 right-0 bg-black flex items-end justify-around px-1 pt-1 pb-1">
          {[
            { label: 'Home',     path: <path d="M3 10.6L12 3l9 7.6V21a1 1 0 01-1 1h-4.5v-6h-7v6H4a1 1 0 01-1-1V10.6z" /> },
            { label: 'Discover', path: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.4-4.4" /></g> },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-0.5 w-9">
              <svg className="w-[18px] h-[18px] text-white" fill="currentColor" viewBox="0 0 24 24">{item.path}</svg>
              <span className="text-white text-[7px] font-medium leading-none">{item.label}</span>
            </div>
          ))}
          <div className="flex flex-col items-center w-9 pb-2.5">
            <div className="relative w-7 h-[18px]">
              <div className="absolute left-0 top-0 w-6 h-[18px] rounded-[5px] bg-[#25F4EE]" />
              <div className="absolute right-0 top-0 w-6 h-[18px] rounded-[5px] bg-[#FE2C55]" />
              <div className="absolute left-[2px] top-0 w-[23px] h-[18px] rounded-[5px] bg-white flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              </div>
            </div>
          </div>
          {[
            { label: 'Inbox', path: <path d="M4 3h16a2 2 0 012 2v11a2 2 0 01-2 2H9l-4.4 3.3A1 1 0 013 20.5V5a2 2 0 012-2z" /> },
            { label: 'Me',    path: <g><circle cx="12" cy="7.5" r="4" /><path d="M3.8 21c.6-4.3 4.1-6.6 8.2-6.6s7.6 2.3 8.2 6.6H3.8z" /></g> },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-0.5 w-9">
              <svg className="w-[18px] h-[18px] text-white" fill="currentColor" viewBox="0 0 24 24">{item.path}</svg>
              <span className="text-white text-[7px] font-medium leading-none">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderPlatformPreview = () => {
    switch (selectedPreviewPlatform) {
      case 'facebook':
        return renderFacebookPreview()
      case 'instagram':
        return renderInstagramPreview()
      case 'twitter':
        return renderTwitterPreview()
      case 'linkedin':
        return renderLinkedInPreview()
      case 'tiktok':
        return renderTikTokPreview()
      default:
        return renderFacebookPreview()
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col flex-1 overflow-hidden">
      {/* Content Preview */}
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-center">
            {/* Schedule Button */}
            {!isEditing && (() => {
              // Check if any images are still uploading
              const hasUploadingImages = uploadedImages.some(img => 
                !img.blobUrl && (img.preview?.startsWith('blob:') || img.preview?.startsWith('data:'))
              )
              const selectedCaption = getSelectedCaption ? getSelectedCaption() : ''
              const isDisabled = isSendingToScheduler || 
                (!customCaptionFromPreview.trim() && !selectedCaption) ||
                hasUploadingImages
              
              return (
                <Button
                  onClick={() => {
                    if (onOpenScheduleModal) {
                      onOpenScheduleModal()
                    } else {
                      console.log('Schedule button clicked - modal handler not provided')
                    }
                  }}
                  disabled={isDisabled}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white disabled:opacity-50"
                >
                  <Send className="w-5 h-5 mr-2 text-white" />
                  Schedule
                </Button>
              )
            })()}
          </div>
        </CardHeader>
        
        {/* Action Buttons - Below header */}
        {!isEditing && (
          <div className="px-6 -mt-4 pb-4 space-y-3 border-b border-gray-200">
            {/* Add to Calendar Button */}
            {(() => {
              // Check if any images are still uploading
              const hasUploadingImages = uploadedImages.some(img => 
                !img.blobUrl && (img.preview?.startsWith('blob:') || img.preview?.startsWith('data:'))
              )
              const selectedCaption = getSelectedCaption ? getSelectedCaption() : ''
              const isDisabled = isSendingToScheduler || 
                (!customCaptionFromPreview.trim() && !selectedCaption) ||
                hasUploadingImages
              
              return (
                <Button
                  onClick={() => {
                    // Use custom caption from preview if available, otherwise use selected caption
                    const caption = customCaptionFromPreview.trim() || selectedCaption
                    handleSendToScheduler(caption, uploadedImages)
                  }}
                  disabled={isDisabled}
                  className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                >
                  {isSendingToScheduler ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : hasUploadingImages ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Uploading Image...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-5 h-5 mr-2" />
                      Add to Calendar
                    </>
                  )}
                </Button>
              )
            })()}
            
            {/* Project Selector */}
            {setSelectedProjectId && setShowNewProjectForm && (
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-between text-left font-normal"
                    >
                      {selectedProjectId 
                        ? projects.find(p => p.id === selectedProjectId)?.name || 'Select Project'
                        : 'No Project'
                      }
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full min-w-[200px]" align="start">
                    <DropdownMenuItem 
                      onClick={() => setSelectedProjectId(null)}
                      className={!selectedProjectId ? 'bg-accent' : ''}
                    >
                      No Project
                    </DropdownMenuItem>
                    {projects.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        {projects.map((project) => (
                          <DropdownMenuItem 
                            key={project.id} 
                            onClick={() => setSelectedProjectId(project.id)}
                            className={selectedProjectId === project.id ? 'bg-accent' : ''}
                          >
                            {project.name}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowNewProjectForm(true)}
                      className="text-blue-600 focus:text-blue-600"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        )}
        
        <CardContent className="flex-1 flex flex-col overflow-y-auto">
          <div className="space-y-4">
            {copyType === 'email-marketing' ? (
              // Email Marketing Preview
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="text-center text-xs text-gray-500 mb-2">
                  Email Marketing Preview
                </div>
                {uploadedImages.length > 0 ? renderEmailPreview() : (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-lg mx-auto">
                    {/* Email Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold" role="img" aria-label="email">📧</span>
                          </div>
                          <div className="ml-3">
                            <div className="font-semibold text-gray-900 text-sm">Email Marketing</div>
                            <div className="text-xs text-gray-500">Professional email preview</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Email Content - No Image Placeholder */}
                    <div className="p-4">
                      <div className="mb-4">
                        <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                          <span className="text-gray-500 text-sm">No Image</span>
                        </div>
                      </div>

                      {/* Email Copy */}
                      <div className="text-gray-900 leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
                        {displayCaption || 'Your email content will appear here...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Social Media Preview
              <>
                {/* Platform Selection */}
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <button
                    onClick={() => setSelectedPreviewPlatform('facebook')}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedPreviewPlatform === 'facebook'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <FacebookIcon size={20} />
                  </button>
                  <button
                    onClick={() => setSelectedPreviewPlatform('instagram')}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedPreviewPlatform === 'instagram'
                        ? 'bg-pink-100 text-pink-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <InstagramIcon size={20} />
                  </button>
                  <button
                    onClick={() => setSelectedPreviewPlatform('twitter')}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedPreviewPlatform === 'twitter'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <TwitterIcon size={20} />
                  </button>
                  <button
                    onClick={() => setSelectedPreviewPlatform('linkedin')}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedPreviewPlatform === 'linkedin'
                        ? 'bg-blue-100 text-[#0A66C2]'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <LinkedInIcon size={20} />
                  </button>
                  <button
                    onClick={() => setSelectedPreviewPlatform('tiktok')}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedPreviewPlatform === 'tiktok'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <TikTokIcon size={20} />
                  </button>
                </div>

                {/* Mobile Preview Container */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="text-center text-xs text-gray-500 mb-2">
                    Mobile Preview - {PREVIEW_PLATFORM_LABELS[selectedPreviewPlatform] || selectedPreviewPlatform}
                  </div>
                  {(uploadedImages.length > 0 || selectedPreviewPlatform === 'linkedin' || selectedPreviewPlatform === 'tiktok') ? renderPlatformPreview() : (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto">
                      {/* Platform Header */}
                      {selectedPreviewPlatform === 'facebook' && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center">
                            {clientLogo ? (
                              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                                <img src={clientLogo} alt={clientName || 'Client'} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                                <FacebookIcon size={20} className="text-white" />
                              </div>
                            )}
                            <div className="ml-3">
                              <div className="font-semibold text-gray-900 text-sm">{clientName || 'Your Facebook'}</div>
                              <div className="flex items-center text-xs text-gray-500">
                                <span role="img" aria-label="globe">🌐</span>
                                <span className="ml-1">Just now</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-gray-400 text-lg">⋯</div>
                        </div>
                      )}

                      {selectedPreviewPlatform === 'instagram' && (
                        <div className="flex items-center justify-between px-3 py-3">
                          <div className="flex items-center">
                            {clientLogo ? (
                              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                                <img src={clientLogo} alt={clientName || 'Client'} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                                <InstagramIcon size={16} className="text-white" />
                              </div>
                            )}
                            <div className="ml-3">
                              <div className="font-semibold text-gray-900 text-sm">{clientName || 'your_instagram'}</div>
                            </div>
                          </div>
                          <div className="text-gray-400 text-lg">⋯</div>
                        </div>
                      )}

                      {selectedPreviewPlatform === 'twitter' && (
                        <div className="flex items-center p-3 border-b border-gray-100">
                          {clientLogo ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                              <img src={clientLogo} alt={clientName || 'Client'} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center overflow-hidden flex-shrink-0">
                              <TwitterIcon size={20} className="text-white" />
                            </div>
                          )}
                          <div className="ml-3 flex-1">
                            <div className="font-semibold text-gray-900 text-sm">{clientName || 'Your Twitter'}</div>
                            <div className="text-xs text-gray-500">@yourhandle</div>
                          </div>
                          <div className="text-gray-400">⋯</div>
                        </div>
                      )}

                      {/* Caption */}
                      <div className={selectedPreviewPlatform === 'twitter' ? 'p-3' : 'px-4 pb-3'}>
                        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
                          {displayCaption || 'Your caption will appear here...'}
                        </p>
                      </div>

                      {/* No Image Placeholder */}
                      <div className="relative">
                        <div className={`${selectedPreviewPlatform === 'instagram' ? 'aspect-square' : 'h-48'} bg-gray-200 flex items-center justify-center`}>
                          <span className="text-gray-500 text-sm">No Image</span>
                        </div>
                      </div>

                      {/* Platform-specific bottom sections */}
                      {selectedPreviewPlatform === 'facebook' && (
                        <>
                          <div className="px-4 py-2 border-t border-gray-100">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <div className="flex items-center">
                                <div className="flex -space-x-1">
                                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
                                  </svg>
                                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                  </svg>
                                </div>
                                <span className="ml-2">436</span>
                              </div>
                              <div className="flex items-center space-x-4">
                                <span>54 Comments</span>
                                <span>8 Shares</span>
                              </div>
                            </div>
                          </div>
                          <div className="px-2 py-2 border-t border-gray-100">
                            <div className="flex items-center justify-around">
                              <button className="flex items-center justify-center py-2 px-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-1">
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                </svg>
                                <span className="text-sm font-medium">Like</span>
                              </button>
                              <button className="flex items-center justify-center py-2 px-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-1">
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                                </svg>
                                <span className="text-sm font-medium">Comment</span>
                              </button>
                              <button className="flex items-center justify-center py-2 px-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-1">
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
                                </svg>
                                <span className="text-sm font-medium">Share</span>
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {selectedPreviewPlatform === 'instagram' && (
                        <div className="px-3 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-4">
                              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            </div>
                            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </div>
                          <div className="mb-2">
                            <span className="font-semibold text-gray-900 text-sm">237 likes</span>
                          </div>
                        </div>
                      )}

                      {selectedPreviewPlatform === 'twitter' && (
                        <div className="px-3 py-2 border-t border-gray-100">
                          <div className="flex items-center justify-center text-gray-500 text-sm">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span className="ml-1">104</span>
                              </div>
                              <div className="flex items-center">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                <span className="ml-1">78</span>
                              </div>
                              <div className="flex items-center">
                                <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                </svg>
                                <span className="ml-1 text-pink-500">24</span>
                              </div>
                              <div className="flex items-center">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                              </div>
                              <div className="flex items-center">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Action Button - Show when editing */}
      {isEditing && (
        <div className="mt-4">
          <Button
            onClick={() => handleSendToScheduler(displayCaption, uploadedImages)}
            disabled={updatingPost || !displayCaption.trim() || uploadedImages.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {updatingPost ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating Post...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Update Post
              </>
            )}
          </Button>
        </div>
      )}

      {/* Schedule Post Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Post
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center py-2">
              <span className="text-sm text-gray-600">When and where would you like to post this content?</span>
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Platforms *
              </label>
              {isLoadingAccounts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="text-sm text-gray-500">Loading connected accounts...</span>
                </div>
              ) : connectedAccounts.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No connected accounts found.</p>
                  <p className="text-xs mt-1">Please connect your social media accounts first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {connectedAccounts.map((account) => (
                    <button
                      key={account._id}
                      type="button"
                      onClick={() => {
                        const newSelected = new Set(selectedPlatforms)
                        if (newSelected.has(account.platform)) {
                          newSelected.delete(account.platform)
                        } else {
                          newSelected.add(account.platform)
                        }
                        setSelectedPlatforms(newSelected)
                      }}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        selectedPlatforms.has(account.platform)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm capitalize">{account.platform}</div>
                          <div className="text-xs text-gray-500">{account.name}</div>
                        </div>
                        {selectedPlatforms.has(account.platform) && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date Input */}
            <div>
              <label htmlFor="scheduleDate" className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <Input
                id="scheduleDate"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Time Input */}
            <div>
              <label htmlFor="scheduleTime" className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <div className="flex gap-2">
                <Input
                  id="scheduleTime"
                  type="text"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  placeholder="12:00 PM"
                  className="flex-1"
                />
                <div className="text-sm text-gray-500 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Format: 12:00 PM
                </div>
              </div>
            </div>

            {scheduleError && (
              <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                {scheduleError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSchedulePost}
                disabled={isScheduling || selectedPlatforms.size === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {isScheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEditing ? 'Updating...' : 'Scheduling...'}
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    {isEditing ? 'Update Post' : 'Schedule Post'}
                  </>
                )}
              </Button>

              <Button
                onClick={() => setShowScheduleModal(false)}
                variant="outline"
                disabled={isScheduling}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlanRestrictionDialog} onOpenChange={setShowPlanRestrictionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Upgrade Required
            </DialogTitle>
            <DialogDescription>
              {planRestrictionMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPlanRestrictionDialog(false)}
            >
              Close
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                window.location.href = '/pricing'
              }}
            >
              Upgrade Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
