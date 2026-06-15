import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { mountCandidateTrainingsList } from "./candidate-trainings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const candidatesRouter = Router();
candidatesRouter.use(requireAuth);
mountCandidateTrainingsList(candidatesRouter);

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

// ── GET /api/candidates/check-duplicate ─────────────────
candidatesRouter.get("/check-duplicate", async (req, res, next) => {
  try {
    const { phone, name, exclude_id } = req.query;
    const results = {};
    if (phone) {
      const { rows } = await pool.query(
        `SELECT id, name, email FROM candidates WHERE phone = $1 ${exclude_id ? 'AND id != $2' : ''} LIMIT 1`,
        exclude_id ? [phone, exclude_id] : [phone]
      );
      if (rows[0]) results.phone = rows[0];
    }
    if (name) {
      const { rows } = await pool.query(
        `SELECT id, name, email FROM candidates WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) ${exclude_id ? 'AND id != $2' : ''} LIMIT 1`,
        exclude_id ? [name, exclude_id] : [name]
      );
      if (rows[0]) results.name = rows[0];
    }
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

// ── GET /api/candidates ──────────────────────────────────
candidatesRouter.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q, search, work_status, provider_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const searchTerm = `%${q || search || ""}%`;

    const conditions = [
      `(c.name ILIKE $1 OR c.email ILIKE $1 OR c.phone ILIKE $1
        OR pr.name ILIKE $1
        OR EXISTS (
          SELECT 1 FROM master_industries mi
          WHERE mi.name ILIKE $1 AND mi.name = ANY(c.industry_preference)
        ))`
    ];
    const params = [searchTerm];
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
              pr.name AS provider_name,
              con.name AS consultant_name
       FROM candidates c
       LEFT JOIN applications a  ON a.candidate_id = c.id
       LEFT JOIN providers pr    ON pr.id = c.provider_id
       LEFT JOIN consultants con ON con.id = c.consultant_id
       ${where}
       GROUP BY c.id, pr.name, con.name
       ORDER BY c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── GET /api/candidates/:id ────────────────────────────
candidatesRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
              pr.name  AS provider_name,
              con.name AS consultant_name
       FROM candidates c
       LEFT JOIN providers   pr  ON pr.id  = c.provider_id
       LEFT JOIN consultants con ON con.id = c.consultant_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Candidate not found" });

    // Provider scope
    if (req.user.role === "provider" && rows[0].provider_id !== req.user.provider_id) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    // Latest application dates
    const { rows: apps } = await pool.query(
      `SELECT a.id, a.stage, a.source, a.score, a.applied_at,
              a.interview_date, a.ets_date, a.placement_date,
              j.title AS job_title
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
      first_name, last_name, name,
      email, phone, suburb, city, state, postcode,
      provider_id, consultant_id,
      date_referred, benchmark_hours,
      industry_preference, car, police_check, wwc,
      comments, notes,
      wage_subsidy, wage_subsidy_amount, interested_job,
    } = req.body;

    const fullName = name || [first_name, last_name].filter(Boolean).join(" ");
    if (!fullName.trim()) return res.status(400).json({ success: false, error: "Name is required" });
    if (!phone)          return res.status(400).json({ success: false, error: "Phone is required" });
    if (!provider_id)    return res.status(400).json({ success: false, error: "Provider is required" });
    if (!benchmark_hours) return res.status(400).json({ success: false, error: "Benchmark hours is required" });

    // Auto-generate sr_no
    const srResult = await pool.query("SELECT 'C-' || LPAD(nextval('candidate_sr_seq')::TEXT, 4, '0') AS sr_no");
    const sr_no = srResult.rows[0].sr_no;

    const { rows } = await pool.query(
      `INSERT INTO candidates
         (sr_no, name, first_name, last_name,
          email, phone, suburb, city, state, postcode, country,
          provider_id, consultant_id, date_referred,
          benchmark_hours, industry_preference,
          car, police_check, wwc,
          comments, notes, interested_job,
          wage_subsidy, wage_subsidy_amount, work_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       RETURNING *`,
      [
        sr_no, fullName, first_name || null, last_name || null,
        email || null, phone, suburb || city || null, suburb || city || null, state || null,
        postcode || null, "Australia",
        provider_id, consultant_id || null, date_referred || null,
        benchmark_hours ? Number(benchmark_hours) : null,
        industry_preference || [],
        car || "no", police_check || "no", wwc || "no",
        comments || notes || null, notes || comments || null, interested_job || null,
        wage_subsidy ?? false, wage_subsidy_amount || null, "job_seeking",
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
      first_name, last_name, name,
      email, phone, suburb, city, state, postcode,
      provider_id, consultant_id, date_referred,
      benchmark_hours, industry_preference,
      car, police_check, wwc,
      comments, notes, interested_job,
      wage_subsidy, wage_subsidy_amount, work_status,
    } = req.body;

    const fullName = name || (first_name && last_name ? `${first_name} ${last_name}` : (first_name || undefined));
    const { rows } = await pool.query(
      `UPDATE candidates SET
         name                = COALESCE($1,  name),
         first_name          = COALESCE($2,  first_name),
         last_name           = COALESCE($3,  last_name),
         email               = COALESCE($4,  email),
         phone               = COALESCE($5,  phone),
         suburb              = COALESCE($6,  suburb),
         city                = COALESCE($6,  city),
         state               = COALESCE($7,  state),
         postcode            = COALESCE($8,  postcode),
         provider_id         = COALESCE($9,  provider_id),
         consultant_id       = COALESCE($10, consultant_id),
         date_referred       = COALESCE($11, date_referred),
         benchmark_hours     = COALESCE($12, benchmark_hours),
         industry_preference = COALESCE($13, industry_preference),
         car                 = COALESCE($14, car),
         police_check        = COALESCE($15, police_check),
         wwc                 = COALESCE($16, wwc),
         comments            = COALESCE($17, comments),
         notes               = COALESCE($17, notes),
         interested_job      = COALESCE($18, interested_job),
         wage_subsidy        = COALESCE($19, wage_subsidy),
         wage_subsidy_amount = COALESCE($20, wage_subsidy_amount),
         work_status         = COALESCE($21, work_status),
         updated_at          = NOW()
       WHERE id = $22 RETURNING *`,
      [
        fullName || null,
        first_name || null,
        last_name  || null,
        email      || null,
        phone      || null,
        suburb || city || null,
        state      || null,
        postcode   || null,
        provider_id   || null,
        consultant_id || null,
        date_referred || null,
        benchmark_hours ? Number(benchmark_hours) : null,
        industry_preference || null,
        car          || null,
        police_check || null,
        wwc          || null,
        comments || notes || null,
        interested_job || null,
        wage_subsidy !== undefined ? wage_subsidy : null,
        wage_subsidy_amount || null,
        work_status || null,
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

      pool.query(
        `INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata)
         VALUES ('candidate_document', $1, 'uploaded', $2, $3)`,
        [req.params.id, req.user.id, JSON.stringify({ document_type, file_name: req.file.originalname })]
      ).catch(() => {});

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

// ── GET /api/candidates/:id/documents/:doc_id/view ───────
// Serves the file inline so PDFs and images open in the browser tab
candidatesRouter.get("/:id/documents/:doc_id/view", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM candidate_documents WHERE id = $1 AND candidate_id = $2`,
      [req.params.doc_id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Document not found" });
    const filePath = path.join(__dirname, "../../../../", rows[0].file_path);
    const mimeType = rows[0].mime_type || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${rows[0].file_name}"`);
    res.sendFile(path.resolve(filePath), (err) => {
      if (err) next(err);
    });
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
