import { pool } from '../config/db.js';
import { getValidAccessToken } from './ms-auth.js';

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

  try {
    const tokenResult = await getValidAccessToken(provider);
    accessToken = tokenResult.accessToken;

    if (tokenResult.refreshed) {
      await pool.query(
        `UPDATE providers SET ms_access_token=$1, ms_refresh_token=$2, ms_token_expiry=$3 WHERE id=$4`,
        [tokenResult.newAccessToken, tokenResult.newRefreshToken, tokenResult.newExpiry, provider.id]
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
    let nullCount = 0;
    const resolvedAtsIndices = atsColIndices.map((idx) => {
      if (idx !== null) return idx;
      return nextCol + nullCount++;
    });

    // Write ATS headers if any are missing
    if (needsHeaderWrite) {
      for (let ci = 0; ci < 4; ci++) {
        if (atsColIndices[ci] === null) {
          const colLetter = indexToColLetter(resolvedAtsIndices[ci]);
          await graphPatch(accessToken,
            `/me/drive/items/${provider.onedrive_file_id}/workbook/worksheets/${encodeURIComponent(provider.onedrive_sheet_name)}/range(address='${colLetter}1')`,
            { values: [[ATS_COLUMN_NAMES[ci]]] }
          );
        }
      }
    }

    // Process data rows
    const dataRows = allRows.slice(1);
    let created = 0, updated = 0, writtenBack = 0, skipped = 0;
    const outboundRows = [];

    for (const row of dataRows) {
      const candidate = mapRowToCandidate(headers, row, provider.id);

      if (!candidate.email) {
        const namePart = candidate.name
          ? candidate.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          : '';
        const phonePart = candidate.phone
          ? candidate.phone.replace(/\D/g, '')
          : '';
        if (namePart || phonePart) {
          candidate.email = `${namePart || 'unknown'}-${phonePart || 'nophone'}@sync.local`;
        } else {
          skipped++;
          outboundRows.push(['', '', '', '']);
          continue;
        }
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
      const colLetters = resolvedAtsIndices.map(indexToColLetter);
      const startRow = 2;
      const endRow = startRow + outboundRows.length - 1;

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
    if (err.status === 401) {
      await pool.query(
        `UPDATE providers SET ms_access_token=NULL, ms_refresh_token=NULL, ms_token_expiry=NULL WHERE id=$1`,
        [provider.id]
      );
    }
    try {
      await pool.query(
        `UPDATE provider_sync_logs SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
        [err.message, logId]
      );
    } catch { /* best-effort: don't mask original error */ }
    throw err;
  }
}

export async function searchOneDriveFiles(token, query) {
  const q = (query ?? '').trim() || '.xlsx';
  // Include parentReference so we get driveId — needed for SharePoint/Teams files
  const path = `/me/drive/root/search(q='${encodeURIComponent(q)}')?$select=id,name,file,lastModifiedDateTime,parentReference&$top=25`;
  const json = await graphGet(token, path);
  const items = json?.value ?? [];
  return items
    .filter(item => item.file && /\.(xlsx|xls|xlsm|xlsb)$/i.test(item.name ?? ''))
    .slice(0, 20)
    .map(item => ({
      id: item.id,
      name: item.name,
      last_modified: item.lastModifiedDateTime ?? null,
      drive_id: item.parentReference?.driveId ?? null,
    }));
}

// driveId is required for SharePoint/Teams files — personal OneDrive files
// work with /me/drive/items but SharePoint files need /drives/{driveId}/items
export async function listWorksheets(token, fileId, driveId) {
  const base = driveId
    ? `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(fileId)}`
    : `/me/drive/items/${encodeURIComponent(fileId)}`;
  const path = `${base}/workbook/worksheets?$select=id,name,position`;
  const json = await graphGet(token, path);
  return (json?.value ?? [])
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(ws => ({ id: ws.id, name: ws.name }));
}
