import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../db/pool.js";
import { logActivity } from "../activity/activity.routes.js";     

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, first_name, last_name, email, password_hash, role, status, must_change_password FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    // Same error for "no user" and "wrong password" — never reveal which one failed
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.status === "Disabled") {
      return res.status(403).json({ error: "This account has been disabled" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
  {
    userId: user.id,
    email: user.email,
    role: user.role,
  },
  process.env.JWT_SECRET,
  { expiresIn: "8h" }
);
   await logActivity({
  userId: user.id,
  userName: user.email,
  action: "User logged in",
  detail: null,
});
    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
      },
      mustChangePassword: user.must_change_password,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

// --------------------------------------------------
// POST /api/auth/forgot-password
// body: { email }
// --------------------------------------------------
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Toujours le même message (ne pas révéler si l'email existe)
    const genericMessage =
      "If an account exists with this email, a reset link has been generated.";

    const result = await pool.query(
      "SELECT id, email, status FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    // Pas d'utilisateur ou compte désactivé → on ne dit rien de plus
    if (!user || user.status === "Disabled") {
      return res.json({ message: genericMessage });
    }

    // Token aléatoire sécurisé
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    // En dev : pas d'email → on renvoie le lien pour tester
    // En production : on enverrait un vrai email et on NE renverrait PAS le token
    const resetLink = `http://localhost:5173/reset-password?token=${token}`;

    console.log("Password reset link:", resetLink);

    res.json({
      message: genericMessage,
      // visible seulement en développement pour tes tests
      resetLink,
    });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// --------------------------------------------------
// POST /api/auth/reset-password
// body: { token, newPassword }
// --------------------------------------------------
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const result = await pool.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token = $1`,
      [token]
    );

    const row = result.rows[0];

    if (!row) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    if (row.used_at) {
      return res.status(400).json({ error: "This reset link has already been used" });
    }

    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: "This reset link has expired" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users
       SET password_hash = $1, must_change_password = false
       WHERE id = $2`,
      [passwordHash, row.user_id]
    );

    await pool.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
      [row.id]
    );

    res.json({ message: "Password has been reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});
export default router;
// POST /api/auth/change-password
// Nécessite d'être connecté (token JWT)
router.post("/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // 1. Vérifier que le token est présent
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 2. Décoder le token pour récupérer l'userId
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    // 3. Règles de robustesse du nouveau mot de passe
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    // 4. Récupérer l'utilisateur
    const result = await pool.query(
      "SELECT id, password_hash FROM users WHERE id = $1",
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 5. Vérifier l'ancien mot de passe
    const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // 6. Hasher le nouveau mot de passe
    const newHash = await bcrypt.hash(newPassword, 10);

    // 7. Mettre à jour + désactiver must_change_password
    await pool.query(
      "UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2",
      [newHash, userId]
    );

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err.message);
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    res.status(500).json({ error: "Something went wrong" });
  }
});