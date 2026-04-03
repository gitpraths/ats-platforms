import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const candidatesRouter = Router();
candidatesRouter.use(requireAuth);

const ALLOWED_DOC_TYPES = ["cv", "id", "certificate", "other"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function getDocUpload(candidateId) {
  const dir = path.join(__dirname, "../../../../uploads/candidates", candidateId);
  fs.mkdirSync(dir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${file.fieldname}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Invalid file type"));
    },
  });
}

// ── GET /api/candidates ──────────────────────────────────
candidatesRouter.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q, work_status, provider_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const search = `%${q || ""}%`;

    const conditions = ["(c.name ILIKE $1 OR c.email ILIKE $1)"];
    const params = [search];
    let idx = 2;

    // Provider scope
    if (req.user.role === "provider") {
      conditions.push(`c.provider_id = $${idx}`);
      params.push(req.user.provider_id);
      idx++;
    } else if (provider_id) {
      conditions.push(`c.provider_id = $${idx}`);
      params.push(provider_id);
      idx++;
    }

    if (work_status) {
      conditions.push(`c.work_status = $${idx}`);
      params.push(work_status);
      idx++;
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const { rows } = await pool.query(
      `SELECT c.*, COUNT(a.id)::int AS application_count,
              pr.name AS provider_name
       FROM candidates c
       LEFT JOIN applications a ON a.candidate_id = c.id
       LEFT JOIN providers pr   ON pr.id = c.provider_id
       ${where}
       GROUP BY c.id, pr.name
       ORDER BY c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── GET /api/candidates/:id ──────────────────────────────
candidatesRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, pr.name AS provider_name, pr.id AS provider_id_check
       FROM candidates c
       LEFT JOIN providers pr ON pr.id = c.provider_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Candidate not found" });

    // Provider scope
    if (req.user.role === "provider" && rows[0].provider_id !== req.user.provider_id) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { rows: apps } = await pool.query(
      `SELECT a.id, a.stage, a.source, a.score, a.applied_at, j.title AS job_title
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.candidate_id = $1
       ORDER BY a.applied_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], applications: apps } });
  } catch (err) { next(err); }
});

// ── POST /api/candidates ─────────────────────────────────
candidatesRouter.post("/", requireRole("admin", "recruiter_admin", "recruiter"), async (req, res, next) => {
  try {
    const {
      name, email, phone, city, state, resume_url, linkedin, notes,
      provider_id, address_line1, address_line2, postcode, country,
      benchmark_hours, work_status, interested_job,
    } = req.body;
    if (!name)  return res.status(400).json({ success: false, error: "name is required" });
    if (!email) return res.status(400).json({ success: false, error: "email is required" });

    const { rows } = await pool.query(
      `INSERT INTO candidates
         (name, email, phone, city, state, resume_url, linkedin, notes,
          provider_id, address_line1, address_line2, postcode, country,
          benchmark_hours, work_status, interested_job)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        name, email, phone || null, city || null, state || null,
        resume_url || null, linkedin || null, notes || null,
        provider_id || null, address_line1 || null, address_line2 || null,
        postcode || null, country || "Australia",
        benchmark_hours || null, work_status || "job_seeking", interested_job || null,
      ]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, error: "A candidate with this email already exists" });
    }
    next(err);
  }
});

// ── PUT /api/candidates/:id ──────────────────────────────
candidatesRouter.put("/:id", requireRole("admin", "recruiter_admin", "recruiter"), async (req, res, next) => {
  try {
    const {
      name, email, phone, city, state, resume_url, linkedin, notes,
      provider_id, address_line1, address_line2, postcode, country,
      benchmark_hours, work_status, interested_job,
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE candidates
       SET name           = COALESCE($1,  name),
           email          = COALESCE($2,  email),
           phone          = COALESCE($3,  phone),
           city           = COALESCE($4,  city),
           state          = COALESCE($5,  state),
           resume_url     = COALESCE($6,  resume_url),
           linkedin       = COALESCE($7,  linkedin),
           notes          = COALESCE($8,  notes),
           provider_id    = COALESCE($9,  provider_id),
           address_line1  = COALESCE($10, address_line1),
           address_line2  = COALESCE($11, address_line2),
           postcode       = COALESCE($12, postcode),
           country        = COALESCE($13, country),
           benchmark_hours= COALESCE($14, benchmark_hours),
           work_status    = COALESCE($15, work_status),
           interested_job = COALESCE($16, interested_job),
           updated_at     = NOW()
       WHERE id = $17 RETURNING *`,
      [
        name, email, phone, city, state, resume_url, linkedin, notes,
        provider_id, address_line1, address_line2, postcode, country,
        benchmark_hours, work_status, interested_job,
        req.params.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Candidate not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── GET /api/candidates/:id/documents ───────────────────
candidatesRouter.get("/:id/documents", async (req, res, next) => {
  try {
    const { rows: candidate } = await pool.query("SELECT id, provider_id FROM candidates WHERE id = $1", [req.params.id]);
    if (!candidate[0]) return res.status(404).json({ success: false, error: "Candidate not found" });

    if (req.user.role === "provider" && candidate[0].provider_id !== req.user.provider_id) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { rows } = await pool.query(
      `SELECT cd.*, u.name AS uploaded_by_name
       FROM candidate_documents cd
       LEFT JOIN users u ON u.id = cd.uploaded_by
       WHERE cd.candidate_id = $1
       ORDER BY cd.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST /api/candidates/:id/documents ──────────────────
candidatesRouter.post("/:id/documents", requireRole("admin", "recruiter_admin", "recruiter"), async (req, res, next) => {
  const upload = getDocUpload(req.params.id);
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: "file is required" });

    const { document_type } = req.body;
    if (!document_type || !ALLOWED_DOC_TYPES.includes(document_type)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, error: `document_type must be one of: ${ALLOWED_DOC_TYPES.join(", ")}` });
    }

    try {
      const { rows: candidate } = await pool.query("SELECT id FROM candidates WHERE id = $1", [req.params.id]);
      if (!candidate[0]) return res.status(404).json({ success: false, error: "Candidate not found" });

      const relativePath = `/uploads/candidates/${req.params.id}/${req.file.filename}`;
      const { rows } = await pool.query(
        `INSERT INTO candidate_documents
           (candidate_id, document_type, file_name, file_path, file_size, mime_type, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          req.params.id, document_type, req.file.originalname,
          relativePath, req.file.size, req.file.mimetype, req.user.id,
        ]
      );

      await pool.query(
        `INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata)
         VALUES ('candidate_document', $1, 'uploaded', $2, $3)`,
        [req.params.id, req.user.id, JSON.stringify({ document_type, file_name: req.file.originalname })]
      );

      res.status(201).json({ success: true, data: rows[0] });
    } catch (dbErr) { next(dbErr); }
  });
});

// ── GET /api/candidates/:id/documents/:doc_id/download ──
candidatesRouter.get("/:id/documents/:doc_id/download", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM candidate_documents WHERE id = $1 AND candidate_id = $2`,
      [req.params.doc_id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Document not found" });

    const filePath = path.join(__dirname, "../../../../", rows[0].file_path);
    res.download(filePath, rows[0].file_name);
  } catch (err) { next(err); }
});

// ── DELETE /api/candidates/:id/documents/:doc_id ─────────
candidatesRouter.delete("/:id/documents/:doc_id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM candidate_documents WHERE id = $1 AND candidate_id = $2 RETURNING *`,
      [req.params.doc_id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Document not found" });

    const filePath = path.join(__dirname, "../../../../", rows[0].file_path);
    fs.unlink(filePath, () => {});

    res.json({ success: true });
  } catch (err) { next(err); }
});
