'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Check, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  ThreadsIcon
} from '@/components/social-icons'

interface ConnectedAccount {
  _id: string
  platform: string
  name: string
  accountId?: string
}

export default function ConnectPlatformsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { getAccessToken } = useAuth()

  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([])
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fetchAccountsRef = useRef(false)
  const oauthHandledRef = useRef<string | null>(null)

  const fetchConnectedAccounts = useCallback(async () => {
    if (!clientId || fetchAccountsRef.current) return

    const accessToken = getAccessToken()
    if (!accessToken) {
      setTimeout(() => fetchConnectedAccounts(), 500)
      return
    }

    try {
      fetchAccountsRef.current = true
      setLoading(true)
      const response = await fetch(`/api/late/get-accounts/${clientId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setConnectedAccounts(data.accounts || [])
      } else {
        setConnectedAccounts([])
      }
    } catch {
      setConnectedAccounts([])
    } finally {
      fetchAccountsRef.current = false
      setLoading(false)
    }
  }, [clientId, getAccessToken])

  useEffect(() => {
    fetchConnectedAccounts()
  }, [fetchConnectedAccounts])

  // Handle OAuth callback params
  useEffect(() => {
    if (!searchParams) return
    const paramsKey = searchParams.toString()
    if (!paramsKey || oauthHandledRef.current === paramsKey) return

    const connected = searchParams.get('connected')
    const status = searchParams.get('status')
    const oauthError = searchParams.get('oauth_error')

    if (connected && status === 'success') {
      oauthHandledRef.current = paramsKey
      setOauthMessage({ type: 'success', text: `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully!` })
      fetchAccountsRef.current = false
      fetchConnectedAccounts()
      setTimeout(() => setOauthMessage(null), 5000)
      router.replace(`/dashboard/client/${clientId}/connect-platforms`)
    } else if (oauthError || (connected && status === 'error')) {
      oauthHandledRef.current = paramsKey
      const platform = connected || oauthError || 'platform'
      setOauthMessage({ type: 'error', text: `Failed to connect ${platform}. Please try again.` })
      setTimeout(() => setOauthMessage(null), 5000)
      router.replace(`/dashboard/client/${clientId}/connect-platforms`)
    }
  }, [searchParams, clientId, fetchConnectedAccounts, router])

  const isPlatformConnected = (platform: string) =>
    connectedAccounts.some((a) => a.platform === platform)

  const getPlatformButtonStyles = (platform: string) => {
    const connected = isPlatformConnected(platform)
    return {
      connected,
      buttonClasses: connected
        ? 'border-2 border-emerald-500 bg-emerald-50 shadow-sm hover:bg-emerald-100'
        : 'border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50',
      iconWrapperClasses: connected ? 'ring-4 ring-green-500 scale-105' : '',
      labelClasses: connected ? 'text-emerald-700' : 'text-gray-700',
    }
  }

  const getPlatformLabel = (platform: string, defaultLabel: string) => {
    if (connectingPlatform === platform) return 'Connecting...'
    if (isPlatformConnected(platform)) return 'CONNECTED'
    return defaultLabel
  }

  const handlePlatformConnect = async (platform: string) => {
    try {
      setConnectingPlatform(platform)
      const accessToken = getAccessToken()
      if (!accessToken) return

      const apiRoute = platform === 'facebook' ? '/api/late/connect-facebook' : '/api/late/connect-platform'
      const requestBody =
        platform === 'facebook'
          ? { clientId, source: 'onboarding' }
          : { platform, clientId, source: 'onboarding' }

      const response = await fetch(apiRoute, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to connect to ${platform}`)
      }

      const data = await response.json()
      if (!data.success) throw new Error(data.error || `Failed to connect to ${platform}`)

      if (data.connectUrl) {
        window.location.href = data.connectUrl
      } else {
        throw new Error('No authentication URL received')
      }
    } catch (err) {
      console.error(`Error connecting to ${platform}:`, err)
      setOauthMessage({ type: 'error', text: `Failed to start ${platform} connection. Please try again.` })
      setTimeout(() => setOauthMessage(null), 5000)
    } finally {
      setConnectingPlatform(null)
    }
  }

  const canContinue = connectedAccounts.length > 0

  const platforms = [
    { id: 'facebook', label: 'Facebook', icon: FacebookIcon, bgClass: 'bg-blue-600' },
    { id: 'instagram', label: 'Instagram', icon: InstagramIcon, bgClass: 'bg-gradient-to-br from-purple-500 to-pink-500' },
    { id: 'twitter', label: 'Twitter', icon: TwitterIcon, bgClass: 'bg-blue-400' },
    { id: 'linkedin', label: 'LinkedIn', icon: LinkedInIcon, bgClass: 'bg-blue-700' },
    { id: 'tiktok', label: 'TikTok', icon: TikTokIcon, bgClass: 'bg-black' },
    { id: 'youtube', label: 'YouTube', icon: YouTubeIcon, bgClass: 'bg-red-600' },
    { id: 'threads', label: 'Threads', icon: ThreadsIcon, bgClass: 'bg-gray-800' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-green-200 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold">
              <Check className="w-3.5 h-3.5" />
            </span>
            <span className="line-through">Step 1: Create Profile</span>
          </div>
          <div className="w-8 h-px bg-gray-300" />
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
              2
            </span>
            Connect Social Media
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Social Platforms</h1>
        <p className="text-gray-600 mb-8">
          Connect at least one social media platform to start scheduling and publishing posts.
        </p>

        {/* OAuth message */}
        {oauthMessage && (
          <div
            className={`mb-6 p-4 rounded-md flex items-center gap-2 ${
              oauthMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {oauthMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            {oauthMessage.text}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Social Media Platforms</CardTitle>
              <div className="flex items-center gap-2 text-gray-500">
                <span className="text-sm">Powered by</span>
                <img
                  src="/lateapi-logo.png"
                  alt="LATE"
                  className="h-5 w-auto rounded border border-black"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {platforms.map(({ id, label, icon: Icon, bgClass }) => {
                  const styles = getPlatformButtonStyles(id)
                  return (
                    <button
                      key={id}
                      onClick={() => handlePlatformConnect(id)}
                      disabled={connectingPlatform === id}
                      className={`relative flex flex-col items-center space-y-2 p-2 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles.buttonClasses}`}
                    >
                      {styles.connected && (
                        <span className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                      <div
                        className={`w-10 h-10 ${bgClass} rounded-full flex items-center justify-center transition-all ${styles.iconWrapperClasses}`}
                      >
                        {connectingPlatform === id ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        ) : (
                          <Icon className="text-white" size={20} />
                        )}
                      </div>
                      <span className={`text-xs font-medium ${styles.labelClasses}`}>
                        {getPlatformLabel(id, label)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Connected count indicator */}
            {!loading && connectedAccounts.length > 0 && (
              <p className="mt-4 text-sm text-emerald-700 font-medium">
                {connectedAccounts.length} platform{connectedAccounts.length !== 1 ? 's' : ''} connected
              </p>
            )}
          </CardContent>
        </Card>

        {/* Continue button */}
        <div className="mt-6 flex flex-col items-end gap-2">
          {!canContinue && !loading && (
            <p className="text-sm text-gray-500">Connect at least one platform to continue.</p>
          )}
          <Button
            onClick={() => router.push(`/dashboard/client/${clientId}`)}
            disabled={!canContinue}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Continue to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
