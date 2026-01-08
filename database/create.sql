BEGIN;

-- ===============================
--  BUILDINGS TABLE
-- ===============================
CREATE TABLE public.buildings (
  building_id SERIAL PRIMARY KEY,
  address     VARCHAR(50) NOT NULL,
  city        VARCHAR(50) NOT NULL
);

-- ===============================
--  ROOMS TABLE
-- ===============================
CREATE TABLE public.rooms (
  room_id        SERIAL PRIMARY KEY,
  room_number    VARCHAR(20) NOT NULL,
  capacity       INTEGER     NOT NULL CHECK (capacity >= 0),
  floor          INTEGER     NOT NULL,
  building_id    INTEGER     NOT NULL REFERENCES public.buildings(building_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  -- Room number must be unique per building (same room number can exist in different buildings)
  CONSTRAINT rooms_number_building_unique UNIQUE (room_number, building_id)
);

-- ===============================
--  ROLES TABLE
-- ===============================
CREATE TABLE public.roles (
  role_id SERIAL PRIMARY KEY,
  name    VARCHAR(20) UNIQUE NOT NULL
);

INSERT INTO public.roles (name)
VALUES ('viewer'), ('employee'), ('admin');

-- ===============================
--  USERS TABLE (WITH BUILDING_ID)
-- ===============================
CREATE TABLE public.users (
  user_id     SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(100) UNIQUE NOT NULL,
  role_id     INTEGER REFERENCES public.roles(role_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  building_id INTEGER REFERENCES public.buildings(building_id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ===============================
--  RESERVATIONS TABLE
-- ===============================
CREATE TABLE public.reservations (
  reservation_id    SERIAL PRIMARY KEY,
  room_id           INTEGER NOT NULL REFERENCES public.rooms(room_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  created_date      DATE     NOT NULL DEFAULT CURRENT_DATE,
  reservation_date  DATE     NOT NULL,
  start_time        TIME     NOT NULL DEFAULT '00:00',
  duration          INTERVAL NOT NULL CHECK (duration > INTERVAL '0 minutes'),
  user_id           INTEGER NOT NULL REFERENCES public.users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

COMMIT;