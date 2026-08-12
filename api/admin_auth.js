/**
 * /api/admin_auth.js
 * Admin password verification endpoint
 *
 * POST /api/admin_auth { password }
 *   → 200 { success: true }  if password matches ADMIN_PASSWORD env var
 *   → 401 { success: false } if wrong
 *
 * The ADMIN_PASSWORD is stored ONLY in Vercel environment variables.
 * It is NEVER exposed to browser JavaScript / DevTools / Inspect Element.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body || {};
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error('[admin_auth] ADMIN_PASSWORD env var not configured on Vercel');
      return res.status(500).json({ success: false, error: 'Server not configured. Please add ADMIN_PASSWORD in Vercel environment variables.' });
    }

    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    if (password === adminPassword) {
      console.log('[admin_auth] Admin authenticated successfully');
      return res.status(200).json({ success: true, message: 'Authenticated' });
    }

    console.warn('[admin_auth] Failed authentication attempt');
    return res.status(401).json({ success: false, error: 'Incorrect password. Access denied.' });

  } catch (err) {
    console.error('[admin_auth Error]', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
