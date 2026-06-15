import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load backend-specific .env first (local dev with Railway DB URL),
// then fall back to monorepo root .env.
// Railway sets env vars directly — .env files are never read in production.
config({ path: resolve(__dirname, "../../.env") });          // packages/backend/.env
config({ path: resolve(__dirname, "../../../../.env") });    // root .env (fallback)
