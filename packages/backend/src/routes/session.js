import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const sessionRouter = Router();
sessionRouter.use(requireAuth);

// ── GET /api/session ──────────────────────────────────────────────────────────
// Returns current user profile from DB using the JWT identity
sessionRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = $1 AND is_active = true",
      [req.user.id]
    );
    if (!rows[0]) return res.status(401).json({ success: false, error: "User not found or inactive" });

    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── GET /api/session/refresh ──────────────────────────────────────────────────
// Issues a fresh JWT with a reset expiry
sessionRouter.get("/refresh", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1 AND is_active = true",
      [req.user.id]
    );
    if (!rows[0]) return res.status(401).json({ success: false, error: "User not found or inactive" });

    const token = jwt.sign(
      { id: rows[0].id, email: rows[0].email, role: rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    res.json({ success: true, data: { token } });
  } catch (err) { next(err); }
});
