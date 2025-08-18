// late-proxy/api/schedule.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const LATE_KEY = process.env.LATE_API_KEY;
  if (!LATE_KEY) return res.status(500).json({ error: 'Missing LATE_API_KEY env var' });

  try {
    const lateResp = await fetch('https://getlate.dev/api/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await lateResp.json();
    res.status(lateResp.status).json(data);
  } catch (err) {
    console.error('Proxy error', err);
    res.status(500).json({ error: 'proxy error', details: err.message });
  }
}
