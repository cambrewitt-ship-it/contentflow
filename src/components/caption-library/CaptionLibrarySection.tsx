'use client'

import { AtSign } from 'lucide-react'
import { CaptionLibraryManager } from './CaptionLibraryManager'

// The client's accounts to tag and hashtag sets, on their dashboard.
export default function CaptionLibrarySection({ clientId }: { clientId: string }) {
  return (
    <div id="accounts-hashtags" className="scroll-mt-24">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-orange-400 text-white">
          <AtSign className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-gray-900">Accounts &amp; Hashtags</h3>
          <p className="mt-1 text-sm text-gray-600">
            Accounts this client tags and the hashtags they use. Type @ or # in any caption to pick from them.
          </p>
        </div>
      </div>
      <CaptionLibraryManager clientId={clientId} />
    </div>
  )
}
