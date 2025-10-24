BEGIN;

-- (1) BUILDINGS
INSERT INTO public.budova (adresa, mesto) VALUES
  ('Letná 9',        'Košice'),
  ('Technická 1',    'Košice'),
  ('Trieda SNP 1',   'Košice'),
  ('Hlavná 15',      'Košice'),
  ('Watsonova 47',   'Košice');

-- (2) ROOMS
INSERT INTO public.miestnost (cislo_miestnosti, kapacita, poschodie, budova_id) VALUES
  ('A101', 20, 1, (SELECT budova_id FROM public.budova WHERE adresa = 'Letná 9')),
  ('A102', 12, 1, (SELECT budova_id FROM public.budova WHERE adresa = 'Letná 9')),
  ('B201', 30, 2, (SELECT budova_id FROM public.budova WHERE adresa = 'Technická 1')),
  ('C301', 25, 3, (SELECT budova_id FROM public.budova WHERE adresa = 'Watsonova 47')),
  ('D105', 10, 1, (SELECT budova_id FROM public.budova WHERE adresa = 'Hlavná 15'));

-- (3) USERS
INSERT INTO public.uzivatel (meno, priezvisko, personal_number) VALUES
  ('Nikita',     'Kuropatkin',   'KE-0001'),
  ('Tibor',      'Olearnik',     'KE-0002'),
  ('Juraj',      'Pjescak',      'KE-0003'),
  ('Nikodem',    'Simonak',      'KE-0004'),
  ('Karolina',   'Polackova',    'KE-0005');

-- (4) RESERVATIONS
-- Each reservation includes date, start time, duration, and linked user
INSERT INTO public.rezervacia
  (miestnost_id, datum_vytvorenia, datum_rezervacie, zaciatok_rezervacie, dlzka_rezervacie, uzivatel_id)
VALUES
  ((SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'A101'),
    DATE '2025-10-20', DATE '2025-10-28', TIME '11:00', INTERVAL '2 hours',
    (SELECT uzivatel_id FROM public.uzivatel WHERE personal_number = 'KE-0001')),

  ((SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'A102'),
    DATE '2025-10-21', DATE '2025-10-29', TIME '09:00', INTERVAL '1 hour 30 minutes',
    (SELECT uzivatel_id FROM public.uzivatel WHERE personal_number = 'KE-0002')),

  ((SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'B201'),
    DATE '2025-10-22', DATE '2025-11-02', TIME '14:30', INTERVAL '3 hours',
    (SELECT uzivatel_id FROM public.uzivatel WHERE personal_number = 'KE-0003')),

  ((SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'C301'),
    DATE '2025-10-23', DATE '2025-11-03', TIME '08:00', INTERVAL '45 minutes',
    (SELECT uzivatel_id FROM public.uzivatel WHERE personal_number = 'KE-0004')),

  ((SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'D105'),
    DATE '2025-10-24', DATE '2025-11-04', TIME '16:00', INTERVAL '1 hour',
    (SELECT uzivatel_id FROM public.uzivatel WHERE personal_number = 'KE-0005'));

COMMIT;