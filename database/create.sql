BEGIN;

-- Budova
CREATE TABLE public.budova (
  budova_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  adresa     VARCHAR(25) NOT NULL,
  mesto      VARCHAR(25) NOT NULL
);

-- Miestnosť
CREATE TABLE public.miestnost (
  miestnost_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cislo_miestnosti VARCHAR(20) NOT NULL,
  kapacita         INTEGER     NOT NULL CHECK (kapacita >= 0),
  poschodie        INTEGER     NOT NULL,
  budova_id        INTEGER     NOT NULL,
  CONSTRAINT fk_miestnost_budova
    FOREIGN KEY (budova_id) REFERENCES public.budova(budova_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Užívateľ
CREATE TABLE public.uzivatel (
  uzivatel_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meno            VARCHAR(20) NOT NULL,
  priezvisko      VARCHAR(20) NOT NULL,
  personal_number VARCHAR(20) NOT NULL UNIQUE
);

-- Rezervácia (dlzka_rezervacie = INTERVAL)
CREATE TABLE public.rezervacia (
  rezervacia_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  miestnost_id     INTEGER NOT NULL,
  datum_vytvorenia DATE    NOT NULL,
  datum_rezervacie DATE    NOT NULL,
  dlzka_rezervacie INTERVAL NOT NULL CHECK (dlzka_rezervacie > INTERVAL '0 minutes'),
  uzivatel_id      INTEGER NOT NULL,
  CONSTRAINT fk_rezervacia_miestnost
    FOREIGN KEY (miestnost_id) REFERENCES public.miestnost(miestnost_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_rezervacia_uzivatel
    FOREIGN KEY (uzivatel_id) REFERENCES public.uzivatel(uzivatel_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Indexy
CREATE INDEX idx_miestnost_budova       ON public.miestnost(budova_id);
CREATE INDEX idx_rezervacia_miestnost   ON public.rezervacia(miestnost_id);
CREATE INDEX idx_rezervacia_uzivatel    ON public.rezervacia(uzivatel_id);
CREATE INDEX idx_rezervacia_datum       ON public.rezervacia(datum_rezervacie);

-- (ak sú rezervácie celodenné, môžeš pridať)
-- ALTER TABLE public.rezervacia
--   ADD CONSTRAINT unq_miestnost_den UNIQUE (miestnost_id, datum_rezervacie);

COMMIT;