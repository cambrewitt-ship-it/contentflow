'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, X, Wand2, Upload, Type } from 'lucide-react'
import { extractLogoPalette } from '@/lib/logoPalette'
import type { BrandKitImage } from '@/lib/brandKit'
import { BRAND_KIT_LIMITS } from '@/lib/brandKit'
import { type UseBrandKit, kitFonts, loadCustomFont, resolveKitFont } from './useBrandKit'
import { fontPreview, type EditorFont } from '@/components/image-editor/fonts'

// Manage a client's brand kit. On the client page it's for setting the kit up; inside the
// Design Studio the same panel also puts things on the canvas (the onUse* callbacks).

interface Props {
  brandKit: UseBrandKit
  /** Compact single-column layout for the editor side panel. */
  compact?: boolean
  onUseLogo?: (logo: BrandKitImage) => void
  onUseUpload?: (upload: BrandKitImage) => void
  onUseColor?: (hex: string) => void
  onUseFont?: (font: EditorFont, role: 'heading' | 'body') => void
}

export function BrandKitManager({ brandKit, compact, onUseLogo, onUseUpload, onUseColor, onUseFont }: Props) {
  const { kit, loading, error, setupRequired, busy, update, addImage, addFont, clearError } = brandKit
  const logoInput = useRef<HTMLInputElement>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const fontInput = useRef<HTMLInputElement>(null)
  const [newColor, setNewColor] = useState('#3b82f6')
  const [suggesting, setSuggesting] = useState(false)
  const [, setFontsLoaded] = useState(0)

  // Make uploaded fonts render in the previews
  useEffect(() => {
    kit.fonts.forEach((f) => loadCustomFont(f).then(() => setFontsLoaded((n) => n + 1)))
  }, [kit.fonts])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading brand kit…
      </div>
    )
  }

  const removeFrom = (list: 'logos' | 'uploads', id: string) => update((k) => ({ ...k, [list]: k[list].filter((i) => i.id !== id) }))
  const addColor = (hex: string) => update((k) => (k.colors.includes(hex) ? k : { ...k, colors: [...k.colors, hex].slice(0, BRAND_KIT_LIMITS.colors) }))
  const suggestColors = async () => {
    const logo = kit.logos[0]
    if (!logo) return
    setSuggesting(true)
    try {
      const palette = await extractLogoPalette(logo.url)
      await update((k) => ({ ...k, colors: Array.from(new Set([...k.colors, ...palette])).slice(0, BRAND_KIT_LIMITS.colors) }))
    } catch {
      // Logo couldn't be read — leave colours as they are
    } finally {
      setSuggesting(false)
    }
  }

  const fonts = kitFonts(kit)
  const heading = resolveKitFont(kit, kit.headingFont)
  const body = resolveKitFont(kit, kit.bodyFont)
  const grid = compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-6'

  return (
    <div className={compact ? 'space-y-5' : 'grid gap-8 lg:grid-cols-2'}>
      {(setupRequired || error) && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${setupRequired ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-700'} ${compact ? '' : 'lg:col-span-2'}`}>
          {error ?? setupRequired}
          {error && (
            <button onClick={clearError} className="ml-2 underline">
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Logos */}
      <section>
        <SectionTitle title="Logos" hint={onUseLogo ? 'Click a logo to add it' : 'Main logo, icon, white version…'} />
        <div className={`grid ${grid} gap-2`}>
          {kit.logos.map((logo) => (
            <Tile key={logo.id} onClick={onUseLogo ? () => onUseLogo(logo) : undefined} onRemove={() => removeFrom('logos', logo.id)} label={logo.name} checker>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo.url} alt={logo.name} className="max-h-full max-w-full object-contain" />
            </Tile>
          ))}
          {kit.logos.length < BRAND_KIT_LIMITS.logos && (
            <AddTile onClick={() => logoInput.current?.click()} busy={busy === 'logos'} label="Add logo" />
          )}
        </div>
        <HiddenFileInput inputRef={logoInput} accept="image/png,image/jpeg,image/webp,image/gif" onFiles={(files) => files.forEach((f) => addImage(f, 'logos'))} />
      </section>

      {/* Colours */}
      <section>
        <SectionTitle title="Brand colours" hint={onUseColor ? 'Click to apply to the selection' : undefined} />
        <div className="flex flex-wrap items-center gap-2">
          {kit.colors.map((hex) => (
            <div key={hex} className="group relative">
              <button
                onClick={onUseColor ? () => onUseColor(hex) : undefined}
                className={`h-10 w-10 rounded-full border border-gray-200 shadow-sm ${onUseColor ? 'cursor-pointer hover:scale-105' : 'cursor-default'} transition-transform`}
                style={{ background: hex }}
                title={hex}
                aria-label={onUseColor ? `Use ${hex}` : hex}
              />
              <RemoveButton onClick={() => update((k) => ({ ...k, colors: k.colors.filter((c) => c !== hex) }))} label={`Remove ${hex}`} />
            </div>
          ))}
          {kit.colors.length < BRAND_KIT_LIMITS.colors && (
            <label className="flex h-10 items-center gap-1.5 rounded-full border border-dashed border-gray-300 pl-1.5 pr-3 text-xs text-gray-600 hover:border-gray-400">
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Pick a colour" />
              <button onClick={() => addColor(newColor)} className="font-medium">
                Add
              </button>
            </label>
          )}
        </div>
        {kit.logos.length > 0 && (
          <button onClick={suggestColors} disabled={suggesting} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50">
            {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Suggest colours from logo
          </button>
        )}
      </section>

      {/* Fonts */}
      <section>
        <SectionTitle title="Brand fonts" hint={onUseFont ? 'Click to add text in that font' : undefined} />
        <div className="space-y-2">
          <FontRow
            role="heading"
            label="Heading"
            compact={compact}
            font={heading}
            value={kit.headingFont}
            options={fonts}
            onChange={(v) => update((k) => ({ ...k, headingFont: v }))}
            onUse={onUseFont}
          />
          <FontRow
            role="body"
            label="Body"
            compact={compact}
            font={body}
            value={kit.bodyFont}
            options={fonts}
            onChange={(v) => update((k) => ({ ...k, bodyFont: v }))}
            onUse={onUseFont}
          />
        </div>
        {kit.fonts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {kit.fonts.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1 text-xs text-gray-700">
                <Type className="h-3 w-3" /> {f.name}
                <button
                  onClick={() =>
                    update((k) => ({
                      ...k,
                      fonts: k.fonts.filter((x) => x.id !== f.id),
                      headingFont: k.headingFont === `custom:${f.id}` ? null : k.headingFont,
                      bodyFont: k.bodyFont === `custom:${f.id}` ? null : k.bodyFont,
                    }))
                  }
                  className="rounded-full p-0.5 hover:bg-gray-200"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {kit.fonts.length < BRAND_KIT_LIMITS.fonts && (
          <button
            onClick={() => fontInput.current?.click()}
            disabled={busy === 'fonts'}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
          >
            {busy === 'fonts' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload a brand font (.woff2, .woff, .ttf, .otf)
          </button>
        )}
        <HiddenFileInput inputRef={fontInput} accept=".woff2,.woff,.ttf,.otf" onFiles={(files) => files.forEach((f) => addFont(f))} />
      </section>

      {/* Uploads library */}
      <section>
        <SectionTitle
          title="Brand uploads"
          hint={onUseUpload ? 'Click to add to your design' : 'Product shots, badges, stickers, icons — reusable on any design'}
        />
        <div className={`grid ${grid} gap-2`}>
          {kit.uploads.map((u) => (
            <Tile key={u.id} onClick={onUseUpload ? () => onUseUpload(u) : undefined} onRemove={() => removeFrom('uploads', u.id)} label={u.name} checker cover>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.url} alt={u.name} className="h-full w-full object-contain" />
            </Tile>
          ))}
          {kit.uploads.length < BRAND_KIT_LIMITS.uploads && (
            <AddTile onClick={() => uploadInput.current?.click()} busy={busy === 'uploads'} label="Upload" />
          )}
        </div>
        <HiddenFileInput inputRef={uploadInput} accept="image/png,image/jpeg,image/webp,image/gif" multiple onFiles={(files) => files.forEach((f) => addImage(f, 'uploads'))} />
      </section>
    </div>
  )
}

function FontRow({
  role,
  label,
  compact,
  font,
  value,
  options,
  onChange,
  onUse,
}: {
  role: 'heading' | 'body'
  label: string
  compact?: boolean
  font: EditorFont | null
  value: string | null
  options: ReturnType<typeof kitFonts>
  onChange: (v: string | null) => void
  onUse?: (font: EditorFont, role: 'heading' | 'body') => void
}) {
  const fallback = options.find((o) => o.label === (role === 'heading' ? 'Bebas Neue' : 'Poppins')) ?? options[0]
  const shown = font ?? fallback
  return (
    <div className={`flex gap-2 rounded-lg border border-gray-200 p-2 ${compact ? 'flex-col' : 'items-center'}`}>
      <button
        type="button"
        onClick={onUse ? () => onUse(shown, role) : undefined}
        {...fontPreview(shown.family)}
        className={`min-w-0 flex-1 truncate text-left ${onUse ? 'hover:text-blue-700' : 'cursor-default'} ${role === 'heading' ? 'text-xl font-bold' : 'text-sm'}`}
        title={onUse ? `Add ${label.toLowerCase()} text` : undefined}
      >
        {label}
        {onUse && <Plus className="ml-1 inline h-3.5 w-3.5 align-middle opacity-60" />}
      </button>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={`h-8 rounded-md border border-gray-300 bg-white px-1.5 text-xs ${compact ? 'w-full' : 'max-w-[9.5rem]'}`}
        aria-label={`${label} font`}
      >
        <option value="">Default ({fallback.label})</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.custom ? `★ ${o.label}` : o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Tile({
  children,
  onClick,
  onRemove,
  label,
  checker,
  cover,
}: {
  children: React.ReactNode
  onClick?: () => void
  onRemove: () => void
  label: string
  checker?: boolean
  cover?: boolean
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        title={label}
        className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 ${cover ? 'p-1' : 'p-2'} ${
          checker ? 'bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:14px_14px]' : 'bg-white'
        } ${onClick ? 'cursor-pointer hover:border-blue-400' : 'cursor-default'}`}
      >
        {children}
      </button>
      <RemoveButton onClick={onRemove} label={`Remove ${label}`} />
    </div>
  )
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={label}
      title="Remove"
      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white shadow group-hover:flex focus:flex"
    >
      <X className="h-3 w-3" />
    </button>
  )
}

function AddTile({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
      {label}
    </button>
  )
}

function HiddenFileInput({
  inputRef,
  accept,
  multiple,
  onFiles,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      className="hidden"
      onChange={(e) => {
        onFiles(Array.from(e.target.files ?? []))
        e.target.value = ''
      }}
    />
  )
}
