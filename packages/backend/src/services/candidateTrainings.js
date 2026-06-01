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
