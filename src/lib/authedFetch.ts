import { supabase } from '@/lib/supabaseClient';

// JSON fetch for our own API routes, for calls that must not silently fail:
//   - reads the session at call time (getSession refreshes an expired token),
//     rather than a token captured in React state that may have gone stale
//   - on a 401, refreshes the session and retries once
//   - times out instead of spinning forever, with a readable error

const DEFAULT_TIMEOUT_MS = 90_000;

async function currentToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authedFetchJson<T = Record<string, unknown>>(
  url: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const { body, timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = init;

  const attempt = async (token: string | null) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...rest,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let res: Response;
  try {
    res = await attempt(await currentToken());
    if (res.status === 401) {
      const { data } = await supabase.auth.refreshSession();
      res = await attempt(data.session?.access_token ?? null);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('This is taking too long — please try again.');
    }
    throw new Error('Network error — check your connection and try again.');
  }

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON body (e.g. an HTML error page)
  }

  if (res.status === 401) {
    throw new Error('Your login session has expired — refresh the page and try again.');
  }
  if (!res.ok || data.success === false) {
    throw new Error((data.error as string) || `Request failed (${res.status})`);
  }
  return data as T;
}
