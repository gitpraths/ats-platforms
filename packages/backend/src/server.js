import "./config/env.js";
import app from "./app.js";
import logger from "./config/logger.js";
import { initDatabase } from "./config/initDatabase.js";

const PORT = process.env.PORT || 3001;

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    logger.info(`Backend running on http://localhost:${PORT}`);
    logger.info(`API docs available at http://localhost:${PORT}/api-docs`);
  });
}

start();

