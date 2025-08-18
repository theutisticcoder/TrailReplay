// Secure Strava token refresh (keeps client secret on the server)

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
        const { refresh_token } = req.body || {};
        if (!refresh_token) {
            return res.status(400).json({ error: 'Missing refresh_token' });
        }
        const client_id = process.env.STRAVA_CLIENT_ID;
        const client_secret = process.env.STRAVA_CLIENT_SECRET;
        if (!client_id || !client_secret) {
            return res.status(500).json({ error: 'Server not configured' });
        }
        const params = new URLSearchParams();
        params.set('client_id', client_id);
        params.set('client_secret', client_secret);
        params.set('refresh_token', refresh_token);
        params.set('grant_type', 'refresh_token');

        const tokenResp = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const raw = await tokenResp.text();
        let data = {};
        try { data = JSON.parse(raw); } catch {}
        if (!tokenResp.ok) {
            console.error('[api] Strava refresh failed', tokenResp.status, raw);
            return res.status(tokenResp.status).json({ error: data?.message || raw || 'Refresh failed' });
        }
        const payload = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at
        };
        return res.status(200).json(payload);
    } catch (err) {
        console.error('[api] Strava refresh error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
}


