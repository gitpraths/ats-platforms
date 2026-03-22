import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve to monorepo root .env (4 levels up from src/config/)
config({ path: resolve(__dirname, "../../../../.env") });
