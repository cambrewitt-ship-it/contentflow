// Quick-pick reasons for "not quite right" feedback on a Content Agent post.
// Client-safe: shared by the swipe review UI and the feedback API.
// `rule` is the playbook rule saved when the tag is picked with no written
// note (a written note is turned into a rule by the AI instead).

export const FEEDBACK_TAGS = {
  ends_with_question: {
    label: 'Ends with a question',
    rule: "Don't end captions with a question. Vary the endings — a statement, an invitation, or a direct call to action.",
  },
  too_salesy: {
    label: 'Too salesy',
    rule: 'Keep captions low-pressure — no hard-sell language or stacked calls to action.',
  },
  too_long: {
    label: 'Too long',
    rule: "Keep captions short and tight — cut anything that doesn't add to the photo.",
  },
  too_generic: {
    label: 'Too generic',
    rule: 'Make every caption specific to its photo and this business — no lines that could fit any brand.',
  },
  cheesy: {
    label: 'Cheesy / cliché',
    rule: 'Avoid clichés, cheesy wordplay and forced puns.',
  },
  too_many_emojis: {
    label: 'Too many emojis',
    rule: 'Use emojis sparingly — one at most, often none.',
  },
  off_brand: {
    label: 'Off-brand tone',
    rule: null,
  },
  wrong_photo: {
    label: 'Wrong photo',
    rule: null,
  },
} as const satisfies Record<string, { label: string; rule: string | null }>;

export type FeedbackTag = keyof typeof FEEDBACK_TAGS;

export const FEEDBACK_TAG_IDS = Object.keys(FEEDBACK_TAGS) as FeedbackTag[];
