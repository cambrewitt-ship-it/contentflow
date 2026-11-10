'use client'

import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AtSign, Hash, Loader2, Settings2, Sparkles } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { accountInsertText, extractHashtags, type CaptionAccount, type HashtagSet } from '@/lib/captionLibrary'
import { caretCoordinates } from './caretPosition'
import { CaptionLibraryDialog } from './CaptionLibraryDialog'
import { suggestHashtags, useCaptionLibrary } from './useCaptionLibrary'

/**
 * Caption box with @ (accounts to tag) and # (hashtags) autocomplete for a client.
 * A drop-in for <Textarea>/<textarea>: same value/onChange, and picking a suggestion
 * edits the text like typing would (fires onChange, keeps undo).
 */

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  clientId: string | null | undefined
  /** Render a plain <textarea> (caller's classes only) instead of the styled Textarea */
  unstyled?: boolean
  wrapperClassName?: string
}

type Item =
  | { type: 'account'; key: string; account: CaptionAccount }
  | { type: 'handle'; key: string; handle: string; count: number }
  | { type: 'set'; key: string; set: HashtagSet }
  | { type: 'tag'; key: string; tag: string; note: string }
  | { type: 'ai'; key: string }
  | { type: 'manage'; key: string }

const INSERTABLE = new Set<Item['type']>(['account', 'handle', 'set', 'tag'])
const MENU_WIDTH = 300
const MENU_MAX_HEIGHT = 320

// "@que" / "#que" right before the caret, at the start or after a non-word character
const TRIGGER_RE = /(^|[^\p{L}\p{N}_@#&.])([@#])([\p{L}\p{N}._']{0,50})$/u

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** 3 = starts with, 2 = a word starts with, 1 = contains, 0 = no match */
function matchScore(values: Array<string | null | undefined>, query: string): number {
  const q = norm(query)
  if (!q) return 1
  let best = 0
  for (const v of values) {
    if (!v) continue
    const n = norm(v)
    if (n.startsWith(q)) return 3
    if (v.toLowerCase().split(/[\s._-]+/).some((w) => norm(w).startsWith(q))) best = Math.max(best, 2)
    else if (n.includes(q)) best = Math.max(best, 1)
  }
  return best
}

/** Replace [start, end) with text the way typing would: fires input/onChange and keeps undo. */
function replaceRange(el: HTMLTextAreaElement, start: number, end: number, text: string) {
  el.focus()
  el.setSelectionRange(start, end)
  let ok = false
  try {
    ok = document.execCommand('insertText', false, text)
  } catch {
    ok = false
  }
  if (!ok || el.value.slice(start, start + text.length) !== text) {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setValue?.call(el, el.value.slice(0, start) + text + el.value.slice(end))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.setSelectionRange(start + text.length, start + text.length)
  }
}

export const CaptionTextarea = forwardRef<HTMLTextAreaElement, Props>(function CaptionTextarea(
  { clientId, unstyled, wrapperClassName, onChange, onKeyDown, onBlur, onClick, onKeyUp, ...rest },
  forwardedRef
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) forwardedRef.current = el
    },
    [forwardedRef]
  )

  const library = useCaptionLibrary(clientId)
  const [query, setQuery] = useState<{ trigger: '@' | '#'; text: string; start: number } | null>(null)
  const queryRef = useRef(query)
  queryRef.current = query
  const [dismissedStart, setDismissedStart] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<React.CSSProperties>({})
  const [aiTags, setAiTags] = useState<string[] | null>(null)
  const [aiState, setAiState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null })
  const [manageOpen, setManageOpen] = useState(false)

  const updateQuery = useCallback(
    (el: HTMLTextAreaElement) => {
      const caret = el.selectionStart ?? el.value.length
      if (el.selectionEnd !== caret) {
        setQuery(null)
        return
      }
      const match = TRIGGER_RE.exec(el.value.slice(0, caret))
      if (!match) {
        setQuery(null)
        setDismissedStart(null)
        return
      }
      const next = { trigger: match[2] as '@' | '#', text: match[3], start: caret - match[3].length - 1 }
      const prev = queryRef.current
      if (prev?.start !== next.start || prev.trigger !== next.trigger || prev.text !== next.text) {
        setActiveIndex(0)
        setQuery(next)
      }
    },
    []
  )

  const data = library.data
  const caption = typeof rest.value === 'string' ? rest.value : ''

  const items = useMemo<Item[]>(() => {
    if (!query) return []
    const q = query.text
    const out: Item[] = []

    if (query.trigger === '@') {
      const accounts = (data?.accounts ?? [])
        .map((account) => ({ account, score: matchScore([account.name, account.instagram, account.facebook], q) }))
        .filter((a) => a.score > 0)
        .sort((a, b) => b.score - a.score || a.account.name.localeCompare(b.account.name))
        .slice(0, 6)
      accounts.forEach(({ account }) => out.push({ type: 'account', key: `a:${account.id}`, account }))

      const saved = new Set((data?.accounts ?? []).map((a) => a.instagram).filter(Boolean))
      ;(data?.usedHandles ?? [])
        .filter((h) => !saved.has(h.value))
        .map((h) => ({ h, score: matchScore([h.value], q) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || b.h.count - a.h.count)
        .slice(0, Math.max(0, 8 - out.length))
        .forEach(({ h }) => out.push({ type: 'handle', key: `h:${h.value}`, handle: h.value, count: h.count }))

    } else {
      // Tags already in the caption (apart from the one being typed) aren't suggested again
      const present = new Set(
        extractHashtags(caption.slice(0, query.start) + ' ' + caption.slice(query.start + 1 + q.length)).map((t) =>
          t.toLowerCase()
        )
      )
      ;(data?.hashtagSets ?? [])
        .filter((s) => s.tags.length > 0 && (!q || matchScore([s.name], q) > 0))
        .slice(0, 3)
        .forEach((set) => out.push({ type: 'set', key: `set:${set.id}`, set }))

      const pool: Array<{ tag: string; note: string }> = []
      for (const t of aiTags ?? []) pool.push({ tag: t, note: 'AI pick' })
      for (const t of data?.usedHashtags ?? []) pool.push({ tag: t.value, note: `used ${t.count}×` })
      for (const s of data?.hashtagSets ?? []) for (const t of s.tags) pool.push({ tag: t, note: s.name })
      const seen = new Set<string>()
      pool
        .filter(({ tag }) => {
          const key = tag.toLowerCase()
          if (seen.has(key) || present.has(key)) return false
          seen.add(key)
          return true
        })
        .map((p, i) => ({ ...p, i, score: matchScore([p.tag], q) }))
        .filter((p) => p.score > 0)
        .sort((a, b) => b.score - a.score || a.i - b.i)
        .slice(0, 8)
        .forEach((p) => out.push({ type: 'tag', key: `t:${p.tag}`, tag: p.tag, note: p.note }))

      if (aiTags === null) out.push({ type: 'ai', key: 'ai' })
    }

    out.push({ type: 'manage', key: 'manage' })
    return out
  }, [query, data, aiTags, caption])

  const open = !!clientId && query !== null && query.start !== dismissedStart && items.length > 0

  // Keep the active row in range as the list changes
  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(0)
  }, [items.length, activeIndex])

  // Put the menu under (or above, near the bottom of the screen) the @/# being typed
  useLayoutEffect(() => {
    const el = textareaRef.current
    const wrapper = wrapperRef.current
    if (!open || !el || !wrapper || !query) return
    const caret = caretCoordinates(el, query.start)
    const caretTop = Math.min(Math.max(caret.top, 0), el.clientHeight - caret.height)
    const rect = el.getBoundingClientRect()
    const caretViewportY = rect.top + caretTop
    const left = Math.max(0, Math.min(el.offsetLeft + caret.left, wrapper.clientWidth - MENU_WIDTH))
    const placeAbove = caretViewportY + caret.height + MENU_MAX_HEIGHT > window.innerHeight && caretViewportY > MENU_MAX_HEIGHT
    setPosition(
      placeAbove
        ? { left, bottom: wrapper.clientHeight - (el.offsetTop + caretTop) + 4 }
        : { left, top: el.offsetTop + caretTop + caret.height + 4 }
    )
  }, [open, query, caption])

  const replaceQuery = (text: string) => {
    const el = textareaRef.current
    if (!el || !query) return
    const end = query.start + 1 + query.text.length
    const nextChar = el.value.charAt(end)
    replaceRange(el, query.start, end, nextChar && /\s/.test(nextChar) ? text : `${text} `)
    setQuery(null)
  }

  const runAi = async () => {
    if (!clientId || aiState.loading) return
    const textWithoutQuery = query ? caption.slice(0, query.start) + caption.slice(query.start + 1 + query.text.length) : caption
    setAiState({ loading: true, error: null })
    try {
      const tags = await suggestHashtags(clientId, textWithoutQuery)
      setAiTags(tags)
      setAiState({ loading: false, error: tags.length ? null : 'No suggestions came back — try again.' })
      setActiveIndex(0)
    } catch (err) {
      setAiState({ loading: false, error: err instanceof Error ? err.message : 'Could not suggest hashtags' })
    }
  }

  const choose = (item: Item) => {
    switch (item.type) {
      case 'account':
        return replaceQuery(accountInsertText(item.account))
      case 'handle':
        return replaceQuery(`@${item.handle}`)
      case 'tag':
        return replaceQuery(`#${item.tag}`)
      case 'set': {
        const present = new Set(extractHashtags(caption).map((t) => t.toLowerCase()))
        const tags = item.set.tags.filter((t) => !present.has(t.toLowerCase()))
        return replaceQuery(tags.map((t) => `#${t}`).join(' ') || '')
      }
      case 'ai':
        return void runAi()
      case 'manage':
        setQuery(null)
        return setManageOpen(true)
    }
  }

  // Captions change when a different post is opened in the same box: forget AI picks
  const lastLength = useRef(caption.length)
  useEffect(() => {
    if (Math.abs(caption.length - lastLength.current) > 200) setAiTags(null)
    lastLength.current = caption.length
  }, [caption])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % items.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + items.length) % items.length)
        return
      }
      const active = items[activeIndex]
      // Enter/Tab only insert suggestions — never trigger an action (or spend an AI credit) by accident
      if (
        active &&
        INSERTABLE.has(active.type) &&
        ((e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) || (e.key === 'Tab' && !e.shiftKey))
      ) {
        e.preventDefault()
        choose(active)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setDismissedStart(query?.start ?? null)
        return
      }
    }
    onKeyDown?.(e)
  }

  const sharedProps = {
    ...rest,
    ref: setRefs,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e)
      updateQuery(e.target)
    },
    onKeyDown: handleKeyDown,
    onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) updateQuery(e.currentTarget)
      onKeyUp?.(e)
    },
    onClick: (e: React.MouseEvent<HTMLTextAreaElement>) => {
      updateQuery(e.currentTarget)
      onClick?.(e)
    },
    onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => {
      // Let a click on a menu row land first
      setTimeout(() => setQuery(null), 150)
      onBlur?.(e)
    },
    'aria-autocomplete': 'list' as const,
    'aria-expanded': open,
  }

  return (
    <div ref={wrapperRef} className={cn('relative w-full', wrapperClassName)}>
      {unstyled ? <textarea {...sharedProps} /> : <Textarea {...sharedProps} />}

      {open && (
        <div
          role="listbox"
          style={{ ...position, width: MENU_WIDTH, maxHeight: MENU_MAX_HEIGHT }}
          className="absolute z-[60] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 text-left shadow-xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {query?.trigger === '@' ? 'Tag an account' : 'Hashtags'}
            {library.loading && !data && <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin" />}
          </p>
          {items.map((item, i) => (
            <MenuRow
              key={item.key}
              item={item}
              active={i === activeIndex}
              aiState={aiState}
              onHover={() => setActiveIndex(i)}
              onChoose={() => choose(item)}
            />
          ))}
          {query?.trigger === '@' && !items.some((i) => i.type === 'account' || i.type === 'handle') && (
            <p className="px-3 py-1.5 text-xs text-gray-500">
              {query.text ? 'No saved account matches.' : 'No saved accounts yet.'} Instagram can&apos;t be searched —
              type the exact @handle. It&apos;s saved automatically once it&apos;s in a saved caption.
            </p>
          )}
          {aiState.error && query?.trigger === '#' && (
            <p className="px-3 py-1.5 text-xs text-red-600">{aiState.error}</p>
          )}
        </div>
      )}

      {manageOpen && clientId && (
        <CaptionLibraryDialog clientId={clientId} open={manageOpen} onOpenChange={setManageOpen} />
      )}
    </div>
  )
})

function MenuRow({
  item,
  active,
  aiState,
  onHover,
  onChoose,
}: {
  item: Item
  active: boolean
  aiState: { loading: boolean; error: string | null }
  onHover: () => void
  onChoose: () => void
}) {
  const base = cn(
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
    active ? 'bg-blue-50' : 'hover:bg-gray-50'
  )
  const props = {
    type: 'button' as const,
    role: 'option',
    'aria-selected': active,
    onMouseEnter: onHover,
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault()
      onChoose()
    },
  }

  switch (item.type) {
    case 'account': {
      const { account } = item
      return (
        <button {...props} className={base}>
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-orange-400 text-[11px] font-semibold text-white">
            {account.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-gray-900">{account.name}</span>
            <span className="block truncate text-[11px] text-gray-500">
              {[account.instagram && `@${account.instagram}`, account.facebook && `FB: ${account.facebook}`]
                .filter(Boolean)
                .join(' · ') || 'No handle saved'}
            </span>
          </span>
        </button>
      )
    }
    case 'handle':
      return (
        <button {...props} className={base}>
          <AtSign className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span className="min-w-0 flex-1 truncate text-gray-900">{item.handle}</span>
          <span className="text-[10px] text-gray-400">used {item.count}×</span>
        </button>
      )
    case 'set':
      return (
        <button {...props} className={base}>
          <Hash className="h-4 w-4 flex-shrink-0 text-blue-500" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-gray-900">{item.set.name}</span>
            <span className="block truncate text-[11px] text-gray-500">
              {item.set.tags.map((t) => `#${t}`).join(' ')}
            </span>
          </span>
          <span className="text-[10px] text-gray-400">set · {item.set.tags.length}</span>
        </button>
      )
    case 'tag':
      return (
        <button {...props} className={base}>
          <Hash className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span className="min-w-0 flex-1 truncate text-gray-900">{item.tag}</span>
          <span className="max-w-[90px] truncate text-[10px] text-gray-400">{item.note}</span>
        </button>
      )
    case 'ai':
      return (
        <button {...props} className={cn(base, 'border-t border-gray-100 text-violet-700')} disabled={aiState.loading}>
          {aiState.loading ? (
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">
            {aiState.loading ? 'Finding hashtags…' : 'Suggest hashtags for this caption'}
          </span>
          {!aiState.loading && <span className="text-[10px] text-violet-400">1 credit</span>}
        </button>
      )
    case 'manage':
      return (
        <button {...props} className={cn(base, 'border-t border-gray-100 text-gray-600')}>
          <Settings2 className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs">Manage accounts &amp; hashtag sets</span>
        </button>
      )
  }
}
