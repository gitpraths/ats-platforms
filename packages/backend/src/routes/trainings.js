import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listTrainings,
  getTraining,
  createTraining,
  updateTraining,
  softDeleteTraining,
} from "../services/trainings.js";

export const trainingsRouter = Router();
trainingsRouter.use(requireAuth);

trainingsRouter.get("/", async (req, res, next) => {
  try {
    const { page, limit, search, provider_id, is_active } = req.query;
    const isActive = is_active === undefined ? undefined : is_active === "true";
    const { rows, total } = await listTrainings({
      search,
      providerId: provider_id,
      isActive,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    res.json({
      success: true,
      data: rows,
      meta: { total, page: Number(page || 1), limit: Number(limit || 20) },
    });
  } catch (err) { next(err); }
});

trainingsRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await getTraining(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Training not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

trainingsRouter.post("/", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "name is required" });
    }
    const row = await createTraining(req.body);
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

trainingsRouter.patch("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const row = await updateTraining(req.params.id, req.body);
    if (!row) return res.status(404).json({ success: false, error: "Training not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

trainingsRouter.delete("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const row = await softDeleteTraining(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Training not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});
