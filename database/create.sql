BEGIN;

-- ===============================
-- BUILDINGS TABLE
-- ===============================
CREATE TABLE public.buildings (
  building_id SERIAL PRIMARY KEY,
  address VARCHAR(100) NOT NULL,
  city VARCHAR(50) NOT NULL
);

-- ===============================
-- ROOMS TABLE
-- ===============================
CREATE TABLE public.rooms (
  room_id SERIAL PRIMARY KEY,
  room_number VARCHAR(20) NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  floor INTEGER NOT NULL,
  building_id INTEGER NOT NULL REFERENCES public.buildings(building_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT rooms_number_building_unique UNIQUE (room_number, building_id)
);

-- ===============================
-- ROLES TABLE
-- ===============================
CREATE TABLE public.roles (
  role_id SERIAL PRIMARY KEY,
  name VARCHAR(20) UNIQUE NOT NULL
);

INSERT INTO public.roles (name)
VALUES ('viewer'), ('employee'), ('admin');

-- ===============================
-- USERS TABLE
-- ===============================
CREATE TABLE public.users (
  user_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role_id INTEGER REFERENCES public.roles(role_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  building_id INTEGER REFERENCES public.buildings(building_id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ===============================
-- RESERVATIONS TABLE (REFACTORED)
-- ===============================
-- KEY CHANGE: Using TIMESTAMPTZ instead of DATE + TIME + INTERVAL
-- This automatically handles timezone conversions and midnight boundaries
CREATE TABLE public.reservations (
  reservation_id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES public.rooms(room_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES public.users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  
  -- Main change: Store as timezone-aware timestamps
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure end is after start
  CHECK (end_ts > start_ts)
);

-- Index for faster overlap detection
CREATE INDEX idx_reservations_room_date ON reservations(room_id, start_ts, end_ts);

COMMIT; -- can you generate inserts for this except reservation tab