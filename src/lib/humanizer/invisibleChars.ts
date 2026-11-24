// A superset of the Unicode "format" (Cf) category characters that show up
// as an invisible fingerprint in generated text. Python's unicodedata module
// gives this for free (`unicodedata.category(c) == 'Cf'`); JS has no
// equivalent, so this is an explicit approximation covering the ranges that
// actually appear in the wild (zero-width/joiner/direction marks, the tag-
// character smuggling block, Arabic/Syriac format marks, deprecated
// annotation characters).
export const FORMAT_CHAR_RE =
  /[­؀-؅؜۝܏࣢᠎​-‏‪-‮⁠-⁤⁦-⁯﻿￹-￻\u{110BD}\u{110CD}\u{13430}-\u{13438}\u{1BCA0}-\u{1BCA3}\u{1D173}-\u{1D17A}\u{E0001}\u{E0020}-\u{E007F}]/gu;

// The "hard space" family detect.ts counts separately from em dashes/curly
// quotes — the non-breaking and fixed-width spaces a phone keyboard doesn't
// produce but a generated draft sometimes does.
export const HARD_SPACE_RE = /[      ]/g;
