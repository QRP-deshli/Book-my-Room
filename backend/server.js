import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import jwt from "jsonwebtoken";
console.log("🔥 server.js sa načítal");

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());
console.log("🌐 CORS enabled for all origins");

// Session middleware (required for OAuth)
app.use(session({
  secret: process.env.SESSION_SECRET || "secret123",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// PostgreSQL connection
const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
});

pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ Database connection failed:", err));

// ===============================
// GITHUB OAUTH STRATEGY
// ===============================
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: "http://localhost:5000/auth/github/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value || `${profile.username}@github.local`;
    const name = profile.displayName || profile.username;

    // check if user exists
    const existing = await pool.query(
      `SELECT u.*, r.nazov AS nazov_rola
       FROM uzivatel u
       JOIN rola r ON u.rola_id = r.rola_id
       WHERE u.email = $1`, [email]
    );

    let user;
    if (existing.rows.length === 0) {
      const roleRes = await pool.query("SELECT rola_id FROM rola WHERE nazov = 'viewer'");
      const roleId = roleRes.rows[0].rola_id;

      await pool.query(
        "INSERT INTO uzivatel (meno, email, rola_id) VALUES ($1, $2, $3)",
        [name, email, roleId]
      );

      const result = await pool.query(
        `SELECT u.*, r.nazov AS nazov_rola
         FROM uzivatel u
         JOIN rola r ON u.rola_id = r.rola_id
         WHERE u.email = $1`, [email]
      );
      user = result.rows[0];
    } else {
      user = existing.rows[0];
    }

    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ===============================
// AUTH ROUTES
// ===============================
app.get("/auth/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

app.get("/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.uzivatel_id, role: req.user.nazov_rola },
      process.env.JWT_SECRET || "jwtsecret",
      { expiresIn: "1h" }
    );
    res.redirect(`http://localhost:3000?token=${token}`);
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

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
}

// ===============================
// API ROUTES
// ===============================
app.get("/api/rooms", async (req, res) => {
  try {
    const { date, time, search } = req.query;
    const selectedDate = date || new Date().toISOString().slice(0, 10);
    const selectedTime = time || "00:00";
    const searchText = search ? `%${search.toLowerCase()}%` : "%%";

    const roomsQuery = `
  SELECT 
    m.miestnost_id,
    m.cislo_miestnosti,
    m.kapacita,
    m.poschodie,
    b.adresa,
    b.mesto,
    r.rezervacia_id AS active_rezervacia_id,
    CASE 
      WHEN r.rezervacia_id IS NOT NULL THEN 'occupied'
      ELSE 'free'
    END AS status
  FROM public.miestnost m
  JOIN public.budova b ON m.budova_id = b.budova_id
  LEFT JOIN public.rezervacia r
    ON r.miestnost_id = m.miestnost_id
    AND r.datum_rezervacie = $1
    AND $2::TIME >= r.zaciatok_rezervacie
    AND $2::TIME < (r.zaciatok_rezervacie + r.dlzka_rezervacie)
  WHERE LOWER(m.cislo_miestnosti) LIKE $3
     OR LOWER(b.adresa) LIKE $3
     OR LOWER(b.mesto) LIKE $3
     OR $3 = '%%'
  ORDER BY m.miestnost_id;
`;



    const result = await pool.query(roomsQuery, [selectedDate, selectedTime, searchText]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching rooms:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/book-room", verifyToken, requireRole("employer", "admin"), async (req, res) => {
  try {
    const {
      miestnost_id,
      datum_rezervacie,
      zaciatok_rezervacie,
      dlzka_rezervacie
    } = req.body;

    const uzivatel_id = req.user.id;
    if (!miestnost_id || !datum_rezervacie || !zaciatok_rezervacie || !dlzka_rezervacie) {
      return res.status(400).json({ error: "Missing reservation data" });
    }

    const overlapCheck = await pool.query(
      `
      SELECT COUNT(*) AS cnt
      FROM public.rezervacia
      WHERE miestnost_id = $1
        AND datum_rezervacie = $2
        AND (
          ($3::TIME >= zaciatok_rezervacie AND $3::TIME < (zaciatok_rezervacie + dlzka_rezervacie))
          OR (zaciatok_rezervacie >= $3::TIME AND zaciatok_rezervacie < ($3::TIME + $4::INTERVAL))
        )
      `,
      [miestnost_id, datum_rezervacie, zaciatok_rezervacie, dlzka_rezervacie]
    );

    if (parseInt(overlapCheck.rows[0].cnt) > 0) {
      return res.status(409).json({ error: "Room is already reserved at that time" });
    }

    const insert = await pool.query(
      `
      INSERT INTO public.rezervacia (
        miestnost_id, datum_vytvorenia, datum_rezervacie,
        zaciatok_rezervacie, dlzka_rezervacie, uzivatel_id
      )
      VALUES ($1, CURRENT_DATE, $2, $3::TIME, $4::INTERVAL, $5)
      RETURNING rezervacia_id
      `,
      [miestnost_id, datum_rezervacie, zaciatok_rezervacie, dlzka_rezervacie, uzivatel_id]
    );

    res.status(201).json({
      message: `Reservation created for ${datum_rezervacie} at ${zaciatok_rezervacie}`,
      rezervacia_id: insert.rows[0].rezervacia_id
    });
  } catch (err) {
    console.error("Error creating reservation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
// GET reservation by ID
app.get("/api/reservation/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT r.rezervacia_id, m.cislo_miestnosti, r.datum_rezervacie, r.zaciatok_rezervacie
       FROM public.rezervacia r
       JOIN public.miestnost m ON r.miestnost_id = m.miestnost_id
       WHERE r.rezervacia_id = $1`,
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

app.delete("/api/cancel-reservation/:id", verifyToken, requireRole("employer", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM public.rezervacia WHERE rezervacia_id = $1 RETURNING rezervacia_id`,
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
});

app.post("/api/admin/add-user", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { meno, email, rola } = req.body;
    const roleRes = await pool.query("SELECT rola_id FROM rola WHERE nazov = $1", [rola]);
    if (roleRes.rows.length === 0) return res.status(400).json({ error: "Invalid role" });

    const insert = await pool.query(
      "INSERT INTO uzivatel (meno, email, rola_id) VALUES ($1, $2, $3) RETURNING *",
      [meno, email, roleRes.rows[0].rola_id]
    );

    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error("Error adding user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/add-room", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { cislo_miestnosti, kapacita, poschodie, budova_id } = req.body;
    const insert = await pool.query(
      `
      INSERT INTO public.miestnost (cislo_miestnosti, kapacita, poschodie, budova_id)
      VALUES ($1, $2, $3, $4) RETURNING *
      `,
      [cislo_miestnosti, kapacita, poschodie, budova_id]
    );
    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error("Error adding room:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===============================
// START SERVER
// ===============================
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));
