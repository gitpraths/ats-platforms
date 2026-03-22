import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  generateJobDescription,
  suggestJobTitles,
  screenCandidate,
} from "../services/ai.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

// POST /api/ai/job-description
// Body: { title, job_title (alias), required_skills, desired_skills, job_desc }
aiRouter.post("/job-description", async (req, res, next) => {
  try {
    const { title, job_title, required_skills, desired_skills, job_desc, department } = req.body;
    const resolvedTitle = title || job_title;
    if (!resolvedTitle) return res.status(400).json({ success: false, error: "title is required" });

    const description = await generateJobDescription(
      resolvedTitle,
      department || "General",
      required_skills || [],
      desired_skills  || [],
      job_desc        || ""
    );
    res.json({ success: true, data: { description } });
  } catch (err) { next(err); }
});

// POST /api/ai/job-titles
// Body: { title, job_title (alias), skills_required, job_desc }
aiRouter.post("/job-titles", async (req, res, next) => {
  try {
    const { title, job_title, skills_required, job_desc, department } = req.body;
    const resolvedTitle = title || job_title;
    if (!resolvedTitle) return res.status(400).json({ success: false, error: "title is required" });

    const titles = await suggestJobTitles(
      resolvedTitle,
      department      || "General",
      skills_required || [],
      job_desc        || ""
    );
    res.json({ success: true, data: { titles } });
  } catch (err) { next(err); }
});

// POST /api/ai/screen-candidate
// Body: { candidate_notes, job_title, job_description }
aiRouter.post("/screen-candidate", async (req, res, next) => {
  try {
    const { candidate_notes, job_title, job_description } = req.body;
    if (!candidate_notes || !job_title) {
      return res.status(400).json({ success: false, error: "candidate_notes and job_title are required" });
    }
    const result = await screenCandidate(candidate_notes, job_title, job_description || "");
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});
