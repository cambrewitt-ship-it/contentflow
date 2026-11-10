'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CaptionLibraryManager } from './CaptionLibraryManager'

// The accounts & hashtag sets manager in a dialog, opened from the @/# menu of a caption box.
export function CaptionLibraryDialog({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl"
        // Post modals close on Escape from a window listener; keep Escape for this dialog only
        onEscapeKeyDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Accounts &amp; hashtags</DialogTitle>
          <DialogDescription>What the @ and # menus suggest when writing captions for this client.</DialogDescription>
        </DialogHeader>
        <CaptionLibraryManager clientId={clientId} />
      </DialogContent>
    </Dialog>
  )
}
