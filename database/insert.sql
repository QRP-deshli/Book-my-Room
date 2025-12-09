BEGIN;

-- ===============================
--  BUILDINGS
-- ===============================
INSERT INTO public.buildings (address, city) VALUES
  ('Letná 9',        'Košice'),
  ('Technická 1',    'Košice'),
  ('Trieda SNP 1',   'Košice'),
  ('Hlavná 15',      'Košice'),
  ('Watsonova 47',   'Košice');

-- ===============================
--  ROOMS
-- ===============================
INSERT INTO public.rooms (room_number, capacity, floor, building_id) VALUES
  ('A101', 20, 1, (SELECT building_id FROM public.buildings WHERE address = 'Letná 9')),
  ('A102', 12, 1, (SELECT building_id FROM public.buildings WHERE address = 'Letná 9')),
  ('B201', 30, 2, (SELECT building_id FROM public.buildings WHERE address = 'Technická 1')),
  ('C301', 25, 3, (SELECT building_id FROM public.buildings WHERE address = 'Watsonova 47')),
  ('D105', 10, 1, (SELECT building_id FROM public.buildings WHERE address = 'Hlavná 15'));

-- ===============================
--  USERS
-- ===============================
INSERT INTO public.users (name, email, role_id) VALUES
  ('Nikita Kuropatkin',  'nikita@example.com',   (SELECT role_id FROM public.roles WHERE name = 'admin')),
  ('Tibor Olearnik',     'tibor@example.com',    (SELECT role_id FROM public.roles WHERE name = 'employee')),
  ('Juraj Pjescak',      'juraj@example.com',    (SELECT role_id FROM public.roles WHERE name = 'viewer')),
  ('Nikodem Simonak',    'nikodem@example.com',  (SELECT role_id FROM public.roles WHERE name = 'viewer')),
  ('Karolina Polackova', 'karolina@example.com', (SELECT role_id FROM public.roles WHERE name = 'viewer'));

-- ===============================
--  RESERVATIONS
-- ===============================
INSERT INTO public.reservations
  (room_id, created_date, reservation_date, start_time, duration, user_id)
VALUES
  (
    (SELECT room_id FROM public.rooms WHERE room_number = 'A101'),
    CURRENT_DATE, DATE '2025-10-28', TIME '11:00', INTERVAL '2 hours',
    (SELECT user_id FROM public.users WHERE email = 'nikita@example.com')
  ),

  (
    (SELECT room_id FROM public.rooms WHERE room_number = 'A102'),
    CURRENT_DATE, DATE '2025-10-29', TIME '09:00', INTERVAL '1 hour 30 minutes',
    (SELECT user_id FROM public.users WHERE email = 'tibor@example.com')
  ),

  (
    (SELECT room_id FROM public.rooms WHERE room_number = 'B201'),
    CURRENT_DATE, DATE '2025-11-02', TIME '14:30', INTERVAL '3 hours',
    (SELECT user_id FROM public.users WHERE email = 'juraj@example.com')
  ),

  (
    (SELECT room_id FROM public.rooms WHERE room_number = 'C301'),
    CURRENT_DATE, DATE '2025-11-03', TIME '08:00', INTERVAL '45 minutes',
    (SELECT user_id FROM public.users WHERE email = 'nikodem@example.com')
  ),

  (
    (SELECT room_id FROM public.rooms WHERE room_number = 'D105'),
    CURRENT_DATE, DATE '2025-11-04', TIME '16:00', INTERVAL '1 hour',
    (SELECT user_id FROM public.users WHERE email = 'karolina@example.com')
  );

COMMIT;
