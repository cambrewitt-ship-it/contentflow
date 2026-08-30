'use client';

import { useEffect, useState } from 'react';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WeekDayChooser } from '@/components/WeekDayChooser';

interface QuickScheduleDayTimePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: Date;
  imageUrl?: string;
  showTimeField?: boolean;
  onConfirm: (dateKey: string, time: string) => void;
  isSubmitting?: boolean;
}

export function QuickScheduleDayTimePicker({
  open,
  onOpenChange,
  weekStart,
  imageUrl,
  showTimeField = true,
  onConfirm,
  isSubmitting = false,
}: QuickScheduleDayTimePickerProps) {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState('12:00');

  useEffect(() => {
    if (open) {
      setSelectedDateKey(null);
      setSelectedTime('12:00');
    }
  }, [open]);

  const canConfirm = !!selectedDateKey && (!showTimeField || !!selectedTime);

  const handleConfirm = () => {
    if (!canConfirm || !selectedDateKey) return;
    onConfirm(selectedDateKey, showTimeField ? selectedTime : '12:00');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule this post
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {imageUrl && (
            <div className="w-full max-h-80 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="max-w-full max-h-80 w-auto h-auto object-contain" />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Day</label>
            <WeekDayChooser
              weekStart={weekStart}
              selectedDateKey={selectedDateKey}
              onSelect={setSelectedDateKey}
              disabled={isSubmitting}
            />
          </div>

          {showTimeField && (
            <div className="space-y-2">
              <label htmlFor="quickScheduleTime" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time
              </label>
              <Input
                id="quickScheduleTime"
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Schedule'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
