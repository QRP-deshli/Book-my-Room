BEGIN;

-- ===============================
--  BUILDING TABLE
-- ===============================
CREATE TABLE public.budova (
  budova_id  SERIAL PRIMARY KEY,
  adresa     VARCHAR(50) NOT NULL,
  mesto      VARCHAR(50) NOT NULL
);

-- ===============================
--  ROOM TABLE
-- ===============================
CREATE TABLE public.miestnost (
  miestnost_id     SERIAL PRIMARY KEY,
  cislo_miestnosti VARCHAR(20) NOT NULL,
  kapacita         INTEGER     NOT NULL CHECK (kapacita >= 0),
  poschodie        INTEGER     NOT NULL,
  budova_id        INTEGER     NOT NULL REFERENCES public.budova(budova_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ===============================
--  ROLE TABLE
-- ===============================
CREATE TABLE public.rola (
  rola_id SERIAL PRIMARY KEY,
  nazov   VARCHAR(20) UNIQUE NOT NULL
);

INSERT INTO public.rola (nazov) VALUES ('viewer'), ('employer'), ('admin');

-- ===============================
--  USER TABLE
-- ===============================
CREATE TABLE public.uzivatel (
  uzivatel_id SERIAL PRIMARY KEY,
  meno        VARCHAR(100) NOT NULL,
  email       VARCHAR(100) UNIQUE NOT NULL,
  rola_id     INTEGER REFERENCES public.rola(rola_id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ===============================
--  RESERVATION TABLE
-- ===============================
CREATE TABLE public.rezervacia (
  rezervacia_id       SERIAL PRIMARY KEY,
  miestnost_id        INTEGER NOT NULL REFERENCES public.miestnost(miestnost_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  datum_vytvorenia    DATE    NOT NULL DEFAULT CURRENT_DATE,
  datum_rezervacie    DATE    NOT NULL,
  zaciatok_rezervacie TIME    NOT NULL DEFAULT '00:00',
  dlzka_rezervacie    INTERVAL NOT NULL CHECK (dlzka_rezervacie > INTERVAL '0 minutes'),
  uzivatel_id         INTEGER NOT NULL REFERENCES public.uzivatel(uzivatel_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

COMMIT;
