import { FacebookIcon, InstagramIcon, LinkedInIcon, TikTokIcon, TwitterIcon } from '@/components/social-icons';
import { TARGET_PLATFORM_LABELS, normalizeTargetPlatforms, type TargetPlatform } from '@/lib/targetPlatforms';

const BRAND: Record<TargetPlatform, { bg: string; Icon: typeof FacebookIcon }> = {
  facebook: { bg: 'bg-[#1877F2]', Icon: FacebookIcon },
  instagram: { bg: 'bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]', Icon: InstagramIcon },
  linkedin: { bg: 'bg-[#0A66C2]', Icon: LinkedInIcon },
  tiktok: { bg: 'bg-black', Icon: TikTokIcon },
  twitter: { bg: 'bg-black', Icon: TwitterIcon },
};

export function PlatformLogo({ platform, size = 20 }: { platform: TargetPlatform; size?: number }) {
  const { bg, Icon } = BRAND[platform];
  const label = TARGET_PLATFORM_LABELS[platform];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ring-2 ring-white flex-shrink-0 ${bg}`}
      style={{ width: size, height: size }}
      title={label}
      aria-label={label}
    >
      <Icon size={Math.round(size * 0.55)} className="text-white" />
    </span>
  );
}

// Overlapping row of platform logos for the platforms a post is marked for
export function PlatformBadges({ platforms, size = 20 }: { platforms?: string[] | null; size?: number }) {
  const list = normalizeTargetPlatforms(platforms);
  if (list.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {list.map((p) => (
        <PlatformLogo key={p} platform={p} size={size} />
      ))}
    </span>
  );
}
