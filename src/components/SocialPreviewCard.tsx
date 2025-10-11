'use client'

import { 
  FacebookIcon, 
  InstagramIcon, 
  TwitterIcon, 
  LinkedInIcon, 
  TikTokIcon, 
  YouTubeIcon, 
  ThreadsIcon 
} from '@/components/social-icons'

interface SocialPreviewCardProps {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube' | 'threads'
  accountName: string
  username?: string
  caption: string
  imageUrl?: string
  scheduledDate?: string
  scheduledTime?: string
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  clientComments?: string
  showApprovalInfo?: boolean
}

export function SocialPreviewCard({
  platform,
  accountName,
  username,
  caption,
  imageUrl,
  scheduledDate,
  scheduledTime,
  approvalStatus,
  clientComments,
  showApprovalInfo = false
}: SocialPreviewCardProps) {
  
  const getPlatformIcon = () => {
    const iconProps = { size: platform === 'instagram' ? 16 : 20, className: "text-white" }
    
    switch (platform) {
      case 'facebook':
        return <FacebookIcon {...iconProps} />
      case 'instagram':
        return <InstagramIcon {...iconProps} />
      case 'twitter':
        return <TwitterIcon {...iconProps} />
      case 'linkedin':
        return <LinkedInIcon {...iconProps} />
      case 'tiktok':
        return <TikTokIcon {...iconProps} />
      case 'youtube':
        return <YouTubeIcon {...iconProps} />
      case 'threads':
        return <ThreadsIcon {...iconProps} />
      default:
        return <FacebookIcon {...iconProps} />
    }
  }

  const getPlatformStyles = () => {
    switch (platform) {
      case 'facebook':
        return {
          container: "bg-white max-w-sm mx-auto",
          iconBg: "w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }
      case 'instagram':
        return {
          container: "bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto",
          iconBg: "w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
        }
      case 'twitter':
        return {
          container: "bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto",
          iconBg: "w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center"
        }
      default:
        return {
          container: "bg-white border border-gray-200 rounded-lg overflow-hidden max-w-sm mx-auto",
          iconBg: "w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center"
        }
    }
  }

  const styles = getPlatformStyles()

  const renderFacebookPreview = () => (
    <div className={styles.container} style={{ fontFamily: styles.fontFamily }}>
      {/* Facebook Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <div className={styles.iconBg}>
            {getPlatformIcon()}
          </div>
          <div className="ml-3">
            <div className="font-semibold text-gray-900 text-sm">
              {accountName}
            </div>
            <div className="flex items-center text-xs text-gray-500">
              <span>🌐</span>
              <span className="ml-1">Just now</span>
            </div>
          </div>
        </div>
        <div className="text-gray-400 text-lg">⋯</div>
      </div>
      
      {/* Facebook Caption */}
      <div className="px-4 pb-3">
        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">
          {caption}
        </p>
      </div>
      
      {/* Facebook Image */}
      {imageUrl && (
        <div className="relative">
          <img
            src={imageUrl}
            alt="Post content"
            className="w-full object-cover"
            style={{ maxHeight: '400px' }}
          />
        </div>
      )}
      
      {/* Facebook Engagement Stats */}
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center">
            <div className="flex -space-x-1">
              <span className="text-blue-600 text-sm">👍</span>
              <span className="text-yellow-500 text-sm">😮</span>
              <span className="text-red-500 text-sm">❤️</span>
            </div>
            <span className="ml-2">1.4K</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>105 Comments</span>
            <span>25 Shares</span>
          </div>
        </div>
      </div>
      
      {/* Facebook Action Buttons */}
      <div className="px-2 py-2 border-t border-gray-100">
        <div className="flex items-center justify-around">
          <button className="flex items-center justify-center py-2 px-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-1">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            <span className="text-sm font-medium">Like</span>
          </button>
          <button className="flex items-center justify-center py-2 px-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-1">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
            <span className="text-sm font-medium">Comment</span>
          </button>
          <button className="flex items-center justify-center py-2 px-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-1">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
            </svg>
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>
      </div>
    </div>
  )

  const renderInstagramPreview = () => (
    <div className={styles.container}>
      {/* Instagram Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center">
          <div className={styles.iconBg}>
            {getPlatformIcon()}
          </div>
          <div className="ml-3">
            <div className="font-semibold text-gray-900 text-sm">
              {accountName}
            </div>
          </div>
        </div>
        <div className="text-gray-400 text-lg">⋯</div>
      </div>
      
      {/* Instagram Image */}
      {imageUrl && (
        <div className="relative">
          <img
            src={imageUrl}
            alt="Post content"
            className="w-full aspect-square object-cover"
          />
        </div>
      )}
      
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
          <span className="font-semibold text-gray-900 text-sm">5,367 likes</span>
        </div>
        
        {/* Instagram Caption */}
        <div className="text-sm">
          <span className="font-semibold text-gray-900 mr-2">
            {accountName}
          </span>
          <span className="text-gray-900 whitespace-pre-wrap">
            {caption}
          </span>
        </div>
      </div>
    </div>
  )

  const renderTwitterPreview = () => (
    <div className={styles.container}>
      {/* Twitter Header */}
      <div className="flex items-center p-3 border-b border-gray-100">
        <div className={styles.iconBg}>
          {getPlatformIcon()}
        </div>
        <div className="ml-3 flex-1">
          <div className="font-semibold text-gray-900 text-sm">
            {accountName}
          </div>
          <div className="text-xs text-gray-500">@{username || 'yourhandle'}</div>
        </div>
        <div className="text-gray-400">⋯</div>
      </div>
      
      {/* Twitter Content */}
      <div className="p-3">
        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">
          {caption}
        </p>
        
        {/* Twitter Image */}
        {imageUrl && (
          <div className="mt-3 rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt="Post content"
              className="w-full h-48 object-cover"
            />
          </div>
        )}
      </div>
      
      {/* Twitter Actions */}
      <div className="px-3 py-2 border-t border-gray-100">
        <div className="flex items-center justify-between text-gray-500 text-sm">
          <span>💬 Reply</span>
          <span>🔄 Retweet</span>
          <span>❤️ Like</span>
          <span>📤 Share</span>
        </div>
      </div>
    </div>
  )

  const renderPreview = () => {
    switch (platform) {
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
    <div className="space-y-4">
      {/* Social Preview */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <div className="text-center text-xs text-gray-500 mb-2">
          Mobile Preview - {platform.charAt(0).toUpperCase() + platform.slice(1)}
        </div>
        {renderPreview()}
      </div>
      
      {/* Approval Info (only shown in approval board) */}
      {showApprovalInfo && (
        <div className="space-y-2">
          {/* Schedule Info */}
          {(scheduledDate || scheduledTime) && (
            <div className="text-xs text-gray-500">
              {scheduledDate && new Date(scheduledDate).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })}
              {scheduledTime && (
                <span> at {scheduledTime.slice(0, 5)}</span>
              )}
            </div>
          )}

          {/* Approval Status */}
          {approvalStatus && (
            <div className="flex items-center justify-between">
              <div className={`text-xs px-2 py-1 rounded ${
                approvalStatus === 'approved' 
                  ? 'bg-green-100 text-green-700'
                  : approvalStatus === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {approvalStatus}
              </div>
            </div>
          )}

          {/* Client Comments */}
          {clientComments && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
              <span className="font-medium">Client:</span> {clientComments}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
