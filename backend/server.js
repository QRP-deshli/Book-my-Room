import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());
console.log("🌐 CORS enabled for all origins");

// PostgreSQL connection
const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
});

// Test connection
pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ Database connection failed:", err));

/**
 * GET /api/rooms
 * Returns all rooms with their current status ("free" or "occupied")
 * Query params:
 *   date=YYYY-MM-DD
 *   time=HH:MM
 */
app.get("/api/rooms", async (req, res) => {
  try {
    const { date, time } = req.query;
    const selectedDate = date || new Date().toISOString().slice(0, 10);
    const selectedTime = time || "00:00";

    // Check if any reservation overlaps with the requested time
    const query = `
      SELECT 
        m.miestnost_id,
        m.cislo_miestnosti,
        m.kapacita,
        m.poschodie,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM public.rezervacia r
            WHERE r.miestnost_id = m.miestnost_id
              AND r.datum_rezervacie = $1
              AND $2::TIME >= r.zaciatok_rezervacie
              AND $2::TIME < (r.zaciatok_rezervacie + r.dlzka_rezervacie)
          )
          THEN 'occupied'
          ELSE 'free'
        END AS status
      FROM public.miestnost m
      ORDER BY m.miestnost_id;
    `;

    const result = await pool.query(query, [selectedDate, selectedTime]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching rooms:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/book-room
 * Creates a new reservation.
 * Body:
 * {
 *   miestnost_id: number,
 *   uzivatel_id: number,
 *   datum_rezervacie: "YYYY-MM-DD",
 *   zaciatok_rezervacie: "HH:MM",
 *   dlzka_rezervacie: "2 hours"
 * }
 */
app.post("/api/book-room", async (req, res) => {
  try {
    const {
      miestnost_id,
      uzivatel_id,
      datum_rezervacie,
      zaciatok_rezervacie,
      dlzka_rezervacie
    } = req.body;

    if (!miestnost_id || !uzivatel_id || !datum_rezervacie || !zaciatok_rezervacie || !dlzka_rezervacie) {
      return res.status(400).json({ error: "Missing reservation data" });
    }

    // Check if there’s already an overlapping reservation
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

    // Create reservation
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

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));
