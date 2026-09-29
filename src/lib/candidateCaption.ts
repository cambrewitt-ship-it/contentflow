import type { AutopilotCandidate } from '@/types/autopilot';

export function normalizeHashtags(tags: string[] | null | undefined): string[] {
  return (tags ?? []).map(t => t.trim()).filter(Boolean).map(t => (t.startsWith('#') ? t : `#${t}`));
}

/** The caption exactly as it would be published: copy, then hashtags. */
export function publishedCaption(candidate: Pick<AutopilotCandidate, 'caption' | 'hashtags'>): string {
  const tags = normalizeHashtags(candidate.hashtags);
  return tags.length > 0 ? `${candidate.caption}\n\n${tags.join(' ')}` : candidate.caption;
}
