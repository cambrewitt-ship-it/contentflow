// Scores the first line of a Reel/caption on five properties strong hooks
// share, ported from the ig-reel skill's hookscore.py: a length you can say
// in under three seconds, a concrete marker, something at stake, the
// payload at the front rather than the back, and a viewer to aim it at.
//
// This is five local heuristics, not a view predictor. Tested against 74
// real short-form hooks: it separates a real hook from a deliberately bad
// one well (AUC 0.83), but barely separates a good creator's hits from that
// same creator's misses (AUC 0.56, where 0.50 is a coin flip). Use it to
// catch greetings, preambles and hooks with nothing concrete in them — not
// to pick a winner between two decent hooks.

const WORD_RE = /[A-Za-z0-9$%'’-]+/g;

const NUMBER_SOURCE =
  "\\$\\s?\\d[\\d,]*(?:\\.\\d+)?" +
  "|\\b\\d[\\d,]*(?:\\.\\d+)?\\s?" +
  '(?:%|k\\b|x\\b|hrs?\\b|hours?\\b|mins?\\b|minutes?\\b' +
  '|days?\\b|weeks?\\b|months?\\b|years?\\b)?';
const NUMBER_RE = new RegExp(NUMBER_SOURCE, 'gi');
const NUMBER_ANCHORED_RE = new RegExp(`^(?:${NUMBER_SOURCE})`, 'i');

// No MULTILINE-equivalent needed — hooks are scored one line at a time, so
// `^` means "start of this line" either way.
const PROPER_RE = /(?<!^)\b[A-Z][a-z]{2,}\b/g;

const HASHTAG_TEST_RE = /(?:^|\s)#\w+/;
const EMOJI_TEST_RE = /[\u{1F300}-\u{1FAFF}☀-➿]/u;

const SPOKEN_NUMBERS = new Set([
  'zero', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'fifteen', 'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million',
  'billion', 'dozen', 'half', 'twice', 'triple',
]);

const MONEY_WORDS = new Set([
  'dollars', 'dollar', 'bucks', 'grand', 'percent', 'cents',
  'millionaire', 'billionaire', 'revenue', 'profit', 'salary', 'rent',
]);

const STAKES = new Set([
  'stop', 'never', 'wrong', 'mistake', 'mistakes', 'lost', 'lose', 'losing',
  'cost', 'costs', 'broke', 'broken', 'failed', 'failure', 'fail', 'nobody',
  'no', 'not', "don't", 'dont', "doesn't", "didn't", "can't", "won't",
  'quit', 'quitting', 'fired', 'deleted', 'delete', 'killed', 'kills', 'kill',
  'replaced', 'replaces', 'cut', 'beat', 'free', 'paid', 'charged', 'hired',
  'saved', 'first',
  'banned', 'illegal', 'worst', 'hate', 'hated', 'wasted', 'waste', 'scam',
  'lie', 'lied', 'lying', 'truth', 'secret', 'hidden', 'stole', 'stolen',
  'before', 'until', 'instead', 'but', 'except', 'unless', 'problem',
  'risk', 'danger', 'warning', 'regret', 'wish', 'should', "shouldn't",
  'still', 'already', 'only', 'without', 'versus', 'vs', 'actually',
]);

const WEAK_OPENERS = [
  'so', 'ok', 'okay', 'hey', 'hi', 'hello', 'guys', 'yo', 'alright',
  'welcome', 'today', 'basically', 'honestly', 'look', 'listen', 'um',
  'just', 'let', 'lets', "let's", 'i wanted', 'i want', 'one of',
  'have you', 'did you', 'do you', 'are you', 'in this', 'in today',
  'the thing', 'a lot', 'there is', 'there are', 'this is', 'it is',
  'as a', 'when it', "if you've", 'you know',
];

const IMPERATIVES = new Set([
  'stop', 'steal', 'copy', 'delete', 'try', 'watch', 'read', 'save',
  'use', 'build', 'make', 'write', 'send', 'take', 'start', 'quit',
  'never', 'always', "don't", 'dont', 'do', 'put', 'run', 'check',
]);

const DEALBREAKERS: Array<[RegExp, string]> = [
  [/^\s*(?:stop scrolling|don'?t scroll)/i, 'Opens with "stop scrolling". Asking for attention proves you have not earned it.'],
  [/\b(?:in (?:this|today'?s) (?:video|reel)|i'?m going to show you|i'?ll show you how)\b/i, 'Video preamble. Delete it and open on the payoff.'],
  [/^\s*(?:hey |hi |what'?s up |welcome )/i, 'Greeting. Nobody came to the feed to be greeted.'],
  [HASHTAG_TEST_RE, 'Hashtag in the hook. Hashtags belong at the bottom of the caption, if anywhere.'],
  [EMOJI_TEST_RE, 'Emoji in the hook. On-screen text at hook size has room for words or for an emoji, not both.'],
];

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function stripQuote(s: string): string {
  return s.replace(/^['’]+|['’]+$/g, '');
}

function wordsOf(text: string): string[] {
  const noCommas = text.replace(/(?<=\d),(?=\d)/g, '');
  return noCommas.match(WORD_RE) ?? [];
}

function checkLength(text: string): [number, string] {
  const w = wordsOf(text);
  const n = w.length;
  const secs = n / 2.75;
  const chars = text.trim().length;
  let score: number;
  if (n >= 5 && n <= 12) score = 100;
  else if (n < 5) score = clamp(100 - (5 - n) * 20);
  else score = clamp(100 - (n - 12) * 11);
  if (chars > 60) score -= 12;
  return [clamp(score), `${n} words, ${chars} chars, ~${secs.toFixed(1)}s spoken (want 5-12 words)`];
}

function checkSpecificity(text: string): [number, string] {
  const nums = (text.match(NUMBER_RE) ?? []).map((n) => n.trim()).filter(Boolean);
  const propers = new Set(text.match(PROPER_RE) ?? []);
  const low = wordsOf(text).map((w) => stripQuote(w.toLowerCase()));
  const spoken = low.filter((w) => SPOKEN_NUMBERS.has(w) || MONEY_WORDS.has(w));
  const hits = nums.length + propers.size + spoken.length;
  const score = hits === 0 ? 15 : clamp(45 + hits * 30);
  const found = [...nums.slice(0, 2), ...Array.from(propers).sort().slice(0, 2), ...spoken.slice(0, 2)].join(', ');
  return [score, `${hits} concrete marker(s)` + (found ? `: ${found}` : ' - no number, no name, nothing checkable')];
}

function checkStakes(text: string): [number, string] {
  const w = wordsOf(text).map((x) => stripQuote(x.toLowerCase()));
  const hitSet = new Set(w.filter((x) => STAKES.has(x)));
  const markers = Array.from(hitSet).sort();
  if (/\$\s?\d/.test(text)) markers.push('a price');
  const n = markers.length;
  const score = n === 0 ? 20 : n === 1 ? 70 : 100;
  const detail =
    `${n} tension marker(s)` + (markers.length > 0 ? `: ${markers.slice(0, 4).join(', ')}` : ' - nothing is at stake in this line');
  return [clamp(score), detail];
}

function checkFrontload(text: string): [number, string] {
  const w = wordsOf(text);
  if (w.length === 0) return [0, 'empty'];
  const low = w.map((x) => stripQuote(x.toLowerCase()));
  const opener = low.slice(0, 2).join(' ');
  let penalty = 0;
  let hitOpener: string | null = null;
  for (const weak of WEAK_OPENERS) {
    if (opener.startsWith(weak) || low[0] === weak) {
      penalty = 30;
      hitOpener = weak;
      break;
    }
  }
  let payload: number | null = null;
  for (let i = 0; i < low.length; i++) {
    const token = low[i];
    if (STAKES.has(token) || SPOKEN_NUMBERS.has(token) || MONEY_WORDS.has(token) || NUMBER_ANCHORED_RE.test(w[i])) {
      payload = i;
      break;
    }
  }
  let base: number;
  let where: string;
  if (payload === null) {
    base = 30;
    where = 'no payload word anywhere in the line';
  } else if (payload <= 3) {
    base = 100;
    where = `payload at word ${payload + 1}`;
  } else if (payload <= 6) {
    base = 70;
    where = `payload at word ${payload + 1}, could move forward`;
  } else {
    base = 40;
    where = `payload at word ${payload + 1}, too late`;
  }
  const detail = where + (hitOpener ? `; weak opener "${hitOpener}"` : '');
  return [clamp(base - penalty), detail];
}

function checkAddress(text: string): [number, string] {
  const low = text.toLowerCase();
  const w = wordsOf(text).map((x) => stripQuote(x.toLowerCase()));
  if (/\b(?:you|your|you're|youre|yourself)\b/.test(low)) return [100, 'speaks to the viewer'];
  if (w.length > 0 && IMPERATIVES.has(w[0])) return [90, `imperative opener ("${w[0]}")`];
  if (/\b(?:i|my|me|we|our)\b/.test(low)) return [70, 'first person, no viewer named'];
  return [35, 'third person, nobody in the room'];
}

export interface HookCheckResult {
  score: number;
  detail: string;
}

export type HookVerdict = 'STRONG' | 'OK' | 'WEAK';

export interface HookScoreResult {
  checks: Record<string, HookCheckResult>;
  weakest: string;
  flags: string[];
  score: number;
  verdict: HookVerdict;
}

const CHECK_NAMES = ['LENGTH', 'SPECIFICITY', 'STAKES', 'FRONTLOAD', 'ADDRESS'] as const;

export function scoreHook(text: string): HookScoreResult {
  const results: Record<string, [number, string]> = {
    LENGTH: checkLength(text),
    SPECIFICITY: checkSpecificity(text),
    STAKES: checkStakes(text),
    FRONTLOAD: checkFrontload(text),
    ADDRESS: checkAddress(text),
  };
  const flags = DEALBREAKERS.filter(([re]) => re.test(text)).map(([, msg]) => msg);
  const scores = CHECK_NAMES.map((name) => results[name][0]);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const overall = clamp(mean * 0.6 + minScore * 0.4 - flags.length * 15);
  const verdict: HookVerdict =
    overall >= 70 && minScore >= 55 && flags.length === 0 ? 'STRONG' : overall >= 50 ? 'OK' : 'WEAK';
  const weakest = CHECK_NAMES.reduce((min, name) => (results[name][0] < results[min][0] ? name : min), CHECK_NAMES[0]);

  const checks: Record<string, HookCheckResult> = {};
  for (const name of CHECK_NAMES) {
    checks[name] = { score: Math.round(results[name][0] * 10) / 10, detail: results[name][1] };
  }
  return { checks, weakest, flags, score: Math.round(overall * 10) / 10, verdict };
}
