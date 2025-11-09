BEGIN;

-- ===============================
--  BUILDINGS
-- ===============================
INSERT INTO public.budova (adresa, mesto) VALUES
  ('Letná 9',        'Košice'),
  ('Technická 1',    'Košice'),
  ('Trieda SNP 1',   'Košice'),
  ('Hlavná 15',      'Košice'),
  ('Watsonova 47',   'Košice');

-- ===============================
--  ROOMS
-- ===============================
INSERT INTO public.miestnost (cislo_miestnosti, kapacita, poschodie, budova_id) VALUES
  ('A101', 20, 1, (SELECT budova_id FROM public.budova WHERE adresa = 'Letná 9')),
  ('A102', 12, 1, (SELECT budova_id FROM public.budova WHERE adresa = 'Letná 9')),
  ('B201', 30, 2, (SELECT budova_id FROM public.budova WHERE adresa = 'Technická 1')),
  ('C301', 25, 3, (SELECT budova_id FROM public.budova WHERE adresa = 'Watsonova 47')),
  ('D105', 10, 1, (SELECT budova_id FROM public.budova WHERE adresa = 'Hlavná 15'));

-- ===============================
--  USERS (backend expects meno, email, rola_id)
-- ===============================
INSERT INTO public.uzivatel (meno, email, rola_id) VALUES
  ('Nikita Kuropatkin',  'nikita@example.com',   (SELECT rola_id FROM public.rola WHERE nazov = 'admin')),
  ('Tibor Olearnik',     'tibor@example.com',    (SELECT rola_id FROM public.rola WHERE nazov = 'employer')),
  ('Juraj Pjescak',      'juraj@example.com',    (SELECT rola_id FROM public.rola WHERE nazov = 'viewer')),
  ('Nikodem Simonak',    'nikodem@example.com',  (SELECT rola_id FROM public.rola WHERE nazov = 'viewer')),
  ('Karolina Polackova', 'karolina@example.com', (SELECT rola_id FROM public.rola WHERE nazov = 'viewer'));

-- ===============================
--  RESERVATIONS
-- ===============================
INSERT INTO public.rezervacia
  (miestnost_id, datum_vytvorenia, datum_rezervacie, zaciatok_rezervacie, dlzka_rezervacie, uzivatel_id)
VALUES
  ((SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'A101'),
    CURRENT_DATE, DATE '2025-10-28', TIME '11:00', INTERVAL '2 hours',
    (SELECT uzivatel_id FROM public.uzivatel WHERE email = 'nikita@example.com')),

  ((SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'A102'),
    CURRENT_DATE, DATE '2025-10-29', TIME '09:00', INTERVAL '1 hour 30 minutes',
    (SELECT uzivatel_id FROM public.uzivatel WHERE email = 'tibor@example.com')),

  ((SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'B201'),
    CURRENT_DATE, DATE '2025-11-02', TIME '14:30', INTERVAL '3 hours',
    (SELECT uzivatel_id FROM public.uzivatel WHERE email = 'juraj@example.com')),

  ((SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'C301'),
    CURRENT_DATE, DATE '2025-11-03', TIME '08:00', INTERVAL '45 minutes',
    (SELECT uzivatel_id FROM public.uzivatel WHERE email = 'nikodem@example.com')),

  ((SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'D105'),
    CURRENT_DATE, DATE '2025-11-04', TIME '16:00', INTERVAL '1 hour',
    (SELECT uzivatel_id FROM public.uzivatel WHERE email = 'karolina@example.com'));

COMMIT;
