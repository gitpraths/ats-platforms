import logger from "../config/logger.js";

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms,
    });
  });
  next();
}
