// Platforms a calendar post can be marked for; ids match the social preview components
export const TARGET_PLATFORM_IDS = ['facebook', 'instagram', 'linkedin', 'tiktok', 'twitter'] as const;

export type TargetPlatform = (typeof TARGET_PLATFORM_IDS)[number];

export const TARGET_PLATFORM_LABELS: Record<TargetPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  twitter: 'Twitter/X',
};

// Keeps only known platforms, de-duplicated, in the canonical order above
export function normalizeTargetPlatforms(values: unknown): TargetPlatform[] {
  if (!Array.isArray(values)) return [];
  return TARGET_PLATFORM_IDS.filter((id) => values.includes(id));
}
