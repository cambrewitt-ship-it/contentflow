import type { SupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'
import { facebookCaption, normalizeCaptionLibrary, type CaptionLibrary } from '@/lib/captionLibrary'

export const CAPTION_LIBRARY_SETUP_MESSAGE =
  'Saving accounts and hashtag sets needs a one-off database update (migrations/032-caption-library.sql).'

// Postgres "relation does not exist" — migration 032 hasn't been run yet
export const isMissingTable = (error: { code?: string } | null) => error?.code === '42P01'

export async function loadCaptionLibrary(
  admin: SupabaseClient,
  clientId: string
): Promise<{ library: CaptionLibrary; saved: boolean; missingTable: boolean }> {
  const { data, error } = await admin
    .from('client_caption_libraries')
    .select('accounts, hashtag_sets')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) {
    if (!isMissingTable(error)) logger.error('Load caption library error:', error)
    return { library: { accounts: [], hashtagSets: [] }, saved: false, missingTable: isMissingTable(error) }
  }
  return {
    library: normalizeCaptionLibrary({ accounts: data?.accounts, hashtagSets: data?.hashtag_sets }),
    saved: !!data,
    missingTable: false,
  }
}

/**
 * Zernio (LATE) platform entries with a Facebook-specific caption where saved
 * Instagram handles need swapping for Facebook names. Never throws: if the library
 * can't be read, the post goes out with the caption as written.
 */
export async function withFacebookCaptions<T extends { platform: string }>(
  admin: SupabaseClient,
  clientId: string,
  caption: string,
  platforms: T[]
): Promise<Array<T & { customContent?: string }>> {
  if (!platforms.some((p) => String(p.platform).toLowerCase() === 'facebook')) return platforms
  try {
    const { library } = await loadCaptionLibrary(admin, clientId)
    const fbCaption = facebookCaption(caption, library.accounts)
    if (fbCaption === caption) return platforms
    return platforms.map((p) =>
      String(p.platform).toLowerCase() === 'facebook' ? { ...p, customContent: fbCaption } : p
    )
  } catch (error) {
    logger.error('Facebook caption conversion failed:', error)
    return platforms
  }
}
