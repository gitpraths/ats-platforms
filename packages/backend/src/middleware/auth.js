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
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    if (userRole === "super_admin" || userRole === "admin") return next();

    let allowed = false;
    for (const r of roles) {
      if (r === userRole) {
        allowed = true;
        break;
      }
      if (r === "staff" && ["recruiter", "recruiter_admin", "staff", "hr", "marketing"].includes(userRole)) {
        allowed = true;
        break;
      }
      if (r === "recruiter" && ["recruiter_admin", "staff"].includes(userRole)) {
        allowed = true;
        break;
      }
      if (r === "admin" && (userRole === "super_admin" || userRole === "recruiter_admin")) {
        allowed = true;
        break;
      }
    }

    if (!allowed) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    next();
  };
}

export function requirePermission(...requiredPermissions) {
  return async (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole) return res.status(403).json({ success: false, error: "Forbidden" });

    // Super Admin and Admin bypass all granular permission checks
    if (userRole === "super_admin" || userRole === "admin") return next();

    let userPerms = req.user?.permissions;
    if (!Array.isArray(userPerms)) {
      // Lazy load permissions from DB if not already on the JWT token
      const { pool } = await import("../config/db.js");
      const { rows } = await pool.query("SELECT permissions, role FROM users WHERE id = $1", [req.user.id]);
      userPerms = rows[0]?.permissions || [];
      if (req.user) req.user.permissions = userPerms;
    }

    const hasAll = requiredPermissions.every((p) => userPerms.includes(p));
    if (!hasAll) {
      return res.status(403).json({
        success: false,
        error: `Permission denied. Required: ${requiredPermissions.join(", ")}`,
      });
    }
    next();
  };
}
