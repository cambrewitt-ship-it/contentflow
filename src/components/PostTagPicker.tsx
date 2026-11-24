'use client';

// Tag picker for a single post, anchored to a button. Uses the agency tag dropdown (clientId)
// or the client-portal one (portalToken), saves each toggle, and reports the post's new tag list
// through onTagsChange so the caller can update its own state (board labels, modal chips).
// Rendered into document.body so it isn't clipped or offset by the card/modal it opens from,
// and so its clicks don't reach the card underneath (open post, drag).

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { TagDropdownModal } from '@/components/TagDropdownModal';
import { PortalTagDropdown } from '@/components/PortalTagDropdown';
import { supabase } from '@/lib/supabaseClient';

export type PostTag = { id: string; name: string; color: string };

interface PostTagPickerProps {
  postId: string;
  tags: PostTag[];
  /** Agency side — tags are saved through /api/posts/[postId]/tags. */
  clientId?: string;
  /** Client portal — tags are saved through /api/portal/post-tags. */
  portalToken?: string;
  anchor: HTMLElement | null;
  onClose: () => void;
  onTagsChange: (postId: string, tags: PostTag[]) => void;
}

async function savePostTag(postId: string, tagId: string, add: boolean, clientId?: string, portalToken?: string) {
  if (portalToken) {
    return add
      ? fetch('/api/portal/post-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portal_token: portalToken, post_id: postId, tag_id: tagId }),
        })
      : fetch(
          `/api/portal/post-tags?portal_token=${encodeURIComponent(portalToken)}&post_id=${postId}&tag_id=${tagId}`,
          { method: 'DELETE' }
        );
  }
  if (!clientId) throw new Error('No client');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');
  return add
    ? fetch(`/api/posts/${postId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tag_id: tagId }),
      })
    : fetch(`/api/posts/${postId}/tags/${tagId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
}

export function PostTagPicker({ postId, tags, clientId, portalToken, anchor, onClose, onTagsChange }: PostTagPickerProps) {
  // Latest tag list, so quick successive toggles build on each other rather than on a stale prop.
  const currentRef = useRef<PostTag[]>(tags);

  const toggle = async (tag: PostTag) => {
    const previous = currentRef.current;
    const add = !previous.some((t) => t.id === tag.id);
    const next = add ? [...previous, tag] : previous.filter((t) => t.id !== tag.id);
    // Optimistic — the card/modal shows the change straight away.
    currentRef.current = next;
    onTagsChange(postId, next);
    try {
      const res = await savePostTag(postId, tag.id, add, clientId, portalToken);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to update tag');
    } catch (error) {
      console.error('Error toggling tag:', error);
      const reverted = add
        ? currentRef.current.filter((t) => t.id !== tag.id)
        : [...currentRef.current, tag];
      currentRef.current = reverted;
      onTagsChange(postId, reverted);
      alert(error instanceof Error ? error.message : 'Failed to update tag. Please try again.');
    }
  };

  const rect = anchor?.getBoundingClientRect();
  const position = rect ? { top: rect.bottom, left: rect.left } : undefined;
  const selectedTagIds = tags.map((t) => t.id);

  return createPortal(
    <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {portalToken ? (
        <PortalTagDropdown
          isOpen
          onClose={onClose}
          portalToken={portalToken}
          postId={postId}
          selectedTagIds={selectedTagIds}
          onTagToggle={(_tagId, tag) => toggle(tag)}
          position={position}
        />
      ) : clientId ? (
        <TagDropdownModal
          isOpen
          onClose={onClose}
          clientId={clientId}
          postId={postId}
          selectedTagIds={selectedTagIds}
          onTagToggle={toggle}
          position={position}
        />
      ) : null}
    </div>,
    document.body
  );
}
