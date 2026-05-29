import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  return Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
}

export function encryptToken(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptToken(ciphertext) {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

export function buildOAuthUrl(providerId, userId) {
  const state = jwt.sign({ providerId, userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.MS_REDIRECT_URI,
    scope: 'Files.ReadWrite offline_access User.Read',
    state,
    response_mode: 'query',
  });
  return `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params}`;
}

export function parseStateJwt(state) {
  return jwt.verify(state, process.env.JWT_SECRET);
}

export async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    code,
    redirect_uri: process.env.MS_REDIRECT_URI,
    grant_type: 'authorization_code',
    scope: 'Files.ReadWrite offline_access User.Read',
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() }
  );
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function refreshTokens(encryptedRefreshToken) {
  const refreshToken = decryptToken(encryptedRefreshToken);
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'Files.ReadWrite offline_access User.Read',
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() }
  );
  if (!res.ok) {
    const err = Object.assign(new Error(`Token refresh failed: ${res.status}`), { status: res.status });
    throw err;
  }
  return res.json();
}

// Returns a valid plaintext access token, refreshing if needed.
// Caller must save the updated tokens back to DB if refresh occurred.
export async function getValidAccessToken(provider) {
  if (!provider.ms_access_token || !provider.ms_refresh_token) {
    throw Object.assign(new Error('Provider not connected to OneDrive'), { code: 'NOT_CONNECTED' });
  }

  const expiry = provider.ms_token_expiry ? new Date(provider.ms_token_expiry) : null;
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiry && expiry > fiveMinutesFromNow) {
    return { accessToken: decryptToken(provider.ms_access_token), refreshed: false };
  }

  const tokenData = await refreshTokens(provider.ms_refresh_token);
  return {
    accessToken: tokenData.access_token,
    refreshed: true,
    newAccessToken: encryptToken(tokenData.access_token),
    newRefreshToken: encryptToken(tokenData.refresh_token),
    newExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
  };
}
