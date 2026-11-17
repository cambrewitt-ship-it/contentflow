// A five-check panel that scores how machine-written a draft looks, ported
// from the ig-human skill's detect.py. These are local heuristics modelled
// on the signals public AI detectors key on (sentence-length variation,
// concreteness, stock vocabulary, typographic fingerprint, voice) — not a
// call to GPTZero/Originality/Copyleaks/Winston/Turnitin, and no promise of
// matching their verdict. Each check returns 0-100, higher is more human.
import { SLOP_LEXICON, SlopLexicon } from './slopLexicon';
import { FORMAT_CHAR_RE, HARD_SPACE_RE } from './invisibleChars';

const SENT_RE = /[^.!?\n]+[.!?]*/g;
const WORD_RE = /[A-Za-z']+/g;
const CONTRACTIONS_RE = /\b\w+'(?:s|t|re|ve|ll|d|m)\b/gi;
const PRONOUNS_RE = /\b(?:i|me|my|mine|we|us|our|you|your)\b/gi;
const NUMBERS_RE = /\b\d[\d,.]*%?\b|\$\d/g;
const PROPER_RE = /(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}\b/gm;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function scale(value: number, human: number, machine: number): number {
  if (human === machine) return 50;
  return clamp(((value - machine) / (human - machine)) * 100);
}

function sentenceList(text: string): string[] {
  return (text.match(SENT_RE) ?? [])
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length > 2);
}

function wordsOf(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

function checkBurstiness(text: string): [number, string] {
  const lens = sentenceList(text).map((s) => s.split(/\s+/).filter(Boolean).length);
  if (lens.length < 4) return [50, 'too short to judge'];
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  const cv = mean ? Math.sqrt(variance) / mean : 0;
  const score = scale(cv, 0.7, 0.22);
  return [score, `variation ${cv.toFixed(2)} across ${lens.length} sentences (want 0.55+)`];
}

function checkSpecificity(text: string): [number, string] {
  const w = wordsOf(text);
  if (w.length < 25) return [50, 'too short to judge'];
  const per100 = 100 / w.length;
  const numbersCount = (text.match(NUMBERS_RE) ?? []).length;
  const properSet = new Set(text.match(PROPER_RE) ?? []);
  const hits = numbersCount + properSet.size;
  const density = hits * per100;
  const score = scale(density, 6.0, 0.5);
  return [score, `${hits} concrete markers, ${density.toFixed(1)} per 100 words (want 4+)`];
}

function checkSlop(text: string, lex: SlopLexicon): [number, string] {
  const w = wordsOf(text);
  if (w.length === 0) return [50, 'empty'];
  let hits = 0;
  const found: string[] = [];
  for (const entry of [...lex.words, ...lex.phrases]) {
    const pattern = new RegExp(`\\b${escapeForWordMatch(entry.find)}\\b`, 'gi');
    const n = (text.match(pattern) ?? []).length;
    if (n > 0) {
      hits += n;
      found.push(entry.find);
    }
  }
  const density = (hits * 100) / w.length;
  const score = scale(density, 0.0, 4.0);
  let detail = `${hits} stock terms, ${density.toFixed(1)} per 100 words`;
  if (found.length > 0) {
    const sorted = [...found].sort();
    detail += ` (${sorted.slice(0, 4).join(', ')}${found.length > 4 ? ', ...' : ''})`;
  }
  return [score, detail];
}

function checkFingerprint(text: string): [number, string] {
  const invisible = (text.match(FORMAT_CHAR_RE) ?? []).length;
  const em = (text.match(/—/g) ?? []).length;
  const curly = (text.match(/[‘’“”]/g) ?? []).length;
  const ellip = (text.match(/…/g) ?? []).length;
  const nbsp = (text.match(HARD_SPACE_RE) ?? []).length;
  const total = invisible * 4 + em * 2 + curly + ellip + nbsp;
  const per1k = (total * 1000) / Math.max(text.length, 1);
  const score = scale(per1k, 0.0, 12.0);
  const detail = `${invisible} invisible, ${em} em dash, ${curly} curly quote, ${ellip} ellipsis, ${nbsp} hard space`;
  return [score, detail];
}

function checkVoice(text: string, lex: SlopLexicon): [number, string] {
  const w = wordsOf(text);
  if (w.length < 25) return [50, 'too short to judge'];
  const per100 = 100 / w.length;
  const contractions = (text.match(CONTRACTIONS_RE) ?? []).length * per100;
  const person = (text.match(PRONOUNS_RE) ?? []).length * per100;
  let tells = 0;
  const names: string[] = [];
  for (const s of lex.structures) {
    let re: RegExp;
    try {
      re = new RegExp(s.regex, 'gmu');
    } catch {
      continue;
    }
    const n = (text.match(re) ?? []).length;
    if (n > 0) {
      tells += n;
      names.push(s.id);
    }
  }
  const bulletLines = [...text.matchAll(/^[ \t]*[-*•]\s+(.+)$/gm)].map(
    (m) => m[1].split(/\s+/).filter(Boolean).length
  );
  let uniform = false;
  if (bulletLines.length >= 3) {
    const mean = bulletLines.reduce((a, b) => a + b, 0) / bulletLines.length;
    const variance = bulletLines.reduce((a, b) => a + (b - mean) ** 2, 0) / bulletLines.length;
    uniform = Math.sqrt(variance) < 1.6;
  }
  let score = scale(contractions, 3.0, 0.0) * 0.35 + scale(person, 8.0, 1.0) * 0.35 + clamp(100 - tells * 22) * 0.3;
  if (uniform) {
    score -= 12;
    names.push('uniform-bullets');
  }
  let detail = `${contractions.toFixed(1)} contractions, ${person.toFixed(1)} personal pronouns per 100 words, ${tells} structural tell(s)`;
  if (names.length > 0) detail += ` [${names.slice(0, 4).join(', ')}]`;
  return [clamp(score), detail];
}

function escapeForWordMatch(find: string): string {
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(/ /g, '\\s+');
}

export type DetectVerdict = 'PASS' | 'REVIEW' | 'FLAGGED';

export interface DetectCheckResult {
  score: number;
  detail: string;
}

export interface DetectResult {
  checks: Record<string, DetectCheckResult>;
  score: number;
  verdict: DetectVerdict;
}

const CHECK_NAMES = ['BURSTINESS', 'SPECIFICITY', 'SLOP DENSITY', 'FINGERPRINT', 'VOICE'] as const;

export function detectHumanScore(text: string, lex: SlopLexicon = SLOP_LEXICON): DetectResult {
  const results: Record<string, [number, string]> = {
    BURSTINESS: checkBurstiness(text),
    SPECIFICITY: checkSpecificity(text),
    'SLOP DENSITY': checkSlop(text, lex),
    FINGERPRINT: checkFingerprint(text),
    VOICE: checkVoice(text, lex),
  };
  const scores = CHECK_NAMES.map((name) => results[name][0]);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const overall = clamp(mean * 0.6 + minScore * 0.4);
  const verdict: DetectVerdict = overall >= 70 && minScore >= 55 ? 'PASS' : overall >= 50 ? 'REVIEW' : 'FLAGGED';

  const checks: Record<string, DetectCheckResult> = {};
  for (const name of CHECK_NAMES) {
    checks[name] = { score: Math.round(results[name][0] * 10) / 10, detail: results[name][1] };
  }
  return { checks, score: Math.round(overall * 10) / 10, verdict };
}
