import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  buildOAuthUrl,
  parseStateJwt,
  exchangeCodeForTokens,
  encryptToken,
} from '../services/ms-auth.js';

export const msAuthRouter = Router();

// GET /api/providers/:id/ms-auth/url
msAuthRouter.get('/providers/:id/ms-auth/url', requireAuth, requireRole('admin', 'recruiter_admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id FROM providers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Provider not found' });

    const url = buildOAuthUrl(req.params.id, req.user.id);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
});

// GET /api/ms-auth/callback
// No requireAuth — this is a public OAuth callback endpoint
msAuthRouter.get('/ms-auth/callback', async (req, res, next) => {
  const { code, state, error } = req.query;
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    return res.redirect(`${frontendBase}/providers?ms_error=${encodeURIComponent(error)}`);
  }

  if (!state) {
    return res.status(400).json({ success: false, error: 'Missing state parameter' });
  }

  let parsed;
  try {
    parsed = parseStateJwt(state);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid or expired state token' });
  }

  if (!code) {
    return res.status(400).json({ success: false, error: 'Missing authorization code' });
  }

  try {
    const tokenData = await exchangeCodeForTokens(code);

    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const msUserEmail = profile.mail || profile.userPrincipalName || '';

    const expiry = new Date(Date.now() + tokenData.expires_in * 1000);

    const updateResult = await pool.query(
      `UPDATE providers SET
        ms_access_token=$1, ms_refresh_token=$2, ms_token_expiry=$3, ms_user_email=$4
       WHERE id=$5`,
      [
        encryptToken(tokenData.access_token),
        encryptToken(tokenData.refresh_token),
        expiry,
        msUserEmail,
        parsed.providerId,
      ]
    );

    if (updateResult.rowCount === 0) {
      return res.redirect(`${frontendBase}/providers?ms_error=provider_not_found`);
    }

    res.redirect(`${frontendBase}/providers/${parsed.providerId}?connected=true`);
  } catch (err) { next(err); }
});

// DELETE /api/providers/:id/ms-auth
msAuthRouter.delete('/providers/:id/ms-auth', requireAuth, requireRole('admin', 'recruiter_admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id FROM providers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Provider not found' });

    await pool.query(
      `UPDATE providers SET
        ms_access_token=NULL, ms_refresh_token=NULL, ms_token_expiry=NULL,
        ms_user_email=NULL, onedrive_file_id=NULL, onedrive_sheet_name='Sheet1'
       WHERE id=$1`,
      [req.params.id]
    );

    res.json({ success: true, data: { disconnected: true } });
  } catch (err) { next(err); }
});
