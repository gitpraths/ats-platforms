import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

export async function loginUser(email, password) {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE email = $1 AND is_active = true",
    [email]
  );
  const user = rows[0];
  if (!user) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid credentials");

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url },
  };
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
