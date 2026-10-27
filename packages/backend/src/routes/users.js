import { Router } from "express";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import multer from "multer";
import sharp from "sharp";
import bcrypt from "bcrypt";
import { pool } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { hashPassword } from "../services/auth.js";

// ── Avatar setup ──────────────────────────────────────────────────────────────
const UPLOAD_DIR  = process.env.UPLOAD_DIR || "uploads";
const AVATAR_DIR  = join(process.cwd(), UPLOAD_DIR, "avatars");
if (!existsSync(AVATAR_DIR)) mkdirSync(AVATAR_DIR, { recursive: true });

const ALLOWED_MIME   = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024;
const MAX_DIMENSION  = 1024;

// Store in memory so sharp can process before saving to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
  },
});

export const usersRouter = Router();

// ── GET /api/users/:id/avatar (Publicly accessible for <img> tags) ─────────────
usersRouter.get("/:id/avatar", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id FROM users WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: "User not found" });

    const filePath = join(AVATAR_DIR, `${req.params.id}.webp`);
    if (!existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "Avatar not found" });
    }

    res.set("Content-Type",  "image/webp");
    res.set("Cache-Control", "public, max-age=60, must-revalidate");
    res.sendFile(filePath);
  } catch (err) { next(err); }
});

usersRouter.use(requireAuth);

// ── GET /api/users/me ─────────────────────────────────────────────────────────
usersRouter.get("/me", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, role, permissions, avatar_url, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── PUT /api/users/me ─────────────────────────────────────────────────────────
usersRouter.put("/me", async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name is required" });

    const { rows } = await pool.query(
      "UPDATE users SET name=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, email, role, avatar_url",
      [name, req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── PUT /api/users/me/password ───────────────────────────────────────────────
usersRouter.put("/me/password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Current password and new password are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "New password must be at least 8 characters" });
    }

    const { rows } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(400).json({ success: false, error: "Current password is incorrect" });
    }

    const newHash = await hashPassword(newPassword);
    await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [newHash, req.user.id]);

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) { next(err); }
});

// ── POST /api/users/:id/avatar ────────────────────────────────────────────────
usersRouter.post("/:id/avatar", (req, res, next) => {
  if (req.params.id !== req.user.id)
    return res.status(403).json({ success: false, error: "You can only upload your own avatar" });

  upload.single("avatar")(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });

    try {
      // Validate dimensions and resize with sharp (max 1024x1024 — doc 0012)
      const image    = sharp(req.file.buffer);
      const metadata = await image.metadata();
      const needsResize =
        (metadata.width  ?? 0) > MAX_DIMENSION ||
        (metadata.height ?? 0) > MAX_DIMENSION;

      const outputPath = join(AVATAR_DIR, `${req.user.id}.webp`);
      if (needsResize) {
        await image
          .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
          .webp()
          .toFile(outputPath);
      } else {
        await image.webp().toFile(outputPath);
      }

      const avatarUrl = `/api/users/${req.user.id}/avatar`;
      await pool.query("UPDATE users SET avatar_url=$1 WHERE id=$2", [avatarUrl, req.user.id]);
      res.json({ success: true, data: { avatar_url: avatarUrl } });
    } catch (e) { next(e); }
  });
});

export const ALLOWED_ROLES = ["super_admin", "admin", "staff", "hr", "marketing"];

// ── GET /api/users ────────────────────────────────────────────────────────────
usersRouter.get("/", async (req, res, next) => {
  try {
    const { pool } = await import("../config/db.js");
    const { rows: me } = await pool.query("SELECT role, permissions FROM users WHERE id = $1", [req.user.id]);
    const myRole = me[0]?.role;
    const myPerms = me[0]?.permissions || [];
    const isAllowed = myRole === "super_admin" || myRole === "admin" || myPerms.includes("admin:users") || myPerms.includes("jobs:view") || myPerms.includes("jobs:create") || myPerms.includes("jobs:edit") || myPerms.includes("candidates:view");
    if (!isAllowed) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { role, q } = req.query;
    const params      = [];
    const conditions  = [];
    if (role) { params.push(role);       conditions.push(`role = $${params.length}`); }
    if (q)    { params.push(`%${q}%`);   conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT id, name, email, role, permissions, avatar_url, created_at FROM users ${where} ORDER BY name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST /api/users ───────────────────────────────────────────────────────────
usersRouter.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: "name, email, and password are required" });

    if (role && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: `Invalid role '${role}'. Allowed roles: ${ALLOWED_ROLES.join(", ")}` });
    }

    const { ROLE_DEFAULTS } = await import("../config/permissions.js");
    const userRole = role || "staff";
    const userPerms = Array.isArray(permissions) ? permissions : (ROLE_DEFAULTS[userRole] || []);

    const password_hash = await hashPassword(password);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, permissions) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, permissions, created_at",
      [name, email, password_hash, userRole, JSON.stringify(userPerms)]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ success: false, error: "Email already in use" });
    next(err);
  }
});

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
usersRouter.put("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { name, email, role } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, error: "name and email are required" });

    if (role && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: `Invalid role '${role}'. Allowed roles: ${ALLOWED_ROLES.join(", ")}` });
    }

    const existing = await pool.query("SELECT role, permissions FROM users WHERE id = $1", [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: "User not found" });

    const newRole = role || existing.rows[0].role;
    let newPerms = req.body.permissions;
    if (!newPerms && role && role !== existing.rows[0].role) {
      const { ROLE_DEFAULTS } = await import("../config/permissions.js");
      newPerms = ROLE_DEFAULTS[newRole] || [];
    } else if (!newPerms) {
      newPerms = existing.rows[0].permissions || [];
    }

    const { rows } = await pool.query(
      "UPDATE users SET name=$1, email=$2, role=$3, permissions=$4, updated_at=NOW() WHERE id=$5 RETURNING id, name, email, role, permissions, avatar_url, created_at",
      [name, email, newRole, JSON.stringify(newPerms), req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ success: false, error: "Email already in use" });
    next(err);
  }
});

// ── PUT /api/users/:id/password ───────────────────────────────────────────────
usersRouter.put("/:id/password", requireRole("admin"), async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
    }

    const { rows } = await pool.query("SELECT id FROM users WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: "User not found" });

    const password_hash = await hashPassword(password);
    await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [password_hash, req.params.id]);

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) { next(err); }
});

// ── GET /api/users/:id/permissions ───────────────────────────────────────────
usersRouter.get("/:id/permissions", requireRole("admin"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, role, permissions FROM users WHERE id = $1",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "User not found" });

    const { PERMISSIONS_CATALOG, ROLE_DEFAULTS, ALL_PERMISSION_IDS } = await import("../config/permissions.js");
    res.json({
      success: true,
      data: {
        user: rows[0],
        catalog: PERMISSIONS_CATALOG,
        role_defaults: ROLE_DEFAULTS,
        all_permissions: ALL_PERMISSION_IDS,
      },
    });
  } catch (err) { next(err); }
});

// ── PUT /api/users/:id/permissions ───────────────────────────────────────────
usersRouter.put("/:id/permissions", requireRole("admin"), async (req, res, next) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, error: "permissions must be an array of strings" });
    }

    const { ALL_PERMISSION_IDS, SUPER_ADMIN_EMAILS } = await import("../config/permissions.js");
    // Sanitize: keep only permissions that exist in catalog
    const sanitized = permissions.filter((p) => ALL_PERMISSION_IDS.includes(p));

    const target = await pool.query("SELECT id, email, role FROM users WHERE id = $1", [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ success: false, error: "User not found" });

    // Only a Super Admin can modify a Super Admin user's permissions
    const isTargetSuperAdmin = target.rows[0].role === "super_admin" ||
      SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === target.rows[0].email.toLowerCase());
    if (isTargetSuperAdmin && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, error: "Only Super Admins can modify Super Admin permissions" });
    }

    const { rows } = await pool.query(
      "UPDATE users SET permissions = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role, permissions",
      [JSON.stringify(sanitized), req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── DELETE /api/users/:id (Protected Account Guarded) ─────────────────────────────
usersRouter.delete("/:id", requireRole("admin"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ success: false, error: "You cannot delete your own account" });

    const target = await client.query("SELECT id, email, role FROM users WHERE id = $1", [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ success: false, error: "User not found" });

    // Hard-lock: Super Admins & Protected Accounts cannot be deleted
    const { SUPER_ADMIN_EMAILS, PROTECTED_USER_EMAILS } = await import("../config/permissions.js");
    const protectedList = PROTECTED_USER_EMAILS || SUPER_ADMIN_EMAILS;
    const isTargetProtected = target.rows[0].role === "super_admin" ||
      protectedList.some((e) => e.toLowerCase() === (target.rows[0].email || "").toLowerCase().trim());

    if (isTargetProtected) {
      return res.status(403).json({
        success: false,
        error: "This account is permanently protected and cannot be deleted.",
      });
    }

    await client.query("BEGIN");
    const userId = req.params.id;

    // 1. Jobs: nullify user references and remove recruiter links
    await client.query("UPDATE jobs SET sourced_by_user_id = NULL WHERE sourced_by_user_id = $1", [userId]);
    await client.query("UPDATE jobs SET created_by = NULL WHERE created_by = $1", [userId]);
    await client.query("UPDATE jobs SET updated_by = NULL WHERE updated_by = $1", [userId]);
    await client.query("DELETE FROM job_recruiter WHERE user_id = $1", [userId]);
    await client.query("UPDATE job_activity SET user_id = NULL WHERE user_id = $1", [userId]);

    // 2. Candidates: nullify staff and audit links
    await client.query("UPDATE candidates SET staff_id = NULL WHERE staff_id = $1", [userId]);
    await client.query("UPDATE candidates SET created_by = NULL WHERE created_by = $1", [userId]);
    await client.query("UPDATE candidates SET updated_by = NULL WHERE updated_by = $1", [userId]);
    await client.query("UPDATE candidate_documents SET uploaded_by = NULL WHERE uploaded_by = $1", [userId]);
    await client.query("UPDATE candidate_notes SET created_by = NULL WHERE created_by = $1", [userId]);

    // 3. Training & Placements: nullify creator links
    await client.query("UPDATE candidate_trainings SET created_by = NULL WHERE created_by = $1", [userId]);
    await client.query("UPDATE placements SET created_by = NULL WHERE created_by = $1", [userId]);

    // 4. Integrations & Activity logs
    await client.query("UPDATE xero_connection SET connected_by = NULL WHERE connected_by = $1", [userId]);
    await client.query("UPDATE xero_invoices SET created_by = NULL WHERE created_by = $1", [userId]);
    await client.query("UPDATE activity_log SET performed_by = NULL WHERE performed_by = $1", [userId]);

    // 5. Delete the user
    const { rows } = await client.query("DELETE FROM users WHERE id = $1 RETURNING id", [userId]);
    await client.query("COMMIT");

    res.json({ success: true, data: { id: rows[0].id } });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});
