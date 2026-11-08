'use client'

// Canva-style image editor for the Content Suite: put text, logos, other images and
// shapes over a photo, adjust it, resize it for each platform, and save the result
// straight back into the post. Built on Fabric.js (MIT).

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Canvas,
  FabricImage,
  FabricObject,
  Textbox,
  Rect,
  Circle,
  Triangle,
  Gradient,
  Shadow,
  Point,
  filters,
  setFilterBackend,
  Canvas2dFilterBackend,
} from 'fabric'
import {
  Type,
  Shapes,
  Upload,
  Palette,
  SlidersHorizontal,
  Undo2,
  Redo2,
  X,
  Loader2,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FlipHorizontal,
  FlipVertical,
  AlignCenterHorizontal,
  AlignCenterVertical,
  Move,
  ImagePlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { extractLogoPalette } from '@/lib/logoPalette'
import type { ImageDesign } from '@/lib/contentStore'
import { EDITOR_FONTS, ensureAllFontsLoaded, ensureFontLoaded } from './fonts'

// The WebGL filter backend crops photos larger than its texture size; the 2D one doesn't.
if (typeof window !== 'undefined') setFilterBackend(new Canvas2dFilterBackend())

// ---------------------------------------------------------------------------------------
// Types & constants

export interface ImageEditorProps {
  /** URL of the image to edit (blob:, data: or https). */
  imageUrl: string
  /** The original file when we still have it — avoids any cross-origin issues. */
  file?: File
  /** A previously saved layered design, reopened with every layer still editable. */
  design?: ImageDesign
  /** Other images in the post, offered as one-click overlays. */
  otherImages?: string[]
  brandLogoUrl?: string
  brandName?: string
  onCancel: () => void
  onSave: (file: File, design: ImageDesign) => void | Promise<void>
}

type Role = 'base' | 'overlay'
type FabricWithMeta = FabricObject & { cfRole?: Role; cfAdjust?: Adjustments }

interface Adjustments {
  preset: FilterPreset
  brightness: number
  contrast: number
  saturation: number
  blur: number
}

type FilterPreset = 'none' | 'BlackWhite' | 'Sepia' | 'Vintage' | 'Polaroid' | 'Kodachrome' | 'Technicolor' | 'Brownie'

const DEFAULT_ADJUST: Adjustments = { preset: 'none', brightness: 0, contrast: 0, saturation: 0, blur: 0 }

const FILTER_PRESETS: { id: FilterPreset; label: string }[] = [
  { id: 'none', label: 'Original' },
  { id: 'BlackWhite', label: 'B&W' },
  { id: 'Sepia', label: 'Sepia' },
  { id: 'Vintage', label: 'Vintage' },
  { id: 'Polaroid', label: 'Polaroid' },
  { id: 'Kodachrome', label: 'Vivid' },
  { id: 'Technicolor', label: 'Pop' },
  { id: 'Brownie', label: 'Warm' },
]

interface SizePreset {
  id: string
  label: string
  hint: string
  width: number
  height: number
}

const SIZE_PRESETS: SizePreset[] = [
  { id: 'square', label: 'Square', hint: 'Instagram / Facebook post · 1:1', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait', hint: 'Instagram feed · 4:5', width: 1080, height: 1350 },
  { id: 'story', label: 'Story / Reel', hint: 'Stories, Reels, TikTok · 9:16', width: 1080, height: 1920 },
  { id: 'landscape', label: 'Landscape', hint: 'Facebook / LinkedIn link · 1.91:1', width: 1200, height: 628 },
]

const MAX_ORIGINAL_SIDE = 2048 // longest side for "Original size" designs
const MAX_SOURCE_SIDE = 2560 // photos are downscaled to this before editing
const HISTORY_LIMIT = 50
const SERIALIZED_PROPS = ['cfRole', 'cfAdjust', 'selectable', 'evented']

const BASIC_COLORS = ['#ffffff', '#000000', '#1f2937', '#ef4444', '#f97316', '#facc15', '#22c55e', '#0ea5e9', '#6366f1', '#ec4899']

type Tab = 'text' | 'elements' | 'uploads' | 'brand' | 'adjust'

// ---------------------------------------------------------------------------------------
// Helpers

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image failed to load'))
    img.src = src
  })
}

/** Load an image, downscale it if huge, and return a same-origin object URL for Fabric. */
async function prepareSource(
  src: string,
  maxSide = MAX_SOURCE_SIDE,
  ownedObjectUrl = false
): Promise<{ url: string; width: number; height: number }> {
  const img = await loadHtmlImage(src)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const scale = Math.min(1, maxSide / Math.max(w, h))
  // Reuse an object URL only if we made it (nobody else will revoke it while a saved
  // design still points at it); otherwise copy the pixels into one of our own.
  if (scale === 1 && ownedObjectUrl) return { url: src, width: w, height: h }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  // toBlob throws/returns null on a tainted canvas — i.e. the host doesn't allow editing.
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    try {
      canvas.toBlob(resolve, 'image/png')
    } catch (e) {
      reject(e)
    }
  })
  if (!blob) throw new Error('Image could not be read for editing')
  return { url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height }
}

function buildFilters(a: Adjustments) {
  const list: InstanceType<(typeof filters)['BaseFilter']>[] = []
  if (a.preset !== 'none') {
    const Preset = (filters as unknown as Record<string, new () => InstanceType<(typeof filters)['BaseFilter']>>)[a.preset]
    if (Preset) list.push(new Preset())
  }
  if (a.brightness) list.push(new filters.Brightness({ brightness: a.brightness }))
  if (a.contrast) list.push(new filters.Contrast({ contrast: a.contrast }))
  if (a.saturation) list.push(new filters.Saturation({ saturation: a.saturation }))
  if (a.blur) list.push(new filters.Blur({ blur: a.blur }))
  return list
}

const isText = (o: FabricObject | undefined | null): o is Textbox => !!o && o instanceof Textbox
const isShape = (o: FabricObject | undefined | null) => !!o && (o instanceof Rect || o instanceof Circle || o instanceof Triangle)
const colorValue = (v: unknown, fallback = '#000000') => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback)

// ---------------------------------------------------------------------------------------
// Component

export default function ImageEditor({
  imageUrl,
  file,
  design,
  otherImages = [],
  brandLogoUrl,
  brandName,
  onCancel,
  onSave,
}: ImageEditorProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const fcRef = useRef<Canvas | null>(null)
  const sizeRef = useRef({ width: 1080, height: 1080 })
  const historyRef = useRef<{ stack: string[]; index: number; lock: boolean }>({ stack: [], index: -1, lock: false })
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const guidesRef = useRef({ v: false, h: false })
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [, rerender] = useReducer((x: number) => x + 1, 0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('text')
  const [sizeId, setSizeId] = useState<string>('original')
  const [originalSize, setOriginalSize] = useState({ width: 1080, height: 1080 })
  const [adjust, setAdjust] = useState<Adjustments>(DEFAULT_ADJUST)
  const [movePhoto, setMovePhoto] = useState(false)
  const [brandColors, setBrandColors] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')

  const fc = () => fcRef.current
  const getBase = () => fc()?.getObjects().find((o) => (o as FabricWithMeta).cfRole === 'base') as FabricImage | undefined
  const active = fc()?.getActiveObject() as FabricWithMeta | undefined

  // ---- history -------------------------------------------------------------------------

  const snapshot = useCallback(() => JSON.stringify(fcRef.current?.toObject(SERIALIZED_PROPS) ?? {}), [])

  const commit = useCallback(() => {
    const h = historyRef.current
    if (h.lock || !fcRef.current) return
    const snap = snapshot()
    if (h.stack[h.index] === snap) return
    h.stack = h.stack.slice(0, h.index + 1)
    h.stack.push(snap)
    if (h.stack.length > HISTORY_LIMIT) h.stack.shift()
    h.index = h.stack.length - 1
    if (h.stack.length > 1) setDirty(true)
    rerender()
  }, [snapshot])

  const commitSoon = useCallback(() => {
    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(commit, 300)
  }, [commit])

  const resetHistory = useCallback(() => {
    historyRef.current = { stack: [], index: -1, lock: false }
    commit()
  }, [commit])

  const lockBase = useCallback((locked: boolean) => {
    const base = getBase()
    if (!base) return
    base.set({ selectable: !locked, evented: !locked })
    if (locked && fcRef.current?.getActiveObject() === base) fcRef.current.discardActiveObject()
    fcRef.current?.requestRenderAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const restore = useCallback(async (json: string) => {
    const canvas = fcRef.current
    if (!canvas) return
    historyRef.current.lock = true
    try {
      await canvas.loadFromJSON(json)
      const base = getBase() as (FabricImage & FabricWithMeta) | undefined
      setAdjust(base?.cfAdjust ?? DEFAULT_ADJUST)
      lockBase(!movePhoto)
      canvas.requestRenderAll()
    } finally {
      historyRef.current.lock = false
      rerender()
    }
  }, [lockBase, movePhoto]) // eslint-disable-line react-hooks/exhaustive-deps

  const undo = useCallback(async () => {
    const h = historyRef.current
    if (h.index <= 0) return
    h.index -= 1
    await restore(h.stack[h.index])
    setDirty(true)
  }, [restore])

  const redo = useCallback(async () => {
    const h = historyRef.current
    if (h.index >= h.stack.length - 1) return
    h.index += 1
    await restore(h.stack[h.index])
    setDirty(true)
  }, [restore])

  // ---- layout: fit the design into the visible stage -----------------------------------

  const fitToStage = useCallback(() => {
    const canvas = fcRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return
    const { width, height } = sizeRef.current
    const pad = 32
    const zoom = Math.min((stage.clientWidth - pad) / width, (stage.clientHeight - pad) / height, 1)
    const z = Math.max(zoom, 0.05)
    canvas.setDimensions({ width: Math.round(width * z), height: Math.round(height * z) })
    canvas.setZoom(z)
    canvas.requestRenderAll()
  }, [])

  const coverBase = useCallback((mode: 'fill' | 'fit' = 'fill') => {
    const base = getBase()
    if (!base) return
    const { width, height } = sizeRef.current
    const sx = width / (base.width ?? 1)
    const sy = height / (base.height ?? 1)
    const s = mode === 'fill' ? Math.max(sx, sy) : Math.min(sx, sy)
    base.set({ scaleX: s, scaleY: s, angle: 0 })
    base.setPositionByOrigin(new Point(width / 2, height / 2), 'center', 'center')
    base.setCoords()
    fcRef.current?.requestRenderAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyDesignSize = useCallback((width: number, height: number, rescaleObjects: boolean) => {
    const canvas = fcRef.current
    if (!canvas) return
    const prev = sizeRef.current
    sizeRef.current = { width, height }
    if (rescaleObjects) {
      // Keep overlays in the same relative spot on the new canvas
      const rx = width / prev.width
      const ry = height / prev.height
      const r = Math.min(rx, ry)
      canvas.getObjects().forEach((o) => {
        if ((o as FabricWithMeta).cfRole === 'base') return
        const c = o.getCenterPoint()
        o.set({ scaleX: (o.scaleX ?? 1) * r, scaleY: (o.scaleY ?? 1) * r })
        o.setPositionByOrigin(new Point(c.x * rx, c.y * ry), 'center', 'center')
        o.setCoords()
      })
      coverBase('fill')
    }
    fitToStage()
  }, [coverBase, fitToStage])

  // ---- set up the canvas ---------------------------------------------------------------

  useEffect(() => {
    if (!canvasElRef.current) return
    let disposed = false
    const canvas = new Canvas(canvasElRef.current, {
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selectionColor: 'rgba(59,130,246,0.08)',
      selectionBorderColor: '#3b82f6',
    })
    fcRef.current = canvas

    FabricObject.ownDefaults.borderColor = '#3b82f6'
    FabricObject.ownDefaults.cornerColor = '#ffffff'
    FabricObject.ownDefaults.cornerStrokeColor = '#3b82f6'
    FabricObject.ownDefaults.cornerStyle = 'circle'
    FabricObject.ownDefaults.transparentCorners = false
    FabricObject.ownDefaults.cornerSize = 12
    FabricObject.ownDefaults.padding = 4

    const onChange = () => commit()
    const onSelection = () => rerender()
    canvas.on('object:added', onChange)
    canvas.on('object:removed', onChange)
    canvas.on('object:modified', onChange)
    canvas.on('text:changed', commitSoon)
    canvas.on('selection:created', onSelection)
    canvas.on('selection:updated', onSelection)
    canvas.on('selection:cleared', onSelection)

    // Snap to the centre lines while dragging, Canva-style
    canvas.on('object:moving', (e) => {
      const obj = e.target
      const { width, height } = sizeRef.current
      const threshold = 10 / canvas.getZoom()
      const c = obj.getCenterPoint()
      const snapV = Math.abs(c.x - width / 2) < threshold
      const snapH = Math.abs(c.y - height / 2) < threshold
      if (snapV || snapH) {
        obj.setPositionByOrigin(new Point(snapV ? width / 2 : c.x, snapH ? height / 2 : c.y), 'center', 'center')
      }
      guidesRef.current = { v: snapV, h: snapH }
    })
    canvas.on('mouse:up', () => {
      if (guidesRef.current.v || guidesRef.current.h) {
        guidesRef.current = { v: false, h: false }
        canvas.requestRenderAll()
      }
    })
    canvas.on('after:render', ({ ctx }) => {
      const g = guidesRef.current
      if (!g.v && !g.h) return
      if (ctx !== canvas.getContext()) return // never draw guides into an export
      const z = canvas.getZoom()
      const { width, height } = sizeRef.current
      ctx.save()
      ctx.strokeStyle = '#ec4899'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      if (g.v) {
        ctx.moveTo((width / 2) * z, 0)
        ctx.lineTo((width / 2) * z, height * z)
      }
      if (g.h) {
        ctx.moveTo(0, (height / 2) * z)
        ctx.lineTo(width * z, (height / 2) * z)
      }
      ctx.stroke()
      ctx.restore()
    })

    const load = async () => {
      try {
        await ensureAllFontsLoaded()
        historyRef.current.lock = true

        // Reopen a saved design with every layer editable, if it still loads
        if (design) {
          try {
            sizeRef.current = { width: design.width, height: design.height }
            await canvas.loadFromJSON(design.json)
            if (disposed) return
            const base = getBase() as (FabricImage & FabricWithMeta) | undefined
            if (base) {
              setAdjust(base.cfAdjust ?? DEFAULT_ADJUST)
              const preset = SIZE_PRESETS.find((p) => p.width === design.width && p.height === design.height)
              setSizeId(preset?.id ?? 'original')
              setOriginalSize({ width: design.width, height: design.height })
              lockBase(true)
              fitToStage()
              historyRef.current.lock = false
              resetHistory()
              setStatus('ready')
              return
            }
          } catch {
            canvas.clear()
            canvas.backgroundColor = '#ffffff'
          }
        }

        const fromFile = !!file && file.size > 0 && file.type.startsWith('image/')
        const src = fromFile ? URL.createObjectURL(file) : imageUrl
        const prepared = await prepareSource(src, MAX_SOURCE_SIDE, fromFile)
        if (disposed) return
        const base = (await FabricImage.fromURL(prepared.url)) as FabricImage & FabricWithMeta
        if (disposed) return
        base.cfRole = 'base'
        base.cfAdjust = DEFAULT_ADJUST
        base.set({ selectable: false, evented: false })

        const longest = Math.max(prepared.width, prepared.height)
        const s = Math.min(1, MAX_ORIGINAL_SIDE / longest)
        const orig = { width: Math.round(prepared.width * s), height: Math.round(prepared.height * s) }
        setOriginalSize(orig)
        sizeRef.current = orig
        canvas.add(base)
        coverBase('fill')
        fitToStage()
        historyRef.current.lock = false
        resetHistory()
        setStatus('ready')
      } catch (err) {
        if (disposed) return
        historyRef.current.lock = false
        setErrorMessage(
          err instanceof Error && /read for editing|tainted|security/i.test(err.message)
            ? "This image is hosted somewhere that doesn't allow editing. Download it and upload it again to edit."
            : "We couldn't open this image for editing."
        )
        setStatus('error')
      }
    }
    load()

    return () => {
      disposed = true
      if (commitTimer.current) clearTimeout(commitTimer.current)
      canvas.dispose()
      fcRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refit when the window changes size
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fitToStage())
    ro.observe(stage)
    return () => ro.disconnect()
  }, [fitToStage])

  // Brand colours from the client's logo
  useEffect(() => {
    if (!brandLogoUrl) return
    let cancelled = false
    extractLogoPalette(brandLogoUrl)
      .then((colors) => !cancelled && setBrandColors(colors))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [brandLogoUrl])

  // Lock the page behind the editor
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ---- adding things -------------------------------------------------------------------

  const placeCentered = (obj: FabricObject, yRatio = 0.5) => {
    const canvas = fc()
    if (!canvas) return
    const { width, height } = sizeRef.current
    obj.setPositionByOrigin(new Point(width / 2, height * yRatio), 'center', 'center')
    obj.setCoords()
    canvas.add(obj)
    canvas.setActiveObject(obj)
    canvas.requestRenderAll()
  }

  const addText = async (kind: 'heading' | 'subheading' | 'body' | 'label' | 'outline' | 'quote') => {
    const { width } = sizeRef.current
    const u = width / 1080 // scale presets to the design
    const presets = {
      heading: { text: 'Add a heading', font: 'Bebas Neue', size: 140, weight: 'normal', fill: '#ffffff', y: 0.3 },
      subheading: { text: 'Add a subheading', font: 'Montserrat', size: 64, weight: 'bold', fill: '#ffffff', y: 0.45 },
      body: { text: 'Add a little bit of body text', font: 'Poppins', size: 40, weight: 'normal', fill: '#ffffff', y: 0.6 },
      label: { text: 'NEW IN', font: 'Montserrat', size: 52, weight: 'bold', fill: '#ffffff', y: 0.15 },
      outline: { text: 'BIG NEWS', font: 'Anton', size: 150, weight: 'normal', fill: 'rgba(0,0,0,0)', y: 0.5 },
      quote: { text: '“Your quote here”', font: 'Playfair Display', size: 72, weight: 'normal', fill: '#ffffff', y: 0.5 },
    }[kind]
    const font = EDITOR_FONTS.find((f) => f.label === presets.font) ?? EDITOR_FONTS[0]
    await ensureFontLoaded(font.family, presets.weight === 'bold' ? 700 : 400)
    const tb = new Textbox(presets.text, {
      width: width * 0.8,
      fontSize: presets.size * u,
      fontFamily: font.family,
      fontWeight: presets.weight,
      fontStyle: kind === 'quote' ? 'italic' : 'normal',
      fill: presets.fill,
      textAlign: 'center',
      lineHeight: 1.1,
      splitByGrapheme: false,
      shadow: kind === 'outline' || kind === 'label' ? undefined : new Shadow({ color: 'rgba(0,0,0,0.35)', blur: 12 * u, offsetX: 0, offsetY: 2 * u }),
    })
    if (kind === 'label') {
      tb.set({ backgroundColor: brandColors[0] ?? '#111827', width: width * 0.4, charSpacing: 150 })
    }
    if (kind === 'outline') {
      tb.set({ stroke: '#ffffff', strokeWidth: 3 * u, charSpacing: 40 })
    }
    placeCentered(tb, presets.y)
    setTab('text')
  }

  const addShape = (kind: 'rect' | 'rounded' | 'circle' | 'triangle' | 'bar' | 'fade' | 'tint' | 'frame') => {
    const { width, height } = sizeRef.current
    const m = Math.min(width, height)
    const accent = brandColors[0] ?? '#3b82f6'
    let obj: FabricObject
    switch (kind) {
      case 'rect':
        obj = new Rect({ width: m * 0.4, height: m * 0.25, fill: accent })
        break
      case 'rounded':
        obj = new Rect({ width: m * 0.4, height: m * 0.25, rx: m * 0.03, ry: m * 0.03, fill: accent })
        break
      case 'circle':
        obj = new Circle({ radius: m * 0.15, fill: accent })
        break
      case 'triangle':
        obj = new Triangle({ width: m * 0.3, height: m * 0.26, fill: accent })
        break
      case 'bar':
        obj = new Rect({ width, height: height * 0.16, fill: 'rgba(17,24,39,0.75)' })
        obj.setPositionByOrigin(new Point(width / 2, height * 0.92), 'center', 'center')
        break
      case 'fade':
        obj = new Rect({
          width,
          height: height * 0.55,
          fill: new Gradient({
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: 0, y2: height * 0.55 },
            colorStops: [
              { offset: 0, color: 'rgba(0,0,0,0)' },
              { offset: 1, color: 'rgba(0,0,0,0.8)' },
            ],
          }),
        })
        obj.setPositionByOrigin(new Point(width / 2, height - (height * 0.55) / 2), 'center', 'center')
        break
      case 'tint':
        obj = new Rect({ width, height, fill: accent, opacity: 0.35 })
        obj.setPositionByOrigin(new Point(width / 2, height / 2), 'center', 'center')
        break
      case 'frame': {
        const inset = m * 0.04
        obj = new Rect({ width: width - inset * 2, height: height - inset * 2, fill: 'rgba(0,0,0,0)', stroke: '#ffffff', strokeWidth: m * 0.012, strokeUniform: true })
        obj.setPositionByOrigin(new Point(width / 2, height / 2), 'center', 'center')
        break
      }
    }
    const canvas = fc()
    if (!canvas) return
    if (['bar', 'fade', 'tint', 'frame'].includes(kind)) {
      obj.setCoords()
      canvas.add(obj)
      // Overlays sit just above the photo so existing text stays on top
      canvas.moveObjectTo(obj, getBase() ? 1 : 0)
      canvas.setActiveObject(obj)
      canvas.requestRenderAll()
    } else {
      placeCentered(obj)
    }
  }

  const addImageOverlay = async (src: string, opts: { widthRatio?: number; yRatio?: number } = {}, ownedObjectUrl = false) => {
    try {
      const prepared = await prepareSource(src, 1600, ownedObjectUrl)
      const img = (await FabricImage.fromURL(prepared.url)) as FabricImage & FabricWithMeta
      img.cfRole = 'overlay'
      const { width } = sizeRef.current
      const target = width * (opts.widthRatio ?? 0.4)
      img.scale(target / (img.width ?? target))
      placeCentered(img, opts.yRatio ?? 0.5)
    } catch {
      flash("That image couldn't be added — its host doesn't allow editing. Try uploading it from your computer.")
    }
  }

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      await addImageOverlay(URL.createObjectURL(f), {}, true)
    }
  }

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 4000)
  }

  // ---- editing the selection -----------------------------------------------------------

  const update = (props: Record<string, unknown>, opts: { immediate?: boolean } = {}) => {
    const canvas = fc()
    const obj = canvas?.getActiveObject()
    if (!canvas || !obj) return
    obj.set(props)
    obj.setCoords()
    canvas.requestRenderAll()
    if (opts.immediate) commit()
    else commitSoon()
    rerender()
  }

  const setFont = async (family: string) => {
    const obj = fc()?.getActiveObject()
    if (!isText(obj)) return
    await ensureFontLoaded(family, obj.fontWeight === 'bold' ? 700 : 400)
    update({ fontFamily: family }, { immediate: true })
  }

  const toggleShadow = () => {
    const obj = fc()?.getActiveObject()
    if (!obj) return
    const u = sizeRef.current.width / 1080
    update({ shadow: obj.shadow ? null : new Shadow({ color: 'rgba(0,0,0,0.45)', blur: 16 * u, offsetX: 0, offsetY: 4 * u }) }, { immediate: true })
  }

  const toggleOutline = () => {
    const obj = fc()?.getActiveObject()
    if (!obj) return
    const u = sizeRef.current.width / 1080
    update(obj.stroke ? { stroke: null, strokeWidth: 0 } : { stroke: '#000000', strokeWidth: 3 * u }, { immediate: true })
  }

  const applyColor = (color: string) => {
    const obj = fc()?.getActiveObject()
    if (obj && (obj as FabricWithMeta).cfRole !== 'base' && !(obj instanceof FabricImage)) {
      update({ fill: color }, { immediate: true })
    } else {
      const canvas = fc()
      if (!canvas) return
      canvas.backgroundColor = color
      canvas.requestRenderAll()
      commit()
    }
  }

  const layer = (action: 'forward' | 'backward' | 'front' | 'back') => {
    const canvas = fc()
    const obj = canvas?.getActiveObject()
    if (!canvas || !obj) return
    const min = getBase() ? 1 : 0 // never go behind the photo
    const idx = canvas.getObjects().indexOf(obj)
    const top = canvas.getObjects().length - 1
    const to = { forward: Math.min(idx + 1, top), backward: Math.max(idx - 1, min), front: top, back: min }[action]
    canvas.moveObjectTo(obj, to)
    canvas.requestRenderAll()
    commit()
  }

  const duplicate = async () => {
    const canvas = fc()
    const obj = canvas?.getActiveObject() as FabricWithMeta | undefined
    if (!canvas || !obj || obj.cfRole === 'base') return
    const clone = (await obj.clone(SERIALIZED_PROPS)) as FabricWithMeta
    const off = sizeRef.current.width * 0.03
    clone.set({ left: (obj.left ?? 0) + off, top: (obj.top ?? 0) + off })
    clone.setCoords()
    canvas.add(clone)
    canvas.setActiveObject(clone)
    canvas.requestRenderAll()
  }

  const remove = () => {
    const canvas = fc()
    if (!canvas) return
    const objs = canvas.getActiveObjects().filter((o) => (o as FabricWithMeta).cfRole !== 'base')
    if (!objs.length) return
    canvas.discardActiveObject()
    historyRef.current.lock = true
    objs.forEach((o) => canvas.remove(o))
    historyRef.current.lock = false
    commit()
    canvas.requestRenderAll()
  }

  const centerOn = (axis: 'h' | 'v') => {
    const obj = fc()?.getActiveObject()
    if (!obj) return
    const { width, height } = sizeRef.current
    const c = obj.getCenterPoint()
    obj.setPositionByOrigin(new Point(axis === 'h' ? width / 2 : c.x, axis === 'v' ? height / 2 : c.y), 'center', 'center')
    update({}, { immediate: true })
  }

  // ---- photo adjustments ---------------------------------------------------------------

  const applyAdjust = (next: Adjustments, immediate = false) => {
    setAdjust(next)
    const base = getBase() as (FabricImage & FabricWithMeta) | undefined
    if (!base) return
    base.cfAdjust = next
    base.filters = buildFilters(next)
    base.applyFilters()
    fc()?.requestRenderAll()
    if (immediate) commit()
    else commitSoon()
  }

  const toggleMovePhoto = () => {
    const next = !movePhoto
    setMovePhoto(next)
    lockBase(!next)
    const base = getBase()
    if (next && base) {
      fc()?.setActiveObject(base)
      fc()?.requestRenderAll()
    }
    rerender()
  }

  const changeSize = (id: string) => {
    setSizeId(id)
    const preset = SIZE_PRESETS.find((p) => p.id === id)
    const target = preset ?? originalSize
    applyDesignSize(target.width, target.height, true)
    commit()
  }

  // ---- save ----------------------------------------------------------------------------

  const save = async () => {
    const canvas = fc()
    if (!canvas) return
    setSaving(true)
    try {
      canvas.discardActiveObject()
      guidesRef.current = { v: false, h: false }
      canvas.renderAll()
      const blob = await canvas.toBlob({ format: 'jpeg', quality: 0.92, multiplier: 1 / canvas.getZoom(), enableRetinaScaling: false })
      if (!blob) throw new Error('Export failed')
      const out = new File([blob], `design-${Date.now()}.jpg`, { type: 'image/jpeg' })
      const { width, height } = sizeRef.current
      await onSave(out, { json: canvas.toObject(SERIALIZED_PROPS), width, height })
    } catch {
      flash("Couldn't export the design. If you added an image from another website, remove it and try again.")
      setSaving(false)
    }
  }

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your changes to this image?')) return
    onCancel()
  }

  // ---- keyboard shortcuts --------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const canvas = fcRef.current
      if (!canvas) return
      const target = e.target as HTMLElement | null
      const typingInField = !!target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName) && !target.dataset.fabric
      const obj = canvas.getActiveObject()
      const editingText = isText(obj) && obj.isEditing
      const mod = e.metaKey || e.ctrlKey

      if (e.key === 'Escape') {
        if (editingText) return // Fabric exits text editing itself
        if (obj) {
          canvas.discardActiveObject()
          canvas.requestRenderAll()
        } else requestClose()
        return
      }
      if (typingInField || editingText) return

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicate()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && obj) {
        e.preventDefault()
        remove()
      } else if (obj && e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = (e.shiftKey ? 10 : 1) / canvas.getZoom()
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy })
        obj.setCoords()
        canvas.requestRenderAll()
        commitSoon()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- render --------------------------------------------------------------------------

  const h = historyRef.current
  const canUndo = h.index > 0
  const canRedo = h.index < h.stack.length - 1
  const swatches = Array.from(new Set([...brandColors, ...BASIC_COLORS]))

  const tabs: { id: Tab; label: string; icon: typeof Type }[] = [
    { id: 'text', label: 'Text', icon: Type },
    { id: 'elements', label: 'Elements', icon: Shapes },
    { id: 'uploads', label: 'Uploads', icon: Upload },
    { id: 'brand', label: 'Brand', icon: Palette },
    { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
  ]

  const ui = (
    <div className="fixed inset-0 z-[200] flex flex-col bg-gray-100 text-gray-800" role="dialog" aria-modal="true" aria-label="Image editor">
      {/* Top bar */}
      <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:px-4">
        <button onClick={requestClose} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Close editor">
          <X className="h-5 w-5" />
        </button>
        <h2 className="hidden text-base font-semibold sm:block">Edit image</h2>
        <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" />
        <select
          value={sizeId}
          onChange={(e) => changeSize(e.target.value)}
          disabled={status !== 'ready'}
          className="h-9 max-w-[11rem] rounded-md border border-gray-300 bg-white px-2 text-sm"
          aria-label="Canvas size"
        >
          <option value="original">Original size</option>
          {SIZE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — {p.hint}
            </option>
          ))}
        </select>
        <button onClick={undo} disabled={!canUndo} className="rounded-md p-2 hover:bg-gray-100 disabled:opacity-30" aria-label="Undo" title="Undo (Ctrl+Z)">
          <Undo2 className="h-5 w-5" />
        </button>
        <button onClick={redo} disabled={!canRedo} className="rounded-md p-2 hover:bg-gray-100 disabled:opacity-30" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="h-5 w-5" />
        </button>
        <div className="flex-1" />
        <Button variant="outline" onClick={requestClose} className="hidden sm:inline-flex">
          Cancel
        </Button>
        <Button onClick={save} disabled={status !== 'ready' || saving} className="bg-blue-600 text-white hover:bg-blue-700">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save<span className="hidden sm:inline">&nbsp;to post</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Left: tools */}
        <aside className={`order-3 h-[40vh] min-h-0 flex-shrink-0 border-t border-gray-200 bg-white md:order-none md:flex md:h-auto md:w-80 md:border-r md:border-t-0 ${active && status === 'ready' ? 'hidden' : 'flex'}`}>
          <nav className="flex w-16 flex-shrink-0 flex-col border-r border-gray-100 py-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${tab === id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-3">
            {tab === 'text' && (
              <div className="space-y-2">
                <PanelTitle>Add text</PanelTitle>
                <button onClick={() => addText('heading')} className="w-full rounded-lg border border-gray-200 px-3 py-3 text-left hover:border-blue-400">
                  <span className="text-2xl" style={{ fontFamily: EDITOR_FONTS[2].family }}>Add a heading</span>
                </button>
                <button onClick={() => addText('subheading')} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-left hover:border-blue-400">
                  <span className="text-base font-bold" style={{ fontFamily: EDITOR_FONTS[1].family }}>Add a subheading</span>
                </button>
                <button onClick={() => addText('body')} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:border-blue-400">
                  Add body text
                </button>
                <PanelTitle className="pt-3">Text styles</PanelTitle>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => addText('label')} className="rounded-lg bg-gray-900 px-2 py-3 text-xs font-bold tracking-widest text-white hover:opacity-90">
                    NEW IN
                  </button>
                  <button
                    onClick={() => addText('outline')}
                    className="rounded-lg border border-gray-200 bg-gray-700 px-2 py-2 text-xl text-transparent hover:border-blue-400"
                    style={{ fontFamily: EDITOR_FONTS[3].family, WebkitTextStroke: '1px white' }}
                  >
                    BIG NEWS
                  </button>
                  <button
                    onClick={() => addText('quote')}
                    className="col-span-2 rounded-lg border border-gray-200 px-2 py-2 text-lg italic hover:border-blue-400"
                    style={{ fontFamily: EDITOR_FONTS[5].family }}
                  >
                    “Your quote here”
                  </button>
                </div>
                <p className="pt-2 text-xs text-gray-500">Double-click text on the canvas to type.</p>
              </div>
            )}

            {tab === 'elements' && (
              <div className="space-y-3">
                <PanelTitle>Overlays</PanelTitle>
                <div className="grid grid-cols-2 gap-2">
                  <ToolTile onClick={() => addShape('fade')} label="Dark fade">
                    <div className="h-full w-full rounded bg-gradient-to-b from-transparent to-black/80" />
                  </ToolTile>
                  <ToolTile onClick={() => addShape('bar')} label="Caption bar">
                    <div className="mt-auto h-1/3 w-full rounded bg-gray-900/75" />
                  </ToolTile>
                  <ToolTile onClick={() => addShape('tint')} label="Colour tint">
                    <div className="h-full w-full rounded opacity-40" style={{ background: brandColors[0] ?? '#3b82f6' }} />
                  </ToolTile>
                  <ToolTile onClick={() => addShape('frame')} label="Frame">
                    <div className="h-full w-full rounded border-2 border-white outline outline-1 outline-gray-300" />
                  </ToolTile>
                </div>
                <PanelTitle>Shapes</PanelTitle>
                <div className="grid grid-cols-4 gap-2">
                  <ShapeButton onClick={() => addShape('rect')} label="Square"><div className="h-7 w-7 bg-gray-700" /></ShapeButton>
                  <ShapeButton onClick={() => addShape('rounded')} label="Rounded"><div className="h-7 w-7 rounded-md bg-gray-700" /></ShapeButton>
                  <ShapeButton onClick={() => addShape('circle')} label="Circle"><div className="h-7 w-7 rounded-full bg-gray-700" /></ShapeButton>
                  <ShapeButton onClick={() => addShape('triangle')} label="Triangle">
                    <div className="h-0 w-0 border-x-[14px] border-b-[24px] border-x-transparent border-b-gray-700" />
                  </ShapeButton>
                </div>
              </div>
            )}

            {tab === 'uploads' && (
              <div className="space-y-3">
                <PanelTitle>Add an image on top</PanelTitle>
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <ImagePlus className="h-4 w-4" /> Upload from computer
                </button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleUploadFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <p className="text-xs text-gray-500">Logos, product shots, stickers — PNGs with transparent backgrounds work best.</p>
                {otherImages.length > 0 && (
                  <>
                    <PanelTitle className="pt-2">From this post</PanelTitle>
                    <div className="grid grid-cols-3 gap-2">
                      {otherImages.map((src) => (
                        <button key={src} onClick={() => addImageOverlay(src)} className="aspect-square overflow-hidden rounded-md border border-gray-200 hover:border-blue-400">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'brand' && (
              <div className="space-y-3">
                <PanelTitle>{brandName ? `${brandName} logo` : 'Logo'}</PanelTitle>
                {brandLogoUrl ? (
                  <button
                    onClick={() => addImageOverlay(brandLogoUrl, { widthRatio: 0.22, yRatio: 0.88 })}
                    className="flex h-24 w-full items-center justify-center rounded-lg border border-gray-200 bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-3 hover:border-blue-400"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={brandLogoUrl} alt="Add logo" className="max-h-full max-w-full object-contain" />
                  </button>
                ) : (
                  <p className="text-xs text-gray-500">Add a logo to this client&apos;s brand information to drop it onto images in one click.</p>
                )}
                {brandColors.length > 0 && (
                  <>
                    <PanelTitle className="pt-2">Brand colours</PanelTitle>
                    <div className="flex gap-2">
                      {brandColors.map((c) => (
                        <button key={c} onClick={() => applyColor(c)} className="h-10 w-10 rounded-full border border-gray-200 shadow-sm" style={{ background: c }} aria-label={`Use ${c}`} />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">Applies to the selected element, or the background if nothing is selected.</p>
                  </>
                )}
              </div>
            )}

            {tab === 'adjust' && (
              <div className="space-y-4">
                <div>
                  <PanelTitle>Photo</PanelTitle>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => { coverBase('fill'); commit() }}>Fill canvas</Button>
                    <Button variant="outline" size="sm" onClick={() => { coverBase('fit'); commit() }}>Fit whole photo</Button>
                    <Button variant={movePhoto ? 'default' : 'outline'} size="sm" className="col-span-2" onClick={toggleMovePhoto}>
                      <Move className="mr-1.5 h-4 w-4" /> {movePhoto ? 'Done moving photo' : 'Move / crop photo'}
                    </Button>
                  </div>
                </div>
                <div>
                  <PanelTitle>Filters</PanelTitle>
                  <div className="grid grid-cols-4 gap-1.5 [&>button]:truncate">
                    {FILTER_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => applyAdjust({ ...adjust, preset: p.id }, true)}
                        className={`rounded-md border px-1 py-1.5 text-[11px] ${adjust.preset === p.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-400'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <PanelTitle>Adjust</PanelTitle>
                  <Slider label="Brightness" min={-0.5} max={0.5} step={0.01} value={adjust.brightness} onChange={(v) => applyAdjust({ ...adjust, brightness: v })} />
                  <Slider label="Contrast" min={-0.5} max={0.5} step={0.01} value={adjust.contrast} onChange={(v) => applyAdjust({ ...adjust, contrast: v })} />
                  <Slider label="Saturation" min={-1} max={1} step={0.01} value={adjust.saturation} onChange={(v) => applyAdjust({ ...adjust, saturation: v })} />
                  <Slider label="Blur" min={0} max={0.5} step={0.01} value={adjust.blur} onChange={(v) => applyAdjust({ ...adjust, blur: v })} />
                  <Button variant="ghost" size="sm" onClick={() => applyAdjust(DEFAULT_ADJUST, true)}>Reset adjustments</Button>
                </div>
                <div>
                  <PanelTitle>Background colour</PanelTitle>
                  <p className="mb-2 text-xs text-gray-500">Shows when the photo doesn&apos;t fill the canvas.</p>
                  <ColorRow
                    value={colorValue(fc()?.backgroundColor, '#ffffff')}
                    swatches={swatches}
                    onChange={(c) => {
                      const canvas = fc()
                      if (!canvas) return
                      canvas.backgroundColor = c
                      canvas.requestRenderAll()
                      commitSoon()
                      rerender()
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Centre: canvas */}
        <main ref={stageRef} className="relative order-1 flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden md:order-none"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              fc()?.discardActiveObject()
              fc()?.requestRenderAll()
            }
          }}
        >
          <div className={`shadow-xl ${status === 'ready' ? '' : 'invisible'}`}>
            <canvas ref={canvasElRef} />
          </div>
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Opening image…
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="max-w-sm text-sm text-gray-700">{errorMessage}</p>
              <Button variant="outline" onClick={onCancel}>Close</Button>
            </div>
          )}
          {notice && (
            <div className="absolute bottom-4 left-1/2 max-w-md -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-center text-sm text-white shadow-lg">{notice}</div>
          )}
        </main>

        {/* Right: properties of the selected element */}
        {active && status === 'ready' && (
          <aside className="order-2 h-[40vh] flex-shrink-0 overflow-y-auto border-t border-gray-200 bg-white p-3 md:order-none md:h-auto md:w-72 md:border-l md:border-t-0">
            <button
              onClick={() => {
                fc()?.discardActiveObject()
                fc()?.requestRenderAll()
              }}
              className="float-right rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 md:hidden"
            >
              Done
            </button>
            <SelectionPanel
              obj={active}
              swatches={swatches}
              update={update}
              setFont={setFont}
              toggleShadow={toggleShadow}
              toggleOutline={toggleOutline}
              layer={layer}
              duplicate={duplicate}
              remove={remove}
              centerOn={centerOn}
            />
          </aside>
        )}
      </div>
    </div>
  )

  return createPortal(ui, document.body)
}

// ---------------------------------------------------------------------------------------
// Selection properties

function SelectionPanel({
  obj,
  swatches,
  update,
  setFont,
  toggleShadow,
  toggleOutline,
  layer,
  duplicate,
  remove,
  centerOn,
}: {
  obj: FabricWithMeta
  swatches: string[]
  update: (props: Record<string, unknown>, opts?: { immediate?: boolean }) => void
  setFont: (family: string) => void
  toggleShadow: () => void
  toggleOutline: () => void
  layer: (a: 'forward' | 'backward' | 'front' | 'back') => void
  duplicate: () => void
  remove: () => void
  centerOn: (axis: 'h' | 'v') => void
}) {
  const isBase = obj.cfRole === 'base'
  const text = isText(obj) ? obj : null
  const shape = isShape(obj)
  const fontLabel = text ? EDITOR_FONTS.find((f) => f.family === text.fontFamily)?.label ?? 'Custom' : ''
  const u = (obj.canvas?.getWidth() ?? 1080) / (obj.canvas?.getZoom() ?? 1) / 1080

  return (
    <div className="space-y-4">
      <PanelTitle>{isBase ? 'Photo' : text ? 'Text' : shape ? 'Shape' : (obj as FabricObject) instanceof FabricImage ? 'Image' : 'Selection'}</PanelTitle>

      {text && (
        <div className="space-y-3">
          <select
            value={fontLabel}
            onChange={(e) => {
              const f = EDITOR_FONTS.find((x) => x.label === e.target.value)
              if (f) setFont(f.family)
            }}
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
            aria-label="Font"
          >
            {fontLabel === 'Custom' && <option value="Custom">Custom</option>}
            {EDITOR_FONTS.map((f) => (
              <option key={f.label} value={f.label} style={{ fontFamily: f.family }}>
                {f.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Size</label>
            <input
              type="number"
              min={8}
              max={600}
              value={Math.round((text.fontSize ?? 40) / u)}
              onChange={(e) => update({ fontSize: Math.max(8, Number(e.target.value) || 8) * u })}
              className="h-8 w-20 rounded-md border border-gray-300 px-2 text-sm"
            />
            <div className="flex-1" />
            <IconToggle active={text.fontWeight === 'bold' || Number(text.fontWeight) >= 700} onClick={() => update({ fontWeight: text.fontWeight === 'bold' ? 'normal' : 'bold' }, { immediate: true })} label="Bold"><Bold className="h-4 w-4" /></IconToggle>
            <IconToggle active={text.fontStyle === 'italic'} onClick={() => update({ fontStyle: text.fontStyle === 'italic' ? 'normal' : 'italic' }, { immediate: true })} label="Italic"><Italic className="h-4 w-4" /></IconToggle>
            <IconToggle active={!!text.underline} onClick={() => update({ underline: !text.underline }, { immediate: true })} label="Underline"><Underline className="h-4 w-4" /></IconToggle>
          </div>
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <IconToggle key={a} active={text.textAlign === a} onClick={() => update({ textAlign: a }, { immediate: true })} label={`Align ${a}`}>
                {a === 'left' ? <AlignLeft className="h-4 w-4" /> : a === 'center' ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
              </IconToggle>
            ))}
            <div className="flex-1" />
            <button onClick={() => update({ text: (text.text ?? '').toUpperCase() }, { immediate: true })} className="rounded-md border border-gray-200 px-2 text-xs hover:bg-gray-50">AA</button>
          </div>
          <div>
            <SubLabel>Text colour</SubLabel>
            <ColorRow value={colorValue(text.fill, '#ffffff')} swatches={swatches} onChange={(c) => update({ fill: c })} />
          </div>
          <div>
            <SubLabel>Highlight</SubLabel>
            <ColorRow value={colorValue(text.backgroundColor, '#000000')} swatches={swatches} onChange={(c) => update({ backgroundColor: c })} onClear={() => update({ backgroundColor: '' }, { immediate: true })} cleared={!text.backgroundColor} />
          </div>
          <Slider label="Letter spacing" min={-100} max={800} step={10} value={text.charSpacing ?? 0} onChange={(v) => update({ charSpacing: v })} />
          <Slider label="Line height" min={0.7} max={2.5} step={0.05} value={text.lineHeight ?? 1.16} onChange={(v) => update({ lineHeight: v })} />
          <div className="flex gap-2">
            <Button variant={obj.shadow ? 'default' : 'outline'} size="sm" className="flex-1" onClick={toggleShadow}>Shadow</Button>
            <Button variant={obj.stroke ? 'default' : 'outline'} size="sm" className="flex-1" onClick={toggleOutline}>Outline</Button>
          </div>
          {!!obj.stroke && (
            <div>
              <SubLabel>Outline colour</SubLabel>
              <ColorRow value={colorValue(obj.stroke, '#000000')} swatches={swatches} onChange={(c) => update({ stroke: c })} />
            </div>
          )}
        </div>
      )}

      {shape && (
        <div className="space-y-3">
          {typeof obj.fill === 'string' && (
            <div>
              <SubLabel>Fill</SubLabel>
              <ColorRow value={colorValue(obj.fill, '#3b82f6')} swatches={swatches} onChange={(c) => update({ fill: c })} />
            </div>
          )}
          <div>
            <SubLabel>Border</SubLabel>
            <ColorRow
              value={colorValue(obj.stroke, '#ffffff')}
              swatches={swatches}
              onChange={(c) => update({ stroke: c, strokeWidth: obj.strokeWidth || 6 * u, strokeUniform: true })}
              onClear={() => update({ stroke: null, strokeWidth: 0 }, { immediate: true })}
              cleared={!obj.stroke}
            />
          </div>
          {!!obj.stroke && <Slider label="Border width" min={1} max={60} step={1} value={Math.round((obj.strokeWidth ?? 0) / u)} onChange={(v) => update({ strokeWidth: v * u })} />}
          {obj instanceof Rect && (
            <Slider label="Corner radius" min={0} max={300} step={1} value={Math.round((obj.rx ?? 0) / u)} onChange={(v) => update({ rx: v * u, ry: v * u })} />
          )}
        </div>
      )}

      {(obj instanceof FabricImage || isBase) && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => update({ flipX: !obj.flipX }, { immediate: true })}><FlipHorizontal className="mr-1 h-4 w-4" /> Flip</Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => update({ flipY: !obj.flipY }, { immediate: true })}><FlipVertical className="mr-1 h-4 w-4" /> Flip</Button>
        </div>
      )}

      {!isBase && (
        <>
          <Slider label="Transparency" min={0} max={1} step={0.01} value={obj.opacity ?? 1} onChange={(v) => update({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <div>
            <SubLabel>Position</SubLabel>
            <div className="grid grid-cols-3 gap-1.5">
              <PropButton onClick={() => centerOn('h')} label="Centre"><AlignCenterVertical className="h-4 w-4" /></PropButton>
              <PropButton onClick={() => centerOn('v')} label="Middle"><AlignCenterHorizontal className="h-4 w-4" /></PropButton>
              <PropButton onClick={duplicate} label="Duplicate"><Copy className="h-4 w-4" /></PropButton>
              <PropButton onClick={() => layer('forward')} label="Forward"><ArrowUp className="h-4 w-4" /></PropButton>
              <PropButton onClick={() => layer('backward')} label="Backward"><ArrowDown className="h-4 w-4" /></PropButton>
              <PropButton onClick={() => layer('front')} label="To front"><ChevronsUp className="h-4 w-4" /></PropButton>
              <PropButton onClick={() => layer('back')} label="To back"><ChevronsDown className="h-4 w-4" /></PropButton>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full text-red-600 hover:bg-red-50 hover:text-red-700" onClick={remove}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------
// Small UI pieces

function PanelTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}>{children}</h3>
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs text-gray-500">{children}</div>
}

function ToolTile({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="group flex flex-col gap-1 text-left">
      <div className="flex h-20 w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-[linear-gradient(135deg,#93c5fd,#c4b5fd)] p-1.5 group-hover:border-blue-400">{children}</div>
      <span className="text-xs text-gray-600">{label}</span>
    </button>
  )
}

function ShapeButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="flex aspect-square items-center justify-center rounded-lg border border-gray-200 hover:border-blue-400">
      {children}
    </button>
  )
}

function PropButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 rounded-md border border-gray-200 py-1.5 text-[10px] text-gray-600 hover:bg-gray-50">
      {children}
      {label}
    </button>
  )
}

function IconToggle({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md border ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="tabular-nums">{format ? format(value) : Number.isInteger(step) ? value : value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-blue-600" />
    </label>
  )
}

function ColorRow({
  value,
  swatches,
  onChange,
  onClear,
  cleared,
}: {
  value: string
  swatches: string[]
  onChange: (c: string) => void
  onClear?: () => void
  cleared?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {onClear && (
        <button
          onClick={onClear}
          aria-label="None"
          title="None"
          className={`h-6 w-6 rounded-full border bg-[linear-gradient(45deg,transparent_45%,#ef4444_45%,#ef4444_55%,transparent_55%)] ${cleared ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-gray-300'}`}
        />
      )}
      {swatches.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={c}
          className={`h-6 w-6 rounded-full border border-gray-300 ${!cleared && value.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
          style={{ background: c }}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-gray-300 bg-white p-0" aria-label="Custom colour" />
    </div>
  )
}
