import "./config/env.js";
import app from "./app.js";
import logger from "./config/logger.js";

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`Backend running on http://localhost:${PORT}`);
  logger.info(`API docs available at http://localhost:${PORT}/api-docs`);
});
