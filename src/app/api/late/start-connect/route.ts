import { NextResponse } from 'next/server';

const LATE_API_KEY = process.env.LATE_API_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!; // set in .env.local

export async function POST(req: Request) {
  try {
    const { platform } = await req.json();
    if (!platform) {
      return NextResponse.json({ error: 'Missing platform' }, { status: 400 });
    }

    // 1) Create a profile (for now, always create a new one)
    const profileRes = await fetch('https://getlate.dev/api/v1/profiles', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `test-profile-${platform}`,
        description: 'Temporary profile for dev'
      })
    });

    if (!profileRes.ok) {
      const err = await profileRes.text();
      return NextResponse.json({ error: 'Failed to create LATE profile', details: err }, { status: 500 });
    }

    const profile = await profileRes.json();
    const profileId = profile._id || profile.id;

    // 2) Build connect URL
    const redirectUrl = `${APP_URL}/api/late/oauth-callback`;
    const connectUrl = `https://getlate.dev/api/v1/connect/${platform}?profileId=${profileId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    return NextResponse.json({ connectUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
