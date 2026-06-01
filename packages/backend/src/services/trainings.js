import { pool } from "../config/db.js";

export async function listTrainings({ search, providerId, isActive, page = 1, limit = 20 }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(t.name ILIKE $${idx} OR t.code ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (providerId) {
    conditions.push(`t.provider_id = $${idx}`);
    params.push(providerId);
    idx++;
  }
  if (isActive !== undefined) {
    conditions.push(`t.is_active = $${idx}`);
    params.push(isActive);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (Number(page) - 1) * Number(limit);

  const { rows } = await pool.query(
    `SELECT t.*, p.name AS provider_name
       FROM trainings t
       LEFT JOIN providers p ON p.id = t.provider_id
       ${where}
       ORDER BY t.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, Number(limit), offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM trainings t ${where}`,
    params
  );

  return { rows, total: countRows[0].total };
}

export async function getTraining(id) {
  const { rows } = await pool.query(
    `SELECT t.*, p.name AS provider_name
       FROM trainings t
       LEFT JOIN providers p ON p.id = t.provider_id
       WHERE t.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createTraining({ name, code, description, duration_days, provider_id, is_active }) {
  const { rows } = await pool.query(
    `INSERT INTO trainings (name, code, description, duration_days, provider_id, is_active)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
     RETURNING *`,
    [name, code || null, description || null, duration_days || null, provider_id || null, is_active]
  );
  return rows[0];
}

export async function updateTraining(id, { name, code, description, duration_days, provider_id, is_active }) {
  const { rows } = await pool.query(
    `UPDATE trainings
        SET name          = COALESCE($1, name),
            code          = COALESCE($2, code),
            description   = COALESCE($3, description),
            duration_days = COALESCE($4, duration_days),
            provider_id   = COALESCE($5, provider_id),
            is_active     = COALESCE($6, is_active),
            updated_at    = NOW()
      WHERE id = $7
      RETURNING *`,
    [name, code, description, duration_days, provider_id, is_active, id]
  );
  return rows[0] || null;
}

export async function softDeleteTraining(id) {
  const { rows } = await pool.query(
    `UPDATE trainings SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}
