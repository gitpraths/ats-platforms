import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { encryptToken, decryptToken } from "./ms-auth.js";

const TOKEN_URL = "https://identity.xero.com/connect/token";
const CONNECTIONS_URL = "https://api.xero.com/connections";

export class XeroNotConnectedError extends Error {
  constructor() {
    super("xero_not_connected");
    this.name = "XeroNotConnectedError";
  }
}
export class XeroAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "XeroAuthError";
  }
}

export function buildXeroAuthUrl(userId) {
  const state = jwt.sign({ userId, kind: "xero" }, process.env.JWT_SECRET, { expiresIn: "10m" });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.XERO_CLIENT_ID,
    redirect_uri: process.env.XERO_REDIRECT_URI,
    scope: process.env.XERO_SCOPES || "offline_access accounting.contacts accounting.transactions",
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
}

export function parseXeroState(state) {
  const decoded = jwt.verify(state, process.env.JWT_SECRET);
  if (decoded.kind !== "xero") throw new Error("invalid_state_kind");
  return decoded;
}

async function postTokenRequest(body) {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new XeroAuthError(json.error_description || json.error || "xero_token_request_failed");
  return json;
}

export async function exchangeCodeForTokens(code) {
  return postTokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.XERO_REDIRECT_URI,
  });
}

export async function discoverTenant(accessToken) {
  const res = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new XeroAuthError("xero_connections_lookup_failed");
  const arr = await res.json();
  if (!arr.length) throw new XeroAuthError("no_tenant_authorised");
  return { tenant_id: arr[0].tenantId, tenant_name: arr[0].tenantName };
}

export async function saveConnection({ tokens, tenant, userId }) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await pool.query(
    `INSERT INTO xero_connection (id, tenant_id, tenant_name, access_token, refresh_token, token_expiry, connected_by, connected_at, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE
       SET tenant_id     = EXCLUDED.tenant_id,
           tenant_name   = EXCLUDED.tenant_name,
           access_token  = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           token_expiry  = EXCLUDED.token_expiry,
           connected_by  = EXCLUDED.connected_by,
           connected_at  = EXCLUDED.connected_at,
           updated_at    = NOW()`,
    [tenant.tenant_id, tenant.tenant_name, encryptToken(tokens.access_token), encryptToken(tokens.refresh_token), expiresAt, userId]
  );
}

export async function getConnection() {
  const { rows } = await pool.query(
    `SELECT c.*, u.name AS connected_by_name
       FROM xero_connection c
       LEFT JOIN users u ON u.id = c.connected_by
      WHERE c.id = 1`
  );
  return rows[0] || null;
}

export async function clearConnection() {
  await pool.query(`DELETE FROM xero_connection WHERE id = 1`);
}

export async function getValidXeroAccessToken() {
  const conn = await getConnection();
  if (!conn) throw new XeroNotConnectedError();

  const expiry = new Date(conn.token_expiry);
  if (expiry.getTime() > Date.now() + 60_000) {
    return { accessToken: decryptToken(conn.access_token), tenantId: conn.tenant_id };
  }

  let tokens;
  try {
    tokens = await postTokenRequest({
      grant_type: "refresh_token",
      refresh_token: decryptToken(conn.refresh_token),
    });
  } catch (err) {
    // Refresh failed — assume user revoked us in Xero. Clear the row.
    await clearConnection();
    throw new XeroAuthError("xero_auth_lost");
  }

  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
  await pool.query(
    `UPDATE xero_connection
        SET access_token  = $1,
            refresh_token = $2,
            token_expiry  = $3,
            updated_at    = NOW()
      WHERE id = 1`,
    [encryptToken(tokens.access_token), encryptToken(tokens.refresh_token), newExpiry]
  );
  return { accessToken: tokens.access_token, tenantId: conn.tenant_id };
}
