'use client'

import { Palette } from 'lucide-react'
import { BrandKitManager } from './BrandKitManager'
import { useBrandKit } from './useBrandKit'

// The client's brand kit on their dashboard — everything here shows up in the Design Studio.
export default function BrandKitSection({ clientId }: { clientId: string }) {
  const brandKit = useBrandKit(clientId)
  return (
    <div id="brand-kit" className="scroll-mt-24">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-blue-600 text-white">
          <Palette className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-gray-900">Brand Kit</h3>
          <p className="mt-1 text-sm text-gray-600">
            Logos, colours, fonts and images for this client. They&apos;re one click away whenever you design a post in the
            Design Studio.
          </p>
        </div>
      </div>
      <BrandKitManager brandKit={brandKit} />
    </div>
  )
}
