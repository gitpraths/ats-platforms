import { createServer } from "http";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "dist");
const PORT = process.env.PORT || 3000;

console.log(`Serving from: ${dist}`);
console.log(`Files in dist:`, existsSync(dist) ? readdirSync(dist).slice(0, 5) : "DIST NOT FOUND");

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
};

createServer((req, res) => {
  try {
    const url = req.url.split("?")[0];
    let isHtml = false;
    let filePath = join(dist, url === "/" ? "index.html" : url);
    if (!existsSync(filePath) || url === "/" || !extname(filePath)) {
      filePath = join(dist, "index.html");
      isHtml = true;
    }
    const ext = extname(filePath);
    if (ext === ".html") isHtml = true;

    const content = readFileSync(filePath);
    const headers = { "Content-Type": MIME[ext] || "text/html" };

    if (isHtml) {
      headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
      headers["Pragma"] = "no-cache";
      headers["Expires"] = "0";
    } else if (url.startsWith("/assets/")) {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    } else {
      headers["Cache-Control"] = "public, max-age=3600";
    }

    res.writeHead(200, headers);
    res.end(content);
  } catch (err) {
    console.error("Request error:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error: " + err.message);
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend serving on port ${PORT}`);
});
