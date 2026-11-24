'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { PlatformBadges } from '@/components/PlatformBadges';
import { authedFetchJson } from '@/lib/authedFetch';
import { accountFullName, platformName, type SocialAccountLike } from '@/lib/socialAccounts';

export { platformName };

// Every connected social account by name, each with a Remove button.
// Used under "Social Media Platforms" on the client overview and on /connect-platforms.

export interface ListedSocialAccount extends SocialAccountLike {
  _id: string;
  profilePicture?: string | null;
}

export function ConnectedAccountsList({
  clientId,
  accounts,
  onRemoved,
  className = '',
}: {
  clientId: string;
  accounts: ListedSocialAccount[];
  /** Called after an account is disconnected, so the page can refresh its list */
  onRemoved: (accountId: string) => void;
  className?: string;
}) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (accounts.length === 0) return null;

  const remove = async (account: ListedSocialAccount) => {
    const label = `${platformName(account.platform)} — ${accountFullName(account) ?? 'this account'}`;
    if (
      !window.confirm(
        `Disconnect ${label}?\n\nPosts won't be published to it any more. If you reconnect the same account within an hour, its scheduled posts are restored.`
      )
    ) {
      return;
    }
    setRemovingId(account._id);
    setError(null);
    try {
      await authedFetchJson('/api/late/disconnect-account', {
        method: 'POST',
        body: { clientId, accountId: account._id },
      });
      onRemoved(account._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t disconnect that account');
    } finally {
      setRemovingId(null);
    }
  };

  // Group order: by platform, so two accounts on one platform sit together
  const sorted = [...accounts].sort((a, b) => a.platform.localeCompare(b.platform));

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Connected accounts</p>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {sorted.map(account => {
          const name = accountFullName(account) ?? 'Connected account';
          const removing = removingId === account._id;
          return (
            <li key={account._id} className="flex items-center gap-3 px-3 py-2.5">
              {account.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={account.profilePicture}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full border border-gray-100 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                  <PlatformBadges platforms={[account.platform]} size={22} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900" title={name}>
                  {name}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  {account.profilePicture && <PlatformBadges platforms={[account.platform]} size={12} />}
                  {platformName(account.platform)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void remove(account)}
                disabled={!!removingId}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Disconnect ${platformName(account.platform)} account ${name}`}
              >
                {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
