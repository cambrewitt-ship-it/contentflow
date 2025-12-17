'use client';

import { useState } from 'react';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  ThreadsIcon,
} from '@/components/social-icons';

export interface Platform {
  id: string;
  name: string;
  type: 'facebook' | 'instagram' | 'twitter' | 'x' | 'linkedin' | 'tiktok' | 'youtube' | 'threads';
}

interface SchedulePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (date: string, time: string, platform: Platform) => void;
  availablePlatforms: Platform[];
  isScheduling?: boolean;
}

export function SchedulePostModal({
  isOpen,
  onClose,
  onSchedule,
  availablePlatforms,
  isScheduling = false,
}: SchedulePostModalProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  const handleSchedule = () => {
    if (!selectedDate || !selectedTime || !selectedPlatform) {
      return;
    }
    onSchedule(selectedDate, selectedTime, selectedPlatform);
    // Reset form
    setSelectedDate('');
    setSelectedTime('');
    setSelectedPlatform(null);
  };

  const handleClose = () => {
    // Don't allow closing while scheduling
    if (isScheduling) return;
    // Reset form when closing
    setSelectedDate('');
    setSelectedTime('');
    setSelectedPlatform(null);
    onClose();
  };

  const getPlatformIcon = (platformType: Platform['type']) => {
    const iconProps = { size: 20, className: 'text-white' };
    switch (platformType) {
      case 'facebook':
        return <FacebookIcon {...iconProps} />;
      case 'instagram':
        return <InstagramIcon {...iconProps} />;
      case 'twitter':
      case 'x':
        return <TwitterIcon {...iconProps} />;
      case 'linkedin':
        return <LinkedInIcon {...iconProps} />;
      case 'tiktok':
        return <TikTokIcon {...iconProps} />;
      case 'youtube':
        return <YouTubeIcon {...iconProps} />;
      case 'threads':
        return <ThreadsIcon {...iconProps} />;
      default:
        return null;
    }
  };

  const getPlatformButtonStyles = (platformType: Platform['type']) => {
    switch (platformType) {
      case 'facebook':
        return 'bg-blue-600 hover:bg-blue-700';
      case 'instagram':
        return 'bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600';
      case 'twitter':
      case 'x':
        return 'bg-black hover:bg-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700';
      case 'linkedin':
        return 'bg-blue-700 hover:bg-blue-800';
      case 'tiktok':
        return 'bg-black hover:bg-gray-900';
      case 'youtube':
        return 'bg-red-600 hover:bg-red-700';
      case 'threads':
        return 'bg-black hover:bg-gray-900';
      default:
        return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  const canSchedule = selectedDate && selectedTime && selectedPlatform;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isScheduling && handleClose()}>
      <DialogContent className="max-w-md bg-white/50 backdrop-blur-md border border-white/20 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Calendar className="h-5 w-5" />
            Schedule Post
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date Selection */}
          <div className="space-y-2">
            <label htmlFor="scheduleDate" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date
            </label>
            <Input
              id="scheduleDate"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              disabled={isScheduling}
              className="bg-white/80 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <label htmlFor="scheduleTime" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time
            </label>
            <Input
              id="scheduleTime"
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              disabled={isScheduling}
              className="bg-white/80 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Platform Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">
              Select Platform
            </label>
            {availablePlatforms.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50/50 backdrop-blur-sm p-3 rounded-md border border-gray-200">
                No platforms connected. Please connect a social platform first.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availablePlatforms.map((platform) => {
                  const isSelected = selectedPlatform?.id === platform.id;
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => !isScheduling && setSelectedPlatform(platform)}
                      disabled={isScheduling}
                      className={`
                        flex items-center justify-center gap-2 px-4 py-3 rounded-md
                        transition-all duration-200
                        ${isScheduling ? 'opacity-50 cursor-not-allowed' : ''}
                        ${isSelected
                          ? `${getPlatformButtonStyles(platform.type)} text-white shadow-lg scale-[1.02]`
                          : 'bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                        }
                      `}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-white/20' : getPlatformButtonStyles(platform.type)
                      }`}>
                        {getPlatformIcon(platform.type)}
                      </div>
                      <span className="font-medium text-sm">{platform.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isScheduling}
              className="flex-1 bg-white/80 backdrop-blur-sm border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={!canSchedule || isScheduling}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Schedule Post'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
