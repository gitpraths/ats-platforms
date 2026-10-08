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
      "SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = $1",
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

// ── GET /api/users ────────────────────────────────────────────────────────────
usersRouter.get("/", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { role, q } = req.query;
    const params      = [];
    const conditions  = [];
    if (role) { params.push(role);       conditions.push(`role = $${params.length}`); }
    if (q)    { params.push(`%${q}%`);   conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT id, name, email, role, avatar_url, created_at FROM users ${where} ORDER BY name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST /api/users ───────────────────────────────────────────────────────────
usersRouter.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: "name, email, and password are required" });

    const password_hash = await hashPassword(password);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, created_at",
      [name, email, password_hash, role || "recruiter"]
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

    const { rows } = await pool.query(
      "UPDATE users SET name=$1, email=$2, role=$3, updated_at=NOW() WHERE id=$4 RETURNING id, name, email, role, avatar_url, created_at",
      [name, email, role || "recruiter", req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "User not found" });
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

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
usersRouter.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ success: false, error: "You cannot delete your own account" });

    const { rows } = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, data: { id: rows[0].id } });
  } catch (err) { next(err); }
});
