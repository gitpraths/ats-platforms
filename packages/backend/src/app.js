import express from "express";
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
import { errorHandler }       from "./middleware/errorHandler.js";
import { requestLogger }      from "./middleware/requestLogger.js";
import { requestId }          from "./middleware/requestId.js";

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
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(requestLogger);

// ── API Docs ──────────────────────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

// ── Static uploads ────────────────────────────────────────────────────────────
app.use("/uploads", express.static("uploads"));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",         authRouter);
app.use("/api/jobs",         jobsRouter);
app.use("/api/candidates",   candidatesRouter);
app.use("/api/applications", applicationsRouter);
app.use("/api/users",        usersRouter);
app.use("/api/ai",           aiRouter);
app.use("/api/departments",  departmentsRouter);
app.use("/api/locations",    locationsRouter);
app.use("/api/session",      sessionRouter);
app.use("/api/stats",        statsRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) =>
  res.json({ status: "ok", version: process.env.npm_package_version || "0.1.0" })
);

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

export default app;
