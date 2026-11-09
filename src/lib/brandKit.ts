import { z } from 'zod'

// A client's brand kit for the Design Studio: logos, colours, fonts and an uploads library.

export interface BrandKitImage {
  id: string
  url: string
  name: string
}

export interface BrandKitCustomFont {
  id: string
  name: string
  url: string
}

export interface BrandKit {
  logos: BrandKitImage[]
  colors: string[]
  /** Built-in font label (e.g. "Bebas Neue") or `custom:<id>` for an uploaded font. */
  headingFont: string | null
  bodyFont: string | null
  fonts: BrandKitCustomFont[]
  uploads: BrandKitImage[]
}

export const EMPTY_BRAND_KIT: BrandKit = {
  logos: [],
  colors: [],
  headingFont: null,
  bodyFont: null,
  fonts: [],
  uploads: [],
}

export const BRAND_KIT_LIMITS = { logos: 10, colors: 16, fonts: 10, uploads: 200 }

const httpsUrl = z.string().url().max(2000).refine((u) => u.startsWith('https://'), 'Must be an https URL')
const id = z.string().min(1).max(64)
const name = z.string().trim().max(120)
const image = z.object({ id, url: httpsUrl, name })

export const brandKitSchema = z.object({
  logos: z.array(image).max(BRAND_KIT_LIMITS.logos),
  colors: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).max(BRAND_KIT_LIMITS.colors),
  headingFont: z.string().max(80).nullable(),
  bodyFont: z.string().max(80).nullable(),
  fonts: z.array(z.object({ id, name: name.min(1), url: httpsUrl })).max(BRAND_KIT_LIMITS.fonts),
  uploads: z.array(image).max(BRAND_KIT_LIMITS.uploads),
})

/** Fill in any missing fields so older/partial kits are always complete. */
export function normalizeBrandKit(raw: unknown): BrandKit {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<BrandKit>
  return {
    logos: Array.isArray(r.logos) ? r.logos : [],
    colors: Array.isArray(r.colors) ? r.colors : [],
    headingFont: typeof r.headingFont === 'string' ? r.headingFont : null,
    bodyFont: typeof r.bodyFont === 'string' ? r.bodyFont : null,
    fonts: Array.isArray(r.fonts) ? r.fonts : [],
    uploads: Array.isArray(r.uploads) ? r.uploads : [],
  }
}

export const newKitId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const FONT_MIME_BY_EXT: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
}
export const MAX_FONT_BYTES = 2 * 1024 * 1024
