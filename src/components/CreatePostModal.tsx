'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Sparkles, Images, Send, RefreshCw, Upload as UploadIcon } from 'lucide-react';
import { ContentStoreProvider, useContentStore } from '@/lib/contentStore';
import { useAuth } from '@/contexts/AuthContext';
import { SocialPreviewCard } from '@/components/SocialPreviewCard';
import PhotoSwapDialog from '@/components/PhotoSwapDialog';
import { WeekDayChooser } from '@/components/WeekDayChooser';
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

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  weekStart: Date;
  projects?: Project[];
  onCreated: (post: CreatedPost) => void;
}

const PREVIEW_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'twitter', label: 'Twitter' },
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

function CreatePostModalContent({ onClose, clientId, weekStart, projects, onCreated }: CreatePostModalProps) {
  const { getAccessToken } = useAuth();
  const {
    uploadedImages,
    captions,
    selectedCaptions,
    activeImageId,
    postNotes,
    setUploadedImages,
    setActiveImageId,
    setSelectedCaptions,
    setPostNotes,
    addImage,
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
    clearAll,
  } = useContentStore();

  const [selectedPlatform, setSelectedPlatform] = useState<PreviewPlatform>('instagram');
  const [customCaption, setCustomCaption] = useState('');
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fresh session each time the modal opens — contentStore's localStorage hydration is not
  // scoped by clientId, so without this a reopen could silently show a different client's
  // stale captions/images.
  useEffect(() => {
    clearAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeImage = uploadedImages.find((img) => img.id === activeImageId);
  const selectedCaption = captions.find((c) => selectedCaptions.includes(c.id));
  const activeCaptionText = customCaption.trim() ? customCaption : (selectedCaption?.text || '');

  const handleCreditError = (err: unknown) => {
    if (err instanceof Error && err.message === 'INSUFFICIENT_CREDITS') {
      const details = (err as Error & { details?: string }).details;
      setCreditDialogMessage(details || null);
      setShowCreditDialog(true);
      return true;
    }
    return false;
  };

  // Auto-enter chat mode once an image becomes active (mirrors content-suite page's behavior)
  useEffect(() => {
    if (chatMode && activeImage && chatMessages.length === 0) {
      const accessToken = getAccessToken();
      handleEnterChatMode(accessToken || undefined).catch((err: unknown) => {
        handleCreditError(err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMode, activeImage, chatMessages.length]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleFileSelected = async (file: File) => {
    setError(null);
    await addImage(file);
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
      const mockFile = new File([], 'gallery-photo.jpg', { type: 'image/jpeg' });
      const imageId = `gallery-${mediaGalleryId}`;
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

  const canSubmit = !!activeImage && !!activeCaptionText.trim() && !!selectedDateKey && !!selectedTime && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !activeImage || !selectedDateKey || !activeCaptionText.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Authentication required. Please log in again.');
      const imageUrl = activeImage.blobUrl || activeImage.preview;
      const response = await fetch('/api/calendar/scheduled', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledPost: {
            client_id: clientId,
            project_id: selectedProjectId,
            caption: activeCaptionText,
            image_url: imageUrl,
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
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                accountName="Your Account"
                caption={activeCaptionText}
                imageUrl={activeImage?.blobUrl || activeImage?.preview}
                scheduledDate={selectedDateKey ?? undefined}
                scheduledTime={selectedTime}
              />
            </div>
          </div>

          {/* RIGHT — build the post */}
          <div className="flex-1 min-w-0 overflow-y-auto px-5 py-4 space-y-5">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Image */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Photo</p>
              {activeImage ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeImage.preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-24 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                  No photo selected
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <UploadIcon className="w-3.5 h-3.5" />
                  Upload
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
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Post notes (optional)</p>
              <Textarea
                value={postNotes}
                onChange={(e) => setPostNotes(e.target.value)}
                placeholder="Anything the AI should know about this post..."
                rows={2}
                className="text-sm"
              />
            </div>

            {/* Caption generation */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Caption</p>
                <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
                  <button
                    type="button"
                    onClick={() => setChatMode(false)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      !chatMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const accessToken = getAccessToken();
                      handleEnterChatMode(accessToken || undefined).catch((err: unknown) => handleCreditError(err));
                    }}
                    disabled={!activeImage}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-40 ${
                      chatMode ? 'bg-blue-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    Chat
                  </button>
                </div>
              </div>

              {!chatMode ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleGenerateCaptions}
                    disabled={!activeImage || generatingCaptions}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingCaptions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Generate captions
                  </button>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {captions.map((cap) => (
                      <button
                        key={cap.id}
                        type="button"
                        onClick={() => { setCustomCaption(''); selectCaption(cap.id); }}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                          selectedCaptions.includes(cap.id) && !customCaption.trim()
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
                <div className="border border-gray-200 rounded-lg flex flex-col h-64">
                  <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                    {chatMessages.length === 0 && (
                      <p className="text-xs text-gray-400 text-center mt-6">
                        {activeImage ? 'Generating captions...' : 'Select a photo to start'}
                      </p>
                    )}
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
                              <button
                                key={cap.id}
                                type="button"
                                onClick={() => { setCustomCaption(''); selectChatCaption(cap); }}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                                  selectedCaptions.includes(cap.id)
                                    ? 'border-blue-400 bg-blue-50 text-gray-900'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                {cap.text}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">{msg.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 p-2 border-t border-gray-100">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendChatMessage(getAccessToken() || undefined);
                        }
                      }}
                      placeholder='Try "make it shorter"...'
                      disabled={chatLoading}
                      className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => sendChatMessage(getAccessToken() || undefined)}
                      disabled={!chatInput.trim() || chatLoading || !activeImage}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-blue-600 text-white disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                    >
                      {chatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Or write your own
                </p>
                <Textarea
                  value={customCaption}
                  onChange={(e) => {
                    setCustomCaption(e.target.value);
                    if (e.target.value.trim()) setSelectedCaptions([]);
                  }}
                  placeholder="Write a custom caption..."
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>
            </div>

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
            {projects && projects.length > 0 && (
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
