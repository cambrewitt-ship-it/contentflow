/**
 * Helpers for sending the user back to the screen they were on, e.g. after a
 * social OAuth round trip or a login.
 */

// Query params the OAuth callbacks add; stripped before adding fresh ones so
// a page that already showed a result doesn't carry a stale one.
const OAUTH_RESULT_PARAMS = [
  'connected',
  'status',
  'username',
  'profileId',
  'message',
  'error',
  'error_description',
  'oauth_error',
  'oauth_success',
];

/**
 * Returns `value` only if it is a same-origin path (`/dashboard/...`), so a
 * crafted link can't bounce the user to another site. Otherwise null.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return null;
  }
  return value;
}

/** The current page's path and query, minus any previous OAuth result params. */
export function currentReturnPath(): string {
  const url = new URL(window.location.href);
  OAUTH_RESULT_PARAMS.forEach((param) => url.searchParams.delete(param));
  return url.pathname + url.search;
}

/**
 * Absolute URL for `returnPath` on `appUrl` with the OAuth result params set.
 * Returns null if `returnPath` isn't a safe same-origin path.
 */
export function buildOAuthReturnUrl(
  appUrl: string,
  returnPath: string | null | undefined,
  params: Record<string, string>
): string | null {
  const path = safeReturnPath(returnPath);
  if (!path) return null;

  const url = new URL(path, appUrl);
  if (url.origin !== new URL(appUrl).origin) return null;

  OAUTH_RESULT_PARAMS.forEach((param) => url.searchParams.delete(param));
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

/** Login page URL that brings the user back to the current page after sign-in. */
export function loginUrlForCurrentPage(): string {
  const here = window.location.pathname + window.location.search;
  return `/auth/login?redirectTo=${encodeURIComponent(here)}`;
}
