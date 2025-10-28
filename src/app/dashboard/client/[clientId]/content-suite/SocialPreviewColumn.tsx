'use client'

import { useContentStore } from '@/lib/contentStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, X, FolderOpen, Calendar, Clock, Check } from 'lucide-react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'

interface ConnectedAccount {
  _id: string;
  platform: string;
  name: string;
  accountId?: string;
  profilePicture?: string;
  username?: string;
  additionalData?: any;
}

interface SocialPreviewColumnProps {
  clientId: string
  handleSendToScheduler: (
    selectedCaption: string,
    uploadedImages: { preview: string; id: string; file?: File }[]
  ) => Promise<void>
  isSendingToScheduler: boolean
  // Editing props
  isEditing?: boolean
  updatingPost?: boolean
  // Custom caption change handler
  onCustomCaptionChange?: (customCaption: string) => void
}

export function SocialPreviewColumn({
  clientId,
  handleSendToScheduler,
  isSendingToScheduler,
  isEditing = false,
  updatingPost = false,
  onCustomCaptionChange,
}: SocialPreviewColumnProps) {
  const {
    uploadedImages,
    captions,
    selectedCaptions,
    activeImageId,
    postNotes,
    copyType,
    setCaptions,
    setSelectedCaptions,
  } = useContentStore()
  const { getAccessToken } = useAuth()

  // Scheduling state
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('12:00 PM')
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

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
      const response = await fetch(`/api/late/get-accounts/${clientId}`)
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
  }, [clientId])

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

      // Step 2: Create a temporary post ID for LATE API
      const tempPostId = `content-suite-${Date.now()}`

      // Step 3: Schedule via LATE API
      const lateRequestBody = {
        postId: tempPostId,
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

  // Platform-specific preview components
  const renderFacebookPreview = () => (
    <div className="bg-white max-w-sm mx-auto" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Facebook Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
            <FacebookIcon size={20} className="text-white" />
          </div>
          <div className="ml-3">
            <div className="font-semibold text-gray-900 text-sm">
              Your Facebook
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
        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">
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
          <div className="relative">
            <img
              src={mediaSrc}
              alt={isVideo ? "Video thumbnail" : "Post content"}
              className="w-full object-cover"
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
            <InstagramIcon size={16} className="text-white" />
          </div>
          <div className="ml-3">
            <div className="font-semibold text-gray-900 text-sm">
              {currentAccountData?.name || 'your_instagram'}
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
          <div className="relative">
            <img
              src={mediaSrc}
              alt={isVideo ? "Video thumbnail" : "Post content"}
              className="w-full aspect-square object-cover"
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
            {currentAccountData?.name || 'your_instagram'}
          </span>
          <span className="text-gray-900 whitespace-pre-wrap">
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
        <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center overflow-hidden">
          <TwitterIcon size={20} className="text-white" />
        </div>
        <div className="ml-3 flex-1">
          <div className="font-semibold text-gray-900 text-sm">
            {currentAccountData?.name || 'Your Twitter'}
          </div>
          <div className="text-xs text-gray-500">@{currentAccountData?.username || 'yourhandle'}</div>
        </div>
        <div className="text-gray-400">⋯</div>
      </div>

      {/* Twitter Content */}
      <div className="p-3">
        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">
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
            <div className="mt-3 rounded-lg overflow-hidden relative">
              <img
                src={mediaSrc}
                alt={isVideo ? "Video thumbnail" : "Post content"}
                className="w-full h-48 object-cover"
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
            <div className="mb-4 relative">
              <img
                src={mediaSrc}
                alt={isVideo ? "Video thumbnail" : "Email content"}
                className="w-full max-h-64 object-cover rounded-lg"
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
        <div className="text-gray-900 leading-relaxed whitespace-pre-wrap">
          {displayCaption}
        </div>
      </div>
    </div>
  )

  const renderPlatformPreview = () => {
    switch (selectedPreviewPlatform) {
      case 'facebook':
        return renderFacebookPreview()
      case 'instagram':
        return renderInstagramPreview()
      case 'twitter':
        return renderTwitterPreview()
      default:
        return renderFacebookPreview()
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col flex-1">
      {/* Content Preview */}
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="card-title-26">
              {copyType === 'email-marketing' ? 'Email Marketing Preview' : 'Social Media Preview'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
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
                      <div className="text-gray-900 leading-relaxed whitespace-pre-wrap">
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
                </div>

                {/* Mobile Preview Container */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="text-center text-xs text-gray-500 mb-2">
                    Mobile Preview - {selectedPreviewPlatform.charAt(0).toUpperCase() + selectedPreviewPlatform.slice(1)}
                  </div>
                  {uploadedImages.length > 0 ? renderPlatformPreview() : (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto">
                      {/* Platform Header */}
                      {selectedPreviewPlatform === 'facebook' && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
                              <FacebookIcon size={20} className="text-white" />
                            </div>
                            <div className="ml-3">
                              <div className="font-semibold text-gray-900 text-sm">Your Facebook</div>
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
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                              <InstagramIcon size={16} className="text-white" />
                            </div>
                            <div className="ml-3">
                              <div className="font-semibold text-gray-900 text-sm">your_instagram</div>
                            </div>
                          </div>
                          <div className="text-gray-400 text-lg">⋯</div>
                        </div>
                      )}

                      {selectedPreviewPlatform === 'twitter' && (
                        <div className="flex items-center p-3 border-b border-gray-100">
                          <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center overflow-hidden">
                            <TwitterIcon size={20} className="text-white" />
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="font-semibold text-gray-900 text-sm">Your Twitter</div>
                            <div className="text-xs text-gray-500">@yourhandle</div>
                          </div>
                          <div className="text-gray-400">⋯</div>
                        </div>
                      )}

                      {/* Caption */}
                      <div className={selectedPreviewPlatform === 'twitter' ? 'p-3' : 'px-4 pb-3'}>
                        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">
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

            {/* Caption Editor */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label htmlFor="customCaption" className="block text-sm font-medium text-gray-700 mb-2">
                Edit {copyType === 'email-marketing' ? 'Email Copy' : 'Caption'}
              </label>
              <Textarea
                id="customCaption"
                value={customCaption}
                onChange={(e) => {
                  setCustomCaption(e.target.value)
                  setCaptionConfirmed(false) // Reset confirmation when user types
                }}
                onBlur={handleCaptionConfirm}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCaptionConfirm()
                  }
                }}
                placeholder={selectedCaption ? `Edit the AI-generated ${copyType === 'email-marketing' ? 'email copy' : 'caption'} or type your own...` : `Type your ${copyType === 'email-marketing' ? 'email copy' : 'caption'} here...`}
                className="w-full min-h-[80px] resize-none"
                rows={3}
              />
              {selectedCaption && !customCaption && (
                <p className="text-xs text-gray-500 mt-1">
                  AI {copyType === 'email-marketing' ? 'Email Copy' : 'Caption'}: {selectedCaption}
                </p>
              )}

              {customCaption.trim() && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {captionConfirmed ? (
                      <span className="text-green-600 flex items-center">
                        <Check className="w-3 h-3 mr-1" />
                        Caption confirmed - ready to add to calendar
                      </span>
                    ) : (
                      <span className="text-amber-600">
                        Click outside the box or press Enter to confirm your caption
                      </span>
                    )}
                  </p>
                </div>
              )}

            </div>
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
    </div>
  )
}
