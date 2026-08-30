'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WeekDayChooser } from '@/components/WeekDayChooser';
import { Loader2, Upload as UploadIcon } from 'lucide-react';

interface QueueUpload {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  notes?: string | null;
}

interface PortalQuickAddModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
  weekStart: Date;
  clientUploads: QueueUpload[];
  onScheduled: () => void;
}

export function PortalQuickAddModal({ open, onClose, token, weekStart, clientUploads, onScheduled }: PortalQuickAddModalProps) {
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState('12:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setSelectedUploadId(null);
    setNewFile(null);
    setNotes('');
    setSelectedDateKey(null);
    setSelectedTime('12:00');
    setError(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const canSubmit = (!!selectedUploadId || !!newFile) && !!selectedDateKey && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedDateKey) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (newFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(newFile);
        });
        const response = await fetch('/api/portal/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            fileName: newFile.name,
            fileType: newFile.type,
            fileSize: newFile.size,
            fileUrl: base64,
            notes: notes || '',
            targetDate: selectedDateKey,
            targetTime: `${selectedTime}:00`,
          }),
        });
        if (!response.ok) throw new Error('Failed to upload photo');
      } else if (selectedUploadId) {
        const response = await fetch('/api/portal/upload', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            uploadId: selectedUploadId,
            targetDate: selectedDateKey,
            targetTime: `${selectedTime}:00`,
            ...(notes ? { notes } : {}),
          }),
        });
        if (!response.ok) throw new Error('Failed to schedule photo');
      }
      onScheduled();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule photo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to calendar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {clientUploads.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">From your queue</p>
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {clientUploads.map((upload) => (
                  <button
                    key={upload.id}
                    type="button"
                    onClick={() => { setSelectedUploadId(upload.id); setNewFile(null); }}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedUploadId === upload.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {upload.file_type?.startsWith('video/') ? (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
                        Video
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={upload.file_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Or upload a new photo</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setNewFile(file); setSelectedUploadId(null); }
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <UploadIcon className="w-3.5 h-3.5" />
              {newFile ? newFile.name : 'Choose file'}
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes (optional)</p>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Day</p>
            <WeekDayChooser weekStart={weekStart} selectedDateKey={selectedDateKey} onSelect={setSelectedDateKey} disabled={isSubmitting} />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Time</p>
            <Input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              disabled={isSubmitting}
              className="w-32 text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-200">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to calendar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
