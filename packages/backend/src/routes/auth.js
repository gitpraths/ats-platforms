import { Router } from "express";
import { loginUser } from "../services/auth.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }
    const result = await loginUser(email, password);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === "Invalid credentials") {
      return res.status(401).json({ success: false, error: err.message });
    }
    next(err);
  }
});

authRouter.post("/logout", (_req, res) => {
  res.json({ success: true });
});
