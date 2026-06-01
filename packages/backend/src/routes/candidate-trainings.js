import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listEnrolmentsForCandidate,
  getEnrolment,
  createEnrolment,
  updateEnrolment,
  deleteEnrolment,
  listEnrolments,
  getEnrolmentStats,
  bulkEnrol,
} from "../services/candidateTrainings.js";
import { pool } from "../config/db.js";

function validateDates(start_date, end_date) {
  if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
    return "end_date must be on or after start_date";
  }
  return null;
}

async function logActivity(entityId, action, performedBy, metadata) {
  try {
    await pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata)
       VALUES ('candidate_training', $1, $2, $3, $4)`,
      [entityId, action, performedBy, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (_err) { /* non-fatal */ }
}

// Mounted at /api/candidate-trainings
export const candidateTrainingsRouter = Router();
candidateTrainingsRouter.use(requireAuth);

candidateTrainingsRouter.get("/", async (req, res, next) => {
  try {
    const { page, limit, status, training_id, provider_id, date_from, date_to, search } = req.query;
    const statusList = !status
      ? undefined
      : Array.isArray(status) ? status : String(status).split(",").filter(Boolean);

    const result = await listEnrolments({
      page, limit,
      status: statusList,
      training_id,
      provider_id,
      date_from,
      date_to,
      search,
    });
    res.json({
      success: true,
      data: result.rows,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) { next(err); }
});

candidateTrainingsRouter.get("/stats", async (req, res, next) => {
  try {
    const { training_id, provider_id, date_from, date_to, search } = req.query;
    const stats = await getEnrolmentStats({
      training_id, provider_id, date_from, date_to, search,
    });
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

candidateTrainingsRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await getEnrolment(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Enrolment not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

candidateTrainingsRouter.post(
  "/bulk",
  requireRole("admin", "recruiter_admin", "recruiter"),
  async (req, res, next) => {
    try {
      const { training_id, start_date, end_date, candidate_ids } = req.body;
      if (!training_id || !start_date) {
        return res.status(400).json({ success: false, error: "training_id and start_date are required" });
      }
      if (!Array.isArray(candidate_ids) || candidate_ids.length === 0) {
        return res.status(400).json({ success: false, error: "candidate_ids must be a non-empty array" });
      }
      if (end_date && new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({ success: false, error: "end_date must be on or after start_date" });
      }

      const result = await bulkEnrol({
        training_id, start_date, end_date,
        candidate_ids,
        created_by: req.user.id,
      });

      for (const row of result.created) {
        await logActivity(row.id, "created", req.user.id, {
          candidate_id: row.candidate_id, training_id, bulk: true,
        });
      }

      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

candidateTrainingsRouter.post(
  "/",
  requireRole("admin", "recruiter_admin", "recruiter"),
  async (req, res, next) => {
    try {
      const { candidate_id, training_id, start_date, end_date } = req.body;
      if (!candidate_id || !training_id) {
        return res.status(400).json({ success: false, error: "candidate_id and training_id are required" });
      }
      const dateError = validateDates(start_date, end_date);
      if (dateError) return res.status(400).json({ success: false, error: dateError });

      const row = await createEnrolment({ ...req.body, created_by: req.user.id });
      await logActivity(row.id, "created", req.user.id, { candidate_id, training_id, status: row.status });
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

candidateTrainingsRouter.patch(
  "/:id",
  requireRole("admin", "recruiter_admin", "recruiter"),
  async (req, res, next) => {
    try {
      const { start_date, end_date } = req.body;
      const dateError = validateDates(start_date, end_date);
      if (dateError) return res.status(400).json({ success: false, error: dateError });

      const row = await updateEnrolment(req.params.id, req.body);
      if (!row) return res.status(404).json({ success: false, error: "Enrolment not found" });
      await logActivity(row.id, "updated", req.user.id, { status: row.status });
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

candidateTrainingsRouter.delete("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const ok = await deleteEnrolment(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Enrolment not found" });
    await logActivity(req.params.id, "deleted", req.user.id, null);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Exported helper for mounting the per-candidate list under /api/candidates/:id/trainings
export function mountCandidateTrainingsList(candidatesRouter) {
  candidatesRouter.get("/:id/trainings", requireAuth, async (req, res, next) => {
    try {
      const rows = await listEnrolmentsForCandidate(req.params.id);
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  });
}
