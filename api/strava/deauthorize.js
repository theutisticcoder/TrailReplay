// Strava deauthorization endpoint (optional but recommended for compliance)

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
        const { access_token } = req.body || {};
        if (!access_token) {
            return res.status(400).json({ error: 'Missing access_token' });
        }
        const resp = await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            return res.status(resp.status).json({ error: data?.message || 'Deauthorize failed' });
        }
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('Strava deauthorize error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
}


