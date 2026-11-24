'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { authedFetchJson } from '@/lib/authedFetch'
import { uploadMediaToBlob } from '@/lib/blobUpload'
import { BrandKit, BrandKitImage, EMPTY_BRAND_KIT, MAX_FONT_BYTES, newKitId, normalizeBrandKit } from '@/lib/brandKit'
import { EDITOR_FONTS, type EditorFont } from '@/components/image-editor/fonts'

// Load and edit a client's brand kit. Changes apply straight away and save in the
// background; a failed save rolls back and reports the error.

export interface UseBrandKit {
  kit: BrandKit
  loading: boolean
  /** True once the kit has been loaded (or failed to load). */
  ready: boolean
  error: string | null
  setupRequired: string | null
  busy: string | null
  update: (fn: (kit: BrandKit) => BrandKit) => Promise<boolean>
  addImage: (file: File, list: 'logos' | 'uploads') => Promise<BrandKitImage | null>
  addFont: (file: File) => Promise<boolean>
  clearError: () => void
}

export function useBrandKit(clientId?: string | null): UseBrandKit {
  const [kit, setKit] = useState<BrandKit>(EMPTY_BRAND_KIT)
  const kitRef = useRef(kit)
  const [loading, setLoading] = useState(!!clientId)
  const [ready, setReady] = useState(!clientId)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    setLoading(true)
    authedFetchJson<{ kit: BrandKit; setupRequired?: string }>(`/api/clients/${clientId}/brand-kit`)
      .then((data) => {
        if (cancelled) return
        const loaded = normalizeBrandKit(data.kit)
        kitRef.current = loaded
        setKit(loaded)
        setSetupRequired(data.setupRequired ?? null)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load brand kit'))
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  const update = useCallback(
    async (fn: (kit: BrandKit) => BrandKit) => {
      if (!clientId) return false
      const prev = kitRef.current
      const next = fn(prev)
      kitRef.current = next
      setKit(next)
      try {
        await authedFetchJson(`/api/clients/${clientId}/brand-kit`, { method: 'PUT', body: { kit: next } })
        setSetupRequired(null)
        return true
      } catch (err) {
        // Only roll back if nothing else changed the kit meanwhile
        if (kitRef.current === next) {
          kitRef.current = prev
          setKit(prev)
        }
        setError(err instanceof Error ? err.message : 'Failed to save brand kit')
        return false
      }
    },
    [clientId]
  )

  const addImage = useCallback(
    async (file: File, list: 'logos' | 'uploads') => {
      if (!file.type.startsWith('image/')) {
        setError('Please choose an image file')
        return null
      }
      setBusy(list)
      try {
        const { url } = await uploadMediaToBlob(file, `brand-${Date.now()}-${file.name}`)
        const item: BrandKitImage = { id: newKitId(), url, name: file.name.replace(/\.[^.]+$/, '').slice(0, 120) }
        const ok = await update((k) => ({ ...k, [list]: [...k[list], item] }))
        return ok ? item : null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
        return null
      } finally {
        setBusy(null)
      }
    },
    [update]
  )

  const addFont = useCallback(
    async (file: File) => {
      if (!clientId) return false
      if (file.size > MAX_FONT_BYTES) {
        setError('Font files can be up to 2MB')
        return false
      }
      setBusy('fonts')
      try {
        const data = await fileToBase64(file)
        const res = await authedFetchJson<{ url: string }>(`/api/clients/${clientId}/brand-kit/font`, {
          method: 'POST',
          body: { filename: file.name, data },
        })
        const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 120) || 'Brand font'
        const font = { id: newKitId(), name, url: res.url }
        // A newly uploaded font becomes the heading font if none is set yet
        return await update((k) => ({
          ...k,
          fonts: [...k.fonts, font],
          headingFont: k.headingFont ?? `custom:${font.id}`,
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Font upload failed')
        return false
      } finally {
        setBusy(null)
      }
    },
    [clientId, update]
  )

  return { kit, loading, ready, error, setupRequired, busy, update, addImage, addFont, clearError: () => setError(null) }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

// ---- fonts ------------------------------------------------------------------------------

const loadedCustomFonts = new Map<string, Promise<boolean>>()

export const customFontFamily = (id: string) => `"BrandFont-${id.replace(/[^a-zA-Z0-9-]/g, '')}"`

/**
 * Register an uploaded brand font with the browser. Fetched and added through the
 * FontFace API (the CSP doesn't allow loading font files straight from storage).
 */
export function loadCustomFont(font: { id: string; url: string }): Promise<boolean> {
  const existing = loadedCustomFonts.get(font.id)
  if (existing) return existing
  const p = (async () => {
    try {
      const res = await fetch(font.url)
      if (!res.ok) return false
      const face = new FontFace(customFontFamily(font.id).replace(/"/g, ''), await res.arrayBuffer())
      await face.load()
      document.fonts.add(face)
      return true
    } catch {
      return false
    }
  })()
  loadedCustomFonts.set(font.id, p)
  return p
}

/** All fonts available for this kit: the client's uploaded fonts first, then the built-ins. */
export function kitFonts(kit: BrandKit): (EditorFont & { value: string; custom?: boolean })[] {
  return [
    ...kit.fonts.map((f) => ({ label: f.name, family: customFontFamily(f.id), value: `custom:${f.id}`, custom: true })),
    ...EDITOR_FONTS.map((f) => ({ ...f, value: f.label })),
  ]
}

/** Resolve a kit font setting ("Bebas Neue" or "custom:<id>") to a font, if set. */
export function resolveKitFont(kit: BrandKit, value: string | null): EditorFont | null {
  if (!value) return null
  return kitFonts(kit).find((f) => f.value === value) ?? null
}
