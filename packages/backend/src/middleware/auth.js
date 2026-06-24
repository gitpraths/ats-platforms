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
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    next();
  };
}
