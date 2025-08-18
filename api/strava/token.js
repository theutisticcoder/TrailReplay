// Secure Strava OAuth code exchange (keeps client secret on the server)

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const { code } = req.body || {};
        if (!code) {
            return res.status(400).json({ error: 'Missing code' });
        }
        // Support user's configured env vars (Vercel): prefer VITE_*; fallback to STRAVA_*
        const client_id = process.env.VITE_STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID;
        const client_secret = process.env.VITE_STRAVA_CLIENT_SECRET || process.env.STRAVA_CLIENT_SECRET;
        if (!client_id || !client_secret) {
            console.error('[api] STRAVA env missing');
            return res.status(500).json({ error: 'Server not configured' });
        }
        const params = new URLSearchParams();
        params.set('client_id', client_id);
        params.set('client_secret', client_secret);
        params.set('code', code);
        params.set('grant_type', 'authorization_code');

        const tokenResp = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const raw = await tokenResp.text();
        let data = {};
        try { data = JSON.parse(raw); } catch {}
        if (!tokenResp.ok) {
            console.error('[api] Strava token exchange failed', tokenResp.status, raw);
            return res.status(tokenResp.status).json({ error: data?.message || raw || 'Token exchange failed' });
        }
        // Return only necessary fields
        const payload = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at,
            athlete: data.athlete
        };
        return res.status(200).json(payload);
    } catch (err) {
        console.error('[api] Strava token exchange error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
}


