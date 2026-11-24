import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { isEmailConfigured } from '@/lib/email';
import {
  APPROVAL_WATCHERS_SETUP_MESSAGE,
  addWatcher,
  addWatcherSchema,
  getWatcherSuggestions,
  listWatchers,
  removeWatcher,
} from '@/lib/approvalWatchers';

export const dynamic = 'force-dynamic';

// The calendar's "Notify by email" list: who gets an email when one of this
// client's posts is approved, gets a comment, is moved, etc. (src/lib/approvalWatchers.ts)

type Params = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  try {
    const [{ watchers, missingTable }, suggestions] = await Promise.all([
      listWatchers(clientId),
      getWatcherSuggestions(clientId),
    ]);
    return NextResponse.json({
      success: true,
      watchers,
      suggestions,
      emailConfigured: isEmailConfigured(),
      ...(missingTable ? { setupRequired: APPROVAL_WATCHERS_SETUP_MESSAGE } : {}),
    });
  } catch (error) {
    logger.error('GET approval watchers error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load email notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = addWatcherSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message || 'Enter a valid email address' },
      { status: 400 }
    );
  }

  const result = await addWatcher(clientId, parsed.data, auth.user.id);
  if (!result.watcher) {
    return NextResponse.json(
      { success: false, error: result.error ?? 'Could not add that email' },
      { status: result.missingTable ? 503 : 500 }
    );
  }
  return NextResponse.json({ success: true, watcher: result.watcher });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

  const ok = await removeWatcher(clientId, id);
  if (!ok) return NextResponse.json({ success: false, error: 'Could not remove that email' }, { status: 500 });
  return NextResponse.json({ success: true });
}
