import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "dist");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
};

createServer((req, res) => {
  let filePath = join(dist, req.url === "/" ? "index.html" : req.url);
  if (!existsSync(filePath)) filePath = join(dist, "index.html");
  const ext = extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "text/html" });
  res.end(readFileSync(filePath));
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend serving on port ${PORT}`);
});
