'use client';

import { Suspense, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { safeReturnPath } from '@/lib/returnPath';

/**
 * Landing page for every social OAuth return (Zernio, formerly LATE).
 *
 * It is public on purpose: the OAuth round trip can come back in a browser that
 * has no ContentFlow session (Instagram/Facebook in-app browsers, another device,
 * an expired session). Signed-in users are forwarded to `next` straight away;
 * everyone else sees the result here instead of being bounced to the login page.
 */

function platformName(platform: string | null): string {
  if (!platform || platform === 'unknown') return 'Your account';
  const names: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    twitter: 'X (Twitter)',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    threads: 'Threads',
  };
  return names[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

function OAuthComplete() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const next = safeReturnPath(searchParams.get('next')) ?? '/dashboard';

  const result = useMemo(() => {
    const params = new URL(next, 'http://x').searchParams;
    const errorPlatform = params.get('oauth_error');
    const status = params.get('status');
    if (errorPlatform || status === 'error') {
      return {
        ok: false,
        title: `${platformName(errorPlatform || params.get('connected'))} could not be connected`,
        detail: params.get('error_description') || params.get('error') || 'Please try connecting again.',
      };
    }
    const platform = params.get('connected') || params.get('oauth_success');
    const username = params.get('username');
    return {
      ok: true,
      title: `${platformName(platform)} connected`,
      detail: username ? `Connected as ${username}.` : 'The account is now linked to ContentFlow.',
    };
  }, [next]);

  useEffect(() => {
    if (!loading && user) {
      window.location.replace(next);
    }
  }, [loading, user, next]);

  if (loading || user) {
    return <p className="text-sm text-gray-500">Finishing up…</p>;
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
      <div
        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-xl ${
          result.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
        aria-hidden
      >
        {result.ok ? '✓' : '!'}
      </div>
      <h1 className="text-lg font-semibold text-gray-900">{result.title}</h1>
      <p className="mt-2 text-sm text-gray-600">{result.detail}</p>
      <p className="mt-4 text-sm text-gray-600">
        You can close this tab and return to ContentFlow where you started.
      </p>
      <Link
        href={next}
        className="mt-6 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Go to ContentFlow
      </Link>
    </div>
  );
}

export default function OAuthCompletePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={<p className="text-sm text-gray-500">Finishing up…</p>}>
        <OAuthComplete />
      </Suspense>
    </main>
  );
}
