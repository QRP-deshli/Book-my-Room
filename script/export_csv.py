import csv
import psycopg2
import os
from datetime import datetime

DB_CONFIG = {
    'host': 'localhost',
    'database': 'bmr_db',
    'user': 'postgres',
    'password': 'heslo'
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def connect_db():
    return psycopg2.connect(**DB_CONFIG)


# ---------------------------------------------------
# EXPORT USERS
# ---------------------------------------------------
def export_users(conn):
    cursor = conn.cursor()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    file = os.path.join(BASE_DIR, f"users_{timestamp}.csv")

    cursor.execute("""
        SELECT u.name, u.email, r.name AS role
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        ORDER BY u.user_id
    """)

    rows = cursor.fetchall()

    with open(file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["name", "email", "role"])
        writer.writerows(rows)

    print("Exported users:", file)


# ---------------------------------------------------
# EXPORT ROOMS
# ---------------------------------------------------
def export_rooms(conn):
    cursor = conn.cursor()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    file = os.path.join(BASE_DIR, f"rooms_{timestamp}.csv")

    cursor.execute("""
        SELECT r.room_number, r.capacity, r.floor, b.address
        FROM rooms r
        JOIN buildings b ON r.building_id = b.building_id
        ORDER BY r.room_id
    """)

    rows = cursor.fetchall()

    with open(file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["room_number", "capacity", "floor", "building_address"])
        writer.writerows(rows)

    print("Exported rooms:", file)


# ---------------------------------------------------
# EXPORT BUILDINGS
# ---------------------------------------------------
def export_buildings(conn):
    cursor = conn.cursor()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    file = os.path.join(BASE_DIR, f"buildings_{timestamp}.csv")

    cursor.execute("""
        SELECT address, city
        FROM buildings
        ORDER BY building_id
    """)

    rows = cursor.fetchall()

    with open(file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["address", "city"])
        writer.writerows(rows)

    print("Exported buildings:", file)


# ---------------------------------------------------
# EXPORT RESERVATIONS
# ---------------------------------------------------
def export_reservations(conn):
    cursor = conn.cursor()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    file = os.path.join(BASE_DIR, f"reservations_{timestamp}.csv")

    cursor.execute("""
        SELECT 
            rm.room_number,
            u.email,
            r.reservation_date,
            r.start_time,
            r.duration,
            r.created_date
        FROM reservations r
        JOIN rooms rm ON rm.room_id = r.room_id
        JOIN users u ON u.user_id = r.user_id
        ORDER BY r.reservation_date, r.start_time
    """)

    rows = cursor.fetchall()

    with open(file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["room_number", "user_email", "date", "start_time", "duration", "created"])
        writer.writerows(rows)

    print("Exported reservations:", file)


# ---------------------------------------------------
# MAIN
# ---------------------------------------------------
def main():
    print("Starting CSV export...")
    conn = connect_db()
    print("Connected to database")

    export_users(conn)
    export_rooms(conn)
    export_buildings(conn)
    export_reservations(conn)

    conn.close()
    print("Export completed successfully.")


if __name__ == "__main__":
    main()
