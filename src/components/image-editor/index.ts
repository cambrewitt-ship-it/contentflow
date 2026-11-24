import dynamic from 'next/dynamic'

// Canva-style image editor, loaded only when opened (Fabric.js is browser-only and large).
export const LazyImageEditor = dynamic(() => import('./ImageEditor'), { ssr: false })
export type { ImageEditorProps } from './ImageEditor'
