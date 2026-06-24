// v2
import express from "express";
import path from "path";
import { mkdirSync } from "fs";
import cors from "cors";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { authRouter }         from "./routes/auth.js";
import { jobsRouter }         from "./routes/jobs.js";
import { candidatesRouter }   from "./routes/candidates.js";
import { applicationsRouter } from "./routes/applications.js";
import { usersRouter }        from "./routes/users.js";
import { aiRouter }           from "./routes/ai.js";
import { departmentsRouter }  from "./routes/departments.js";
import { locationsRouter }    from "./routes/locations.js";
import { sessionRouter }      from "./routes/session.js";
import { statsRouter }        from "./routes/stats.js";
import { providersRouter }    from "./routes/providers.js";
import { employersRouter }    from "./routes/employers.js";
import { placementsRouter, welfareChecksRouter } from "./routes/placements.js";
import { reportsRouter }      from "./routes/reports.js";
import { trainingsRouter }    from "./routes/trainings.js";
import { candidateTrainingsRouter } from "./routes/candidate-trainings.js";
import { xeroRouter }         from "./routes/xero.js";
import { candidatePoolRouter } from "./routes/candidate-pool.js";
import { msAuthRouter }        from "./routes/ms-auth.js";
import { industriesRouter, workTypesRouter, workStatusRouter } from "./routes/master.js";
import { consultantsRouter }  from "./routes/consultants.js";

import { errorHandler }       from "./middleware/errorHandler.js";
import { requestLogger }      from "./middleware/requestLogger.js";
import { requestId }          from "./middleware/requestId.js";
import { startWelfareCheckCron } from "./services/welfare-check-cron.js";

const app = express();

// ── Swagger / OpenAPI ─────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "My ATS Platform API",
      version: "0.1.0",
      description: "Applicant Tracking System REST API",
    },
    servers: [{ url: `http://localhost:${process.env.PORT || 3001}/api` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js"],
});

// ── Core middleware ───────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin === "http://localhost:5173" ||
      origin.endsWith(".up.railway.app")
    ) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(requestLogger);

// ── API Docs ──────────────────────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

// ── Static uploads ────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
mkdirSync(path.join(UPLOADS_DIR, "candidates"), { recursive: true });
app.use("/uploads", express.static(UPLOADS_DIR));

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ success: true, status: "ok" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",         authRouter);
app.use("/api/jobs",         jobsRouter);
app.use("/api/candidates",   candidatesRouter);
app.use("/api/applications", applicationsRouter);
app.use("/api/users",        usersRouter);
app.use("/api/ai",           aiRouter);
app.use("/api/departments",    departmentsRouter);
app.use("/api/locations",      locationsRouter);
app.use("/api/session",        sessionRouter);
app.use("/api/stats",          statsRouter);
app.use("/api/providers",      providersRouter);
app.use("/api/consultants",    consultantsRouter);
app.use("/api/employers",      employersRouter);
app.use("/api/placements",     placementsRouter);
app.use("/api/welfare-checks", welfareChecksRouter);
app.use("/api/reports",        reportsRouter);
app.use("/api/trainings",      trainingsRouter);
app.use("/api/candidate-trainings", candidateTrainingsRouter);
app.use("/api/xero",           xeroRouter);
app.use("/api/candidate-pool", candidatePoolRouter);
app.use("/api", msAuthRouter);
app.use("/api/master/industries",  industriesRouter);
app.use("/api/master/work-types",  workTypesRouter);
app.use("/api/master/work-status", workStatusRouter);

// ── Postcode lookup proxy (avoids browser CORS) ───────────────────────────────
app.get("/api/postcodes/:postcode", async (req, res) => {
  try {
    const { postcode } = req.params;
    if (!/^\d{4}$/.test(postcode)) {
      return res.status(400).json({ success: false, error: "Postcode must be 4 digits" });
    }
    const response = await fetch(`https://v0.postcodeapi.com.au/suburbs/${postcode}.json`);
    if (!response.ok) return res.json({ success: true, data: [] });
    const data = await response.json();
    // Return simplified list: [{ suburb, state }]
    const results = (Array.isArray(data) ? data : []).map((s) => ({
      suburb: s.name,
      state:  s.state?.abbreviation || s.state,
    }));
    res.json({ success: true, data: results });
  } catch {
    res.json({ success: true, data: [] });
  }
});


// ── Admin: manual welfare check trigger ───────────────────────────────────────
import { requireAuth, requireRole } from "./middleware/auth.js";
import { runWelfareCheckJob } from "./services/welfare-check-cron.js";

app.post("/api/admin/run-welfare-checks", requireAuth, requireRole("admin"), async (_req, res, next) => {
  try {
    const result = await runWelfareCheckJob();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) =>
  res.json({ status: "ok", version: process.env.npm_package_version || "0.1.0" })
);

// ── Start cron ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  startWelfareCheckCron();
}

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

export default app;
