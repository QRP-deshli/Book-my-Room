
BEGIN;

-- 1) BUDOVA (5◊ Koöice)
INSERT INTO public.budova (adresa, mesto) VALUES
  ('Letn· 9',        'Koöice'),
  ('Technick· 1',    'Koöice'),
  ('Trieda SNP 1',   'Koöice'),
  ('Hlavn· 15',      'Koöice'),
  ('Watsonova 47',   'Koöice');

-- 2) MIESTNOSç (5◊, rÙzne budovy v KE)
INSERT INTO public.miestnost (cislo_miestnosti, kapacita, poschodie, budova_id) VALUES
  ('A101', 20, 1, (SELECT budova_id FROM public.budova WHERE adresa = 'Letn· 9')),
  ('A102', 12, 1, (SELECT budova_id FROM public.budova WHERE adresa = 'Letn· 9')),
  ('B201', 30, 2, (SELECT budova_id FROM public.budova WHERE adresa = 'Technick· 1')),
  ('C301', 25, 3, (SELECT budova_id FROM public.budova WHERE adresa = 'Watsonova 47')),
  ('D105', 10, 1, (SELECT budova_id FROM public.budova WHERE adresa = 'Hlavn· 15'));

-- 3) UéÕVATEº (5◊)
INSERT INTO public.uzivatel (meno, priezvisko, personal_number) VALUES
  ('Nikita',     'Kuropatkin',   'KE-0001'),
  ('Tibor',   'Olearnik',		'KE-0002'),
  ('Juraj',   'Pjescak', 'KE-0003'),
  ('Nikodem',   'Simonak',   'KE-0004'),
  ('Karolina',   'Polackova',   'KE-0005');

-- 4) REZERV¡CIA (5◊, vöetko Koöice miestnosti + platnÈ intervaly)
-- d·tumy s˙ prÌklady; mÙûeö ich zmeniù podæa potreby
INSERT INTO public.rezervacia
  (miestnost_id, datum_vytvorenia, datum_rezervacie, dlzka_rezervacie, uzivatel_id)
VALUES
  ( (SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'A101'),
    DATE '2025-10-20', DATE '2025-10-28', INTERVAL '2 hours',
    (SELECT uzivatel_id FROM public.uzivatel WHERE personal_number = 'KE-0001') ),

  ( (SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'A102'),
    DATE '2025-10-21', DATE '2025-10-29', INTERVAL '1 hour 30 minutes',
    (SELECT uzivatel_id FROM public.uzivatel WHERE personal_number = 'KE-0002') ),

  ( (SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'B201'),
    DATE '2025-10-22', DATE '2025-11-02', INTERVAL '3 hours',
    (SELECT uzivatel_id FROM public.uzivatel WHERE personal_number = 'KE-0003') ),

  ( (SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'C301'),
    DATE '2025-10-23', DATE '2025-11-03', INTERVAL '45 minutes',
    (SELECT uzivatel_id FROM public.uzivatel WHERE personal_number = 'KE-0004') ),

  ( (SELECT miestnost_id FROM public.miestnost WHERE cislo_miestnosti = 'D105'),
    DATE '2025-10-24', DATE '2025-11-04', INTERVAL '1 hour',
    (SELECT uzivatel_id FROM public.uzivatel WHERE personal_number = 'KE-0005') );

COMMIT;

