BEGIN;

-- ===============================
-- BUILDINGS
-- ===============================
INSERT INTO public.buildings (address, city) VALUES
  ('Letná 9',      'Košice'),
  ('Technická 1',  'Košice'),
  ('Trieda SNP 1', 'Košice'),
  ('Hlavná 15',    'Košice'),
  ('Watsonova 47', 'Košice');

-- ===============================
-- ROOMS
-- ===============================
INSERT INTO public.rooms (room_number, capacity, floor, building_id) VALUES
  (
    'A101', 20, 1,
    (SELECT building_id FROM public.buildings WHERE address = 'Letná 9')
  ),
  (
    'A102', 12, 1,
    (SELECT building_id FROM public.buildings WHERE address = 'Letná 9')
  ),
  (
    'B201', 30, 2,
    (SELECT building_id FROM public.buildings WHERE address = 'Technická 1')
  ),
  (
    'C301', 25, 3,
    (SELECT building_id FROM public.buildings WHERE address = 'Watsonova 47')
  ),
  (
    'D105', 10, 1,
    (SELECT building_id FROM public.buildings WHERE address = 'Hlavná 15')
  );

-- ===============================
-- USERS
-- ===============================
INSERT INTO public.users (name, email, role_id, building_id) VALUES
  (
    'Nikita Kuropatkin',
    'nikita@example.com',
    (SELECT role_id FROM public.roles WHERE name = 'admin'),
    (SELECT building_id FROM public.buildings WHERE address = 'Letná 9')
  ),
  (
    'Tibor Olearnik',
    'tibor@example.com',
    (SELECT role_id FROM public.roles WHERE name = 'employee'),
    (SELECT building_id FROM public.buildings WHERE address = 'Technická 1')
  ),
  (
    'Juraj Pjescak',
    'juraj@example.com',
    (SELECT role_id FROM public.roles WHERE name = 'viewer'),
    NULL
  ),
  (
    'Nikodem Simonak',
    'nikodem@example.com',
    (SELECT role_id FROM public.roles WHERE name = 'viewer'),
    NULL
  ),
  (
    'Karolina Polackova',
    'karolina@example.com',
    (SELECT role_id FROM public.roles WHERE name = 'viewer'),
    NULL
  );

COMMIT;
