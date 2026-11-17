// Lints an Instagram caption against the things that are actually checkable
// before a human posts it: what the feed shows before "... more", hashtag
// count, tag placement, dead links, how many calls to action it makes, and
// emoji density. Ported from the ig-caption skill's caption.py — same checks,
// same wording, same verdict logic.
import { INSTAGRAM_CAPTION_LIMIT, INSTAGRAM_FEED_TRUNCATE, INSTAGRAM_HASHTAG_CAP } from './platformLimits';

export type LintCheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface LintCheck {
  check: string;
  status: LintCheckStatus;
  detail: string;
}

export interface LintResult {
  characters: number;
  limit: number;
  truncateAt: number;
  visible: string;
  truncated: boolean;
  firstLineChars: number;
  hashtags: string[];
  mentions: string[];
  links: string[];
  emoji: number;
  asks: string[];
  checks: LintCheck[];
  verdict: 'READY' | 'REVIEW' | 'FIX';
}

const HASHTAG_RE = /(?:^|\s)(#[A-Za-z0-9_]+)/g;
const MENTION_RE = /(?:^|\s)(@[A-Za-z0-9_.]+)/g;
const LINK_RE = /https?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|co|io|net|org|ai|app)\/\S*/gi;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}☀-➿]/gu;
const CONCRETE_RE = /\$\s?\d|\b\d[\d,.]*\b|(?<!^)\b[A-Z][a-z]{2,}\b/gm;

const ASKS: Array<[RegExp, string]> = [
  [/\bcomment (?:the word |")?[A-Z0-9]{2,}\b/i, 'comment a keyword'],
  [/\b(?:dm|message) me\b/i, 'DM me'],
  [/\bsave (?:this|it)\b/i, 'save this'],
  [/\bshare (?:this|it)\b/i, 'share this'],
  [/\bfollow (?:me|for)\b/i, 'follow'],
  [/\blink in (?:my )?bio\b/i, 'link in bio'],
  [/\b(?:swipe|tap) (?:through|left|right|for|to)\b/i, 'swipe or tap'],
  [/\btell me\b|\bwhat would you\b|\bwhich one\b/i, 'answer a question'],
];

const FILLER_TAGS = new Set([
  '#viral', '#fyp', '#explore', '#explorepage', '#foryou', '#foryoupage',
  '#trending', '#instagood', '#love', '#follow', '#like4like', '#reels',
  '#reelsinstagram', '#viralreels', '#instadaily',
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchAllGroup1(re: RegExp, text: string): string[] {
  return [...text.matchAll(re)]
    .map((m) => m[1])
    .filter((v): v is string => Boolean(v));
}

function visibleWindow(text: string, cut: number): string {
  const flat = text.trim();
  return flat.length <= cut ? flat : flat.slice(0, cut);
}

export function lintCaption(
  rawText: string,
  opts: { truncateAt?: number; keywords?: string[] } = {}
): LintResult {
  const cut = opts.truncateAt ?? INSTAGRAM_FEED_TRUNCATE;
  const stripped = rawText.trim();
  const chars = stripped.length;
  const lines = stripped.split('\n');
  const firstLine = (lines[0] ?? '').trim();
  const tags = matchAllGroup1(HASHTAG_RE, stripped);
  const mentions = matchAllGroup1(MENTION_RE, stripped);
  const links = [...stripped.matchAll(LINK_RE)].map((m) => m[0]);
  const emojiMatches = [...stripped.matchAll(EMOJI_RE)];
  const window = visibleWindow(stripped, cut);
  const truncated = chars > cut;
  const asks = ASKS.filter(([re]) => re.test(stripped)).map(([, name]) => name);
  const filler = tags.filter((t) => FILLER_TAGS.has(t.toLowerCase()));
  const keywords = (opts.keywords ?? []).map((k) => k.trim()).filter(Boolean);

  const checks: LintCheck[] = [];
  const add = (check: string, status: LintCheckStatus, detail: string) => checks.push({ check, status, detail });

  add(
    'LENGTH',
    chars > INSTAGRAM_CAPTION_LIMIT ? 'FAIL' : 'PASS',
    `${chars} / ${INSTAGRAM_CAPTION_LIMIT} characters` +
      (chars > INSTAGRAM_CAPTION_LIMIT ? `, ${chars - INSTAGRAM_CAPTION_LIMIT} over the limit` : '')
  );

  if (!firstLine) {
    add('FIRST LINE', 'FAIL', 'the caption opens on a blank line');
  } else if (firstLine.startsWith('#') || firstLine.startsWith('@')) {
    add('FIRST LINE', 'FAIL', 'opens on a hashtag or a mention, which is the one position worth a sentence');
  } else if (firstLine.length > cut) {
    add(
      'FIRST LINE',
      'WARN',
      `${firstLine.length} characters, so it gets cut at ${cut} mid-thought. Fine if the cut is a cliffhanger, bad if it is a subordinate clause`
    );
  } else {
    add('FIRST LINE', 'PASS', `${firstLine.length} characters, lands whole`);
  }

  const concreteInWindow = [...window.matchAll(CONCRETE_RE)];
  add(
    'HOOK IS CONCRETE',
    concreteInWindow.length > 0 ? 'PASS' : 'WARN',
    `${concreteInWindow.length} number(s) or name(s) in the visible window` +
      (concreteInWindow.length === 0 ? ' - nothing checkable before the tap' : '')
  );

  if (tags.length > INSTAGRAM_HASHTAG_CAP) {
    add(
      'HASHTAGS',
      'FAIL',
      `${tags.length} tags, over Instagram's cap of ${INSTAGRAM_HASHTAG_CAP}. Tags past the cap do not count and the block reads as old`
    );
  } else if (tags.length === INSTAGRAM_HASHTAG_CAP && filler.length > 0) {
    add(
      'HASHTAGS',
      'WARN',
      `${tags.length} tags, at the cap, and ${filler.length} of them generic. Spend the ${INSTAGRAM_HASHTAG_CAP} on topics`
    );
  } else if (filler.length > 0) {
    add(
      'HASHTAGS',
      'WARN',
      `${tags.length} tags, ${filler.length} of them generic (${filler.slice(0, 3).join(', ')}). Those describe nothing`
    );
  } else {
    add('HASHTAGS', 'PASS', `${tags.length} tag(s)` + (tags.length > 0 ? `: ${tags.join(' ')}` : ''));
  }

  if (tags.length === 0) {
    add('TAG PLACEMENT', 'PASS', 'no tags to place');
  } else if (tags.some((t) => new RegExp(`(?:^|\\s)${escapeRegExp(t)}\\b`).test(window))) {
    add('TAG PLACEMENT', 'WARN', 'a hashtag is inside the visible window, spending feed space on a label');
  } else {
    add('TAG PLACEMENT', 'PASS', 'tags are below the fold');
  }

  add(
    'LINKS',
    links.length > 0 ? 'WARN' : 'PASS',
    links.length > 0
      ? `${links.length} link(s) in the caption, and captions are not clickable. Move it to the bio or the DM`
      : 'no dead links in the body'
  );

  if (asks.length === 1) {
    add('ONE ASK', 'PASS', `one call to action: ${asks[0]}`);
  } else if (asks.length === 0) {
    add('ONE ASK', 'WARN', 'no call to action. Decide what this post is for');
  } else {
    add('ONE ASK', 'WARN', `${asks.length} asks (${asks.join(', ')}). Two asks is the same as none`);
  }

  const density = (emojiMatches.length * 100) / Math.max(chars, 1);
  add(
    'EMOJI',
    density > 4 ? 'WARN' : 'PASS',
    `${emojiMatches.length} emoji, ${density.toFixed(1)} per 100 characters` + (density > 4 ? ' - reads as decoration' : '')
  );

  if (keywords.length > 0) {
    const low = stripped.toLowerCase();
    const found = keywords.filter((k) => low.includes(k.toLowerCase()));
    const missing = keywords.filter((k) => !low.includes(k.toLowerCase()));
    const inWindow = found.filter((k) => window.toLowerCase().includes(k.toLowerCase()));
    const status: LintCheckStatus = missing.length === 0 ? 'PASS' : found.length > 0 ? 'WARN' : 'FAIL';
    add(
      'SEARCH TERMS',
      status,
      `${found.length}/${keywords.length} present` +
        (found.length > 0 ? `, ${inWindow.length} in the visible window` : '') +
        (missing.length > 0 ? `. Missing: ${missing.join(', ')}` : '')
    );
  }

  const fails = checks.filter((c) => c.status === 'FAIL').length;
  const warns = checks.filter((c) => c.status === 'WARN').length;
  const verdict: LintResult['verdict'] = fails > 0 ? 'FIX' : warns > 0 ? 'REVIEW' : 'READY';

  return {
    characters: chars,
    limit: INSTAGRAM_CAPTION_LIMIT,
    truncateAt: cut,
    visible: window,
    truncated,
    firstLineChars: firstLine.length,
    hashtags: tags,
    mentions,
    links,
    emoji: emojiMatches.length,
    asks,
    checks,
    verdict,
  };
}
