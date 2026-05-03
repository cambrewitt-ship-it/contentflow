"use client";

import { useState, useEffect, useRef, useCallback, ChangeEvent, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Check, X, AlertTriangle, Minus, CheckCircle, XCircle, FileText, Calendar, Columns, Inbox, Upload, Image as ImageIcon, Film, Trash2, Sparkles, File, ListOrdered, FileDown, Link as LinkIcon, Copy, CheckCheck, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MonthViewCalendar } from '@/components/MonthViewCalendar';
import { PortalColumnViewCalendar, type PortalCalendarRef } from '@/components/PortalColumnViewCalendar';
import { PortalContentInbox } from '@/components/PortalContentInbox';
import { PortalKanbanBoard, type KanbanItem } from '@/components/PortalKanbanBoard';
import { PortalItemModal, type ModalItem } from '@/components/PortalItemModal';
import { type CalendarEvent } from '@/components/CalendarEventModal';
import { PDFExportModal } from '@/components/PDFExportModal';
import { usePortal } from '@/contexts/PortalContext';
import logger from '@/lib/logger';

// Lazy loading image component
const LazyImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {isInView && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onLoad={() => setIsLoaded(true)}
            className={`transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      )}
      {!isLoaded && isInView && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      )}
    </div>
  );
};

interface Post {
  id: string;
  project_id: string;
  caption: string;
  image_url: string;
  scheduled_time: string | null;
  scheduled_date?: string;
  late_post_id?: string;
  platforms_scheduled?: string[];
  late_status?: string;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'needs_attention' | 'draft';
  needs_attention?: boolean;
  client_feedback?: string;
  edit_count?: number;
  last_edited_at?: string;
  last_edited_by?: {
    id: string;
    name: string;
    email: string;
  };
  needs_reapproval?: boolean;
  original_caption?: string;
  status?: 'draft' | 'ready' | 'scheduled' | 'published' | 'archived' | 'deleted';
}

interface Upload {
  id: string;
  client_id: string;
  project_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  notes: string | null;
  review_notes: string | null;
  target_date?: string | null;
  created_at: string;
  updated_at: string;
}

const COLOR_OPTIONS = [
  { value: 'purple', label: 'Purple', bg: 'bg-purple-500' },
  { value: 'blue',   label: 'Blue',   bg: 'bg-blue-500' },
  { value: 'green',  label: 'Green',  bg: 'bg-green-500' },
  { value: 'red',    label: 'Red',    bg: 'bg-red-500' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-500' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-400' },
];

function PortalCalendarEventModal({
  date,
  event,
  token,
  onSave,
  onDelete,
  onClose,
}: {
  date: string;
  event?: import('@/components/CalendarEventModal').CalendarEvent | null;
  token: string;
  onSave: (event: import('@/components/CalendarEventModal').CalendarEvent) => void;
  onDelete: (eventId: string) => void;
  onClose: () => void;
}) {
  const isEditing = !!event;
  const [title, setTitle] = useState(event?.title ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [type, setType] = useState<'event' | 'note'>(event?.type ?? 'note');
  const [color, setColor] = useState(event?.color ?? 'purple');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-NZ', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const method = isEditing ? 'PATCH' : 'POST';
      const body = isEditing
        ? { token, id: event!.id, title: title.trim(), notes: notes || null, type, color }
        : { token, date, title: title.trim(), notes: notes || null, type, color };

      const res = await fetch('/api/portal/events', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      onSave(data.event);
    } catch {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm('Delete this note?')) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/portal/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, id: event.id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      onDelete(event.id);
    } catch {
      alert('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEditing ? 'Edit' : 'Add'} to Calendar
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setType('event')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${type === 'event' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              Event
            </button>
            <button type="button" onClick={() => setType('note')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${type === 'note' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              Note
            </button>
          </div>

          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={type === 'event' ? 'Event title...' : 'Note...'}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSave()}
          />

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes (optional)..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />

          {type === 'event' && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Color</p>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setColor(opt.value)}
                    className={`w-7 h-7 rounded-full ${opt.bg} transition-transform ${color === opt.value ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'}`}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 pb-5">
          <div>
            {isEditing && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40">
              {saving ? 'Saving...' : isEditing ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortalCalendarPage() {
  const params = useParams();
  const token = params?.token as string;
  const { party } = usePortal();

  // Modal state
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [scheduledPosts, setScheduledPosts] = useState<{[key: string]: Post[]}>({});
  const [uploads, setUploads] = useState<{[key: string]: Upload[]}>({});
  const [allUploads, setAllUploads] = useState<Upload[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<{[key: string]: CalendarEvent[]}>({});
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingScheduledPosts, setIsLoadingScheduledPosts] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Upload states
  const [uploading, setUploading] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [isLoadingUploads, setIsLoadingUploads] = useState(false);
  const fileInputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});
  const columnUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingColumnUploadDate, setPendingColumnUploadDate] = useState<string | null>(null);
  
  // Ref to track currently dragged queue item — avoids DataTransfer.getData() issues
  const draggingQueueItemRef = useRef<Upload | null>(null);

  // Loading state for queue-item-to-calendar drag
  const [movingUploadId, setMovingUploadId] = useState<string | null>(null);
  const [movingToDate, setMovingToDate] = useState<string | null>(null);

  // Drag and drop state for column view
  const [movingItems, setMovingItems] = useState<{[key: string]: boolean}>({});
  
  // Delete states
  const [deletingItems, setDeletingItems] = useState<{[key: string]: boolean}>({});
  const deletingUploadIds = useMemo(() => {
    const ids = new Set<string>();
    Object.entries(deletingItems).forEach(([key, value]) => {
      if (value && key.startsWith('upload-') && value) {
        ids.add(key.slice('upload-'.length));
      }
    });
    return ids;
  }, [deletingItems]);
  
  // Approval states
  const [selectedPosts, setSelectedPosts] = useState<{[key: string]: 'approved' | 'rejected' | 'needs_attention'}>({});
  const [comments, setComments] = useState<{[key: string]: string}>({});
  const [editedCaptions, setEditedCaptions] = useState<{[key: string]: string}>({});
  const [isSubmittingApprovals, setIsSubmittingApprovals] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calendar selection (for PDF / OTL / Delete toolbar)
  const [calendarSelectedPostIds, setCalendarSelectedPostIds] = useState<Set<string>>(new Set());
  const [showPDFExportModal, setShowPDFExportModal] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [generatingApprovalLink, setGeneratingApprovalLink] = useState(false);
  const [approvalLinkUrl, setApprovalLinkUrl] = useState<string | null>(null);
  const [showApprovalLinkDialog, setShowApprovalLinkDialog] = useState(false);
  const [approvalLinkCopied, setApprovalLinkCopied] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState(false);

  // Brand settings (persisted in localStorage, keyed by portal token)
  const [brandName, setBrandName] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [showBrandSettings, setShowBrandSettings] = useState(false);
  const [tempBrandName, setTempBrandName] = useState('');
  const [tempBrandLogoUrl, setTempBrandLogoUrl] = useState('');
  const brandInitializedRef = useRef(false);

  // View mode state
  const [viewMode, setViewMode] = useState<'column' | 'month' | 'kanban' | 'inbox'>('column');
  const [kanbanRefreshKey, setKanbanRefreshKey] = useState(0);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const [monthDragOverDate, setMonthDragOverDate] = useState<string | null>(null);

  // Calendar event modal state (for Note feature)
  const [portalEventModal, setPortalEventModal] = useState<{date: string; event?: CalendarEvent | null} | null>(null);

  // Inbox-specific states
  const [inboxUploading, setInboxUploading] = useState(false);
  const [inboxDragOver, setInboxDragOver] = useState(false);
  const [inboxNotes, setInboxNotes] = useState('');
  const [inboxCaptionPrompt, setInboxCaptionPrompt] = useState('');
  const [inboxTargetDate, setInboxTargetDate] = useState('');
  const [inboxUploads, setInboxUploads] = useState<Upload[]>([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const inboxFileInputRef = useRef<HTMLInputElement | null>(null);
  const portalCalendarRef = useRef<PortalCalendarRef>(null);
  
  // Client timezone for calendar display
  const [clientTimezone, setClientTimezone] = useState<string>('Pacific/Auckland');

  // Load brand settings from localStorage on mount
  useEffect(() => {
    if (!token) return;
    try {
      const stored = localStorage.getItem(`portal_brand_${token}`);
      if (stored) {
        const { name, logoUrl } = JSON.parse(stored);
        if (name !== undefined) setBrandName(name);
        if (logoUrl !== undefined) setBrandLogoUrl(logoUrl);
        brandInitializedRef.current = true;
      }
    } catch {
      // ignore
    }
  }, [token]);

  // Get start of week (Monday) in client's timezone
  const getStartOfWeek = useCallback((offset: number = 0) => {
    const today = new Date();
    const clientDate = new Date(today.toLocaleString("en-US", {timeZone: clientTimezone}));
    const monday = new Date(clientDate);
    const dayOfWeek = monday.getDay();
    const diff = monday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    monday.setDate(diff + (offset * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [clientTimezone]);

  // Calculate week offset for a given date
  const getWeekOffsetForDate = (date: Date) => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = targetStart.getTime() - todayStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Calculate week offset (positive for future weeks, negative for past weeks)
    return Math.floor(diffDays / 7);
  };

  // Handle date click from month view
  const handleDateClick = (date: Date) => {
    const weekOffset = getWeekOffsetForDate(date);
    setWeekOffset(weekOffset);
    setViewMode('column');
  };

  const fetchScheduledPosts = useCallback(async (retryCount = 0, forceRefresh = false) => {
    if (!token) return;
    
    // Check cache first (unless force refresh)
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime < 30000 && Object.keys(scheduledPosts).length > 0) {
      logger.debug('📦 Using cached scheduled posts data');
      return;
    }
    
    const maxRetries = 1;
    const baseLimit = 20;
    
    try {
      if (retryCount === 0) {
        setIsLoadingScheduledPosts(true);
      setError(null);
      }
      logger.debug(`🔍 FETCHING - Scheduled posts for portal (attempt ${retryCount + 1})`);
      
      // Calculate date range for calendar views (3 weeks to support column layout)
      const weeksToFetch = 3;
      const startOfWeek = getStartOfWeek(weekOffset);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + (weeksToFetch * 7) - 1);

      const startDate = startOfWeek.toISOString().split('T')[0];
      const endDate = endOfWeek.toISOString().split('T')[0];

      const response = await fetch(
        `/api/portal/calendar?token=${encodeURIComponent(token)}&startDate=${startDate}&endDate=${endDate}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 408) {
          logger.error('⏰ Query timeout:', errorData);
          
          if (retryCount < maxRetries) {
            logger.debug(`🔄 Retrying... (attempt ${retryCount + 1})`);
            return fetchScheduledPosts(retryCount + 1);
          } else {
            setError('Query timeout - please try refreshing the page');
            setIsLoadingScheduledPosts(false);
            return;
          }
        }
        
        if (response.status === 404) {
          logger.debug('📭 No scheduled posts found for this period');
          setScheduledPosts({});
          setIsLoadingScheduledPosts(false);
          return;
        }
        
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      const postsByDate = data.posts || {};
      
      logger.debug(`✅ Retrieved posts for ${Object.keys(postsByDate).length} dates`);
      
      // Set client timezone from response (for calendar display)
      if (data.timezone) {
        setClientTimezone(data.timezone);
        logger.debug('📍 Portal using client timezone:', data.timezone);
      }

      // Seed brand defaults from client record if not yet set via localStorage
      if (!brandInitializedRef.current && data.client) {
        brandInitializedRef.current = true;
        setBrandName(data.client.name || '');
        setBrandLogoUrl(data.client.logo_url || '');
      }
      
      // The API already returns posts grouped by date, so we can use it directly
      setScheduledPosts(postsByDate);
      setCalendarEvents(data.events || {});
      setLastFetchTime(Date.now());
      setIsLoadingScheduledPosts(false);
      setRefreshKey(prev => prev + 1);
      logger.debug('Scheduled posts loaded - dates:', Object.keys(postsByDate).length);
      
    } catch (error) {
      if (retryCount === 0) {
        setIsLoadingScheduledPosts(false);
      }
      logger.error('❌ Error fetching scheduled posts:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (retryCount < maxRetries && errorMessage.includes('fetch')) {
        logger.debug(`🔄 Network error, retrying... (attempt ${retryCount + 1})`);
        setTimeout(() => fetchScheduledPosts(retryCount + 1), 2000);
        return;
      }
      
      setError(`Failed to load scheduled posts: ${errorMessage}`);
      setIsLoadingScheduledPosts(false);
    }
  }, [token, weekOffset]); // Remove problematic dependencies that cause infinite loops

  // Fetch uploads for the current date range
  const fetchUploads = useCallback(async () => {
    if (!token || isLoadingUploads) return; // Prevent multiple simultaneous calls
    
    setIsLoadingUploads(true);
    try {
      const response = await fetch(`/api/portal/upload?token=${encodeURIComponent(token)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch uploads');
      }

      const data = await response.json();
      const uploadsList = data.uploads || [];
      
      // Group uploads by target_date — only include on calendar if explicitly placed there
      const uploadsByDate: {[key: string]: Upload[]} = {};
      uploadsList.forEach((upload: Upload) => {
        if (!upload.target_date) return; // queue-only items stay out of the calendar
        if (!uploadsByDate[upload.target_date]) {
          uploadsByDate[upload.target_date] = [];
        }
        uploadsByDate[upload.target_date].push(upload);
      });
      
      setUploads(uploadsByDate);
      setAllUploads(uploadsList);
    } catch (err) {
      logger.error('Error fetching uploads:', err);
    } finally {
      setIsLoadingUploads(false);
    }
  }, [token, isLoadingUploads]);

  // Handle file upload
  const handleFileUpload = async (files: FileList, targetDate: string) => {
    if (files.length === 0) return;

    setUploading(true);
    logger.debug(`📤 Uploading files to date: ${targetDate}`);

    try {
      for (const file of Array.from(files)) {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Upload to portal
        const response = await fetch('/api/portal/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileUrl: base64,
            notes: '',
            targetDate: targetDate // Pass the target date
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }

      // Refresh uploads list
      await fetchUploads();
    } catch (err) {
      logger.error('Error uploading files:', err);
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleColumnAddUpload = (dateKey: string) => {
    setPendingColumnUploadDate(dateKey);
    if (columnUploadInputRef.current) {
      columnUploadInputRef.current.value = '';
    }
    requestAnimationFrame(() => {
      columnUploadInputRef.current?.click();
    });
  };

  const handleColumnUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const targetDate = pendingColumnUploadDate;

    if (!files || files.length === 0 || !targetDate) {
      setPendingColumnUploadDate(null);
      event.target.value = '';
      return;
    }

    try {
      await handleFileUpload(files, targetDate);
    } finally {
      setPendingColumnUploadDate(null);
      event.target.value = '';
    }
  };

  // Handle notes editing
  const handleEditNotes = (uploadId: string, currentNotes: string) => {
    setEditingNotes(uploadId);
    setTempNotes(currentNotes || '');
  };

  const handleSaveNotes = async (uploadId: string) => {
    try {
      const response = await fetch('/api/portal/upload', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          uploadId,
          notes: tempNotes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update notes');
      }

      // Update local state
      setUploads(prev => {
        const newUploads = { ...prev };
        Object.keys(newUploads).forEach(date => {
          newUploads[date] = newUploads[date].map(upload => 
            upload.id === uploadId 
              ? { ...upload, notes: tempNotes }
              : upload
          );
        });
        return newUploads;
      });

      setEditingNotes(null);
      setTempNotes('');
    } catch (err) {
      logger.error('Error updating notes:', err);
      alert('Failed to update notes');
    }
  };

  const handleCancelEdit = () => {
    setEditingNotes(null);
    setTempNotes('');
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file icon
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="h-8 w-8 text-blue-600" />;
    }
    return <File className="h-8 w-8 text-gray-600" />;
  };

  // Drag and drop handlers removed with week view; column view handles its own interactions

  // Delete handlers
  const handleDeleteUpload = async (uploadId: string, uploadDate: string) => {
    if (!confirm('Are you sure you want to delete this upload? This action cannot be undone.')) {
      return;
    }

    const itemKey = `upload-${uploadId}`;
    setDeletingItems(prev => ({ ...prev, [itemKey]: true }));

    try {
      const response = await fetch('/api/portal/upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          uploadId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete upload');
      }

      // Remove from local state
      setUploads(prev => {
        const newUploads = { ...prev };
        if (newUploads[uploadDate]) {
          newUploads[uploadDate] = newUploads[uploadDate].filter(upload => upload.id !== uploadId);
          if (newUploads[uploadDate].length === 0) {
            delete newUploads[uploadDate];
          }
        }
        return newUploads;
      });
    } catch (err) {
      logger.error('Error deleting upload:', err);
      alert('Failed to delete upload. Please try again.');
    } finally {
      setDeletingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  const handleDeleteUploadFromCalendar = (upload: Upload) => {
    const existingEntry = Object.entries(uploads).find(([, items]) =>
      items.some(item => item.id === upload.id)
    );
    const uploadDateKey =
      existingEntry?.[0] ||
      (upload.created_at ? new Date(upload.created_at).toLocaleDateString('en-CA') : null);

    if (!uploadDateKey) {
      logger.warn('Unable to determine upload date for deletion', upload);
      return;
    }

    void handleDeleteUpload(upload.id, uploadDateKey);
  };

  // Inbox: fetch all uploads as a flat list
  const fetchInboxUploads = useCallback(async () => {
    if (!token) return;
    setIsLoadingInbox(true);
    setInboxError(null);
    try {
      const response = await fetch(`/api/portal/upload?token=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error('Failed to fetch uploads');
      const data = await response.json();
      setInboxUploads(data.uploads || []);
    } catch (err) {
      logger.error('Error fetching inbox uploads:', err);
      setInboxError('Failed to load uploads');
    } finally {
      setIsLoadingInbox(false);
    }
  }, [token]);

  // Inbox: handle file upload(s) with notes + caption prompt attached
  const handleInboxUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setInboxUploading(true);
    try {
      for (const file of fileArray) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Combine notes + caption prompt into the notes field
        const combinedNotes = [
          inboxNotes.trim() ? `Notes: ${inboxNotes.trim()}` : '',
          inboxCaptionPrompt.trim() ? `Caption Brief: ${inboxCaptionPrompt.trim()}` : '',
        ].filter(Boolean).join('\n\n') || null;

        const response = await fetch('/api/portal/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileUrl: base64,
            notes: combinedNotes,
            targetDate: inboxTargetDate || null,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `Failed to upload ${file.name}`);
        }
      }
      // Clear form, refresh list
      setInboxNotes('');
      setInboxCaptionPrompt('');
      setInboxTargetDate('');
      await fetchInboxUploads();
    } catch (err) {
      logger.error('Inbox upload error:', err);
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setInboxUploading(false);
    }
  };

  const handleInboxDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setInboxDragOver(true);
  };

  const handleInboxDragLeave = () => setInboxDragOver(false);

  const handleInboxDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setInboxDragOver(false);
    await handleInboxUpload(e.dataTransfer.files);
  };

  // Inbox: delete an upload
  const handleInboxDelete = async (uploadId: string) => {
    if (!confirm('Delete this upload? This cannot be undone.')) return;
    try {
      const response = await fetch('/api/portal/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, uploadId }),
      });
      if (!response.ok) throw new Error('Failed to delete');
      setInboxUploads(prev => prev.filter(u => u.id !== uploadId));
    } catch (err) {
      logger.error('Error deleting inbox upload:', err);
      alert('Failed to delete upload.');
    }
  };

  // Fetch inbox uploads when switching to inbox view
  useEffect(() => {
    if (viewMode === 'inbox' && token) {
      fetchInboxUploads();
    }
  }, [viewMode, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeletePost = async (postId: string, postDate: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    const itemKey = `post-${postId}`;
    setDeletingItems(prev => ({ ...prev, [itemKey]: true }));

    try {
      const response = await fetch('/api/portal/delete-post', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portal_token: token,
          post_id: postId,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      // Remove from local state
      setScheduledPosts(prev => {
        const newPosts = { ...prev };
        if (newPosts[postDate]) {
          newPosts[postDate] = newPosts[postDate].filter(post => post.id !== postId);
          if (newPosts[postDate].length === 0) {
            delete newPosts[postDate];
          }
        }
        return newPosts;
      });
    } catch (err) {
      logger.error('Error deleting post:', err);
      alert('Failed to delete post. Please try again.');
    } finally {
      setDeletingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  // Brand settings handlers
  const openBrandSettings = () => {
    setTempBrandName(brandName);
    setTempBrandLogoUrl(brandLogoUrl);
    setShowBrandSettings(true);
  };

  const saveBrandSettings = () => {
    setBrandName(tempBrandName);
    setBrandLogoUrl(tempBrandLogoUrl);
    setShowBrandSettings(false);
    try {
      localStorage.setItem(`portal_brand_${token}`, JSON.stringify({ name: tempBrandName, logoUrl: tempBrandLogoUrl }));
    } catch {
      // ignore
    }
  };

  // Calendar selection toolbar handlers
  const handleToggleCalendarPostSelection = (postId: string) => {
    setCalendarSelectedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleTagsChange = (postId: string, tags: Array<{ id: string; name: string; color: string }>) => {
    setScheduledPosts(prev => {
      const next = { ...prev };
      for (const [dateKey, posts] of Object.entries(next)) {
        const idx = posts.findIndex(p => p.id === postId);
        if (idx !== -1) {
          const updated = [...posts];
          updated[idx] = { ...updated[idx], tags };
          next[dateKey] = updated;
          break;
        }
      }
      return next;
    });
  };

  const handleCalendarExportToPDF = () => {
    if (calendarSelectedPostIds.size === 0) return;
    setShowPDFExportModal(true);
  };

  const performCalendarPDFExport = async (pdfTitle: string, pdfFileName: string) => {
    setShowPDFExportModal(false);
    setExportingPDF(true);
    try {
      const response = await fetch('/api/portal/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, postIds: Array.from(calendarSelectedPostIds), pdfTitle, pdfFileName }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to export PDF' }));
        throw new Error(err.error || 'Failed to export PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFileName.endsWith('.pdf') ? pdfFileName : `${pdfFileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleCalendarGenerateApprovalLink = async () => {
    if (calendarSelectedPostIds.size === 0) return;
    setGeneratingApprovalLink(true);
    try {
      const response = await fetch('/api/portal/approval-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, postIds: Array.from(calendarSelectedPostIds) }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to create link' }));
        throw new Error(err.error || 'Failed to create link');
      }
      const data = await response.json();
      setApprovalLinkUrl(data.share_url);
      setShowApprovalLinkDialog(true);
    } catch (error) {
      alert(`Failed to generate approval link: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGeneratingApprovalLink(false);
    }
  };

  const handleCalendarDeleteSelectedPosts = async () => {
    if (calendarSelectedPostIds.size === 0) return;
    setPendingDeleteConfirm(false);
    setIsDeletingSelected(true);
    try {
      const idsToDelete = new Set(calendarSelectedPostIds);
      const results = await Promise.allSettled(
        Array.from(idsToDelete).map(postId =>
          fetch('/api/calendar/scheduled', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId }),
          })
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<Response>).value.ok);
      if (succeeded.length > 0) {
        setScheduledPosts(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(date => {
            updated[date] = updated[date].filter(p => !idsToDelete.has(p.id));
            if (updated[date].length === 0) delete updated[date];
          });
          return updated;
        });
        setCalendarSelectedPostIds(new Set());
        // Close modal if it was showing a deleted post
        setModalItem(prev => {
          if (prev?.type === 'post' && idsToDelete.has(prev.data.id)) return null;
          return prev;
        });
      }
      const failed = results.length - succeeded.length;
      if (failed > 0) logger.error(`Failed to delete ${failed} post(s)`);
    } catch (err) {
      logger.error('Error deleting posts:', err);
    } finally {
      setIsDeletingSelected(false);
    }
  };

  // Approval handlers
  const handlePostSelection = (postKey: string, status: 'approved' | 'rejected' | 'needs_attention' | null) => {
    setSelectedPosts(prev => {
      const newSelected = { ...prev };
      if (status === null) {
        delete newSelected[postKey];
      } else {
        newSelected[postKey] = status;
      }
      return newSelected;
    });
  };

  const handleCommentChange = (postKey: string, comment: string) => {
    setComments(prev => ({
      ...prev,
      [postKey]: comment
    }));
  };

  const handleCaptionChange = (postKey: string, caption: string) => {
    setEditedCaptions(prev => ({
      ...prev,
      [postKey]: caption
    }));
  };

  // Portal calendar event (note) handlers
  const handlePortalEventSave = (event: CalendarEvent) => {
    setCalendarEvents(prev => {
      const updated = { ...prev };
      const dateKey = event.date;
      const existing = updated[dateKey] ?? [];
      const idx = existing.findIndex(e => e.id === event.id);
      if (idx >= 0) {
        updated[dateKey] = existing.map(e => e.id === event.id ? event : e);
      } else {
        updated[dateKey] = [...existing, event];
      }
      return updated;
    });
    setPortalEventModal(null);
  };

  const handlePortalEventDelete = (eventId: string) => {
    setCalendarEvents(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(date => {
        updated[date] = updated[date].filter(e => e.id !== eventId);
        if (updated[date].length === 0) delete updated[date];
      });
      return updated;
    });
    setPortalEventModal(null);
  };

  const handleSubmitApprovals = async () => {
    if (Object.keys(selectedPosts).length === 0) {
      alert('Please select at least one post to approve or reject');
      return;
    }

    logger.info('🚀 Starting approval submission:', selectedPosts);
    setIsSubmittingApprovals(true);
    setError(null);

    try {
      const promises = Object.entries(selectedPosts).map(async ([postKey, approvalStatus]) => {
        logger.debug(`📝 Processing post ${postKey} with status ${approvalStatus}`);
        
        // Split on the first hyphen only (UUIDs contain hyphens)
        const firstHyphenIndex = postKey.indexOf('-');
        const postId = postKey.substring(firstHyphenIndex + 1);
        
        // Portal calendar posts come from calendar_scheduled_posts table, so use 'planner_scheduled' type
        const postType = 'planner_scheduled';
        
        logger.debug(`🔍 Parsed key "${postKey}" -> postType: "${postType}", postId: "${postId}"`);
        
        const editedCaption = editedCaptions[postKey];
        const post = Object.values(scheduledPosts)
          .flat()
          .find(p => p.id === postId);
        
        if (!post) {
          logger.error(`❌ Post not found for key ${postKey}`);
          throw new Error(`Post not found for key ${postKey}`);
        }

        const hasEditedCaption = editedCaption && editedCaption !== post.caption;
        
        logger.debug(`🔄 Making API call for post ${postId}:`, {
          token: token.substring(0, 8) + '...',
          post_id: post.id,
          post_type: postType,
          approval_status: approvalStatus,
          has_comments: !!comments[postKey],
          has_edited_caption: hasEditedCaption
        });
        
        const response = await fetch('/api/portal/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            post_id: post.id,
            post_type: postType,
            approval_status: approvalStatus,
            client_comments: comments[postKey] || '',
            edited_caption: hasEditedCaption ? editedCaption : undefined
          })
        });
        
        logger.debug(`📡 API response for ${postId}:`, response.status, response.statusText);
        
        if (!response.ok) {
          const errorData = await response.json();
          logger.error(`❌ API error for ${postId}:`, errorData);
          throw new Error(errorData.error || `Failed to submit approval for post ${postId}`);
        }
        
        const result = await response.json();
        logger.debug(`✅ API success for ${postId}:`, result);
        
        return { postKey, success: true, result };
      });

      const results = await Promise.allSettled(promises);
      logger.debug('✅ Approval submission results:', results);
      
      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        logger.error('❌ Some submissions failed:', failures);
        const errorMessages = failures.map(f => f.reason?.message || 'Unknown error');
        throw new Error(`Some submissions failed: ${errorMessages.join(', ')}`);
      }
      
      const successes = results.filter(result => result.status === 'fulfilled');
      logger.debug(`✅ Successfully submitted ${successes.length} approvals`);
      
      // Clear selections and refresh data
      setSelectedPosts({});
      setComments({});
      setEditedCaptions({});
      
      logger.debug('🔄 Refreshing calendar data...');
      await fetchScheduledPosts(0, true);
      logger.debug('✅ Calendar data refreshed');
      
      // Show success message
      const count = Object.keys(selectedPosts).length;
      setSuccessMessage(`Successfully submitted ${count} approval(s)! Your feedback has been sent to the team.`);
      setTimeout(() => setSuccessMessage(null), 8000);
      
    } catch (error) {
      logger.error('Error submitting approvals:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit approvals');
    } finally {
      setIsSubmittingApprovals(false);
    }
  };

  // Debounced effect to prevent rapid API calls
  useEffect(() => {
    if (!token) return;
    
    const timeoutId = setTimeout(() => {
      fetchScheduledPosts(0, true);
      fetchUploads();
    }, 100); // Small delay to debounce rapid changes
    
    return () => clearTimeout(timeoutId);
  }, [token, weekOffset]); // Remove function dependencies to prevent infinite loops

  const getWeeksToDisplay = (count: number = 2) => {
    const weeks = [];
    for (let i = 0; i < count; i++) {
      weeks.push(getStartOfWeek(weekOffset + i));
    }
    return weeks;
  };

  // Format week commencing date as "W/C 8th Sept"
  const formatWeekCommencing = (weekStart: Date) => {
    const day = weekStart.getDate();
    const month = weekStart.toLocaleDateString('en-NZ', { month: 'short' });
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : 
                   day === 2 || day === 22 ? 'nd' : 
                   day === 3 || day === 23 ? 'rd' : 'th';
    return `W/C ${day}${suffix} ${month}`;
  };

  // Helper function to convert 24-hour time to 12-hour format
  const formatTimeTo12Hour = (time24: string) => {
    if (!time24) return '12:00 PM';
    
    // Check if time already has AM/PM
    if (time24.includes('AM') || time24.includes('PM')) {
      return time24;
    }
    
    // Handle different time formats (with or without seconds)
    const timeParts = time24.split(':');
    const hours = parseInt(timeParts[0]);
    const minutes = timeParts[1] || '00';
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleColumnPostMove = async (postKey: string, newDate: string) => {
    const firstHyphenIndex = postKey.indexOf('-');
    const postId = firstHyphenIndex >= 0 ? postKey.substring(firstHyphenIndex + 1) : postKey;

    let sourceDate: string | null = null;
    let movingPost: Post | undefined;

    for (const [dateKey, posts] of Object.entries(scheduledPosts)) {
      const foundPost = posts.find((post) => post.id === postId);
      if (foundPost) {
        sourceDate = dateKey;
        movingPost = foundPost;
        break;
      }
    }

    if (!movingPost || !sourceDate || sourceDate === newDate) {
      return;
    }

    const itemKey = `post-${postId}`;
    const previousState: {[key: string]: Post[]} = JSON.parse(JSON.stringify(scheduledPosts));

    setMovingItems((prev) => ({ ...prev, [itemKey]: true }));

    setScheduledPosts((prev) => {
      const updated = { ...prev };

      if (updated[sourceDate]) {
        updated[sourceDate] = updated[sourceDate].filter((post) => post.id !== postId);
        if (updated[sourceDate].length === 0) {
          delete updated[sourceDate];
        }
      }

      const updatedPost = { ...movingPost, scheduled_date: newDate };
      const targetPosts = updated[newDate] ? [...updated[newDate], updatedPost] : [updatedPost];

      targetPosts.sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));

      updated[newDate] = targetPosts;

      return updated;
    });

    try {
      const response = await fetch('/api/portal/calendar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          postId: movingPost.id,
          scheduled_date: newDate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to move post');
      }
    } catch (err) {
      logger.error('Error moving post in column view:', err);
      setScheduledPosts(previousState);
      await fetchScheduledPosts(0, true);
      alert('Failed to move post. Please try again.');
    } finally {
      setMovingItems((prev) => {
        const next = { ...prev };
        delete next[itemKey];
        return next;
      });
    }
  };

  // Helper function to get approval status badge
  const getApprovalStatusBadge = (post: Post) => {
    const status = post.approval_status || 'pending';
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    
    switch (status) {
      case 'approved':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800`}>
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800`}>
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      case 'needs_attention':
        return (
          <span className={`${baseClasses} bg-orange-100 text-orange-800`}>
            <AlertTriangle className="w-3 h-3 mr-1" />
            Improve
          </span>
        );
      case 'draft':
        return (
          <span className={`${baseClasses} bg-gray-100 text-gray-800`}>
            <FileText className="w-3 h-3 mr-1" />
            Draft
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-gray-100 text-gray-800`}>
            <Minus className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
    }
  };

  if (isLoadingScheduledPosts && Object.keys(scheduledPosts).length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive mb-4">{error}</div>
        <Button onClick={() => fetchScheduledPosts(0, true)} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-card-foreground">
            {viewMode === 'inbox' ? 'Content Inbox' : viewMode === 'kanban' ? 'Content Pipeline' : 'Content Calendar'}
          </h2>
          <p className="text-muted-foreground">
            View your scheduled posts, upload content, and manage your content calendar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              if (!isLoadingScheduledPosts && !isLoadingUploads) {
                fetchScheduledPosts(0, true);
                fetchUploads();
              }
            }}
            disabled={isLoadingScheduledPosts || isLoadingUploads}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(isLoadingScheduledPosts || isLoadingUploads) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Submit Approvals Section */}
      {Object.keys(selectedPosts).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Submit Your Approvals</h3>
              <p className="text-sm text-gray-600 mt-1">
                {Object.keys(selectedPosts).length} post{Object.keys(selectedPosts).length !== 1 ? 's' : ''} selected for approval
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setSelectedPosts({});
                  setComments({});
                  setEditedCaptions({});
                }}
                variant="outline"
                disabled={isSubmittingApprovals}
              >
                Clear All
              </Button>
              
              <Button
                onClick={handleSubmitApprovals}
                disabled={isSubmittingApprovals || Object.keys(selectedPosts).length === 0}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmittingApprovals ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  `Submit ${Object.keys(selectedPosts).length} Approval${Object.keys(selectedPosts).length !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
          
          {Object.keys(selectedPosts).length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <div className="font-medium text-gray-900 mb-2">Selected posts:</div>
              <div className="space-y-1">
                {Object.entries(selectedPosts).map(([postKey, status]) => {
                  const postId = postKey.replace('post-', '');
                  const post = Object.values(scheduledPosts)
                    .flat()
                    .find(p => p.id === postId);
                  
                  if (!post) return null;
                  
                  return (
                    <div key={postKey} className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-1 rounded text-white ${
                        status === 'approved' ? 'bg-green-600' :
                        status === 'rejected' ? 'bg-red-600' :
                        'bg-orange-600'
                      }`}>
                        {status === 'approved' ? '✓ Approved' :
                         status === 'rejected' ? '✗ Rejected' :
                         '⚠ Improve'}
                      </span>
                      <span className="text-gray-600">
                        {post.scheduled_date && new Date(post.scheduled_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short'
                        })} - {post.caption.substring(0, 50)}...
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}


      {/* Content Inbox View */}
      {viewMode === 'inbox' && (
        <div className="space-y-6">
          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Upload Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Drag & Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 ${
                  inboxDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={handleInboxDragOver}
                onDragLeave={handleInboxDragLeave}
                onDrop={handleInboxDrop}
                onClick={() => inboxFileInputRef.current?.click()}
              >
                {inboxUploading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl font-light text-gray-400 leading-none">+</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Drag & drop files here, or click to browse
                    </p>
                    <p className="text-xs text-gray-400">Images, videos, PDFs up to 50MB</p>
                  </>
                )}
                <input
                  ref={inboxFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files?.length) handleInboxUpload(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>

              {/* Target Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Date <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={inboxTargetDate}
                  onChange={e => setInboxTargetDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <Textarea
                  value={inboxNotes}
                  onChange={e => setInboxNotes(e.target.value)}
                  placeholder="Add context, references, or instructions for this content..."
                  className="min-h-[90px] resize-none border-2 border-gray-200 focus:border-primary"
                />
              </div>

              {/* AI Caption Prompt */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Caption Brief
                </label>
                <Textarea
                  value={inboxCaptionPrompt}
                  onChange={e => setInboxCaptionPrompt(e.target.value)}
                  placeholder="Describe what you want the caption to communicate — key messages, tone, call-to-action, hashtags, etc. The team will use this to generate the copy."
                  className="min-h-[90px] resize-none border-2 border-blue-300 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  This brief will be passed to the content team as AI generation context.
                </p>
              </div>

              <Button
                onClick={() => inboxFileInputRef.current?.click()}
                disabled={inboxUploading}
                className="w-full"
              >
                {inboxUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Upload Files</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Uploaded Files */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-semibold">Uploaded Files</CardTitle>
              {isLoadingInbox && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              {inboxError && (
                <p className="text-sm text-destructive mb-4">{inboxError}</p>
              )}
              {!isLoadingInbox && inboxUploads.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No uploads yet. Use the form above to send files to the team.</p>
                </div>
              )}
              {inboxUploads.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inboxUploads.map(upload => {
                    const isImage = upload.file_type?.startsWith('image/');
                    const isVideo = upload.file_type?.startsWith('video/');
                    return (
                      <div key={upload.id} className="border rounded-lg overflow-hidden bg-gray-50 flex flex-col">
                        {/* Thumbnail */}
                        <div className="aspect-video bg-gray-200 flex items-center justify-center relative overflow-hidden">
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={upload.file_url}
                              alt={upload.file_name}
                              className="w-full h-full object-cover"
                            />
                          ) : isVideo ? (
                            <div className="flex flex-col items-center gap-2 text-gray-500">
                              <Film className="h-8 w-8" />
                              <span className="text-xs">Video</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-gray-500">
                              <File className="h-8 w-8" />
                              <span className="text-xs">{upload.file_type?.split('/')[1]?.toUpperCase() ?? 'File'}</span>
                            </div>
                          )}
                          {/* Status badge */}
                          <span className={`absolute top-2 right-2 px-2 py-0.5 text-xs rounded-full font-medium ${
                            upload.status === 'completed' || upload.status === 'published' ? 'bg-green-100 text-green-800' :
                            upload.status === 'in_use' ? 'bg-blue-100 text-blue-800' :
                            upload.status === 'unassigned' ? 'bg-gray-100 text-gray-700' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {upload.status === 'unassigned' ? 'Received' :
                             upload.status === 'in_use' ? 'In Use' :
                             upload.status === 'published' ? 'Published' :
                             upload.status === 'completed' ? 'Done' :
                             upload.status ?? 'Pending'}
                          </span>
                        </div>
                        {/* Info */}
                        <div className="p-3 flex flex-col gap-1 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate" title={upload.file_name}>
                            {upload.file_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(upload.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                            {' · '}
                            {upload.file_size ? `${(upload.file_size / (1024 * 1024)).toFixed(1)} MB` : ''}
                          </p>
                          {upload.notes && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{upload.notes}</p>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="px-3 pb-3">
                          <button
                            onClick={() => handleInboxDelete(upload.id)}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content Inbox — above the calendar (queue strip hidden in column view, shown as sidebar instead) */}
      {viewMode !== 'inbox' && (
        <PortalContentInbox
          token={token}
          viewMode={viewMode === 'inbox' ? 'column' : viewMode as 'column' | 'month' | 'kanban'}
          onViewModeChange={(mode) => setViewMode(mode)}
          refreshTrigger={queueRefreshKey}
          externalQueueItems={allUploads.filter(u => !u.target_date)}
          isExternalQueueLoading={isLoadingUploads}
          hideQueueStrip={viewMode === 'column'}
          onCalendarSuccess={() => {
            fetchUploads();
            fetchScheduledPosts(0, true);
            setKanbanRefreshKey(k => k + 1);
          }}
          onQueueItemClick={(upload) =>
            setModalItem({ type: 'upload', data: upload })
          }
          statusSummary={(() => {
            const allPosts = Object.values(scheduledPosts).flat();
            return {
              approved: allPosts.filter(p => p.approval_status === 'approved').length,
              rejected: allPosts.filter(p => p.approval_status === 'rejected').length,
              needsAttention: allPosts.filter(p => p.approval_status === 'needs_attention').length,
              pending: allPosts.filter(p => p.approval_status === 'pending' || !p.approval_status).length,
            };
          })()}
        />
      )}

      {/* Kanban Board */}
      {viewMode === 'kanban' && (
        <PortalKanbanBoard
          token={token}
          refreshTrigger={kanbanRefreshKey}
          onStatusChange={() => setQueueRefreshKey(k => k + 1)}
          onItemClick={(item: KanbanItem) =>
            setModalItem({
              type: 'upload',
              data: {
                id: item.id,
                file_name: item.file_name,
                file_type: item.file_type,
                file_url: item.file_url,
                notes: item.notes,
                created_at: item.created_at,
                target_date: null,
              },
            })
          }
        />
      )}

      {/* Calendar — Column View (sidebar + calendar, no overflow-hidden so sticky works) */}
      {viewMode === 'column' && (
        <div key={refreshKey} className="flex gap-4 items-start">

          {/* ── Queue Sidebar — sticky, never scrolls past top of content area ── */}
          {(() => {
            const queueItems = allUploads.filter(u => !u.target_date);
            return (
              <div
                className="bg-white rounded-lg shadow flex flex-col flex-shrink-0 w-44 sticky top-0"
                style={{ height: 'calc(100vh - 112px)' }}
              >
                {/* Sidebar header */}
                <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <ListOrdered className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">Queue</span>
                    {queueItems.length > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium leading-none">
                        {queueItems.length}
                      </span>
                    )}
                  </div>
                  {isLoadingUploads && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300" />}
                </div>

                {/* Sidebar content */}
                <div className="flex-1 overflow-y-auto p-2">
                  {isLoadingUploads && queueItems.length === 0 ? (
                    <div className="flex flex-col gap-2">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 overflow-hidden animate-pulse">
                          <div className="h-28 bg-gray-200" />
                          <div className="p-2 space-y-1.5">
                            <div className="h-2.5 bg-gray-200 rounded w-3/4" />
                            <div className="h-2 bg-gray-100 rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : queueItems.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6 px-2">No items in queue</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {queueItems.map(item => {
                        const isImage = item.file_type?.startsWith('image/');
                        const isVideo = item.file_type?.startsWith('video/');
                        const isMoving = movingUploadId === item.id;
                        return (
                          <div
                            key={item.id}
                            draggable={!isMoving}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/portal-upload', JSON.stringify(item));
                              draggingQueueItemRef.current = item;
                            }}
                            onDragEnd={() => {
                              draggingQueueItemRef.current = null;
                            }}
                            onClick={() => !isMoving && setModalItem({ type: 'upload', data: item })}
                            className={`relative rounded-lg border border-gray-100 bg-gray-50 overflow-hidden transition-all ${isMoving ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-200'}`}
                          >
                            {isMoving && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                              </div>
                            )}
                            <div className="h-28 bg-gray-200 flex items-center justify-center overflow-hidden">
                              {isImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.file_url} alt={item.file_name} draggable={false} className="w-full h-full object-cover" />
                              ) : isVideo ? (
                                <div className="flex flex-col items-center gap-1 text-gray-400">
                                  <Film className="w-6 h-6" />
                                  <span className="text-xs">Video</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-gray-400">
                                  <FileText className="w-6 h-6" />
                                  <span className="text-xs">{item.file_type?.split('/')[1]?.toUpperCase() ?? 'File'}</span>
                                </div>
                              )}
                            </div>
                            <div className="p-2">
                              <p className="text-xs font-medium text-gray-700 truncate" title={item.file_name}>
                                {item.file_name}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Column Calendar ── */}
          <div className="flex-1 min-w-0 bg-white rounded-lg shadow p-4">

            {/* Selection toolbar */}
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 flex-wrap">
              <span className={`text-sm font-medium ${calendarSelectedPostIds.size > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                {calendarSelectedPostIds.size > 0 ? `${calendarSelectedPostIds.size} post${calendarSelectedPostIds.size !== 1 ? 's' : ''} selected` : 'Select posts to use toolbar'}
              </span>

              {pendingDeleteConfirm ? (
                <div className="inline-flex items-center gap-1.5">
                  <span className="text-sm text-red-700 font-medium">
                    Delete {calendarSelectedPostIds.size} post{calendarSelectedPostIds.size !== 1 ? 's' : ''}?
                  </span>
                  <button
                    onClick={handleCalendarDeleteSelectedPosts}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded text-white bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setPendingDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => calendarSelectedPostIds.size > 0 && setPendingDeleteConfirm(true)}
                  disabled={isDeletingSelected || calendarSelectedPostIds.size === 0}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded text-white transition-all ${
                    isDeletingSelected ? 'bg-red-400 cursor-not-allowed opacity-70'
                    : calendarSelectedPostIds.size === 0 ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isDeletingSelected ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {isDeletingSelected ? 'Deleting…' : 'Delete'}
                </button>
              )}

              <button
                onClick={handleCalendarExportToPDF}
                disabled={exportingPDF || calendarSelectedPostIds.size === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded text-white transition-all ${
                  exportingPDF ? 'bg-blue-400 cursor-not-allowed opacity-70'
                  : calendarSelectedPostIds.size === 0 ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {exportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                {exportingPDF ? 'Exporting…' : `Export PDF${calendarSelectedPostIds.size > 0 ? ` (${calendarSelectedPostIds.size})` : ''}`}
              </button>

              <button
                onClick={handleCalendarGenerateApprovalLink}
                disabled={generatingApprovalLink || calendarSelectedPostIds.size === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded text-white transition-all ${
                  generatingApprovalLink ? 'bg-purple-400 cursor-not-allowed opacity-70'
                  : calendarSelectedPostIds.size === 0 ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {generatingApprovalLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                {generatingApprovalLink ? 'Generating…' : `One-Time Link${calendarSelectedPostIds.size > 0 ? ` (${calendarSelectedPostIds.size})` : ''}`}
              </button>

              {/* Calendar nav buttons — always visible */}
              <button
                onClick={() => portalCalendarRef.current?.navigatePrev()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors flex-shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <button
                onClick={() => portalCalendarRef.current?.navigateNext()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors flex-shrink-0"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Brand Settings button — always visible, on the right end */}
              <button
                onClick={openBrandSettings}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors flex-shrink-0"
                title="Set brand name & logo for previews"
              >
                {brandLogoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={brandLogoUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <Settings2 className="w-3.5 h-3.5" />
                )}
                {brandName ? <span className="max-w-[120px] truncate">{brandName}</span> : 'Brand'}
              </button>

              {calendarSelectedPostIds.size > 0 && (
                <button
                  onClick={() => { setCalendarSelectedPostIds(new Set()); setPendingDeleteConfirm(false); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear selection
                </button>
              )}
            </div>

            <PortalColumnViewCalendar
              ref={portalCalendarRef}
              weeks={getWeeksToDisplay(3)}
              scheduledPosts={scheduledPosts}
              clientUploads={uploads}
              events={calendarEvents}
              loading={isLoadingScheduledPosts}
              onPostMove={handleColumnPostMove}
              formatWeekCommencing={formatWeekCommencing}
              formatTimeTo12Hour={formatTimeTo12Hour}
              portalToken={token}
              onAddUploadClick={handleColumnAddUpload}
              selectedPosts={selectedPosts}
              onPostSelection={handlePostSelection}
              comments={comments}
              onCommentChange={handleCommentChange}
              editedCaptions={editedCaptions}
              onCaptionChange={handleCaptionChange}
              onDeleteClientUpload={handleDeleteUploadFromCalendar}
              deletingUploadIds={deletingUploadIds}
              uploading={uploading}
              uploadingForDate={pendingColumnUploadDate}
              onPostClick={(post) => {
                const isUpload =
                  post.post_type === 'client-upload' ||
                  post.post_type === 'client_upload' ||
                  (post as any).isClientUpload;
                if (isUpload) {
                  const uploadData = (post as any).client_upload || (post as any).upload || post;
                  setModalItem({
                    type: 'upload',
                    data: {
                      id: post.id,
                      file_name: uploadData.file_name || post.caption || 'Upload',
                      file_type: uploadData.file_type || 'image/jpeg',
                      file_url: uploadData.file_url || post.image_url || '',
                      notes: uploadData.notes || null,
                      review_notes: uploadData.review_notes || null,
                      created_at: uploadData.created_at || new Date().toISOString(),
                      target_date: uploadData.target_date ?? null,
                    },
                  });
                } else {
                  setModalItem({
                    type: 'post',
                    data: {
                      id: post.id,
                      caption: post.caption,
                      image_url: post.image_url,
                      scheduled_date: post.scheduled_date,
                      scheduled_time: post.scheduled_time ?? null,
                      approval_status: post.approval_status,
                      approval_steps: post.approval_steps,
                      platforms_scheduled: post.platforms_scheduled,
                      tags: post.tags ?? [],
                    },
                  });
                }
              }}
              movingToDate={movingToDate}
              calendarSelectedPostIds={calendarSelectedPostIds}
              onToggleCalendarPostSelection={handleToggleCalendarPostSelection}
              onTagsChange={handleTagsChange}
              onEventAdd={(dateKey) => setPortalEventModal({ date: dateKey })}
              onEventClick={(event) => setPortalEventModal({ date: event.date, event })}
              onQueueItemDrop={async (uploadId, dateKey) => {
                try {
                  await fetch('/api/portal/upload', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, uploadId, targetDate: dateKey }),
                  });
                  fetchUploads();
                  setKanbanRefreshKey(k => k + 1);
                  setQueueRefreshKey(k => k + 1);
                } catch {
                  // silent fail
                }
              }}
              onDrop={async (e, dateKey) => {
                // Use ref first (most reliable), fall back to DataTransfer
                const upload = draggingQueueItemRef.current
                  ?? (() => {
                    try {
                      const raw = e.dataTransfer.getData('text/portal-upload');
                      return raw ? JSON.parse(raw) : null;
                    } catch { return null; }
                  })();
                draggingQueueItemRef.current = null;
                if (!upload?.id) return;
                setMovingUploadId(upload.id);
                setMovingToDate(dateKey);
                try {
                  await fetch('/api/portal/upload', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, uploadId: upload.id, targetDate: dateKey }),
                  });
                  await fetchUploads();
                  setKanbanRefreshKey(k => k + 1);
                  setQueueRefreshKey(k => k + 1);
                } catch {
                  // silent fail — user can retry
                } finally {
                  setMovingUploadId(null);
                  setMovingToDate(null);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Calendar — Month View */}
      {viewMode === 'month' && (
        <div key={refreshKey} className="bg-white rounded-lg shadow overflow-hidden">
          <MonthViewCalendar
            posts={Object.values(scheduledPosts).flat()}
            uploads={uploads}
            events={calendarEvents}
            loading={isLoadingScheduledPosts}
            onDateClick={handleDateClick}
            dragOverDate={monthDragOverDate}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDragEnter={(e, dateKey) => {
              e.preventDefault();
              setMonthDragOverDate(dateKey);
            }}
            onDragLeave={(_e, _dateKey) => {
              setMonthDragOverDate(null);
            }}
            onDrop={async (e, date) => {
              setMonthDragOverDate(null);
              const queueData = e.dataTransfer.getData('text/portal-upload');
              if (!queueData) return;
              try {
                const upload = JSON.parse(queueData);
                const dateKey = date.toLocaleDateString('en-CA');
                await fetch('/api/portal/upload', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token, uploadId: upload.id, targetDate: dateKey }),
                });
                fetchUploads();
                setQueueRefreshKey(k => k + 1);
              } catch {
                // silent fail
              }
            }}
          />
        </div>
      )}

      <input
        ref={columnUploadInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={handleColumnUploadChange}
      />

      {/* Success Message */}
      {successMessage && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <span className="text-green-800 font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Trello-style item modal */}
      {modalItem && (
        <PortalItemModal
          item={modalItem}
          portalToken={token}
          party={party}
          brandName={brandName || undefined}
          brandLogoUrl={brandLogoUrl || undefined}
          onClose={() => setModalItem(null)}
          onActioned={() => {
            setModalItem(null);
            fetchScheduledPosts(0, true);
            fetchUploads();
            setKanbanRefreshKey(k => k + 1);
            setQueueRefreshKey(k => k + 1);
          }}
          onTagsChange={handleTagsChange}
        />
      )}

      {/* Portal calendar event / note modal */}
      {portalEventModal && (
        <PortalCalendarEventModal
          date={portalEventModal.date}
          event={portalEventModal.event}
          token={token}
          onSave={handlePortalEventSave}
          onDelete={handlePortalEventDelete}
          onClose={() => setPortalEventModal(null)}
        />
      )}

      {/* Brand Settings Modal */}
      {showBrandSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowBrandSettings(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Brand Settings</h2>
                <p className="text-xs text-gray-500 mt-0.5">Used in post previews &amp; social mock-ups</p>
              </div>
              <button onClick={() => setShowBrandSettings(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Brand name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                <input
                  type="text"
                  value={tempBrandName}
                  onChange={e => setTempBrandName(e.target.value)}
                  placeholder="e.g. Acme Co."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                />
              </div>

              {/* Logo URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                  type="url"
                  value={tempBrandLogoUrl}
                  onChange={e => setTempBrandLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                />
                {tempBrandLogoUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tempBrandLogoUrl}
                      alt="Logo preview"
                      className="w-10 h-10 rounded-full object-cover border border-gray-200 bg-gray-50"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="text-xs text-gray-500">Preview</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowBrandSettings(false)}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {(brandName || brandLogoUrl) && (
                <button
                  onClick={() => {
                    setTempBrandName('');
                    setTempBrandLogoUrl('');
                    setBrandName('');
                    setBrandLogoUrl('');
                    setShowBrandSettings(false);
                    try { localStorage.removeItem(`portal_brand_${token}`); } catch { /* ignore */ }
                  }}
                  className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={saveBrandSettings}
                className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Modal */}
      <PDFExportModal
        open={showPDFExportModal}
        onClose={() => setShowPDFExportModal(false)}
        onExport={performCalendarPDFExport}
        defaultTitle="Content Calendar"
        defaultFileName={`content-calendar-${new Date().toISOString().split('T')[0]}`}
      />

      {/* Approval Link Dialog */}
      {showApprovalLinkDialog && approvalLinkUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowApprovalLinkDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">One-Time Approval Link</h2>
              <button onClick={() => setShowApprovalLinkDialog(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Share this link with someone to review and approve the selected {calendarSelectedPostIds.size} post{calendarSelectedPostIds.size !== 1 ? 's' : ''}. The link expires in 30 days.
            </p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
              <span className="flex-1 text-sm text-gray-700 truncate font-mono">{approvalLinkUrl}</span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(approvalLinkUrl);
                  setApprovalLinkCopied(true);
                  setTimeout(() => setApprovalLinkCopied(false), 2000);
                }}
                className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors"
              >
                {approvalLinkCopied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {approvalLinkCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button onClick={() => setShowApprovalLinkDialog(false)} className="w-full py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}