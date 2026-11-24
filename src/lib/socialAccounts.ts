// How a connected social account (from Zernio's GET /v1/accounts, via /api/late/get-accounts)
// is named in the UI and in emails. Browser-safe.
//
// Zernio sends `displayName` (page/profile name) and `username` (handle). `name` is only set on
// the placeholder entries the dashboard adds straight after an OAuth return.

export interface SocialAccountLike {
  platform: string
  name?: string | null
  username?: string | null
  displayName?: string | null
}

// Platforms whose usernames are @handles (Facebook pages, LinkedIn and YouTube aren't)
const AT_HANDLE_PLATFORMS = new Set(['instagram', 'twitter', 'x', 'tiktok', 'threads', 'bluesky', 'pinterest', 'telegram'])

export function accountHandle(account: SocialAccountLike): string | null {
  const username = account.username?.trim().replace(/^@/, '')
  if (!username) return null
  return AT_HANDLE_PLATFORMS.has(account.platform.toLowerCase()) ? `@${username}` : username
}

/** Short name for tight spaces: the profile name, else the handle. */
export function accountShortName(account: SocialAccountLike): string | null {
  const display = account.displayName?.trim()
  const handle = accountHandle(account)
  // A profile name that's just the username reads better as the @handle
  if (display && handle && display.toLowerCase() === handle.replace(/^@/, '').toLowerCase()) return handle
  return display || handle || account.name?.trim() || null
}

/** Full name: "Harbour Coffee (@harbourcoffee)", or whichever of the two exists. */
export function accountFullName(account: SocialAccountLike): string | null {
  const display = account.displayName?.trim()
  const handle = accountHandle(account)
  if (display && handle && display.toLowerCase() !== handle.replace(/^@/, '').toLowerCase()) {
    return `${display} (${handle})`
  }
  return handle || display || account.name?.trim() || null
}

/** All accounts on one platform, e.g. "Harbour Coffee, Harbour Kids". */
export function accountNames(accounts: SocialAccountLike[], format: 'short' | 'full' = 'full'): string | null {
  const names = accounts.map(format === 'short' ? accountShortName : accountFullName).filter((n): n is string => !!n)
  return names.length > 0 ? [...new Set(names)].join(', ') : null
}

const PLATFORM_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  threads: 'Threads',
}

export function platformName(platform: string): string {
  return PLATFORM_NAMES[platform.toLowerCase()] ?? platform.charAt(0).toUpperCase() + platform.slice(1)
}
