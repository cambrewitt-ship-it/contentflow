import localFont from 'next/font/local'
import type { CSSProperties } from 'react'
import { poppins, montserrat } from '@/app/fonts'

// Display fonts for the image editor. Self-hosted (latin subset, SIL Open Font License)
// so builds never depend on fetching Google Fonts, same as the app's own fonts.
const bebasNeue = localFont({ src: '../../app/fonts/bebas-neue-latin.woff2', weight: '400', display: 'swap' })
const anton = localFont({ src: '../../app/fonts/anton-latin.woff2', weight: '400', display: 'swap' })
const oswald = localFont({ src: '../../app/fonts/oswald-latin.woff2', weight: '300 700', display: 'swap' })
const playfair = localFont({ src: '../../app/fonts/playfair-display-latin.woff2', weight: '400 900', display: 'swap' })
const dancingScript = localFont({ src: '../../app/fonts/dancing-script-latin.woff2', weight: '400 700', display: 'swap' })
const pacifico = localFont({ src: '../../app/fonts/pacifico-latin.woff2', weight: '400', display: 'swap' })

export interface EditorFont {
  label: string
  family: string
}

export const EDITOR_FONTS: EditorFont[] = [
  { label: 'Poppins', family: poppins.style.fontFamily },
  { label: 'Montserrat', family: montserrat.style.fontFamily },
  { label: 'Bebas Neue', family: bebasNeue.style.fontFamily },
  { label: 'Anton', family: anton.style.fontFamily },
  { label: 'Oswald', family: oswald.style.fontFamily },
  { label: 'Playfair Display', family: playfair.style.fontFamily },
  { label: 'Dancing Script', family: dancingScript.style.fontFamily },
  { label: 'Pacifico', family: pacifico.style.fontFamily },
  { label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', family: 'Georgia, serif' },
]

/** Props that make an element preview a font (overrides the app-wide font rule). */
export const fontPreview = (family: string) => ({
  'data-font-preview': '',
  style: { ['--font-preview' as string]: family } as CSSProperties,
})

export const fontByLabel = (label: string) => EDITOR_FONTS.find((f) => f.label === label) ?? EDITOR_FONTS[0]

// Canvas text only renders in a web font once the browser has loaded it, and fonts that
// aren't used in the DOM are never loaded on their own — so load before drawing.
export async function ensureFontLoaded(family: string, weight: string | number = 400) {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([
      document.fonts.load(`${weight} 40px ${family}`),
      document.fonts.load(`italic ${weight} 40px ${family}`),
    ])
  } catch {
    // Fall back to whatever the browser has; the text still renders.
  }
}

export async function ensureAllFontsLoaded() {
  await Promise.all(EDITOR_FONTS.flatMap((f) => [ensureFontLoaded(f.family, 400), ensureFontLoaded(f.family, 700)]))
}
