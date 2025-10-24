import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

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

/**
 * GET /api/rooms
 * Returns all rooms with their status (free / occupied)
 */
app.get("/api/rooms", async (req, res) => {
  try {
    const { date } = req.query;
    const selectedDate = date || new Date().toISOString().slice(0, 10); // default = today

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
          )
          THEN 'occupied'
          ELSE 'free'
        END AS status
      FROM public.miestnost m
      ORDER BY m.miestnost_id;
    `;
    const result = await pool.query(query, [selectedDate]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching rooms:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/book-room
 * Body: { miestnost_id, uzivatel_id, datum_rezervacie, dlzka_rezervacie }
 */
app.post("/api/book-room", async (req, res) => {
  try {
    const { miestnost_id, uzivatel_id, datum_rezervacie, dlzka_rezervacie } = req.body;

    if (!miestnost_id || !uzivatel_id || !datum_rezervacie || !dlzka_rezervacie) {
      return res.status(400).json({ error: "Missing reservation data" });
    }

    // Check if the room is already reserved for that day
    const check = await pool.query(
      `SELECT COUNT(*) AS cnt 
       FROM public.rezervacia 
       WHERE miestnost_id = $1 AND datum_rezervacie = $2`,
      [miestnost_id, datum_rezervacie]
    );
    if (parseInt(check.rows[0].cnt) > 0) {
      return res.status(409).json({ error: "Room already reserved for that date" });
    }

    // Create reservation
    const insert = await pool.query(
      `INSERT INTO public.rezervacia 
        (miestnost_id, datum_vytvorenia, datum_rezervacie, dlzka_rezervacie, uzivatel_id)
       VALUES ($1, CURRENT_DATE, $2, $3::INTERVAL, $4)
       RETURNING rezervacia_id`,
      [miestnost_id, datum_rezervacie, dlzka_rezervacie, uzivatel_id]
    );

    res.status(201).json({ message: "Reservation created", rezervacia_id: insert.rows[0].rezervacia_id });
  } catch (err) {
    console.error("Error creating reservation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
