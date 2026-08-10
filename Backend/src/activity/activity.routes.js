import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { pool } from "../db/pool.js";

const router = Router();

// --------------------------------------------------
// Helper : enregistrer une action (à appeler depuis d'autres routes)
// --------------------------------------------------
export async function logActivity({ userId, userName, action, detail = null }) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, user_name, action, detail)
       VALUES ($1, $2, $3, $4)`,
      [
        userId ?? null,
        userName || (userId ? `User #${userId}` : "System"),
        action,
        detail,
      ]
    );
  } catch (err) {
    console.error("Activity log error:", err.message);
  }
}

// --------------------------------------------------
// GET /api/activity — Super Admin + Manager seulement
// --------------------------------------------------
router.get(
  "/",
  requireAuth,
  requireRole("Super Admin", "Manager"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, user_id, user_name, action, detail, created_at
         FROM activity_logs
         ORDER BY created_at DESC
         LIMIT 100`
      );

      res.json({
        count: result.rows.length,
        activities: result.rows,
      });
    } catch (err) {
      console.error("List activity error:", err.message);
      res.status(500).json({ error: "Could not load activity log" });
    }
  }
);

export default router;