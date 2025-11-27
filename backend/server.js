import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import jwt from "jsonwebtoken";
import { exec } from "child_process";

console.log("🔥 server.js loaded");

dotenv.config();
const { Pool } = pkg;

const app = express();

// ===============================
// BASIC APP / CORS
// ===============================
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

// povolené originy (produkcia + lokál)
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
    // cookie nastavíme jednoducho – pre Render to stačí
    cookie: {
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ===============================
// DATABASE (Render + lokál)
// ===============================
let pool;

if (process.env.DATABASE_URL) {
  // Render / iný hosting – typicky dá DATABASE_URL
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Render vyžaduje SSL
  });
  console.log("🛢 Using DATABASE_URL with SSL");
} else {
  // Lokálny vývoj cez PGHOST, PGUSER, ...
  pool = new Pool({
    host: process.env.PGHOST || "localhost",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "bookmyroom",
    port: process.env.PGPORT || 5432,
  });
  console.log("🛢 Using local PG config");
}

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
      callbackURL: `${BACKEND_URL}/auth/github/callback`, // produkcia + lokál podľa ENV
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.[0]?.value || `${profile.username}@github.local`;
        const name = profile.displayName || profile.username;

        // Check if user exists
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

    // redirect na frontend (produkcia alebo lokál podľa ENV)
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

// Optional auth middleware — allows guests and logged users
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
// GET ROOMS + ALL DAILY RESERVATIONS
// ===============================
app.get("/api/rooms", optionalAuth, async (req, res) => {
  try {
    const { date, time, search } = req.query;
    const selectedDate = date || new Date().toISOString().slice(0, 10);
    const selectedTime = time || "00:00";
    const searchText = search ? `%${search.toLowerCase()}%` : "%%";

    // Hlavný query — najbližšia / aktívna rezervácia
    const roomsQuery = `
      SELECT 
        r.room_id,
        r.room_number,
        r.capacity,
        r.floor,
        b.address,
        b.city,
        res.reservation_id AS active_reservation_id,
        res.start_time AS next_reservation_start,
        res.duration AS next_reservation_duration,
        CASE 
          WHEN res.reservation_id IS NOT NULL THEN 'occupied'
          ELSE 'free'
        END AS status
      FROM rooms r
      JOIN buildings b ON r.building_id = b.building_id
      LEFT JOIN LATERAL (
        SELECT reservation_id, start_time, duration
        FROM reservations
        WHERE room_id = r.room_id
          AND reservation_date = $1
          AND (
            ($2::TIME >= start_time AND $2::TIME < (start_time + duration))
            OR start_time >= $2::TIME
          )
        ORDER BY start_time
        LIMIT 1
      ) res ON true
      WHERE LOWER(r.room_number) LIKE $3
         OR LOWER(b.address) LIKE $3
         OR LOWER(b.city) LIKE $3
         OR $3 = '%%'
      ORDER BY r.room_id;
    `;

    const result = await pool.query(roomsQuery, [
      selectedDate,
      selectedTime,
      searchText,
    ]);

    const rooms = result.rows;

    // Load all reservations for this date for each room
    const reservationsQuery = `
  SELECT 
    reservation_id,
    room_id,
    start_time,
    (start_time + duration) AS end_time,
    duration,
    user_id
  FROM reservations
  WHERE reservation_date = $1
  ORDER BY start_time;
`;

    const allRes = await pool.query(reservationsQuery, [selectedDate]);

    // Attach reservations to each room
    rooms.forEach(room => {
      room.reservations = allRes.rows.filter(r => r.room_id === room.room_id);
    });


    // ======================================
    // ✨ PRIDANÉ: všetky rezervácie daného dňa
    // ======================================
    const all = await pool.query(
      `
      SELECT 
        r.room_id,
        r.reservation_id,
        r.start_time,
        (r.start_time + r.duration) AS end_time,
        r.duration,
        u.name AS user_name
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.reservation_date = $1
      ORDER BY r.start_time
      `,
      [selectedDate]
    );

    const dailyReservations = all.rows;

    // pripojíme ku každému room len jeho rezervácie
    const roomsWithReservations = rooms.map((room) => ({
      ...room,
      all_reservations: dailyReservations.filter(
        (r) => r.room_id === room.room_id
      ),
    }));

    // ==============================
    // next free slot (pôvodný kód)
    // ==============================
    let nextFreeSlot = null;
    if (search && rooms.length === 1 && rooms[0].status === "occupied") {
      const roomId = rooms[0].room_id;

      const nextSlotQuery = `
        SELECT (r2.start_time + r2.duration) AS free_after
        FROM reservations r2
        WHERE r2.room_id = $1
          AND r2.reservation_date = $2
          AND r2.start_time >= $3::TIME
          AND NOT EXISTS (
            SELECT 1 FROM reservations r3
            WHERE r3.room_id = r2.room_id
              AND r3.reservation_date = r2.reservation_date
              AND r3.start_time < (r2.start_time + r2.duration)
              AND (r3.start_time + r3.duration) > (r2.start_time + r2.duration)
          )
        ORDER BY r2.start_time
        LIMIT 1;
      `;

      const slotRes = await pool.query(nextSlotQuery, [
        roomId,
        selectedDate,
        selectedTime,
      ]);
      if (slotRes.rows.length > 0) nextFreeSlot = slotRes.rows[0].free_after;
    }

    res.json({
      rooms: roomsWithReservations,
      nextFreeSlot,
    });
  } catch (err) {
    console.error("Error fetching rooms:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// ===============================
// CREATE RESERVATION
// ===============================
app.post(
  "/api/book-room",
  verifyToken,
  requireRole("employer", "admin"),
  async (req, res) => {
    try {
      const { room_id, reservation_date, start_time, duration } = req.body;

      const userId = req.user.id;

      if (!room_id || !reservation_date || !start_time || !duration) {
        return res.status(400).json({ error: "Missing reservation data" });
      }

      // Check overlapping reservations
      const overlapCheck = await pool.query(
        `
        SELECT COUNT(*) AS cnt
        FROM reservations
        WHERE room_id = $1
          AND reservation_date = $2
          AND (
            ($3::TIME >= start_time AND $3::TIME < (start_time + duration))
            OR (start_time >= $3::TIME AND start_time < ($3::TIME + $4::INTERVAL))
          )
        `,
        [room_id, reservation_date, start_time, duration]
      );

      if (parseInt(overlapCheck.rows[0].cnt, 10) > 0) {
        return res
          .status(409)
          .json({ error: "Room is already reserved at that time" });
      }

      const insert = await pool.query(
        `
        INSERT INTO reservations (
          room_id, created_date, reservation_date,
          start_time, duration, user_id
        )
        VALUES ($1, CURRENT_DATE, $2, $3::TIME, $4::INTERVAL, $5)
        RETURNING reservation_id
        `,
        [room_id, reservation_date, start_time, duration, userId]
      );

      res.status(201).json({
        message: `Reservation created for ${reservation_date} at ${start_time}`,
        reservation_id: insert.rows[0].reservation_id,
      });
    } catch (err) {
      console.error("Error creating reservation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// GET RESERVATION BY ID
// ===============================
app.get("/api/reservation/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT r.reservation_id, rm.room_number, r.reservation_date, r.start_time
       FROM reservations r
       JOIN rooms rm ON r.room_id = rm.room_id
       WHERE r.reservation_id = $1`,
      [id]
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
// GET TODAY'S ROOM SCHEDULE
// ===============================
app.get("/api/room-schedule/:roomId", async (req, res) => {
  try {
    const id = parseInt(req.params.roomId, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid room ID" });
    }

    const query = `
      SELECT r.reservation_id, r.reservation_date, r.start_time,
             r.duration, u.name AS user_name
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.room_id = $1
        AND r.reservation_date = CURRENT_DATE
      ORDER BY r.start_time;
    `;

    const result = await pool.query(query, [id]);
    res.json({ reservations: result.rows });
  } catch (err) {
    console.error("Error fetching room day plan:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===============================
// GET ROOM SCHEDULE (s dátumom)
// ===============================
app.get("/api/schedule", async (req, res) => {
  try {
    const { room_id, date } = req.query;

    if (!room_id || !date) {
      return res.status(400).json({ error: "Missing room_id or date" });
    }

    const query = `
      SELECT 
        r.reservation_id, 
        r.reservation_date, 
        r.start_time,
        (r.start_time + r.duration) AS end_time,
        r.duration, 
        u.name AS user_name
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.room_id = $1
        AND r.reservation_date = $2
      ORDER BY r.start_time;
    `;

    const result = await pool.query(query, [room_id, date]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching schedule:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===============================
// CANCEL RESERVATION
// ===============================
app.delete(
  "/api/cancel-reservation/:id",
  verifyToken,
  requireRole("employer", "admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Get reservation owner
      const ownerRes = await pool.query(
        `SELECT user_id FROM reservations WHERE reservation_id = $1`,
        [id]
      );

      if (ownerRes.rows.length === 0) {
        return res.status(404).json({ error: "Reservation not found" });
      }

      const ownerId = ownerRes.rows[0].user_id;

      // Employers can only remove their own reservations
      if (req.user.role === "employer" && ownerId !== req.user.id) {
        return res
          .status(403)
          .json({ error: "You can only cancel your own reservations" });
      }

      const result = await pool.query(
        `DELETE FROM reservations WHERE reservation_id = $1 RETURNING reservation_id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Reservation not found" });
      }

      res.json({ message: "Reservation canceled successfully" });
    } catch (err) {
      console.error("Error canceling reservation:", err);
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
      const { name, email, role } = req.body;

      const roleRes = await pool.query(
        "SELECT role_id FROM roles WHERE name = $1",
        [role]
      );

      if (roleRes.rows.length === 0) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const insert = await pool.query(
        "INSERT INTO users (name, email, role_id) VALUES ($1, $2, $3) RETURNING *",
        [name, email, roleRes.rows[0].role_id]
      );

      res.status(201).json(insert.rows[0]);
    } catch (err) {
      console.error("Error adding user:", err);
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
        `
        INSERT INTO rooms (room_number, capacity, floor, building_id)
        VALUES ($1, $2, $3, $4) RETURNING *
        `,
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
// CSV IMPORT / EXPORT ENDPOINTS
// ===============================

function runScript(script, callback) {
  exec(`python ../script/${script}`, (error, stdout, stderr) => {
    if (error) return callback(stderr || error.message);
    return callback(null, stdout);
  });
}

app.post("/api/admin/import-csv", verifyToken, requireRole("admin"), (req, res) => {
  runScript("import_csv.py", (err, out) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "CSV import completed", log: out });
  });
});

app.post("/api/admin/export-csv", verifyToken, requireRole("admin"), (req, res) => {
  runScript("export_csv.py", (err, out) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "CSV export completed", log: out });
  });
});

// ===============================
// DELETE USER
// ===============================

app.delete(
  "/api/admin/delete-user/:id",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM users WHERE user_id = $1 RETURNING *",
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted successfully" });
  }
);



// ===============================
// DELETE ROOM
// ===============================

app.delete(
  "/api/admin/delete-room/:id",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM rooms WHERE room_id = $1 RETURNING *",
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Room not found" });
    res.json({ message: "Room deleted successfully" });
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
        `SELECT u.user_id, u.name, u.email, r.name as role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.role_id 
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
// START SERVER
// ===============================
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
  console.log(`   BACKEND_URL: ${BACKEND_URL}`);
  console.log(`   FRONTEND_URL: ${FRONTEND_URL}`);
});
