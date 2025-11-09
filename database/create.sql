BEGIN;

-- ===============================
--  BUILDING TABLE
-- ===============================
CREATE TABLE public.budova (
  budova_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  adresa     VARCHAR(25) NOT NULL, -- Street address
  mesto      VARCHAR(25) NOT NULL  -- City
);

-- ===============================
--  ROOM TABLE
-- ===============================
CREATE TABLE public.miestnost (
  miestnost_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cislo_miestnosti VARCHAR(20) NOT NULL, -- Room number (e.g., A101)
  kapacita         INTEGER     NOT NULL CHECK (kapacita >= 0), -- Capacity of the room
  poschodie        INTEGER     NOT NULL, -- Floor
  budova_id        INTEGER     NOT NULL,
  CONSTRAINT fk_miestnost_budova
    FOREIGN KEY (budova_id) REFERENCES public.budova(budova_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ===============================
--  ROLE TABLE
-- ===============================
CREATE TABLE public.rola (
  rola_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nazov VARCHAR(20) UNIQUE NOT NULL
);

INSERT INTO public.rola (nazov) VALUES ('viewer'), ('employer'), ('admin');

-- ===============================
--  USER TABLE
-- ===============================
CREATE TABLE public.uzivatel (
  uzivatel_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meno            VARCHAR(20) NOT NULL, -- First name
  priezvisko      VARCHAR(20) NOT NULL, -- Last name
  personal_number VARCHAR(20) NOT NULL UNIQUE, -- Unique personal ID
  rola_id         INTEGER REFERENCES public.rola(rola_id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- ===============================
--  RESERVATION TABLE
-- ===============================
CREATE TABLE public.rezervacia (
  rezervacia_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  miestnost_id        INTEGER NOT NULL,           -- Linked room
  datum_vytvorenia    DATE    NOT NULL,           -- Date the reservation was created
  datum_rezervacie    DATE    NOT NULL,           -- Date of the reservation
  zaciatok_rezervacie TIME    NOT NULL DEFAULT '00:00', -- Start time of the reservation
  dlzka_rezervacie    INTERVAL NOT NULL CHECK (dlzka_rezervacie > INTERVAL '0 minutes'), -- Duration
  uzivatel_id         INTEGER NOT NULL,           -- Linked user
  CONSTRAINT fk_rezervacia_miestnost
    FOREIGN KEY (miestnost_id) REFERENCES public.miestnost(miestnost_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_rezervacia_uzivatel
    FOREIGN KEY (uzivatel_id) REFERENCES public.uzivatel(uzivatel_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ===============================
--  INDEXES
-- ===============================
CREATE INDEX idx_miestnost_budova       ON public.miestnost(budova_id);
CREATE INDEX idx_rezervacia_miestnost   ON public.rezervacia(miestnost_id);
CREATE INDEX idx_rezervacia_uzivatel    ON public.rezervacia(uzivatel_id);
CREATE INDEX idx_rezervacia_datum       ON public.rezervacia(datum_rezervacie);

COMMIT;
