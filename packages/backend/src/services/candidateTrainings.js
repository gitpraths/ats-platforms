import { pool } from "../config/db.js";

export async function syncCandidateActiveTraining(candidateId, client = pool) {
  const { rows } = await client.query(
    `SELECT start_date, end_date
       FROM candidate_trainings
      WHERE candidate_id = $1 AND status = 'in_progress'
      ORDER BY start_date DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [candidateId]
  );
  const active = rows[0] || { start_date: null, end_date: null };
  await client.query(
    `UPDATE candidates
        SET training_start_date = $1,
            training_end_date   = $2,
            updated_at          = NOW()
      WHERE id = $3`,
    [active.start_date, active.end_date, candidateId]
  );
}

export async function listEnrolmentsForCandidate(candidateId) {
  const { rows } = await pool.query(
    `SELECT ct.*,
            t.name AS training_name, t.code AS training_code,
            p.name AS provider_name
       FROM candidate_trainings ct
       JOIN trainings t  ON t.id = ct.training_id
       LEFT JOIN providers p ON p.id = t.provider_id
      WHERE ct.candidate_id = $1
      ORDER BY ct.start_date DESC NULLS LAST, ct.created_at DESC`,
    [candidateId]
  );
  return rows;
}

export async function getEnrolment(id) {
  const { rows } = await pool.query(
    `SELECT ct.*,
            t.name AS training_name, t.code AS training_code,
            p.name AS provider_name
       FROM candidate_trainings ct
       JOIN trainings t  ON t.id = ct.training_id
       LEFT JOIN providers p ON p.id = t.provider_id
      WHERE ct.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createEnrolment({ candidate_id, training_id, status, start_date, end_date, certificate_no, notes, created_by }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const effectiveStatus = status || "enrolled";
    const completed_at = effectiveStatus === "completed" ? new Date().toISOString().slice(0, 10) : null;
    const { rows } = await client.query(
      `INSERT INTO candidate_trainings
         (candidate_id, training_id, status, start_date, end_date, completed_at, certificate_no, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [candidate_id, training_id, effectiveStatus, start_date || null, end_date || null, completed_at, certificate_no || null, notes || null, created_by || null]
    );
    await syncCandidateActiveTraining(candidate_id, client);
    await client.query("COMMIT");
    return getEnrolment(rows[0].id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateEnrolment(id, fields) {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(
      `SELECT candidate_id, status, completed_at FROM candidate_trainings WHERE id = $1`,
      [id]
    );
    if (!existing[0]) return null;

    await client.query("BEGIN");

    let completed_at = fields.completed_at;
    if (completed_at === undefined && fields.status === "completed" && !existing[0].completed_at) {
      completed_at = new Date().toISOString().slice(0, 10);
    }

    await client.query(
      `UPDATE candidate_trainings
          SET status         = COALESCE($1, status),
              start_date     = COALESCE($2, start_date),
              end_date       = COALESCE($3, end_date),
              completed_at   = COALESCE($4, completed_at),
              certificate_no = COALESCE($5, certificate_no),
              notes          = COALESCE($6, notes),
              updated_at     = NOW()
        WHERE id = $7`,
      [
        fields.status ?? null,
        fields.start_date ?? null,
        fields.end_date ?? null,
        completed_at ?? null,
        fields.certificate_no ?? null,
        fields.notes ?? null,
        id,
      ]
    );
    await syncCandidateActiveTraining(existing[0].candidate_id, client);
    await client.query("COMMIT");
    return getEnrolment(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteEnrolment(id) {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(
      `SELECT candidate_id FROM candidate_trainings WHERE id = $1`,
      [id]
    );
    if (!existing[0]) return false;

    await client.query("BEGIN");
    await client.query(`DELETE FROM candidate_trainings WHERE id = $1`, [id]);
    await syncCandidateActiveTraining(existing[0].candidate_id, client);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function buildEnrolmentFilters({ status, training_id, provider_id, date_from, date_to, search }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status && status.length) {
    conditions.push(`ct.status = ANY($${idx}::training_status[])`);
    params.push(status);
    idx++;
  }
  if (training_id) {
    conditions.push(`ct.training_id = $${idx}`);
    params.push(training_id);
    idx++;
  }
  if (provider_id) {
    conditions.push(`t.provider_id = $${idx}`);
    params.push(provider_id);
    idx++;
  }
  if (date_from) {
    conditions.push(`ct.start_date >= $${idx}`);
    params.push(date_from);
    idx++;
  }
  if (date_to) {
    conditions.push(`ct.start_date <= $${idx}`);
    params.push(date_to);
    idx++;
  }
  if (search) {
    conditions.push(`c.name ILIKE $${idx}`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params, nextIdx: idx };
}

export async function listEnrolments(filters) {
  const { where, params, nextIdx } = buildEnrolmentFilters(filters);
  const page  = Math.max(1, Number(filters.page  || 1));
  const limit = Math.min(100, Math.max(1, Number(filters.limit || 25)));
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT ct.*,
            t.name AS training_name, t.code AS training_code,
            p.name AS provider_name,
            c.name AS candidate_name
       FROM candidate_trainings ct
       JOIN trainings t      ON t.id = ct.training_id
       LEFT JOIN providers p ON p.id = t.provider_id
       JOIN candidates c     ON c.id = ct.candidate_id
       ${where}
       ORDER BY ct.start_date DESC NULLS LAST, ct.created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
    [...params, limit, offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM candidate_trainings ct
       JOIN trainings t  ON t.id = ct.training_id
       JOIN candidates c ON c.id = ct.candidate_id
       ${where}`,
    params
  );

  return { rows, total: countRows[0].total, page, limit };
}

export async function getEnrolmentStats(filters) {
  // Drop `status` from the active filters — stats are GROUPED by status.
  const { status: _ignored, ...rest } = filters;
  const { where, params } = buildEnrolmentFilters(rest);

  const { rows } = await pool.query(
    `SELECT ct.status, COUNT(*)::int AS count
       FROM candidate_trainings ct
       JOIN trainings t  ON t.id = ct.training_id
       JOIN candidates c ON c.id = ct.candidate_id
       ${where}
       GROUP BY ct.status`,
    params
  );

  const result = { enrolled: 0, in_progress: 0, completed: 0, withdrawn: 0, failed: 0 };
  for (const r of rows) result[r.status] = r.count;
  return result;
}

/**
 * Insert one enrolment per candidate in a single transaction.
 * Skips candidates already holding a non-terminal enrolment (`enrolled` or `in_progress`)
 * for the same `training_id`. Returns `{ created, skipped }`.
 *
 *  - `status` for each created row is `'enrolled'` (the bulk action is a cohort enrolment,
 *    not a state transition).
 *  - `completed_at` is null for created rows (status is `'enrolled'`).
 *  - `syncCandidateActiveTraining` is called once per AFFECTED candidate (those actually
 *    inserted) inside the same transaction.
 */
export async function bulkEnrol({ training_id, start_date, end_date, candidate_ids, created_by }) {
  if (!training_id) throw new Error("training_id is required");
  if (!start_date)  throw new Error("start_date is required");
  if (!Array.isArray(candidate_ids) || candidate_ids.length === 0) {
    throw new Error("candidate_ids must be a non-empty array");
  }
  if (end_date && new Date(end_date) < new Date(start_date)) {
    throw new Error("end_date must be on or after start_date");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1: find which candidates already have a non-terminal enrolment for this course.
    const { rows: blockedRows } = await client.query(
      `SELECT DISTINCT candidate_id
         FROM candidate_trainings
        WHERE training_id = $1
          AND status IN ('enrolled', 'in_progress')
          AND candidate_id = ANY($2::uuid[])`,
      [training_id, candidate_ids]
    );
    const blocked = new Set(blockedRows.map((r) => r.candidate_id));

    const skipped = [];
    const insertedIds = [];

    // Step 2: insert one row per non-blocked candidate.
    for (const candidateId of candidate_ids) {
      if (blocked.has(candidateId)) {
        skipped.push({ candidate_id: candidateId, reason: "active_enrolment_exists" });
        continue;
      }
      const { rows } = await client.query(
        `INSERT INTO candidate_trainings
           (candidate_id, training_id, status, start_date, end_date, created_by)
         VALUES ($1, $2, 'enrolled', $3, $4, $5)
         RETURNING id`,
        [candidateId, training_id, start_date, end_date || null, created_by || null]
      );
      insertedIds.push(rows[0].id);
    }

    // Step 3: sync the denormalised column for every affected candidate.
    const affected = candidate_ids.filter((id) => !blocked.has(id));
    for (const candidateId of affected) {
      await syncCandidateActiveTraining(candidateId, client);
    }

    await client.query("COMMIT");

    // Step 4: read back the inserted rows with their joined fields. Done outside the
    // transaction since the txn is committed.
    if (insertedIds.length === 0) return { created: [], skipped };
    const { rows: created } = await pool.query(
      `SELECT ct.*,
              t.name AS training_name, t.code AS training_code,
              p.name AS provider_name,
              c.name AS candidate_name
         FROM candidate_trainings ct
         JOIN trainings t      ON t.id = ct.training_id
         LEFT JOIN providers p ON p.id = t.provider_id
         JOIN candidates c     ON c.id = ct.candidate_id
        WHERE ct.id = ANY($1::uuid[])
        ORDER BY ct.created_at ASC`,
      [insertedIds]
    );
    return { created, skipped };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
