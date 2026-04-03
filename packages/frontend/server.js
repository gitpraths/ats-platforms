import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const dist = join(__dirname, "dist");

app.use(express.static(dist));

app.get("*", (_req, res) => {
  res.sendFile(join(dist, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend serving on port ${PORT}`);
});
