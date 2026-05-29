import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load backend .env so JWT_SECRET and other vars are available in tests
config({ path: resolve(__dirname, '.env') });
