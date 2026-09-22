import { Check } from 'lucide-react';
import { FacebookIcon, InstagramIcon, LinkedInIcon, TikTokIcon, TwitterIcon } from '@/components/social-icons';
import { TARGET_PLATFORM_IDS, TARGET_PLATFORM_LABELS, normalizeTargetPlatforms, type TargetPlatform } from '@/lib/targetPlatforms';

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

// Row of logos for the platforms a post is marked for
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

// Tickable chips for choosing which platforms a post is intended for
export function PlatformPicker({
  selected,
  onToggle,
  disabled = false,
}: {
  selected: TargetPlatform[];
  onToggle: (platform: TargetPlatform) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TARGET_PLATFORM_IDS.map((platform) => {
        const isOn = selected.includes(platform);
        return (
          <button
            key={platform}
            type="button"
            role="checkbox"
            aria-checked={isOn}
            onClick={() => onToggle(platform)}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:cursor-default ${
              isOn
                ? 'bg-gray-900 border-gray-900 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <PlatformLogo platform={platform} size={20} />
            {TARGET_PLATFORM_LABELS[platform]}
            {isOn && <Check className="w-3 h-3" />}
          </button>
        );
      })}
    </div>
  );
}
