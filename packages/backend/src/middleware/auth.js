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

    if (userRole === "admin") return next();

    let allowed = false;
    for (const r of roles) {
      if (r === userRole) {
        allowed = true;
        break;
      }
      if (r === "staff" && ["recruiter", "recruiter_admin", "staff"].includes(userRole)) {
        allowed = true;
        break;
      }
      if (r === "recruiter" && ["recruiter_admin", "staff"].includes(userRole)) {
        allowed = true;
        break;
      }
      if (r === "admin" && userRole === "recruiter_admin") {
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
