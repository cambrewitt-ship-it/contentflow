'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Sparkles, Send, RefreshCw, Plus, AlertCircle, Upload as UploadIcon } from 'lucide-react';
import { uploadMediaToBlob, getMediaType } from '@/lib/blobUpload';
import { extractVideoThumbnail } from '@/lib/videoUtils';
import { prepareImageDataForAI } from '@/lib/imageCompression';
import { SocialPreviewCard } from '@/components/SocialPreviewCard';
import { WeekDayChooser } from '@/components/WeekDayChooser';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import logger from '@/lib/logger';

interface UploadedMedia {
  id: string;
  file: File;
  preview: string;
  blobUrl?: string;
  mediaType?: 'image' | 'video';
  videoThumbnail?: string;
  uploadFailed?: boolean;
}

interface Caption {
  id: string;
  text: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
  captions?: Caption[];
}

interface CreatedPost {
  id: string;
  caption: string | null;
  image_url: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  [key: string]: any;
}

interface PortalCreatePostModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
  clientId: string;
  weekStart: Date;
  onCreated: (post: CreatedPost) => void;
}

const PREVIEW_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'twitter', label: 'Twitter' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
] as const;
type PreviewPlatform = (typeof PREVIEW_PLATFORMS)[number]['id'];

export function PortalCreatePostModal({ open, onClose, token, clientId, weekStart, onCreated }: PortalCreatePostModalProps) {
  const [mediaList, setMediaList] = useState<UploadedMedia[]>([]);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [postNotes, setPostNotes] = useState('');
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [customCaption, setCustomCaption] = useState('');
  const [chatMode, setChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PreviewPlatform>('instagram');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState('12:00');
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [remixingCaptionId, setRemixingCaptionId] = useState<string | null>(null);
  const [creditDialogMessage, setCreditDialogMessage] = useState<string | null>(null);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    mediaList.forEach((m) => { if (m.preview.startsWith('blob:')) URL.revokeObjectURL(m.preview); });
    setMediaList([]);
    setActiveMediaId(null);
    setPostNotes('');
    setCaptions([]);
    setSelectedCaptionId(null);
    setCustomCaption('');
    setChatMode(false);
    setChatMessages([]);
    setChatInput('');
    setSelectedDateKey(null);
    setSelectedTime('12:00');
    setError(null);
  };

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  if (!open) return null;

  // The active photo drives AI captions; every photo in mediaList goes into the post as a carousel
  const media = mediaList.find((m) => m.id === activeMediaId) ?? mediaList[0] ?? null;
  const activeIndex = media ? mediaList.indexOf(media) : 0;
  const allUploaded = mediaList.length > 0 && mediaList.every((m) => !!m.blobUrl && !m.uploadFailed);
  const hasFailedUpload = mediaList.some((m) => m.uploadFailed);

  const selectedCaption = captions.find((c) => c.id === selectedCaptionId);
  const activeCaptionText = customCaption.trim() ? customCaption : (selectedCaption?.text || '');

  const classifyCreditError = (data: unknown): string | undefined => {
    if (!data || typeof data !== 'object') return undefined;
    const err = (data as { error?: unknown }).error;
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'INSUFFICIENT_CREDITS') {
      return (err as { message?: string }).message || 'Insufficient AI credits.';
    }
    if (typeof err === 'string' && (err.includes('credit') || err.includes('Credit'))) return err;
    return undefined;
  };

  const handleFilesSelected = async (files: File[]) => {
    setError(null);
    const valid = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    await Promise.all(valid.map((file, i) => addMediaFile(file, i === 0)));
  };

  const removeMedia = (id: string) => {
    const index = mediaList.findIndex((m) => m.id === id);
    const target = mediaList[index];
    if (target?.preview.startsWith('blob:')) URL.revokeObjectURL(target.preview);
    const remaining = mediaList.filter((m) => m.id !== id);
    setMediaList((prev) => prev.filter((m) => m.id !== id));
    if (activeMediaId === id) {
      const next = remaining[Math.min(Math.max(index, 0), remaining.length - 1)];
      setActiveMediaId(next ? next.id : null);
    }
  };

  const addMediaFile = async (file: File, activate: boolean) => {
    const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const detectedType = getMediaType(file);
    const mediaType = detectedType === 'unknown' ? undefined : detectedType;
    const isVideo = mediaType === 'video';

    let previewUrl: string;
    let videoThumbnail: string | undefined;
    if (isVideo) {
      try {
        videoThumbnail = await extractVideoThumbnail(file);
        previewUrl = videoThumbnail;
      } catch (err) {
        logger.error('Failed to extract video thumbnail:', err);
        previewUrl = URL.createObjectURL(file);
      }
    } else {
      previewUrl = URL.createObjectURL(file);
    }

    setMediaList((prev) => [...prev, { id, file, preview: previewUrl, mediaType, videoThumbnail }]);
    if (activate) setActiveMediaId(id);

    try {
      const filename = `portal-${Date.now()}-${file.name}`;
      const uploadResult = await uploadMediaToBlob(file, filename);
      if (!isVideo || !videoThumbnail) URL.revokeObjectURL(previewUrl);
      setMediaList((prev) => prev.map((m) => m.id === id
        ? { ...m, blobUrl: uploadResult.url, mediaType: uploadResult.mediaType, preview: isVideo ? (m.videoThumbnail || uploadResult.url) : uploadResult.url }
        : m
      ));
    } catch (err) {
      logger.error('Failed to upload media to blob storage:', err);
      setMediaList((prev) => prev.map((m) => (m.id === id ? { ...m, uploadFailed: true } : m)));
    }
  };

  const handleGenerateCaptions = async () => {
    if (!media) return;
    setGeneratingCaptions(true);
    setError(null);
    try {
      const imageData = await prepareImageDataForAI(media);
      if (!imageData) throw new Error('No media available for AI processing');
      const aiContext = postNotes?.trim() || 'Generate engaging social media captions for this content.';

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_captions',
          imageData,
          aiContext,
          postNotes,
          clientId,
          copyType: 'social-media',
          portalToken: token,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const creditError = classifyCreditError(data);
        if (creditError) {
          setCreditDialogMessage(creditError);
          setShowCreditDialog(true);
          return;
        }
        throw new Error((data.error as string) || `Failed to generate captions: ${response.status}`);
      }

      const captionTexts: string[] = data.captions || [];
      const newCaptions = captionTexts.map((text, i) => ({ id: `caption-${Date.now()}-${i}`, text }));
      setCaptions(newCaptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate captions');
    } finally {
      setGeneratingCaptions(false);
    }
  };

  const handleRemix = async (captionId: string) => {
    const caption = captions.find((c) => c.id === captionId);
    if (!caption) return;
    setRemixingCaptionId(captionId);
    setError(null);
    try {
      const imageData = media ? await prepareImageDataForAI(media) : undefined;
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remix_caption',
          imageData,
          prompt: `Create a fresh variation of this caption while maintaining the same style, tone, and message. Keep the core meaning but rephrase it differently. Original caption: "${caption.text}"`,
          existingCaptions: captions.map((c) => c.text),
          aiContext: postNotes || undefined,
          clientId,
          portalToken: token,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const creditError = classifyCreditError(data);
        if (creditError) {
          setCreditDialogMessage(creditError);
          setShowCreditDialog(true);
          return;
        }
        throw new Error((data.error as string) || `Failed to remix caption: ${response.status}`);
      }
      if (data.caption) {
        setCaptions((prev) => prev.map((c) => (c.id === captionId ? { ...c, text: data.caption } : c)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remix caption');
    } finally {
      setRemixingCaptionId(null);
    }
  };

  const runChatCaption = async (instruction: string, history: { role: 'user' | 'assistant'; content: string }[]) => {
    if (!media) return;
    const imageData = await prepareImageDataForAI(media);
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chat_caption',
        imageData,
        userInstruction: instruction,
        conversationHistory: history,
        aiContext: postNotes?.trim() || undefined,
        clientId,
        copyType: 'social-media',
        portalToken: token,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const creditError = classifyCreditError(data);
      throw new Error(creditError || (data.error as string) || `Error ${response.status}`);
    }
    return (data.captions || []) as string[];
  };

  const handleEnterChatMode = async () => {
    setChatMode(true);
    if (!media || chatMessages.length > 0) return;

    const isVideo = media.mediaType === 'video';
    if (isVideo && !postNotes.trim()) {
      setChatMessages([{
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'This is a video. Please add post notes describing your video content, then switch back to Chat mode.',
      }]);
      return;
    }

    const loadingId = `msg-${Date.now()}`;
    setChatMessages([{ id: loadingId, role: 'assistant', content: '', isLoading: true }]);
    setChatLoading(true);
    try {
      const aiContext = postNotes?.trim() || 'Generate engaging social media captions for this content.';
      const captionTexts = await runChatCaption(aiContext, []);
      const ts = Date.now();
      const newCaptions: Caption[] = (captionTexts || []).map((text, i) => ({ id: `chat-init-${ts}-${i}`, text }));
      setCaptions(newCaptions);
      setChatMessages([{ id: loadingId, role: 'assistant', content: '', captions: newCaptions, isLoading: false }]);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('credit')) {
        setChatMessages([]);
        setCreditDialogMessage(err.message);
        setShowCreditDialog(true);
      } else {
        setChatMessages([{
          id: loadingId,
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Failed to generate captions. Please try again.',
        }]);
      }
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    const instruction = chatInput.trim();
    if (!instruction || chatLoading || !media) return;

    const userMsgId = `msg-user-${Date.now()}`;
    const aiMsgId = `msg-ai-${Date.now()}`;
    const snapshot = [...chatMessages];

    setChatMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: instruction },
      { id: aiMsgId, role: 'assistant', content: '', isLoading: true },
    ]);
    setChatInput('');
    setChatLoading(true);

    try {
      const history = snapshot
        .filter((m) => !m.isLoading)
        .map((m) => ({
          role: m.role,
          content: m.role === 'assistant' ? (m.captions?.map((c) => c.text).join('\n\n') || m.content) : m.content,
        }));
      const captionTexts = await runChatCaption(instruction, history);
      const ts = Date.now();
      const newCaptions: Caption[] = (captionTexts || []).map((text, i) => ({ id: `chat-${aiMsgId}-${i}-${ts}`, text }));
      setChatMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, captions: newCaptions, isLoading: false } : m)));
    } catch (err) {
      setChatMessages((prev) => prev.map((m) =>
        m.id === aiMsgId ? { ...m, content: err instanceof Error ? err.message : 'Failed to generate. Please try again.', isLoading: false } : m
      ));
    } finally {
      setChatLoading(false);
    }
  };

  const selectChatCaption = (caption: Caption) => {
    if (!captions.some((c) => c.id === caption.id)) setCaptions((prev) => [...prev, caption]);
    setCustomCaption('');
    setSelectedCaptionId(caption.id);
  };

  const canSubmit = allUploaded && !!activeCaptionText.trim() && !!selectedDateKey && !!selectedTime && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedDateKey) return;
    const mediaUrls = mediaList.map((m) => m.blobUrl as string);
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/portal/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          caption: activeCaptionText,
          image_url: mediaUrls[0],
          media_urls: mediaUrls.length > 1 ? mediaUrls : null,
          post_notes: postNotes || '',
          scheduled_date: selectedDateKey,
          scheduled_time: `${selectedTime}:00`,
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to create post: ${response.status} - ${errText}`);
      }
      const data = await response.json();
      onCreated(data.post);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
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
                accountName="Your Account"
                caption={activeCaptionText}
                imageUrl={media?.blobUrl || media?.preview}
                mediaUrls={mediaList.map((m) => m.blobUrl || m.preview)}
                carouselIndex={activeIndex}
                onCarouselIndexChange={(i) => {
                  const m = mediaList[i];
                  if (m) setActiveMediaId(m.id);
                }}
                scheduledDate={selectedDateKey ?? undefined}
                scheduledTime={selectedTime}
              />

              {mediaList.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    {mediaList.length > 1 ? `Carousel · ${mediaList.length} photos` : '1 photo'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {mediaList.map((m, i) => {
                      const isUploading = !m.blobUrl && !m.uploadFailed;
                      const isActive = m.id === media?.id;
                      return (
                        <div
                          key={m.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setActiveMediaId(m.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveMediaId(m.id); }}
                          className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition-colors ${
                            m.uploadFailed ? 'border-red-400' : isActive ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                          }`}
                          title={`Photo ${i + 1}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[9px] font-semibold leading-none px-1 py-0.5 rounded">
                            {i + 1}
                          </span>
                          {isUploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 text-white animate-spin" />
                            </div>
                          )}
                          {m.uploadFailed && (
                            <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center" title="Upload failed">
                              <AlertCircle className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <button
                            type="button"
                            aria-label={`Remove photo ${i + 1}`}
                            onClick={(e) => { e.stopPropagation(); removeMedia(m.id); }}
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

            {/* Photo */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Photos</p>
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
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <UploadIcon className="w-3.5 h-3.5" />
                {mediaList.length > 0 ? 'Add photos' : 'Upload photos'}
              </button>
              <p className="text-[11px] text-gray-500 mt-1.5">
                {hasFailedUpload
                  ? 'A photo failed to upload — remove it to continue.'
                  : 'Select several photos at once (or keep adding) to make a carousel.'}
              </p>
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
                    onClick={handleEnterChatMode}
                    disabled={!media}
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
                    disabled={!media || generatingCaptions}
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
                        onClick={() => { setCustomCaption(''); setSelectedCaptionId(cap.id); }}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                          selectedCaptionId === cap.id && !customCaption.trim()
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
                        {media ? 'Generating captions...' : 'Select a photo to start'}
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
                                onClick={() => selectChatCaption(cap)}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                                  selectedCaptionId === cap.id
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
                          handleSendChatMessage();
                        }
                      }}
                      placeholder='Try "make it shorter"...'
                      disabled={chatLoading}
                      className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSendChatMessage}
                      disabled={!chatInput.trim() || chatLoading || !media}
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
                    if (e.target.value.trim()) setSelectedCaptionId(null);
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
