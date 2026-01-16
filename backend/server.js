import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import jwt from "jsonwebtoken";
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { promises as fs } from 'fs';

console.log("🔥 server.js loaded (COMPLETE - FIXED MIDNIGHT CROSSING)");

dotenv.config();

const { Pool } = pkg;
const app = express();

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ===============================
// BASIC APP / CORS
// ===============================

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const SERVER_TIMEZONE = "Europe/Bratislava";

const allowedOrigins = [FRONTEND_URL, "http://localhost:3000"].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
console.log("🌐 CORS configured for:", allowedOrigins);

// ===============================
// SESSION (required for OAuth)
// ===============================

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ===============================
// DATABASE
// ===============================

let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  console.log("🛢 Using DATABASE_URL with SSL");
} else {
  pool = new Pool({
    host: process.env.PGHOST || "localhost",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "bookmyroom",
    port: process.env.PGPORT || 5432,
  });
  console.log("🛢 Using local PG config");
}

pool.on('connect', (client) => {
  client.query(`SET timezone = '${SERVER_TIMEZONE}'`);
});

pool
  .connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ Database connection failed:", err));

// ===============================
// GITHUB OAUTH STRATEGY
// ===============================

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${BACKEND_URL}/auth/github/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.[0]?.value || `${profile.username}@github.local`;
        const name = profile.displayName || profile.username;

        const existing = await pool.query(
          `SELECT u.*, r.name AS role_name
           FROM users u
           JOIN roles r ON u.role_id = r.role_id
           WHERE u.email = $1`,
          [email]
        );

        let user;

        if (existing.rows.length === 0) {
          const roleRes = await pool.query(
            "SELECT role_id FROM roles WHERE name = 'viewer'"
          );
          const roleId = roleRes.rows[0].role_id;

          await pool.query(
            "INSERT INTO users (name, email, role_id) VALUES ($1, $2, $3)",
            [name, email, roleId]
          );

          const result = await pool.query(
            `SELECT u.*, r.name AS role_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE u.email = $1`,
            [email]
          );

          user = result.rows[0];
        } else {
          user = existing.rows[0];
        }

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ===============================
// AUTH ROUTES
// ===============================

app.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.user_id, role: req.user.role_name },
      process.env.JWT_SECRET || "jwtsecret",
      { expiresIn: "1h" }
    );

    res.redirect(`${FRONTEND_URL}/?token=${token}`);
  }
);

// ===============================
// JWT Middleware
// ===============================

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || "jwtsecret");
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) return next();

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "jwtsecret");
  } catch {
    // Ignore invalid tokens
  }

  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    next();
  };
}

// ===============================
// GET USER PROFILE
// ===============================

app.get("/api/user/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        u.user_id,
        u.name,
        u.email,
        r.name AS role_name,
        u.building_id,
        b.address,
        b.city
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN buildings b ON u.building_id = b.building_id
       WHERE u.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===============================
// UPDATE USER BUILDING
// ===============================

app.post(
  "/api/user/update-building",
  verifyToken,
  requireRole("employee", "admin"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { building_id } = req.body;

      if (building_id !== null && building_id !== undefined && building_id !== "") {
        const buildingCheck = await pool.query(
          "SELECT building_id FROM buildings WHERE building_id = $1",
          [building_id]
        );

        if (buildingCheck.rows.length === 0) {
          return res.status(400).json({ error: "Invalid building" });
        }
      }

      const result = await pool.query(
        "UPDATE users SET building_id = $1 WHERE user_id = $2 RETURNING *",
        [building_id || null, userId]
      );

      res.json({
        message: "Building updated successfully",
        building_id: result.rows[0].building_id,
      });
    } catch (err) {
      console.error("Error updating building:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// GET ALL BUILDINGS
// ===============================

app.get("/api/buildings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT building_id, address, city FROM buildings ORDER BY city, address"
    );
    res.json({ buildings: result.rows });
  } catch (err) {
    console.error("Error fetching buildings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===============================
// GET ROOMS (for list view)
// ===============================
/**
 * 🔧 FIXED: Now includes reservations that cross midnight from previous day
 */
app.get("/api/rooms", optionalAuth, async (req, res) => {
  try {
    const { localDate, localTime, search, clientTz } = req.query;

    if (!localDate || !localTime) {
      return res.status(400).json({ error: "Missing localDate or localTime" });
    }

    const clientTimezone = clientTz || "Europe/Bratislava";
    const searchText = search ? `%${search.toLowerCase()}%` : "%%";

    // Query: Get all rooms
    const query = `
      SELECT
        r.room_id,
        r.room_number,
        r.capacity,
        r.floor,
        r.building_id,
        b.address,
        b.city
      FROM rooms r
      JOIN buildings b ON r.building_id = b.building_id
      WHERE LOWER(r.room_number) LIKE $1
      OR LOWER(b.address) LIKE $1
      OR LOWER(b.city) LIKE $1
      OR $1 = '%%'
      ORDER BY r.room_id
    `;

    const result = await pool.query(query, [searchText]);

    // 🔧 FIXED: Get reservations for BOTH current day AND previous day
    // This catches reservations that cross midnight
    // IMPORTANT: When viewing on the "next day", we adjust times to 00:00 - XX:XX
    const prevDate = new Date(localDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().slice(0, 10);

    const reservationsQuery = `
      SELECT
        r.room_id,
        r.reservation_id,
        r.start_ts,
        r.end_ts,
        r.user_id,
        u.name AS user_name,
        (r.start_ts AT TIME ZONE $3)::DATE AS local_date,
        -- If reservation started yesterday but we're viewing today, show it as starting at 00:00
        CASE 
          WHEN DATE(r.start_ts AT TIME ZONE $3) < $1::DATE 
          THEN '00:00'::TIME
          ELSE (r.start_ts AT TIME ZONE $3)::TIME
        END AS local_start_time,
        -- If reservation ends tomorrow but we're viewing today, show it as ending at 23:59
        CASE 
          WHEN DATE(r.end_ts AT TIME ZONE $3) > $1::DATE 
          THEN '23:59'::TIME
          ELSE (r.end_ts AT TIME ZONE $3)::TIME
        END AS local_end_time
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.room_id = ANY(SELECT room_id FROM rooms)
      AND (
        -- Reservations that start on the selected date
        DATE(r.start_ts AT TIME ZONE $3) = $1::DATE
        OR
        -- Reservations that start on previous day but end on selected date
        -- (these are the midnight-crossing ones!)
        (
          DATE(r.start_ts AT TIME ZONE $3) = $2::DATE
          AND DATE(r.end_ts AT TIME ZONE $3) = $1::DATE
        )
        OR
        -- Reservations that start on selected date but end on next day
        (
          DATE(r.start_ts AT TIME ZONE $3) = $1::DATE
          AND DATE(r.end_ts AT TIME ZONE $3) > $1::DATE
        )
      )
      ORDER BY r.start_ts
    `;

    const resResult = await pool.query(reservationsQuery, [
      localDate,
      prevDateStr,
      clientTimezone,
    ]);

    // Attach reservations to rooms
    const rooms = result.rows.map((room) => ({
      ...room,
      reservations: resResult.rows.filter((r) => r.room_id === room.room_id),
    }));

    res.json({ rooms });
  } catch (err) {
    console.error("Error fetching rooms:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===============================
// BOOK ROOM (Create Reservation)
// ===============================

app.post(
  "/api/book-room",
  verifyToken,
  requireRole("employee", "admin"),
  async (req, res) => {
    try {
      const { room_id, localDate, localTime, duration, clientTz } = req.body;
      const userId = req.user.id;

      if (!room_id || !localDate || !localTime || !duration) {
        return res.status(400).json({ error: "Missing reservation data" });
      }

      const clientTimezone = clientTz || "Europe/Bratislava";

      const durationMap = {
        "15 minutes": 15,
        "30 minutes": 30,
        "1 hour": 60,
        "1.5 hours": 90,
        "2 hours": 120,
        "24 hours": 1440,
      };

      const durationMinutes = durationMap[duration] || 60;
      const durationInterval = `${durationMinutes} minutes`;

      const localDateTime = `${localDate} ${localTime}`;

      // Check for overlaps
      const overlapCheck = await pool.query(
        `SELECT COUNT(*) as cnt
         FROM reservations
         WHERE room_id = $1
         AND start_ts AT TIME ZONE $4 < ($2::timestamp AT TIME ZONE $4 + $3::INTERVAL)
         AND end_ts AT TIME ZONE $4 > ($2::timestamp AT TIME ZONE $4)`,
        [
          room_id,
          localDateTime,
          durationInterval,
          clientTimezone,
        ]
      );

      if (parseInt(overlapCheck.rows[0].cnt, 10) > 0) {
        return res.status(409).json({
          error: "Room is already reserved at that time",
        });
      }

      // Insert reservation
      const insertQuery = `
        INSERT INTO reservations (
          room_id,
          user_id,
          start_ts,
          end_ts,
          created_at
        )
        VALUES (
          $1,
          $2,
          ($3::timestamp AT TIME ZONE $5)::TIMESTAMPTZ,
          (($3::timestamp AT TIME ZONE $5)::TIMESTAMPTZ + $4::INTERVAL),
          now()
        )
        RETURNING reservation_id, start_ts, end_ts
      `;

      const result = await pool.query(insertQuery, [
        room_id,
        userId,
        localDateTime,
        durationInterval,
        clientTimezone,
      ]);

      const reservation = result.rows[0];

      res.status(201).json({
        message: `Reservation created for ${localDate} at ${localTime}`,
        reservation_id: reservation.reservation_id,
        start_ts: reservation.start_ts,
        end_ts: reservation.end_ts,
      });
    } catch (err) {
      console.error("Error creating reservation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// GET ROOM SCHEDULE (for calendar view)
// ===============================
/**
 * 🔧 FIXED: Now includes reservations from previous day that cross midnight
 */
app.get("/api/schedule", optionalAuth, async (req, res) => {
  try {
    const { room_id, localDate, clientTz } = req.query;

    if (!room_id || !localDate) {
      return res.status(400).json({ error: "Missing room_id or localDate" });
    }

    const clientTimezone = clientTz || "Europe/Bratislava";

    // Calculate previous day
    const prevDate = new Date(localDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().slice(0, 10);

    // 🔧 FIXED: Query includes reservations from previous day that extend into current day
    const query = `
      SELECT
        r.reservation_id,
        r.room_id,
        r.user_id,
        u.name AS user_name,
        r.start_ts,
        r.end_ts,
        (r.start_ts AT TIME ZONE $3)::DATE AS local_date,
        -- If reservation started yesterday but we're viewing today, show it as starting at 00:00
        CASE 
          WHEN DATE(r.start_ts AT TIME ZONE $3) < $2::DATE 
          THEN '00:00'::TIME
          ELSE (r.start_ts AT TIME ZONE $3)::TIME
        END AS local_start_time,
        -- If reservation ends tomorrow but we're viewing today, show it as ending at 23:59
        CASE 
          WHEN DATE(r.end_ts AT TIME ZONE $3) > $2::DATE 
          THEN '23:59'::TIME
          ELSE (r.end_ts AT TIME ZONE $3)::TIME
        END AS local_end_time,
        EXTRACT(EPOCH FROM (r.end_ts - r.start_ts))::INTEGER / 60 AS duration_minutes
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.room_id = $1
      AND (
        -- Reservations that start on the selected date
        DATE(r.start_ts AT TIME ZONE $3) = $2::DATE
        OR
        -- Reservations that start on previous day but end on selected date
        (
          DATE(r.start_ts AT TIME ZONE $3) = $4::DATE
          AND DATE(r.end_ts AT TIME ZONE $3) = $2::DATE
        )
        OR
        -- Reservations that start on selected date but end on next day
        (
          DATE(r.start_ts AT TIME ZONE $3) = $2::DATE
          AND DATE(r.end_ts AT TIME ZONE $3) > $2::DATE
        )
      )
      ORDER BY r.start_ts
    `;

    const result = await pool.query(query, [
      room_id,
      localDate,
      clientTimezone,
      prevDateStr,
    ]);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching schedule:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===============================
// GET RESERVATION BY ID
// ===============================

app.get("/api/reservation/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const clientTz = req.query.clientTz || "Europe/Bratislava";

    const result = await pool.query(
      `SELECT
        r.reservation_id,
        rm.room_number,
        r.start_ts,
        r.end_ts,
        (r.start_ts AT TIME ZONE $2)::DATE AS local_date,
        (r.start_ts AT TIME ZONE $2)::TIME AS local_start_time,
        (r.end_ts AT TIME ZONE $2)::TIME AS local_end_time,
        EXTRACT(EPOCH FROM (r.end_ts - r.start_ts))::INTEGER / 60 AS duration_minutes
       FROM reservations r
       JOIN rooms rm ON r.room_id = rm.room_id
       WHERE r.reservation_id = $1`,
      [id, clientTz]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching reservation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===============================
// CANCEL RESERVATION
// ===============================

app.delete(
  "/api/cancel-reservation/:id",
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const check = await pool.query(
        `SELECT user_id FROM reservations WHERE reservation_id = $1`,
        [id]
      );

      if (check.rows.length === 0) {
        return res.status(404).json({ error: "Reservation not found" });
      }

      if (check.rows[0].user_id !== userId && req.user.role !== "admin") {
        return res.status(403).json({
          error: "You can only cancel your own reservations",
        });
      }

      const result = await pool.query(
        `DELETE FROM reservations WHERE reservation_id = $1 RETURNING reservation_id`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Reservation not found" });
      }

      res.json({ message: "Reservation cancelled successfully" });
    } catch (err) {
      console.error("Error cancelling reservation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// ADMIN: GET ALL USERS
// ===============================

app.get(
  "/api/admin/users",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT 
          u.user_id, 
          u.name, 
          u.email, 
          r.name as role_name,
          u.building_id,
          b.address,
          b.city
         FROM users u 
         JOIN roles r ON u.role_id = r.role_id 
         LEFT JOIN buildings b ON u.building_id = b.building_id
         ORDER BY u.user_id`
      );
      res.json({ users: result.rows });
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// ADMIN: ADD USER
// ===============================

app.post(
  "/api/admin/add-user",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { name, email, role, building_id } = req.body;

      const roleRes = await pool.query(
        "SELECT role_id FROM roles WHERE name = $1",
        [role]
      );

      if (roleRes.rows.length === 0) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const insert = await pool.query(
        "INSERT INTO users (name, email, role_id, building_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, email, roleRes.rows[0].role_id, building_id || null]
      );

      res.status(201).json(insert.rows[0]);
    } catch (err) {
      console.error("Error adding user:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// ADMIN: DELETE USER
// ===============================

app.delete(
  "/api/admin/delete-user/:id",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        "DELETE FROM users WHERE user_id = $1 RETURNING *",
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      console.error("Error deleting user:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// ADMIN: MODIFY USER ROLE
// ===============================

app.post(
  "/api/admin/change-role",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { user_id, role } = req.body;
      const roleRes = await pool.query(
        "SELECT role_id FROM roles WHERE name = $1",
        [role]
      );
      if (roleRes.rows.length === 0) {
        return res.status(400).json({ error: "Invalid role" });
      }
      await pool.query(
        "UPDATE users SET role_id = $1 WHERE user_id = $2",
        [roleRes.rows[0].role_id, user_id]
      );
      res.json({ message: "Role updated successfully" });
    } catch (err) {
      console.error("Error updating role:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// ADMIN: ADD ROOM
// ===============================

app.post(
  "/api/admin/add-room",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { room_number, capacity, floor, building_id } = req.body;

      const insert = await pool.query(
        `INSERT INTO rooms (room_number, capacity, floor, building_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [room_number, capacity, floor, building_id]
      );

      res.status(201).json(insert.rows[0]);
    } catch (err) {
      console.error("Error adding room:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// UPDATE USER NAME (for employees/admins)
// ===============================

app.post(
  "/api/user/update-name",
  verifyToken,
  requireRole("employee", "admin"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Invalid name" });
      }

      // Trim and limit name length
      const sanitizedName = name.trim().substring(0, 100);

      // ✅ SQL Injection Protection: Using parameterized query
      const result = await pool.query(
        "UPDATE users SET name = $1 WHERE user_id = $2 RETURNING name",
        [sanitizedName, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        message: "Name updated successfully",
        name: result.rows[0].name,
      });
    } catch (err) {
      console.error("Error updating name:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// ADMIN: UPDATE USER DETAILS (name and building)
// ===============================

app.post(
  "/api/admin/update-user-details",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { user_id, name, building_id } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Validate name if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ error: "Invalid name" });
        }
      }

      // Validate building_id if provided
      if (building_id !== null && building_id !== undefined && building_id !== "") {
        const buildingCheck = await pool.query(
          "SELECT building_id FROM buildings WHERE building_id = $1",
          [building_id]
        );

        if (buildingCheck.rows.length === 0) {
          return res.status(400).json({ error: "Invalid building" });
        }
      }

      // Build update query dynamically based on what's being updated
      const updates = [];
      const values = [];
      let paramCounter = 1;

      if (name !== undefined) {
        const sanitizedName = name.trim().substring(0, 100);
        updates.push(`name = $${paramCounter}`);
        values.push(sanitizedName);
        paramCounter++;
      }

      if (building_id !== undefined) {
        updates.push(`building_id = $${paramCounter}`);
        values.push(building_id || null);
        paramCounter++;
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }

      // Add user_id as final parameter
      values.push(user_id);

      // ✅ SQL Injection Protection: Using parameterized query
      const query = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramCounter} RETURNING *`;
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        message: "User details updated successfully",
        user: result.rows[0],
      });
    } catch (err) {
      console.error("Error updating user details:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// ADMIN: DELETE ROOM
// ===============================

app.delete(
  "/api/admin/delete-room/:id",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // First, delete all reservations for this room
      const reservationsDeleted = await pool.query(
        "DELETE FROM reservations WHERE room_id = $1",
        [id]
      );
      
      // Then delete the room
      const result = await pool.query(
        "DELETE FROM rooms WHERE room_id = $1 RETURNING *",
        [id]
      );
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Room not found" });
      }
      
      res.json({ 
        message: "Room deleted successfully",
        reservations_deleted: reservationsDeleted.rowCount
      });
    } catch (err) {
      console.error("Error deleting room:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// CSV IMPORT USERS
// ===============================

app.post(
  "/api/admin/import-users-csv",
  verifyToken,
  requireRole("admin"),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileContent = await fs.readFile(req.file.path, 'utf-8');
      
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      let usersAdded = 0;
      let usersSkipped = 0;
      const errors = [];

      for (const record of records) {
        if (record.name && record.email && record.role) {
          try {
            const existingUser = await pool.query(
              "SELECT user_id FROM users WHERE email = $1",
              [record.email]
            );

            if (existingUser.rows.length > 0) {
              usersSkipped++;
              continue;
            }

            const roleRes = await pool.query(
              "SELECT role_id FROM roles WHERE name = $1",
              [record.role.toLowerCase()]
            );
            
            if (roleRes.rows.length > 0) {
              const buildingId = record.building_id ? parseInt(record.building_id) : null;
              
              await pool.query(
                "INSERT INTO users (name, email, role_id, building_id) VALUES ($1, $2, $3, $4)",
                [record.name, record.email, roleRes.rows[0].role_id, buildingId]
              );
              usersAdded++;
            } else {
              errors.push(`Invalid role '${record.role}' for user ${record.email}`);
            }
          } catch (err) {
            errors.push(`Error importing user ${record.email}: ${err.message}`);
          }
        } else {
          errors.push(`Skipped invalid record: missing required fields`);
        }
      }

      await fs.unlink(req.file.path);

      res.json({ 
        message: 'Users CSV import completed',
        summary: {
          usersAdded,
          usersSkipped,
          totalRecords: records.length,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (err) {
      console.error('Error importing users CSV:', err);
      res.status(500).json({ error: 'Failed to import users CSV: ' + err.message });
    }
  }
);

// ===============================
// CSV IMPORT ROOMS
// ===============================

app.post(
  "/api/admin/import-rooms-csv",
  verifyToken,
  requireRole("admin"),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileContent = await fs.readFile(req.file.path, 'utf-8');
      
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      let roomsAdded = 0;
      let roomsSkipped = 0;
      const errors = [];

      for (const record of records) {
        if (record.room_number && record.capacity && record.floor && record.building_id) {
          try {
            const existingRoom = await pool.query(
              "SELECT room_id FROM rooms WHERE room_number = $1 AND building_id = $2",
              [record.room_number, parseInt(record.building_id)]
            );

            if (existingRoom.rows.length > 0) {
              roomsSkipped++;
              continue;
            }

            await pool.query(
              "INSERT INTO rooms (room_number, capacity, floor, building_id) VALUES ($1, $2, $3, $4)",
              [
                record.room_number, 
                parseInt(record.capacity), 
                parseInt(record.floor), 
                parseInt(record.building_id)
              ]
            );
            roomsAdded++;
          } catch (err) {
            errors.push(`Error importing room ${record.room_number}: ${err.message}`);
          }
        } else {
          errors.push(`Skipped invalid record: missing required fields`);
        }
      }

      await fs.unlink(req.file.path);

      res.json({ 
        message: 'Rooms CSV import completed',
        summary: {
          roomsAdded,
          roomsSkipped,
          totalRecords: records.length,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (err) {
      console.error('Error importing rooms CSV:', err);
      res.status(500).json({ error: 'Failed to import rooms CSV: ' + err.message });
    }
  }
);

// ===============================
// CSV EXPORT USERS
// ===============================

app.get(
  "/api/admin/export-users-csv",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const usersRes = await pool.query(`
        SELECT u.user_id, u.name, u.email, r.name as role, u.building_id
        FROM users u 
        JOIN roles r ON u.role_id = r.role_id 
        ORDER BY u.user_id
      `);

      const csvContent = stringify(usersRes.rows, { 
        header: true,
        columns: ['user_id', 'name', 'email', 'role', 'building_id']
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (err) {
      console.error('Error exporting users CSV:', err);
      res.status(500).json({ error: 'Failed to export users CSV: ' + err.message });
    }
  }
);

// ===============================
// CSV EXPORT ROOMS
// ===============================

app.get(
  "/api/admin/export-rooms-csv",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const roomsRes = await pool.query(`
        SELECT room_id, room_number, capacity, floor, building_id 
        FROM rooms 
        ORDER BY room_id
      `);

      const csvContent = stringify(roomsRes.rows, { 
        header: true,
        columns: ['room_id', 'room_number', 'capacity', 'floor', 'building_id']
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="rooms_export_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (err) {
      console.error('Error exporting rooms CSV:', err);
      res.status(500).json({ error: 'Failed to export rooms CSV: ' + err.message });
    }
  }
);

// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (Timezone: ${SERVER_TIMEZONE})`);
  console.log(`   BACKEND_URL: ${BACKEND_URL}`);
  console.log(`   FRONTEND_URL: ${FRONTEND_URL}`);
});