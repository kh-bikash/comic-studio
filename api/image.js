/**
 * Vercel Serverless Function: CORS proxy for Pollinations.ai
 * The browser cannot draw cross-origin images on Canvas.
 * This proxy fetches from Pollinations.ai server-side and adds CORS headers.
 */
export default async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        return res.status(200).end();
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'url parameter required' });
    }

    const targetUrl = decodeURIComponent(url);

    // Security: only proxy Pollinations.ai
    if (!targetUrl.startsWith('https://image.pollinations.ai/')) {
        return res.status(403).json({ error: 'Only Pollinations.ai URLs are allowed' });
    }

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CosmicComicStudio/1.0)' }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Upstream returned ${response.status}` });
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return res.status(200).send(Buffer.from(buffer));

    } catch (error) {
        console.error('[proxy] Error:', error.message);
        return res.status(500).json({ error: 'Proxy fetch failed: ' + error.message });
    }
}
