import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  // Accept token from Authorization header OR ?token= query param (for browser file links)
  const header = req.headers.authorization;
  const rawToken = header?.startsWith("Bearer ")
    ? header.slice(7)
    : (req.query.token ?? null);

  if (!rawToken) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    req.user = jwt.verify(rawToken, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ success: false, error: "Unauthorized" });

    try {
      // Query live role to ensure instant reflection
      const { pool } = await import("../config/db.js");
      const { rows } = await pool.query("SELECT role, permissions FROM users WHERE id = $1", [req.user.id]);
      if (!rows[0]) return res.status(403).json({ success: false, error: "Forbidden" });

      const liveRole = rows[0].role;
      req.user.role = liveRole;
      req.user.permissions = rows[0].permissions || [];

      // Super admin and admin bypass any role check
      if (liveRole === "super_admin" || liveRole === "admin") return next();

      let allowed = false;
      for (const r of roles) {
        if (r === liveRole) {
          allowed = true;
          break;
        }
        if (r === "staff" && ["staff", "hr", "marketing"].includes(liveRole)) {
          allowed = true;
          break;
        }
      }

      if (!allowed) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requirePermission(...requiredPermissions) {
  return async (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ success: false, error: "Unauthorized" });

    try {
      // Always verify live role and permissions from database so changes apply in real time
      const { pool } = await import("../config/db.js");
      const { rows } = await pool.query("SELECT role, permissions FROM users WHERE id = $1", [req.user.id]);
      if (!rows[0]) return res.status(403).json({ success: false, error: "Forbidden" });

      const liveRole = rows[0].role;
      const userPerms = rows[0].permissions || [];
      req.user.role = liveRole;
      req.user.permissions = userPerms;

      // Super Admin and Admin bypass all granular permission checks
      if (liveRole === "super_admin" || liveRole === "admin") return next();

      const hasAll = requiredPermissions.every((p) => userPerms.includes(p));
      if (!hasAll) {
        return res.status(403).json({
          success: false,
          error: `Permission denied. Required: ${requiredPermissions.join(", ")}`,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
