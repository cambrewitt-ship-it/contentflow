import { NextRequest, NextResponse } from 'next/server';
import { startCheckoutForUser } from '@/lib/checkoutHelpers';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { priceId } = await req.json();

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    // Get base URL from request headers to support multiple domains
    const origin = req.headers.get('origin');
    const host = req.headers.get('host') || 'localhost:3000';

    let baseUrl: string;
    if (origin) {
      // Use origin header if available (includes protocol)
      baseUrl = origin;
    } else {
      // Fallback: construct from host and protocol
      const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
      baseUrl = `${protocol}://${host}`;
    }

    const result = await startCheckoutForUser({
      userId: user.id,
      email: user.email!,
      priceId,
      baseUrl,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    logger.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
