import logger from "../config/logger.js";

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) {
    logger.error(`${req.method} ${req.path} — ${err.message}`, {
      requestId: req.id,
      stack: err.stack,
    });
  } else {
    logger.warn(`${req.method} ${req.path} ${status} — ${err.message}`, {
      requestId: req.id,
    });
  }
  res.status(status).json({
    success: false,
    error: err.message || "Internal server error",
  });
}
