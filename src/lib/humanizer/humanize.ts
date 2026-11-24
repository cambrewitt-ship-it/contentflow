// Strips the machine fingerprint out of a draft, in three passes, ported
// from the ig-human skill's humanize.py:
//   1. INVISIBLE   delete/normalise characters a human keyboard never types.
//   2. TYPOGRAPHIC em dash -> comma, curly quotes -> straight, etc.
//   3. LEXICAL     swap the slop lexicon for plain words.
// Structural tells (rule-of-three, "not just X, it's Y", hashtag walls) are
// reported, never auto-rewritten — rewriting a sentence's shape needs
// judgement, which is a job for the hook-writer prompt, not a regex.
import { SLOP_LEXICON, SlopLexicon } from './slopLexicon';
import { FORMAT_CHAR_RE } from './invisibleChars';

export interface InvisibleHit {
  name: string;
  count: number;
  action: 'delete' | 'space';
}

export interface TypographicHit {
  name: string;
  count: number;
  to: string;
}

export interface LexicalHit {
  find: string;
  replace: string;
  count: number;
  family: string;
}

export interface StructureHit {
  name: string;
  count: number;
  fix: string;
}

export interface HumanizeReport {
  invisible: InvisibleHit[];
  typographic: TypographicHit[];
  lexical: LexicalHit[];
  structures: StructureHit[];
}

export interface HumanizeResult {
  text: string;
  report: HumanizeReport;
}

const URL_RE = /https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/g;
const SENT_RE = /[^.!?\n]+[.!?]*/g;

function parseCodepointRange(spec: string): [number, number] {
  if (spec.includes('-')) {
    const [a, b] = spec.split('-');
    return [parseInt(a.slice(2), 16), parseInt(b.slice(2), 16)];
  }
  const n = parseInt(spec.slice(2), 16);
  return [n, n];
}

function protectUrls(text: string): [string, string[]] {
  const found: string[] = [];
  const replaced = text.replace(URL_RE, (m) => {
    found.push(m);
    return `\u0000URL${found.length - 1}\u0000`;
  });
  return [replaced, found];
}

function restoreUrls(text: string, found: string[]): string {
  let out = text;
  found.forEach((url, i) => {
    out = out.split(`\u0000URL${i}\u0000`).join(url);
  });
  return out;
}

function escapeForWordMatch(find: string): string {
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(/ /g, '\\s+');
}

function matchCase(src: string, repl: string): string {
  if (!repl) return repl;
  if (src.length > 1 && src === src.toUpperCase() && src !== src.toLowerCase()) {
    return repl.toUpperCase();
  }
  if (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) {
    return repl.charAt(0).toUpperCase() + repl.slice(1);
  }
  return repl;
}

function passInvisible(text: string, lex: SlopLexicon): [string, InvisibleHit[]] {
  const hits: InvisibleHit[] = [];
  let out = text;
  for (const entry of lex.invisible) {
    const [start, end] = parseCodepointRange(entry.cp);
    const pattern =
      start === end
        ? new RegExp(`[\\u{${start.toString(16)}}]`, 'gu')
        : new RegExp(`[\\u{${start.toString(16)}}-\\u{${end.toString(16)}}]`, 'gu');
    const matches = out.match(pattern);
    if (matches && matches.length > 0) {
      hits.push({ name: `${entry.cp} ${entry.name}`, count: matches.length, action: entry.action });
      out = out.replace(pattern, entry.action === 'delete' ? '' : ' ');
    }
  }
  const stray = out.match(FORMAT_CHAR_RE);
  if (stray && stray.length > 0) {
    hits.push({ name: 'other invisible format chars', count: stray.length, action: 'delete' });
    out = out.replace(FORMAT_CHAR_RE, '');
  }
  return [out, hits];
}

function passTypographic(text: string, lex: SlopLexicon): [string, TypographicHit[]] {
  const hits: TypographicHit[] = [];
  let out = text;
  for (const entry of lex.typographic) {
    const ch = entry.from;
    const count = out.split(ch).length - 1;
    if (count === 0) continue;
    hits.push({ name: `${ch} ${entry.name}`, count, to: entry.to.trim() || '(space)' });
    if (ch === '—') {
      out = out.replace(/\s*—\s*/g, ', ');
    } else if (ch === '–') {
      out = out.replace(/\s*–\s*(?=\d)/g, '-');
      out = out.replace(/\s+–\s+/g, ', ');
      out = out.split('–').join('-');
    } else {
      out = out.split(ch).join(entry.to);
    }
  }
  out = out.replace(/,\s*([,.;:!?])/g, '$1');
  out = out.replace(/,\s*\n/g, '\n');
  return [out, hits];
}

function passLexical(text: string, lex: SlopLexicon): [string, LexicalHit[]] {
  const hits: LexicalHit[] = [];
  let out = text;
  const entries = [...lex.words, ...lex.phrases].sort((a, b) => b.find.length - a.find.length);
  for (const entry of entries) {
    const pattern = new RegExp(`\\b${escapeForWordMatch(entry.find)}\\b`, 'gi');
    const found = out.match(pattern);
    if (!found || found.length === 0) continue;
    hits.push({ find: entry.find, replace: entry.replace || '(deleted)', count: found.length, family: entry.family });
    out = out.replace(pattern, (m) => matchCase(m, entry.replace));
  }
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/^[ \t]*(?:[,.;:]+[ \t]*)+/gm, '');
  out = out.replace(/^[ \t](?=\S)/gm, '');
  out = out.replace(/\s+([,.;:!?])/g, '$1');
  out = out.replace(/,\s*([,.;:!?])/g, '$1');
  out = out.replace(/\.\.\./g, '\u0000ELL\u0000');
  out = out.replace(/\.\s*\.+/g, '.');
  out = out.replace(/([!?])\s*\./g, '$1');
  out = out.split('\u0000ELL\u0000').join('...');
  out = out.replace(/^[ \t]+$/gm, '');
  out = out.replace(/\n{3,}/g, '\n\n');
  out = out.replace(
    /,\s*(also|so|still|basically|in the end)\s*,\s*/gi,
    (_m, w: string) => `. ${w.charAt(0).toUpperCase()}${w.slice(1)}, `
  );
  return [out, hits];
}

export function scanStructures(text: string, lex: SlopLexicon = SLOP_LEXICON): StructureHit[] {
  const flags: StructureHit[] = [];
  for (const s of lex.structures) {
    let re: RegExp;
    try {
      re = new RegExp(s.regex, 'gmu');
    } catch {
      continue;
    }
    const matches = text.match(re);
    if (matches && matches.length > 0) {
      flags.push({ name: s.name, count: matches.length, fix: s.fix });
    }
  }
  const lens = (text.match(SENT_RE) ?? [])
    .map((s) => s.trim().split(/\s+/).filter(Boolean).length)
    .filter((n) => n > 2);
  if (lens.length >= 4) {
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
    const cv = mean ? Math.sqrt(variance) / mean : 0;
    if (cv < 0.35) {
      flags.push({
        name: `Uniform sentence length (variation ${cv.toFixed(2)})`,
        count: lens.length,
        fix: 'Break one sentence in half. Let another run long. Machines write even.',
      });
    }
  }
  return flags;
}

function restoreCapitals(original: string, text: string): string {
  const starts = [...original.matchAll(/(?:^|[.!?]\s+|\n)\s*([A-Za-z])/gm)].map((m) => m[1]);
  if (starts.length === 0) return text;
  const upperCount = starts.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  if (upperCount * 2 < starts.length) return text;
  return text.replace(
    /(?:^|(?<=[.!?] )|(?<=[.!?]\n)|(?<=\n))\s*([a-z])/gm,
    (m, c: string) => m.slice(0, -1) + c.toUpperCase()
  );
}

export function humanizeText(rawText: string, lex: SlopLexicon = SLOP_LEXICON): HumanizeResult {
  const rawForCase = rawText;
  const [protectedText, urls] = protectUrls(rawText);
  const [afterInvisible, invisibleHits] = passInvisible(protectedText, lex);
  const [afterTypo, typoHits] = passTypographic(afterInvisible, lex);
  const [afterLexical, lexicalHits] = passLexical(afterTypo, lex);
  const withCapitals = restoreCapitals(rawForCase, afterLexical);
  const restored = restoreUrls(withCapitals, urls);
  return {
    text: restored.trim() + '\n',
    report: {
      invisible: invisibleHits,
      typographic: typoHits,
      lexical: lexicalHits,
      structures: scanStructures(restored, lex),
    },
  };
}
