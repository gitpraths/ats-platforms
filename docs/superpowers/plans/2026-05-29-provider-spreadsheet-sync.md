# Provider Spreadsheet 2-Way Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync each provider's OneDrive Excel spreadsheet with ATS candidate data — inbound creates/updates candidates, outbound writes pipeline stage, placement, welfare check, and work status back to the sheet.

**Architecture:** Azure OAuth Authorization Code Flow stores encrypted tokens per provider. A manual "Sync Now" trigger calls Microsoft Graph API to read the full sheet and patch ATS-owned columns in a single batch write. Row matching uses email as the unique key.

**Tech Stack:** Node.js native `fetch` (Graph API), Node.js `crypto` (AES-256-GCM), `jsonwebtoken` (state CSRF), `pg` (DB), React + TanStack Query (frontend).

**Spec:** `docs/superpowers/specs/2026-05-29-provider-spreadsheet-sync-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `database/011-provider-spreadsheet-sync.sql` | DB migration: providers columns, transport_type, sync_logs table |
| Create | `packages/backend/src/services/ms-auth.js` | Token encrypt/decrypt, OAuth URL builder, token exchange/refresh |
| Create | `packages/backend/src/services/spreadsheet.js` | Graph API read/write, row parsing, full sync orchestration |
| Create | `packages/backend/src/routes/ms-auth.js` | GET /ms-auth/url, GET /ms-auth/callback, DELETE /ms-auth |
| Modify | `packages/backend/src/routes/providers.js` | Add PATCH /spreadsheet, POST /sync, GET /sync-logs |
| Modify | `packages/backend/src/app.js` | Register msAuthRouter |
| Create | `packages/backend/tests/spreadsheet.test.js` | Unit tests: parseWageSub, parseTransportType, mapRowToCandidate |
| Create | `packages/backend/tests/ms-auth-routes.test.js` | Integration tests: auth guards, callback error handling |
| Create | `packages/frontend/src/components/SpreadsheetSyncPanel.tsx` | Sync UI panel (connect, sync now, history) |
| Create | `packages/frontend/src/hooks/useSpreadsheetSync.ts` | React Query hooks for sync operations |
| Modify | `packages/frontend/src/types/index.ts` | Add SyncLog type, extend Provider type |
| Modify | `packages/frontend/src/pages/ProviderDetail.tsx` | Add SpreadsheetSyncPanel |
| Modify | `.env.example` | Document new env vars |

---

## Task 1: Database Migration

**Files:**
- Create: `database/011-provider-spreadsheet-sync.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Migration 011: Provider spreadsheet sync support

-- Extend providers table with Microsoft OAuth tokens + spreadsheet config
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS ms_access_token     TEXT,
  ADD COLUMN IF NOT EXISTS ms_refresh_token    TEXT,
  ADD COLUMN IF NOT EXISTS ms_token_expiry     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ms_user_email       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS onedrive_file_id    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS onedrive_sheet_name VARCHAR(255) DEFAULT 'Sheet1',
  ADD COLUMN IF NOT EXISTS last_synced_at      TIMESTAMPTZ;

-- Add transport_type to candidates
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS transport_type VARCHAR(20);
-- values: car | public_transport | both | none

-- Sync run history
CREATE TABLE IF NOT EXISTS provider_sync_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id        UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  triggered_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'running',
  -- running | success | partial | failed
  candidates_created INTEGER DEFAULT 0,
  candidates_updated INTEGER DEFAULT 0,
  rows_written_back  INTEGER DEFAULT 0,
  rows_skipped       INTEGER DEFAULT 0,
  error_message      TEXT,
  started_at         TIMESTAMPTZ DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_provider ON provider_sync_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started  ON provider_sync_logs(started_at DESC);
```

- [ ] **Step 2: Run the migration**

```bash
psql $DATABASE_URL -f database/011-provider-spreadsheet-sync.sql
```

Expected: No errors. `ALTER TABLE` and `CREATE TABLE` printed.

- [ ] **Step 3: Verify columns exist**

```bash
psql $DATABASE_URL -c "\d providers" | grep ms_
psql $DATABASE_URL -c "\d candidates" | grep transport_type
psql $DATABASE_URL -c "\dt provider_sync_logs"
```

Expected: `ms_access_token`, `ms_refresh_token`, etc. listed. `transport_type` listed. `provider_sync_logs` table present.

- [ ] **Step 4: Commit**

```bash
git add database/011-provider-spreadsheet-sync.sql
git commit -m "feat: add DB migration for provider spreadsheet sync"
```

---

## Task 2: ms-auth Service

**Files:**
- Create: `packages/backend/src/services/ms-auth.js`

- [ ] **Step 1: Write the failing test**

Create `packages/backend/tests/ms-auth-service.test.js`:

```javascript
import { encryptToken, decryptToken, buildOAuthUrl, parseStateJwt } from '../src/services/ms-auth.js';

// Set env vars before tests
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes as hex
process.env.AZURE_CLIENT_ID = 'test-client-id';
process.env.AZURE_TENANT_ID = 'common';
process.env.MS_REDIRECT_URI = 'http://localhost:3001/api/ms-auth/callback';
process.env.JWT_SECRET = 'test-jwt-secret';

describe('encryptToken / decryptToken', () => {
  it('round-trips a token string', () => {
    const original = 'my-secret-token-value';
    const encrypted = encryptToken(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const a = encryptToken('same');
    const b = encryptToken('same');
    expect(a).not.toBe(b);
  });
});

describe('buildOAuthUrl', () => {
  it('returns a Microsoft login URL with required params', () => {
    const url = buildOAuthUrl('provider-123', 'user-456');
    expect(url).toContain('login.microsoftonline.com');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('response_type=code');
    expect(url).toContain('Files.ReadWrite');
    expect(url).toContain('state=');
  });
});

describe('parseStateJwt', () => {
  it('returns providerId and userId from a valid state token', () => {
    const url = buildOAuthUrl('provider-abc', 'user-xyz');
    const state = new URL(url).searchParams.get('state');
    const result = parseStateJwt(state);
    expect(result.providerId).toBe('provider-abc');
    expect(result.userId).toBe('user-xyz');
  });

  it('throws on an invalid token', () => {
    expect(() => parseStateJwt('bad.token.here')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/backend && npm test -- --testPathPattern=ms-auth-service
```

Expected: FAIL — `Cannot find module '../src/services/ms-auth.js'`

- [ ] **Step 3: Implement ms-auth service**

Create `packages/backend/src/services/ms-auth.js`:

```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/backend && npm test -- --testPathPattern=ms-auth-service
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/ms-auth.js packages/backend/tests/ms-auth-service.test.js
git commit -m "feat: add ms-auth service for Azure OAuth token management"
```

---

## Task 3: Spreadsheet Service (Row Parsing + Graph API)

**Files:**
- Create: `packages/backend/src/services/spreadsheet.js`
- Create: `packages/backend/tests/spreadsheet.test.js`

- [ ] **Step 1: Write the failing tests**

Create `packages/backend/tests/spreadsheet.test.js`:

```javascript
import { parseWageSub, parseTransportType, mapRowToCandidate, indexToColLetter } from '../src/services/spreadsheet.js';

describe('indexToColLetter', () => {
  it('converts 0 to A', () => expect(indexToColLetter(0)).toBe('A'));
  it('converts 25 to Z', () => expect(indexToColLetter(25)).toBe('Z'));
  it('converts 26 to AA', () => expect(indexToColLetter(26)).toBe('AA'));
  it('converts 12 to M', () => expect(indexToColLetter(12)).toBe('M'));
});

describe('parseWageSub', () => {
  it('returns false for empty cell', () => {
    expect(parseWageSub('')).toEqual({ wage_subsidy: false, wage_subsidy_amount: null, benchmark_hours: null });
    expect(parseWageSub(null)).toEqual({ wage_subsidy: false, wage_subsidy_amount: null, benchmark_hours: null });
  });

  it('parses dollar amount and hours', () => {
    expect(parseWageSub('$500 / 20hrs')).toEqual({ wage_subsidy: true, wage_subsidy_amount: 500, benchmark_hours: 20 });
  });

  it('parses amount without hours', () => {
    const result = parseWageSub('$1,500');
    expect(result.wage_subsidy).toBe(true);
    expect(result.wage_subsidy_amount).toBe(1500);
    expect(result.benchmark_hours).toBeNull();
  });

  it('sets wage_subsidy true but nulls amounts for unparseable text', () => {
    const result = parseWageSub('maybe');
    expect(result.wage_subsidy).toBe(true);
    expect(result.wage_subsidy_amount).toBeNull();
    expect(result.benchmark_hours).toBeNull();
    expect(result.raw).toBe('maybe');
  });
});

describe('parseTransportType', () => {
  it('returns null for empty', () => expect(parseTransportType('')).toBeNull());
  it('returns car', () => expect(parseTransportType('Car')).toBe('car'));
  it('returns public_transport for PT', () => expect(parseTransportType('PT')).toBe('public_transport'));
  it('returns both for Car/PT', () => expect(parseTransportType('Car / PT')).toBe('both'));
  it('returns null for unrecognised', () => expect(parseTransportType('bus')).toBeNull());
});

describe('mapRowToCandidate', () => {
  const headers = {
    'jobseeker': 0,
    'ec': 1,
    'ideal roles': 2,
    'comments - experience, hours etc': 3,
    'wage sub - max $ & hours': 4,
    'car or pt?': 5,
    'email': 6,
    'mobile': 7,
    'please refer to (ec only)': 8,
    'comments (ec only)': 9,
    'have referred to (wv only)': 10,
    'comments (wv only)': 11,
  };

  const row = [
    'Jane Smith', 'KB', 'Retail', 'Has 5 years exp, 38 hrs', '$500 / 20hrs', 'Car',
    'jane@example.com', '0412345678', 'WorkCover', '', 'Metro Retail', '',
  ];

  it('extracts email as match key', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.email).toBe('jane@example.com');
  });

  it('maps name, phone, interested_job', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.name).toBe('Jane Smith');
    expect(c.phone).toBe('0412345678');
    expect(c.interested_job).toBe('Retail');
  });

  it('parses wage sub fields', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.wage_subsidy).toBe(true);
    expect(c.wage_subsidy_amount).toBe(500);
    expect(c.benchmark_hours).toBe(20);
  });

  it('sets transport_type', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.transport_type).toBe('car');
  });

  it('merges EC, WV, and experience comments into notes', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.notes).toContain('Has 5 years exp');
    expect(c.notes).toContain('[EC: KB]');
    expect(c.notes).toContain('[EC Refer: WorkCover]');
    expect(c.notes).toContain('[WV Refer: Metro Retail]');
  });

  it('sets provider_id', () => {
    const c = mapRowToCandidate(headers, row, 'provider-1');
    expect(c.provider_id).toBe('provider-1');
  });

  it('returns null email for row with empty email cell', () => {
    const emptyRow = [...row];
    emptyRow[6] = '';
    const c = mapRowToCandidate(headers, emptyRow, 'provider-1');
    expect(c.email).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/backend && npm test -- --testPathPattern=spreadsheet
```

Expected: FAIL — `Cannot find module '../src/services/spreadsheet.js'`

- [ ] **Step 3: Implement the spreadsheet service**

Create `packages/backend/src/services/spreadsheet.js`:

```javascript
import { pool } from '../config/db.js';
import { getValidAccessToken, encryptToken } from './ms-auth.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const REQUIRED_HEADERS = ['email', 'jobseeker'];
const ATS_COLUMN_NAMES = [
  'Work Status (ATS)',
  'Pipeline Stage (ATS)',
  'Placement (ATS)',
  'Welfare Check (ATS)',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function indexToColLetter(index) {
  let result = '';
  let i = index;
  while (i >= 0) {
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26) - 1;
  }
  return result;
}

export function parseWageSub(cell) {
  const str = cell != null ? String(cell).trim() : '';
  if (!str) return { wage_subsidy: false, wage_subsidy_amount: null, benchmark_hours: null };

  const amountMatch = str.match(/\$?([\d,]+(?:\.\d{2})?)/);
  const hoursMatch = str.match(/(\d+)\s*(?:hrs?|hours?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : null;

  if (!amount && !hours) {
    return { wage_subsidy: true, wage_subsidy_amount: null, benchmark_hours: null, raw: str };
  }
  return { wage_subsidy: true, wage_subsidy_amount: amount ?? null, benchmark_hours: hours ?? null };
}

export function parseTransportType(cell) {
  if (!cell) return null;
  const str = String(cell).toLowerCase().trim();
  if (str.includes('car') && (str.includes('pt') || str.includes('public'))) return 'both';
  if (str.includes('car')) return 'car';
  if (str.includes('pt') || str.includes('public')) return 'public_transport';
  return null;
}

export function mapRowToCandidate(headers, row, providerId) {
  const get = (name) => {
    const idx = headers[name.toLowerCase()];
    return idx !== undefined ? (row[idx] ?? '') : '';
  };

  const wageSub = parseWageSub(get('wage sub - max $ & hours'));
  const parts = [
    get('comments - experience, hours etc'),
    get('ec') ? `[EC: ${get('ec')}]` : '',
    get('please refer to (ec only)') ? `[EC Refer: ${get('please refer to (ec only)')}]` : '',
    get('comments (ec only)') ? `[EC Comments: ${get('comments (ec only)')}]` : '',
    get('have referred to (wv only)') ? `[WV Refer: ${get('have referred to (wv only)')}]` : '',
    get('comments (wv only)') ? `[WV Comments: ${get('comments (wv only)')}]` : '',
  ].filter(Boolean);

  return {
    email: String(get('email')).trim().toLowerCase(),
    name: String(get('jobseeker')).trim(),
    phone: String(get('mobile')).trim() || null,
    interested_job: String(get('ideal roles')).trim() || null,
    notes: parts.length ? parts.join(' ') : null,
    transport_type: parseTransportType(get('car or pt?')),
    provider_id: providerId,
    ...wageSub,
  };
}

// ── Graph API ─────────────────────────────────────────────────────────────────

async function graphGet(token, path) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = Object.assign(new Error(`Graph GET error ${res.status}`), { status: res.status });
    throw err;
  }
  return res.json();
}

async function graphPatch(token, path, body) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Graph PATCH error ${res.status}: ${await res.text()}`);
  }
}

export async function resolveShareUrl(token, shareUrl) {
  const encoded = 'u!' + Buffer.from(shareUrl)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
  const item = await graphGet(token, `/shares/${encoded}/driveItem`);
  return item.id;
}

// ── Sync orchestration ────────────────────────────────────────────────────────

export async function runSync(provider, triggeredById) {
  const logResult = await pool.query(
    `INSERT INTO provider_sync_logs (provider_id, triggered_by, status)
     VALUES ($1, $2, 'running') RETURNING id`,
    [provider.id, triggeredById]
  );
  const logId = logResult.rows[0].id;

  let accessToken;
  let tokenUpdates = {};

  try {
    const tokenResult = await getValidAccessToken(provider);
    accessToken = tokenResult.accessToken;

    if (tokenResult.refreshed) {
      tokenUpdates = {
        ms_access_token: tokenResult.newAccessToken,
        ms_refresh_token: tokenResult.newRefreshToken,
        ms_token_expiry: tokenResult.newExpiry,
      };
      await pool.query(
        `UPDATE providers SET ms_access_token=$1, ms_refresh_token=$2, ms_token_expiry=$3 WHERE id=$4`,
        [tokenUpdates.ms_access_token, tokenUpdates.ms_refresh_token, tokenUpdates.ms_token_expiry, provider.id]
      );
    }

    const sheetPath = `/me/drive/items/${provider.onedrive_file_id}/workbook/worksheets/${encodeURIComponent(provider.onedrive_sheet_name)}/usedRange`;
    const sheetData = await graphGet(accessToken, sheetPath);
    const allRows = sheetData.values;

    if (!allRows || allRows.length < 2) {
      throw new Error('Spreadsheet is empty or has only a header row');
    }

    // Build header → column index map (case-insensitive)
    const headerRow = allRows[0].map(h => String(h ?? '').toLowerCase().trim());
    const headers = {};
    headerRow.forEach((h, i) => { headers[h] = i; });

    // Validate required headers
    for (const req of REQUIRED_HEADERS) {
      if (headers[req] === undefined) {
        throw new Error(`Missing required column: "${req}"`);
      }
    }

    // Detect or plan ATS column positions
    const atsColIndices = ATS_COLUMN_NAMES.map(name => {
      const idx = headerRow.indexOf(name.toLowerCase());
      return idx !== -1 ? idx : null;
    });

    const needsHeaderWrite = atsColIndices.some(i => i === null);
    const nextCol = allRows[0].length;
    let resolvedAtsIndices = atsColIndices.map((idx, i) =>
      idx !== null ? idx : nextCol + atsColIndices.slice(0, i).filter(x => x === null).length
    );

    // Write ATS headers if any are missing
    if (needsHeaderWrite) {
      const headerUpdates = [];
      resolvedAtsIndices.forEach((colIdx, i) => {
        if (atsColIndices[i] === null) {
          const colLetter = indexToColLetter(colIdx);
          headerUpdates.push({ col: colLetter, name: ATS_COLUMN_NAMES[i] });
        }
      });
      for (const { col, name } of headerUpdates) {
        await graphPatch(accessToken,
          `/me/drive/items/${provider.onedrive_file_id}/workbook/worksheets/${encodeURIComponent(provider.onedrive_sheet_name)}/range(address='${col}1')`,
          { values: [[name]] }
        );
      }
    }

    // Process data rows
    const dataRows = allRows.slice(1);
    let created = 0, updated = 0, writtenBack = 0, skipped = 0;
    const outboundRows = [];

    for (const row of dataRows) {
      const candidate = mapRowToCandidate(headers, row, provider.id);

      if (!candidate.email) {
        skipped++;
        outboundRows.push(['', '', '', '']);
        continue;
      }

      // Check if candidate belongs to a different provider
      const existing = await pool.query(
        `SELECT id, provider_id FROM candidates WHERE email = $1`,
        [candidate.email]
      );

      if (existing.rows.length > 0 && existing.rows[0].provider_id !== provider.id) {
        skipped++;
        outboundRows.push(['', '', '', '']);
        continue;
      }

      let candidateId;

      if (existing.rows.length === 0) {
        const ins = await pool.query(
          `INSERT INTO candidates (name, email, phone, interested_job, notes, transport_type,
            wage_subsidy, wage_subsidy_amount, benchmark_hours, provider_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [candidate.name, candidate.email, candidate.phone, candidate.interested_job,
           candidate.notes, candidate.transport_type, candidate.wage_subsidy,
           candidate.wage_subsidy_amount, candidate.benchmark_hours, candidate.provider_id]
        );
        candidateId = ins.rows[0].id;
        created++;
      } else {
        candidateId = existing.rows[0].id;
        await pool.query(
          `UPDATE candidates SET name=$1, phone=$2, interested_job=$3, notes=$4,
            transport_type=$5, wage_subsidy=$6, wage_subsidy_amount=$7,
            benchmark_hours=$8, updated_at=NOW()
           WHERE id=$9`,
          [candidate.name, candidate.phone, candidate.interested_job, candidate.notes,
           candidate.transport_type, candidate.wage_subsidy, candidate.wage_subsidy_amount,
           candidate.benchmark_hours, candidateId]
        );
        updated++;
      }

      // Gather outbound ATS data
      const { rows: appRows } = await pool.query(
        `SELECT a.stage, p.start_date, e.name AS employer_name, c.work_status,
                wc.check_type AS latest_welfare
         FROM candidates c
         LEFT JOIN applications a ON a.candidate_id = c.id
           AND a.id = (SELECT id FROM applications WHERE candidate_id = c.id ORDER BY updated_at DESC LIMIT 1)
         LEFT JOIN placements p ON p.candidate_id = c.id
           AND p.id = (SELECT id FROM placements WHERE candidate_id = c.id ORDER BY created_at DESC LIMIT 1)
         LEFT JOIN employers e ON e.id = p.employer_id
         LEFT JOIN welfare_checks wc ON wc.placement_id = p.id AND wc.completed_at IS NOT NULL
           AND wc.id = (SELECT id FROM welfare_checks WHERE placement_id = p.id AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1)
         WHERE c.id = $1`,
        [candidateId]
      );

      const ats = appRows[0] || {};
      outboundRows.push([
        ats.work_status || '',
        ats.stage || '',
        ats.employer_name && ats.start_date
          ? `${ats.employer_name} – ${new Date(ats.start_date).toISOString().slice(0, 10)}`
          : '',
        ats.latest_welfare || '',
      ]);
      writtenBack++;
    }

    // Batch write ATS columns back to spreadsheet
    if (outboundRows.length > 0) {
      // Build column letters for all 4 ATS columns
      const colLetters = resolvedAtsIndices.map(indexToColLetter);
      const startRow = 2; // 1-indexed, skip header
      const endRow = startRow + outboundRows.length - 1;

      // Write each ATS column separately to handle non-contiguous columns
      for (let ci = 0; ci < 4; ci++) {
        const colLetter = colLetters[ci];
        const colValues = outboundRows.map(r => [r[ci]]);
        await graphPatch(accessToken,
          `/me/drive/items/${provider.onedrive_file_id}/workbook/worksheets/${encodeURIComponent(provider.onedrive_sheet_name)}/range(address='${colLetter}${startRow}:${colLetter}${endRow}')`,
          { values: colValues }
        );
      }
    }

    await pool.query(
      `UPDATE provider_sync_logs SET status='success', candidates_created=$1,
        candidates_updated=$2, rows_written_back=$3, rows_skipped=$4, completed_at=NOW()
       WHERE id=$5`,
      [created, updated, writtenBack, skipped, logId]
    );
    await pool.query(`UPDATE providers SET last_synced_at=NOW() WHERE id=$1`, [provider.id]);

    return { status: 'success', candidates_created: created, candidates_updated: updated, rows_written_back: writtenBack, rows_skipped: skipped };

  } catch (err) {
    // If token was revoked, mark provider disconnected
    if (err.status === 401) {
      await pool.query(
        `UPDATE providers SET ms_access_token=NULL, ms_refresh_token=NULL, ms_token_expiry=NULL WHERE id=$1`,
        [provider.id]
      );
    }
    await pool.query(
      `UPDATE provider_sync_logs SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
      [err.message, logId]
    );
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/backend && npm test -- --testPathPattern=spreadsheet
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/spreadsheet.js packages/backend/tests/spreadsheet.test.js
git commit -m "feat: add spreadsheet service with Graph API sync and row parsing"
```

---

## Task 4: ms-auth Routes

**Files:**
- Create: `packages/backend/src/routes/ms-auth.js`
- Create: `packages/backend/tests/ms-auth-routes.test.js`
- Modify: `packages/backend/src/app.js`

- [ ] **Step 1: Write failing tests**

Create `packages/backend/tests/ms-auth-routes.test.js`:

```javascript
import request from 'supertest';
import app from '../src/app.js';

// Login helper
async function loginAsAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@ats.com', password: 'password123' });
  return res.body.data.token;
}

describe('GET /api/providers/:id/ms-auth/url', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/providers/some-id/ms-auth/url');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown provider', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .get('/api/providers/00000000-0000-0000-0000-000000000000/ms-auth/url')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/ms-auth/callback', () => {
  it('returns 400 when state is missing', async () => {
    const res = await request(app).get('/api/ms-auth/callback?code=abc');
    expect(res.status).toBe(400);
  });

  it('returns 400 when state JWT is invalid', async () => {
    const res = await request(app).get('/api/ms-auth/callback?code=abc&state=bad.token.here');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/providers/:id/ms-auth', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/providers/some-id/ms-auth');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/backend && npm test -- --testPathPattern=ms-auth-routes
```

Expected: FAIL — routes not registered yet.

- [ ] **Step 3: Create ms-auth routes file**

Create `packages/backend/src/routes/ms-auth.js`:

```javascript
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
// Returns the Microsoft OAuth URL to redirect the user to
msAuthRouter.get('/providers/:id/ms-auth/url', requireAuth, requireRole(['admin', 'recruiter_admin']), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id FROM providers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Provider not found' });

    const url = buildOAuthUrl(req.params.id, req.user.id);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
});

// GET /api/ms-auth/callback
// Microsoft redirects here after the user authenticates
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

  try {
    const tokenData = await exchangeCodeForTokens(code);

    // Get user's email from Graph API
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const msUserEmail = profile.mail || profile.userPrincipalName || '';

    const expiry = new Date(Date.now() + tokenData.expires_in * 1000);

    await pool.query(
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

    res.redirect(`${frontendBase}/providers/${parsed.providerId}?connected=true`);
  } catch (err) { next(err); }
});

// DELETE /api/providers/:id/ms-auth
// Disconnect — clear all stored tokens
msAuthRouter.delete('/providers/:id/ms-auth', requireAuth, requireRole(['admin', 'recruiter_admin']), async (req, res, next) => {
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
```

- [ ] **Step 4: Register the router in app.js**

In `packages/backend/src/app.js`, add after the existing imports:

```javascript
import { msAuthRouter } from './routes/ms-auth.js';
```

Then add after the existing router registrations (find where `/api/providers` is registered and add below it):

```javascript
app.use('/api', msAuthRouter);
```

- [ ] **Step 5: Add FRONTEND_URL to .env.example**

In `.env.example`, add:

```
FRONTEND_URL=http://localhost:5173
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=common
MS_REDIRECT_URI=https://your-api-host/api/ms-auth/callback
TOKEN_ENCRYPTION_KEY=64-char-hex-string-from-node-crypto
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd packages/backend && npm test -- --testPathPattern=ms-auth-routes
```

Expected: All 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/routes/ms-auth.js packages/backend/src/app.js \
        packages/backend/tests/ms-auth-routes.test.js .env.example
git commit -m "feat: add ms-auth OAuth routes for OneDrive connect/disconnect"
```

---

## Task 5: Provider Sync Routes

**Files:**
- Modify: `packages/backend/src/routes/providers.js`
- Create: `packages/backend/tests/provider-sync-routes.test.js`

- [ ] **Step 1: Write failing tests**

Create `packages/backend/tests/provider-sync-routes.test.js`:

```javascript
import request from 'supertest';
import app from '../src/app.js';

async function loginAsAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@ats.com', password: 'password123' });
  return res.body.data.token;
}

const SEED_PROVIDER_ID = '00000000-0000-0000-0005-000000000001';

describe('PATCH /api/providers/:id/spreadsheet', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).patch(`/api/providers/${SEED_PROVIDER_ID}/spreadsheet`);
    expect(res.status).toBe(401);
  });

  it('returns 400 when onedrive_file_id is missing', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .patch(`/api/providers/${SEED_PROVIDER_ID}/spreadsheet`)
      .set('Authorization', `Bearer ${token}`)
      .send({ onedrive_sheet_name: 'Sheet1' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/providers/:id/sync-logs', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/providers/${SEED_PROVIDER_ID}/sync-logs`);
    expect(res.status).toBe(401);
  });

  it('returns empty array for provider with no sync history', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .get(`/api/providers/${SEED_PROVIDER_ID}/sync-logs`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/providers/:id/sync', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post(`/api/providers/${SEED_PROVIDER_ID}/sync`);
    expect(res.status).toBe(401);
  });

  it('returns 409 when provider has no spreadsheet connected', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .post(`/api/providers/${SEED_PROVIDER_ID}/sync`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/backend && npm test -- --testPathPattern=provider-sync-routes
```

Expected: FAIL — routes not added yet.

- [ ] **Step 3: Add sync routes to providers.js**

At the bottom of `packages/backend/src/routes/providers.js`, before the last line, add:

```javascript
import { runSync, resolveShareUrl } from '../services/spreadsheet.js';
import { getValidAccessToken } from '../services/ms-auth.js';

// ── PATCH /api/providers/:id/spreadsheet ─────────────────
// Accepts an OneDrive share URL, resolves it to a Graph item ID, stores the item ID.
providersRouter.patch('/:id/spreadsheet', requireRole(['admin', 'recruiter_admin']), async (req, res, next) => {
  try {
    const { onedrive_url, onedrive_sheet_name = 'Sheet1' } = req.body;
    if (!onedrive_url) {
      return res.status(400).json({ success: false, error: 'onedrive_url is required' });
    }

    const { rows } = await pool.query('SELECT * FROM providers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Provider not found' });
    const provider = rows[0];

    if (!provider.ms_access_token) {
      return res.status(409).json({ success: false, error: 'Connect OneDrive first before saving spreadsheet' });
    }

    // Resolve share URL → Graph item ID
    const tokenResult = await getValidAccessToken(provider);
    const fileId = await resolveShareUrl(tokenResult.accessToken, onedrive_url);

    await pool.query(
      `UPDATE providers SET onedrive_file_id=$1, onedrive_sheet_name=$2 WHERE id=$3`,
      [fileId, onedrive_sheet_name, req.params.id]
    );

    res.json({ success: true, data: { onedrive_file_id: fileId, onedrive_sheet_name } });
  } catch (err) { next(err); }
});

// ── POST /api/providers/:id/sync ─────────────────────────
providersRouter.post('/:id/sync', requireRole(['admin', 'recruiter_admin']), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM providers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Provider not found' });

    const provider = rows[0];

    if (!provider.ms_access_token || !provider.onedrive_file_id) {
      return res.status(409).json({ success: false, error: 'Provider spreadsheet not connected' });
    }

    const result = await runSync(provider, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── GET /api/providers/:id/sync-logs ─────────────────────
providersRouter.get('/:id/sync-logs', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT psl.*, u.name AS triggered_by_name
       FROM provider_sync_logs psl
       LEFT JOIN users u ON u.id = psl.triggered_by
       WHERE psl.provider_id = $1
       ORDER BY psl.started_at DESC
       LIMIT 20`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});
```

Also add the import at the top of `providers.js` (after the existing imports):

```javascript
import { runSync } from '../services/spreadsheet.js';
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/backend && npm test -- --testPathPattern=provider-sync-routes
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/providers.js packages/backend/tests/provider-sync-routes.test.js
git commit -m "feat: add provider spreadsheet config and sync trigger routes"
```

---

## Task 6: Frontend Types + Hook

**Files:**
- Modify: `packages/frontend/src/types/index.ts`
- Create: `packages/frontend/src/hooks/useSpreadsheetSync.ts`

- [ ] **Step 1: Extend the Provider type and add SyncLog type**

In `packages/frontend/src/types/index.ts`, extend the `Provider` interface:

```typescript
export interface Provider {
  id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  candidate_count?: number;
  created_at: string;
  updated_at: string;
  // Spreadsheet sync fields
  ms_user_email?: string | null;
  onedrive_file_id?: string | null;
  onedrive_sheet_name?: string;
  last_synced_at?: string | null;
}

export interface SyncLog {
  id: string;
  provider_id: string;
  triggered_by: string | null;
  triggered_by_name: string | null;
  status: 'running' | 'success' | 'partial' | 'failed';
  candidates_created: number;
  candidates_updated: number;
  rows_written_back: number;
  rows_skipped: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface SyncResult {
  status: string;
  candidates_created: number;
  candidates_updated: number;
  rows_written_back: number;
  rows_skipped: number;
}
```

- [ ] **Step 2: Create the sync hooks**

Create `packages/frontend/src/hooks/useSpreadsheetSync.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { SyncLog, SyncResult } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export function useSyncLogs(providerId: string) {
  return useQuery<SyncLog[]>({
    queryKey: ["sync-logs", providerId],
    queryFn: () => api.get<SyncLog[]>(`/providers/${providerId}/sync-logs`),
    enabled: !!providerId,
  });
}

export function useMsAuthUrl(providerId: string) {
  return useMutation<{ url: string }, Error>({
    mutationFn: () => api.get<{ url: string }>(`/providers/${providerId}/ms-auth/url`),
  });
}

export function useDisconnect(providerId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error>({
    mutationFn: () => api.delete(`/providers/${providerId}/ms-auth`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider", providerId] });
      queryClient.invalidateQueries({ queryKey: ["sync-logs", providerId] });
    },
  });
}

export function useSaveSpreadsheet(providerId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { onedrive_url: string; onedrive_sheet_name: string }>({
    mutationFn: (body) => api.patch(`/providers/${providerId}/spreadsheet`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider", providerId] });
    },
  });
}

export function useTriggerSync(providerId: string) {
  const queryClient = useQueryClient();
  return useMutation<SyncResult, Error>({
    mutationFn: () => api.post<SyncResult>(`/providers/${providerId}/sync`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-logs", providerId] });
      queryClient.invalidateQueries({ queryKey: ["provider", providerId] });
    },
  });
}
```

- [ ] **Step 3: Extend api.ts with delete and patch methods if missing**

Check if `api.ts` already has `delete` and `patch`. Open `packages/frontend/src/lib/api.ts` and look at the `api` object. If `delete` or `patch` are missing, add them:

```typescript
export const api = {
  // ... existing methods ...
  patch: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string): Promise<T> =>
    request<T>(path, { method: "DELETE" }),
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/types/index.ts \
        packages/frontend/src/hooks/useSpreadsheetSync.ts \
        packages/frontend/src/lib/api.ts
git commit -m "feat: add sync types and useSpreadsheetSync hooks"
```

---

## Task 7: SpreadsheetSyncPanel Component

**Files:**
- Create: `packages/frontend/src/components/SpreadsheetSyncPanel.tsx`

- [ ] **Step 1: Create the component**

Create `packages/frontend/src/components/SpreadsheetSyncPanel.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Loader2, Unplug, RefreshCw, Link2 } from "lucide-react";
import {
  useSyncLogs,
  useMsAuthUrl,
  useDisconnect,
  useSaveSpreadsheet,
  useTriggerSync,
} from "../hooks/useSpreadsheetSync";
import type { Provider } from "../types";

interface Props {
  provider: Provider;
  isAdmin: boolean;
}

export default function SpreadsheetSyncPanel({ provider, isAdmin }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFileForm, setShowFileForm] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [sheetName, setSheetName] = useState(provider.onedrive_sheet_name || "Sheet1");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const { data: logs = [], isLoading: logsLoading } = useSyncLogs(provider.id);
  const connectMutation = useMsAuthUrl(provider.id);
  const disconnectMutation = useDisconnect(provider.id);
  const saveMutation = useSaveSpreadsheet(provider.id);
  const syncMutation = useTriggerSync(provider.id);

  const isConnected = !!provider.ms_user_email && !!provider.onedrive_file_id;

  // Handle redirect back from OAuth
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      setShowFileForm(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  async function handleConnect() {
    const result = await connectMutation.mutateAsync();
    window.location.href = result.url;
  }

  async function handleSaveFile() {
    if (!fileUrl.trim()) return;
    await saveMutation.mutateAsync({
      onedrive_url: fileUrl.trim(),
      onedrive_sheet_name: sheetName.trim() || "Sheet1",
    });
    setShowFileForm(false);
    setSyncMessage("Spreadsheet connected. Run your first sync.");
  }

  async function handleSync() {
    setSyncMessage(null);
    const result = await syncMutation.mutateAsync();
    setSyncMessage(
      `Sync complete — ${result.candidates_created} created, ${result.candidates_updated} updated, ${result.rows_written_back} written back.`
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg p-5 mt-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">Spreadsheet Sync</h3>

      {/* Status row */}
      <div className="flex items-center gap-2 mb-4">
        {isConnected ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="text-sm text-slate-700">
              Connected as <span className="font-medium">{provider.ms_user_email}</span>
            </span>
            {provider.last_synced_at && (
              <span className="text-xs text-slate-400 ml-2">
                Last synced {format(new Date(provider.last_synced_at), "d MMM yyyy, h:mm a")}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            <span className="text-sm text-slate-500">Not connected</span>
          </>
        )}
      </div>

      {/* Action buttons */}
      {isAdmin && (
        <div className="flex gap-2 mb-4">
          {!isConnected && !showFileForm && (
            <button
              onClick={handleConnect}
              disabled={connectMutation.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {connectMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              Connect OneDrive
            </button>
          )}

          {isConnected && (
            <>
              <button
                onClick={handleSync}
                disabled={syncMutation.isPending}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {syncMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Sync Now
              </button>
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <Unplug size={14} />
                Disconnect
              </button>
            </>
          )}
        </div>
      )}

      {/* File setup form — shown after OAuth redirect or if connected but no file */}
      {showFileForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-md p-4 mb-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Paste your OneDrive spreadsheet URL</p>
          <input
            type="text"
            placeholder="https://onedrive.live.com/..."
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap">Sheet name:</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="text-sm border border-slate-300 rounded px-3 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveFile}
              disabled={saveMutation.isPending || !fileUrl.trim()}
              className="ml-auto text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving..." : "Save & Connect"}
            </button>
          </div>
        </div>
      )}

      {/* Sync result message */}
      {syncMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
          {syncMessage}
        </p>
      )}

      {syncMutation.isError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
          Sync failed: {syncMutation.error.message}
        </p>
      )}

      {/* Sync history */}
      {isConnected && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Recent Syncs</p>
          {logsLoading ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-400">No syncs yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {logs.slice(0, 5).map((log) => (
                <li key={log.id} className="flex items-start gap-2 text-xs text-slate-600">
                  {log.status === 'success' || log.status === 'partial' ? (
                    <CheckCircle2 size={13} className="text-green-500 mt-0.5 shrink-0" />
                  ) : log.status === 'failed' ? (
                    <XCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
                  ) : (
                    <Loader2 size={13} className="text-blue-400 mt-0.5 shrink-0 animate-spin" />
                  )}
                  <span>
                    {format(new Date(log.started_at), "d MMM h:mm a")}
                    {log.status === 'failed'
                      ? ` — Failed: ${log.error_message}`
                      : ` — ${log.candidates_created} created, ${log.candidates_updated} updated, ${log.rows_written_back} written back`}
                    {log.rows_skipped > 0 && `, ${log.rows_skipped} skipped`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/SpreadsheetSyncPanel.tsx
git commit -m "feat: add SpreadsheetSyncPanel component"
```

---

## Task 8: Wire Into ProviderDetail Page

**Files:**
- Modify: `packages/frontend/src/pages/ProviderDetail.tsx`

- [ ] **Step 1: Add SpreadsheetSyncPanel to ProviderDetail**

In `packages/frontend/src/pages/ProviderDetail.tsx`:

Add the import at the top:

```typescript
import SpreadsheetSyncPanel from "../components/SpreadsheetSyncPanel";
```

Find the closing `</div>` of the main content area (after the candidates list section) and add the panel before it:

```tsx
{/* Spreadsheet Sync */}
<SpreadsheetSyncPanel provider={provider} isAdmin={isAdmin} />
```

- [ ] **Step 2: Start the dev server and verify**

```bash
npm run dev
```

1. Open http://localhost:5173
2. Log in as `admin@ats.com` / `password123`
3. Navigate to Providers → click a provider
4. Scroll to bottom — "Spreadsheet Sync" panel should appear
5. "Not connected" status with "Connect OneDrive" button visible
6. Click "Connect OneDrive" — should redirect to Microsoft login page

- [ ] **Step 3: Add FRONTEND_URL to Railway**

In Railway → backend service → Variables, add:

```
FRONTEND_URL=https://your-frontend.up.railway.app
```

(Use your actual frontend Railway domain.)

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/ProviderDetail.tsx
git commit -m "feat: add SpreadsheetSyncPanel to ProviderDetail page"
```

---

## Task 9: End-to-End Verification

- [ ] **Step 1: Run all backend tests**

```bash
cd packages/backend && npm test
```

Expected: All test suites pass.

- [ ] **Step 2: Test the full sync flow manually**

1. Log in as admin in the browser
2. Go to a provider detail page
3. Click **Connect OneDrive** — Microsoft login page opens
4. Log in with a Microsoft account that has access to the provider's spreadsheet
5. After redirect back, paste the spreadsheet OneDrive URL into the file form
6. Click **Save & Connect**
7. Click **Sync Now**
8. Verify the sync log shows candidates created/updated
9. Open the spreadsheet in OneDrive — confirm ATS columns are added (Work Status, Pipeline Stage, Placement, Welfare Check)

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete provider spreadsheet 2-way sync via Azure OAuth + Microsoft Graph"
```
