// src/lib/ayrshare.ts
export type AyrsharePublishPayload = {
  caption?: string;
  imageUrl?: string;
  schedule_time?: string; // ISO string
  platforms: string[]; // e.g. ['facebook','instagram']
  external_id?: string;
};

const AYR_API = 'https://app.ayrshare.com/api/v1';
const AYR_KEY = process.env.AYRSHARE_API_KEY;

if (!AYR_KEY) {
  console.warn('AYRSHARE_API_KEY not set — Ayrshare publishing will be unavailable.');
}

export async function publishToAyrshare(payload: AyrsharePublishPayload) {
  console.log('🔧 publishToAyrshare called with payload:', payload);
  
  if (!AYR_KEY) {
    console.error('❌ AYRSHARE_API_KEY missing in publishToAyrshare function');
    throw new Error('Missing AYRSHARE_API_KEY environment variable');
  }

  console.log('🔑 AYRSHARE_API_KEY found, length:', AYR_KEY.length);
  console.log('🌐 Ayrshare API endpoint:', AYR_API);

  const body: any = {
    text: payload.caption ?? '',
    platform: payload.platforms.join(','),
  };
  
  if (payload.imageUrl) {
    body.mediaUrls = [payload.imageUrl];
    console.log('📸 Image URL included:', payload.imageUrl);
  }
  
  if (payload.schedule_time) {
    body.scheduleAt = payload.schedule_time;
    console.log('⏰ Schedule time included:', payload.schedule_time);
  }

  console.log('📤 Final request body to Ayrshare:', body);
  console.log('🔗 Making request to:', `${AYR_API}/posts`);

  try {
    const res = await fetch(`${AYR_API}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AYR_KEY}`
      },
      body: JSON.stringify(body)
    });

    console.log('📡 Ayrshare API response received:', {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries())
    });

    const json = await res.json();
    console.log('📄 Ayrshare API response body:', json);

    if (!res.ok) {
      console.error('❌ Ayrshare API error response:', {
        status: res.status,
        statusText: res.statusText,
        error: json
      });
      
      const err = new Error('Ayrshare API error: ' + (json?.message || JSON.stringify(json)));
      (err as any).response = json;
      (err as any).status = res.status;
      (err as any).statusText = res.statusText;
      throw err;
    }

    console.log('✅ Ayrshare API call successful, returning result');
    return json;
    
  } catch (fetchError: any) {
    console.error('💥 Fetch error in publishToAyrshare:', {
      message: fetchError.message,
      name: fetchError.name,
      cause: fetchError.cause
    });
    
    // Re-throw with additional context
    const enhancedError = new Error(`Ayrshare API request failed: ${fetchError.message}`);
    (enhancedError as any).originalError = fetchError;
    (enhancedError as any).payload = payload;
    throw enhancedError;
  }
}