'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Sparkles, Images, RefreshCw, Plus, AlertCircle, Upload as UploadIcon, Check, Inbox } from 'lucide-react';
import { ContentStoreProvider, useContentStore } from '@/lib/contentStore';
import { useAuth } from '@/contexts/AuthContext';
import { SocialPreviewCard } from '@/components/SocialPreviewCard';
import PhotoSwapDialog from '@/components/PhotoSwapDialog';
import { WeekDayChooser } from '@/components/WeekDayChooser';
import { ChatCaptionOption } from '@/components/ChatCaptionOption';
import { GeneratePromptBox, ChatRefineInput } from '@/components/CaptionPrompt';
import { useInputGlide } from '@/hooks/useInputGlide';
import { PlatformPicker } from '@/components/PlatformBadges';
import { normalizeTargetPlatforms, type TargetPlatform } from '@/lib/targetPlatforms';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Project {
  id: string;
  name: string;
  [key: string]: any;
}

interface CreatedPost {
  id: string;
  caption: string;
  image_url?: string;
  scheduled_date?: string;
  scheduled_time?: string | null;
  project_id?: string | null;
  [key: string]: any;
}

/** A post from the calendar's unscheduled Posts tray. */
export interface UnscheduledPostOption {
  id: string;
  caption: string;
  image_url: string;
  media_urls?: string[] | null;
  [key: string]: any;
}

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  weekStart: Date;
  projects?: Project[];
  onCreated: (post: CreatedPost) => void;
  accountName?: string;
  accountAvatarUrl?: string;
  /** Posts from the unscheduled tray that can be picked instead of building a new one. */
  unscheduledPosts?: UnscheduledPostOption[];
  /** Schedules a picked tray post; required for the picker to show. */
  onScheduleExisting?: (post: UnscheduledPostOption, dateKey: string, time: string) => Promise<void>;
}

const PREVIEW_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'twitter', label: 'Twitter' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
] as const;
type PreviewPlatform = (typeof PREVIEW_PLATFORMS)[number]['id'];

export function CreatePostModal(props: CreatePostModalProps) {
  if (!props.open) return null;
  return (
    <ContentStoreProvider clientId={props.clientId}>
      <CreatePostModalContent {...props} />
    </ContentStoreProvider>
  );
}

function CreatePostModalContent({
  onClose,
  clientId,
  weekStart,
  projects,
  onCreated,
  accountName,
  accountAvatarUrl,
  unscheduledPosts = [],
  onScheduleExisting,
}: CreatePostModalProps) {
  const { getAccessToken } = useAuth();
  const {
    uploadedImages,
    captions,
    selectedCaptions,
    activeImageId,
    postNotes,
    setUploadedImages,
    setActiveImageId,
    setPostNotes,
    addImage,
    removeImage,
    copyType,
    generateAICaptions,
    remixCaption,
    selectCaption,
    chatMode,
    chatMessages,
    chatInput,
    chatLoading,
    setChatMode,
    setChatInput,
    sendChatMessage,
    handleEnterChatMode,
    selectChatCaption,
    updateChatCaption,
    clearAll,
  } = useContentStore();

  const [selectedPlatform, setSelectedPlatform] = useState<PreviewPlatform>('instagram');
  const [targetPlatforms, setTargetPlatforms] = useState<TargetPlatform[]>([]);
  const [customCaption, setCustomCaption] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState('12:00');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [remixingCaptionId, setRemixingCaptionId] = useState<string | null>(null);
  const [creditDialogMessage, setCreditDialogMessage] = useState<string | null>(null);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPost, setExistingPost] = useState<UnscheduledPostOption | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const showChatWindow = chatMode && !customMode && chatMessages.length > 0;
  const inputGlide = useInputGlide(showChatWindow, chatContainerRef);

  // Fresh session each time the modal opens — contentStore's localStorage hydration is not
  // scoped by clientId, so without this a reopen could silently show a different client's
  // stale captions/images.
  useEffect(() => {
    clearAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeImage = uploadedImages.find((img) => img.id === activeImageId);
  const activeIndex = Math.max(0, uploadedImages.findIndex((img) => img.id === activeImageId));
  const previewUrls = uploadedImages.map((img) => img.blobUrl || img.preview);
  const allUploaded = uploadedImages.length > 0 && uploadedImages.every((img) => img.blobUrl?.startsWith('https://') && !img.uploadFailed);
  const hasFailedUpload = uploadedImages.some((img) => img.uploadFailed);
  const selectedCaption = captions.find((c) => selectedCaptions.includes(c.id));
  const activeCaptionText = customMode ? customCaption : (selectedCaption?.text || '');

  const handleCreditError = (err: unknown) => {
    if (err instanceof Error && err.message === 'INSUFFICIENT_CREDITS') {
      const details = (err as Error & { details?: string }).details;
      setCreditDialogMessage(details || null);
      setShowCreditDialog(true);
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleFilesSelected = async (files: File[]) => {
    setError(null);
    const media = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    // Parallel uploads; the first file of the batch becomes the active (previewed) photo
    await Promise.all(media.map((file, i) => addImage(file, { activate: i === 0 })));
  };

  const handleGalleryPhotoSelected = async (mediaGalleryId: string) => {
    const accessToken = getAccessToken();
    try {
      const res = await fetch(
        `/api/media-gallery?clientId=${clientId}&limit=200&status=available`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      const items: Array<{ id: string; media_url: string }> = data.items ?? data.gallery ?? [];
      const item = items.find((i) => i.id === mediaGalleryId);
      if (!item) return;
      const imageId = `gallery-${mediaGalleryId}`;
      if (uploadedImages.some((img) => img.id === imageId)) {
        setActiveImageId(imageId);
        setGalleryOpen(false);
        return;
      }
      const mockFile = new File([], 'gallery-photo.jpg', { type: 'image/jpeg' });
      setUploadedImages([
        ...uploadedImages,
        { id: imageId, file: mockFile, preview: item.media_url, blobUrl: item.media_url },
      ]);
      setActiveImageId(imageId);
      setGalleryOpen(false);
    } catch (err) {
      console.error('Failed to load gallery item:', err);
    }
  };

  const handleGenerateCaptions = async () => {
    if (!activeImage) return;
    setGeneratingCaptions(true);
    setError(null);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Authentication required. Please log in again.');
      const aiContext = postNotes?.trim() || 'Generate engaging social media captions for this content.';
      await generateAICaptions(activeImage.id, aiContext, copyType, accessToken);
    } catch (err) {
      if (!handleCreditError(err)) {
        setError(err instanceof Error ? err.message : 'Failed to generate captions');
      }
    } finally {
      setGeneratingCaptions(false);
    }
  };

  const handleRemix = async (captionId: string) => {
    setRemixingCaptionId(captionId);
    try {
      const accessToken = getAccessToken();
      await remixCaption(captionId, accessToken || undefined);
    } finally {
      setRemixingCaptionId(null);
    }
  };

  // Single "Generate Text" entry point for both Standard and Chat caption modes. In Chat mode
  // (the default) the notes are an optional prompt; once captions exist the box glides down
  // to become the chat refine input.
  const isGenerating = chatMode ? chatLoading : generatingCaptions;
  const isVideoWithoutNotes = activeImage?.mediaType === 'video' && !postNotes.trim();
  const isGenerateDisabled = !activeImage || isGenerating || isVideoWithoutNotes;
  const handleGenerateClick = () => {
    if (!activeImage) return;
    if (chatMode) {
      inputGlide.captureStart();
      handleEnterChatMode(getAccessToken() || undefined).catch((err: unknown) => handleCreditError(err));
    } else {
      handleGenerateCaptions();
    }
  };

  const showPostPicker = !!onScheduleExisting && unscheduledPosts.length > 0;
  const existingMedia = existingPost
    ? ((existingPost.media_urls?.length ?? 0) > 1 ? (existingPost.media_urls as string[]) : [existingPost.image_url].filter(Boolean))
    : [];

  const canSubmit = existingPost
    ? !!selectedDateKey && !!selectedTime && !isSubmitting
    : allUploaded && !!activeCaptionText.trim() && !!selectedDateKey && !!selectedTime && !isSubmitting;

  const handleSubmit = async () => {
    if (existingPost) {
      if (!canSubmit || !selectedDateKey || !onScheduleExisting) return;
      setIsSubmitting(true);
      setError(null);
      try {
        await onScheduleExisting(existingPost, selectedDateKey, selectedTime);
        clearAll();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add post');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (!canSubmit || !selectedDateKey || !activeCaptionText.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Authentication required. Please log in again.');
      const mediaUrls = uploadedImages.map((img) => img.blobUrl as string);
      const response = await fetch('/api/calendar/scheduled', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledPost: {
            client_id: clientId,
            project_id: selectedProjectId,
            caption: activeCaptionText,
            image_url: mediaUrls[0],
            media_urls: mediaUrls.length > 1 ? mediaUrls : null,
            target_platforms: targetPlatforms,
            scheduled_date: selectedDateKey,
            scheduled_time: `${selectedTime}:00`,
            post_notes: postNotes || '',
          },
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create post: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      onCreated(data.post);
      clearAll();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    clearAll();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-semibold text-gray-900">New post</span>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* LEFT — live social preview */}
          <div className="lg:w-[42%] flex-shrink-0 bg-gray-50 flex flex-col lg:border-r border-b lg:border-b-0 border-gray-100 overflow-y-auto">
            <div className="flex items-center gap-1 px-4 pt-4 pb-2 flex-shrink-0">
              {PREVIEW_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                    selectedPlatform === p.id
                      ? 'bg-white shadow-sm text-gray-900 ring-1 ring-gray-200'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex-1 px-3 pb-4">
              <SocialPreviewCard
                platform={selectedPlatform}
                accountName={accountName || "Your Account"}
                accountAvatarUrl={accountAvatarUrl}
                caption={existingPost ? existingPost.caption : activeCaptionText}
                imageUrl={existingPost ? existingMedia[0] : activeImage?.blobUrl || activeImage?.preview}
                mediaUrls={existingPost ? existingMedia : previewUrls}
                carouselIndex={existingPost ? 0 : activeIndex}
                onCarouselIndexChange={(i) => {
                  if (existingPost) return;
                  const img = uploadedImages[i];
                  if (img) setActiveImageId(img.id);
                }}
                scheduledDate={selectedDateKey ?? undefined}
                scheduledTime={selectedTime}
              />

              {!existingPost && uploadedImages.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    {uploadedImages.length > 1 ? `Carousel · ${uploadedImages.length} photos` : '1 photo'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {uploadedImages.map((img, i) => {
                      const isUploading = !img.blobUrl && !img.uploadFailed;
                      const isActive = img.id === activeImageId;
                      return (
                        <div
                          key={img.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setActiveImageId(img.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveImageId(img.id); }}
                          className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition-colors ${
                            img.uploadFailed ? 'border-red-400' : isActive ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                          }`}
                          title={`Photo ${i + 1}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.mediaType === 'video' ? (img.videoThumbnail || img.preview) : img.preview}
                            alt={`Photo ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[9px] font-semibold leading-none px-1 py-0.5 rounded">
                            {i + 1}
                          </span>
                          {isUploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 text-white animate-spin" />
                            </div>
                          )}
                          {img.uploadFailed && (
                            <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center" title="Upload failed">
                              <AlertCircle className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <button
                            type="button"
                            aria-label={`Remove photo ${i + 1}`}
                            onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 flex items-center justify-center transition-colors"
                      title="Add more photos"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — build the post */}
          <div className="flex-1 min-w-0 overflow-y-auto px-5 py-4 space-y-5">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Pick an existing post from the unscheduled Posts tray */}
            {showPostPicker && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Inbox className="w-3.5 h-3.5" />
                    Use a post from your Posts
                  </p>
                  {existingPost && (
                    <button
                      type="button"
                      onClick={() => setExistingPost(null)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Create a new post instead
                    </button>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {unscheduledPosts.map((post) => {
                    const isPicked = existingPost?.id === post.id;
                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => setExistingPost(isPicked ? null : post)}
                        className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                          isPicked ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'
                        }`}
                        title={post.caption || 'Untitled post'}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.image_url || '/api/placeholder/100/100'}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.src = '/api/placeholder/100/100'; }}
                        />
                        {isPicked && (
                          <span className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                            <Check className="w-5 h-5 text-white drop-shadow" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {existingPost ? (
                  <p className="text-xs text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">
                    {existingPost.caption || <span className="italic text-gray-400">No caption</span>}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500 mt-1.5">Pick one to schedule it, or build a new post below.</p>
                )}
              </div>
            )}

            {!existingPost && (
            <>
            {/* Image */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Photos</p>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length > 0) handleFilesSelected(files);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <UploadIcon className="w-3.5 h-3.5" />
                  {uploadedImages.length > 0 ? 'Add photos' : 'Upload photos'}
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryOpen(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Images className="w-3.5 h-3.5" />
                  Gallery
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                {hasFailedUpload
                  ? 'A photo failed to upload — remove it to continue.'
                  : 'Select several photos at once (or keep adding) to make a carousel.'}
              </p>
            </div>

            {/* Intended platforms */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Platforms</p>
              <PlatformPicker
                selected={targetPlatforms}
                onToggle={(platform) => {
                  const isOn = targetPlatforms.includes(platform);
                  setTargetPlatforms(normalizeTargetPlatforms(
                    isOn ? targetPlatforms.filter((p) => p !== platform) : [...targetPlatforms, platform]
                  ));
                  if (!isOn) setSelectedPlatform(platform);
                }}
              />
            </div>

            {/* Caption generation */}
            <div>
              <div ref={inputGlide.anchorRef} className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Caption</p>
                <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
                  <button
                    type="button"
                    onClick={() => { setCustomMode(false); setChatMode(false); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      !chatMode && !customMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCustomMode(false); setChatMode(true); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      chatMode && !customMode ? 'bg-blue-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => { setChatMode(false); setCustomMode(true); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      customMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Prompt box — notes + Generate Text (Standard, and Chat before the first generation) */}
              {!customMode && !showChatWindow && (
                <div className="mb-3">
                  <GeneratePromptBox
                    size="sm"
                    boxRef={inputGlide.fromRef}
                    value={postNotes}
                    onChange={setPostNotes}
                    onGenerate={handleGenerateClick}
                    disabled={isGenerateDisabled}
                    generating={isGenerating}
                  />
                  <p className="text-[11px] text-gray-500 text-center mt-1.5">
                    {isVideoWithoutNotes
                      ? 'Add notes describing your video to generate captions'
                      : chatMode
                        ? 'Notes are optional — generate captions, then refine them in chat'
                        : 'AI will analyze your image and your notes to generate captions'}
                  </p>
                </div>
              )}

              {customMode ? (
                <div className="space-y-1">
                  <Textarea
                    value={customCaption}
                    onChange={(e) => setCustomCaption(e.target.value)}
                    placeholder="Write your own caption..."
                    rows={8}
                    autoFocus
                    className="text-sm resize-y"
                  />
                  <p className="text-[11px] text-gray-400 text-right">{customCaption.length} characters</p>
                </div>
              ) : !chatMode ? (
                <div className="space-y-2">
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {captions.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">
                        {activeImage ? 'Click "Generate Text" above to create captions' : 'Select a photo, then generate captions'}
                      </p>
                    )}
                    {captions.map((cap) => (
                      <button
                        key={cap.id}
                        type="button"
                        onClick={() => selectCaption(cap.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                          selectedCaptions.includes(cap.id)
                            ? 'border-blue-400 bg-blue-50 text-gray-900'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="whitespace-pre-wrap">{cap.text}</span>
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); handleRemix(cap.id); }}
                            className="flex-shrink-0 text-gray-400 hover:text-blue-600"
                            title="Remix"
                          >
                            {remixingCaptionId === cap.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                showChatWindow && (
                <div>
                  <div ref={chatContainerRef} className="h-72 overflow-y-auto rounded-2xl bg-gray-50 border border-gray-200 p-3 space-y-3">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={msg.role === 'user' ? 'text-right' : ''}>
                        {msg.role === 'user' ? (
                          <span className="inline-block px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs">
                            {msg.content}
                          </span>
                        ) : msg.isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                        ) : msg.captions && msg.captions.length > 0 ? (
                          <div className="space-y-1.5">
                            {msg.captions.map((cap) => (
                              <ChatCaptionOption
                                key={cap.id}
                                size="sm"
                                text={cap.text}
                                selected={selectedCaptions.includes(cap.id)}
                                onSelect={() => selectChatCaption(cap)}
                                onChange={(text) => updateChatCaption(cap.id, text)}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">{msg.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <ChatRefineInput
                      size="sm"
                      boxRef={inputGlide.toRef}
                      hintRef={inputGlide.hintRef}
                      value={chatInput}
                      onChange={setChatInput}
                      onSend={() => sendChatMessage(getAccessToken() || undefined)}
                      sendDisabled={!chatInput.trim() || chatLoading || !activeImage}
                      loading={chatLoading}
                    />
                  </div>
                </div>
                )
              )}
            </div>

            </>
            )}

            {/* Day / time */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Day</p>
              <WeekDayChooser weekStart={weekStart} selectedDateKey={selectedDateKey} onSelect={setSelectedDateKey} />
              <div className="mt-2">
                <Input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-32 text-sm"
                />
              </div>
            </div>

            {/* Project */}
            {!existingPost && projects && projects.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Project (optional)</p>
                <select
                  value={selectedProjectId ?? ''}
                  onChange={(e) => setSelectedProjectId(e.target.value || null)}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Add to calendar
            </button>
          </div>
        </div>
      </div>

      <PhotoSwapDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        clientId={clientId}
        currentMediaGalleryId={null}
        onPhotoSelected={handleGalleryPhotoSelected}
      />

      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Insufficient AI credits</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {creditDialogMessage || 'Insufficient AI credits. Please upgrade your plan or wait until next month.'}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
