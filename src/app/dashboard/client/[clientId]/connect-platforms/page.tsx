'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowRight, Check, CheckCircle, AlertCircle, Link2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { currentReturnPath } from '@/lib/returnPath'
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
    if (isPlatformConnected(platform)) return 'Connected'
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
          ? { clientId, source: 'onboarding', returnTo: currentReturnPath() }
          : { platform, clientId, source: 'onboarding', returnTo: currentReturnPath() }

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
    <div className="min-h-screen px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-3xl">
        {/* Step indicator */}
        <ol className="mb-6 flex flex-wrap items-center gap-2 text-[13px]">
          <li className="flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/70 py-1 pl-1 pr-3 text-gray-500 backdrop-blur-sm">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-3 w-3" />
            </span>
            <span className="line-through decoration-gray-300">Step 1: Create Profile</span>
          </li>
          <li aria-hidden="true" className="h-px w-6 bg-gray-300" />
          <li className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 py-1 pl-1 pr-3 font-medium text-blue-800">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white">2</span>
            Connect Social Media
          </li>
        </ol>

        <header className="mb-6 flex gap-3.5">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 ring-1 ring-blue-100">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.022em] text-gray-900">Connect Social Platforms</h1>
            <p className="mt-1 text-[13px] leading-5 text-gray-500">
              Connect at least one social media platform to start scheduling and publishing posts.
            </p>
          </div>
        </header>

        {/* OAuth message */}
        {oauthMessage && (
          <div
            role="status"
            className={`mb-5 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] ${
              oauthMessage.type === 'success'
                ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800'
                : 'border-red-200/80 bg-red-50/80 text-red-800'
            }`}
          >
            {oauthMessage.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {oauthMessage.text}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Social Media Platforms</h2>
              {!loading && (
                <p className="mt-0.5 text-xs text-gray-500">
                  {connectedAccounts.length > 0
                    ? `${connectedAccounts.length} platform${connectedAccounts.length !== 1 ? 's' : ''} connected`
                    : 'Nothing connected yet'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <span className="text-xs">Powered by</span>
              <img src="/lateapi-logo.png" alt="LATE" className="h-5 w-auto rounded border border-black" />
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3 p-5 sm:grid-cols-2" aria-busy="true">
              {platforms.map(({ id }) => (
                <div key={id} className="h-[68px] animate-pulse rounded-xl bg-gray-50" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {platforms.map(({ id, label, icon: Icon, bgClass }) => {
                const styles = getPlatformButtonStyles(id)
                const accounts = connectedAccounts.filter((a) => a.platform === id)
                const connecting = connectingPlatform === id
                return (
                  <button
                    key={id}
                    onClick={() => handlePlatformConnect(id)}
                    disabled={connecting}
                    className={`group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                      styles.connected
                        ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300'
                        : 'border-gray-200/80 bg-white hover:-translate-y-px hover:border-blue-200 hover:shadow-card'
                    }`}
                  >
                    <span className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${bgClass} shadow-sm`}>
                      {connecting ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Icon className="text-white" size={20} />
                      )}
                      {styles.connected && (
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-emerald-500 p-0.5 text-white ring-2 ring-white">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-gray-900">{label}</span>
                      <span className={`block truncate text-xs ${styles.connected ? 'text-emerald-700' : 'text-gray-500'}`}>
                        {styles.connected ? accounts.map((a) => a.name).filter(Boolean).join(', ') || 'Connected' : 'Not connected'}
                      </span>
                    </span>
                    <span
                      className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        styles.connected
                          ? 'text-emerald-700 group-hover:bg-emerald-100/70'
                          : 'bg-blue-600 text-white shadow-button group-hover:bg-blue-700'
                      }`}
                    >
                      {connecting ? getPlatformLabel(id, label) : styles.connected ? 'Connected' : 'Connect'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Continue button */}
        <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          {!canContinue && !loading && <p className="text-[13px] text-gray-500 sm:mr-auto">Connect at least one platform to continue.</p>}
          <Button
            onClick={() => router.push(`/dashboard/client/${clientId}`)}
            disabled={!canContinue}
            size="lg"
            className="h-10 rounded-xl"
          >
            Continue to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
