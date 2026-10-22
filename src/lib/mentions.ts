/**
 * Comment @mention encoding, shared by the browser and the API.
 *
 * Mentions are stored inline in the comment text as `@[Display Name](m:<uuid>)`
 * for portal members and `@[Display Name](u:<uuid>)` for agency users, so the
 * mention survives a later rename and the server can tell exactly who was tagged.
 */

export type MentionKind = 'member' | 'user';

export interface Mentionable {
  id: string;
  kind: MentionKind;
  name: string;
  /** Short label shown next to the name in the picker, e.g. the party or "Agency". */
  label: string | null;
  color: string | null;
}

export interface ParsedMention {
  kind: MentionKind;
  id: string;
  name: string;
}

const MENTION_RE =
  /@\[([^\]\n]{1,100})\]\((m|u):([0-9a-fA-F-]{36})\)/g;

export function encodeMention(m: Pick<Mentionable, 'kind' | 'id' | 'name'>): string {
  const safeName = m.name.replace(/[\[\]\n]/g, '').trim();
  return `@[${safeName}](${m.kind === 'member' ? 'm' : 'u'}:${m.id})`;
}

export function parseMentions(content: string): ParsedMention[] {
  const seen = new Set<string>();
  const out: ParsedMention[] = [];
  for (const match of content.matchAll(MENTION_RE)) {
    const kind: MentionKind = match[2] === 'm' ? 'member' : 'user';
    const id = match[3].toLowerCase();
    const key = `${kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind, id, name: match[1] });
  }
  return out;
}

export type MentionSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; name: string; kind: MentionKind; id: string };

/** Split comment text into plain-text and mention segments for rendering. */
export function splitMentions(content: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  for (const match of content.matchAll(MENTION_RE)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ type: 'text', text: content.slice(last, start) });
    segments.push({
      type: 'mention',
      name: match[1],
      kind: match[2] === 'm' ? 'member' : 'user',
      id: match[3].toLowerCase(),
    });
    last = start + match[0].length;
  }
  if (last < content.length) segments.push({ type: 'text', text: content.slice(last) });
  return segments;
}

/** Plain-text version of a comment (mentions become "@Name"), for emails and previews. */
export function mentionsToPlainText(content: string): string {
  return content.replace(MENTION_RE, (_m, name: string) => `@${name}`);
}
