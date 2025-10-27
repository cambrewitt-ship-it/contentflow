'use client';

import { useState } from 'react';
import { Calendar, Clock, Facebook, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePostStore } from '@/lib/store';

interface SchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  projectId: string;
  clientId: string;
  postCaption: string;
  postImageUrl: string;
}

export default function SchedulingModal({
  isOpen,
  onClose,
  postId,
  projectId,
  clientId,
  postCaption,
  postImageUrl
}: SchedulingModalProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'facebook' | 'instagram' | 'both'>('both');
  const [isScheduling, setIsScheduling] = useState(false);
  
  const schedulePost = usePostStore(state => state.schedulePost);
  
  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime) return;
    
    const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}`);
    if (scheduledDateTime <= new Date()) {
      alert('Please select a future date and time');
      return;
    }
    
    setIsScheduling(true);
    try {
      // Convert platform to account IDs array - this is a placeholder
      // In a real implementation, you'd need to get actual account IDs for the selected platform
      const accountIds = selectedPlatform === 'both' ? ['facebook_account_id', 'instagram_account_id'] : ['platform_account_id'];
      
      await schedulePost(postId, scheduledDateTime, accountIds, projectId, clientId);
      onClose();
    } catch (error) {
      console.error('Failed to schedule post:', error);
      alert('Failed to schedule post. Please try again.');
    } finally {
      setIsScheduling(false);
    }
  };
  
  const canSchedule = selectedDate && selectedTime && selectedPlatform;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Post
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Post Preview */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <img 
                  src={postImageUrl} 
                  alt="Post preview" 
                  className="w-16 h-16 object-cover rounded-md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {postCaption}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Date Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toLocaleDateString('en-CA')} // Keeps local timezone
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          
          {/* Time Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time
            </label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          
          {/* Platform Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Platform</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={selectedPlatform === 'facebook' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlatform('facebook')}
                className="flex-1"
              >
                <Facebook className="h-4 w-4 mr-2" />
                Facebook
              </Button>
              <Button
                type="button"
                variant={selectedPlatform === 'instagram' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlatform('instagram')}
                className="flex-1"
              >
                <Instagram className="h-4 w-4 mr-2" />
                Instagram
              </Button>
              <Button
                type="button"
                variant={selectedPlatform === 'both' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlatform('both')}
                className="flex-1"
              >
                Both
              </Button>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isScheduling}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={!canSchedule || isScheduling}
              className="flex-1"
            >
              {isScheduling ? 'Scheduling...' : 'Schedule Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
