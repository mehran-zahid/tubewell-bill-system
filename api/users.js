/**
 * /api/users.js
 * Server-synced Master Users List API
 *
 * GET  /api/users         → Returns master users list (public, read-only)
 * POST /api/users         → Update users list (requires ADMIN_PASSWORD)
 *
 * Storage: Vercel KV (Redis) — free on Vercel Hobby plan
 * Auth:    ADMIN_PASSWORD environment variable (never exposed to client)
 */

const KV_KEY = 'tubewell_master_users';

// ─── Helper: fetch from Vercel KV REST API ────────────────────────────────────
async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${key}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result ?? null;
  } catch (e) {
    console.error('[KV GET Error]', e.message);
    return null;
  }
}

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV not configured');
  const res = await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value })
  });
  if (!res.ok) throw new Error(`KV SET failed: ${res.status}`);
  return true;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: return master users list ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const stored = await kvGet(KV_KEY);
      if (stored) {
        const users = typeof stored === 'string' ? JSON.parse(stored) : stored;
        return res.status(200).json({ success: true, users });
      }
      // KV not yet initialized — return empty list
      return res.status(200).json({ success: true, users: [], message: 'No users stored yet' });
    } catch (err) {
      console.error('[GET /api/users Error]', err.message);
      return res.status(500).json({ success: false, error: 'Failed to load users' });
    }
  }

  // ── POST: update master users list (password required) ────────────────────
  if (req.method === 'POST') {
    try {
      const { password, users } = req.body || {};

      // Validate password server-side
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        console.error('[POST /api/users] ADMIN_PASSWORD env var not set');
        return res.status(500).json({ success: false, error: 'Server not configured' });
      }
      if (!password || password !== adminPassword) {
        console.warn('[POST /api/users] Unauthorized attempt');
        return res.status(401).json({ success: false, error: 'Incorrect password. Access denied.' });
      }

      // Validate users array
      if (!Array.isArray(users)) {
        return res.status(400).json({ success: false, error: 'Invalid users data' });
      }

      // Save to KV
      await kvSet(KV_KEY, JSON.stringify(users));
      console.log(`[POST /api/users] Saved ${users.length} users`);
      return res.status(200).json({ success: true, message: `Saved ${users.length} users` });

    } catch (err) {
      console.error('[POST /api/users Error]', err.message);
      return res.status(500).json({ success: false, error: 'Failed to save users' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
