import csv
import psycopg2
import os

# ----------------------------
# DATABASE CONFIG
# ----------------------------
DB_CONFIG = {
    'host': 'localhost',
    'database': 'db',
    'user': 'postgres',
    'password': 'kitty_meow_meow'
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ----------------------------
# CONNECT
# ----------------------------
def connect_db():
    return psycopg2.connect(**DB_CONFIG)


# ----------------------------
# IMPORT USERS
# ----------------------------
def import_users(conn):
    cursor = conn.cursor()
    users_path = os.path.join(BASE_DIR, "users.csv")

    try:
        with open(users_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:

                # --- skip if email already exists ---
                cursor.execute("SELECT user_id FROM users WHERE email = %s", (row["email"],))
                existing = cursor.fetchone()

                if existing:
                    print("Skipped existing user:", row["email"])
                    continue

                # --- find role_id ---
                cursor.execute("SELECT role_id FROM roles WHERE name = %s", (row["role"],))
                role = cursor.fetchone()

                if not role:
                    print("ERROR: Role not found:", row["role"])
                    continue

                # --- insert ---
                cursor.execute("""
                    INSERT INTO users (name, email, role_id)
                    VALUES (%s, %s, %s)
                """, (row["name"], row["email"], role[0]))

                print("Imported user:", row["name"], row["email"])

        conn.commit()

    except FileNotFoundError:
        print("ERROR: users.csv not found at:", users_path)
    except Exception as e:
        print("ERROR importing users:", e)
        conn.rollback()
    finally:
        cursor.close()


# ----------------------------
# IMPORT ROOMS
# ----------------------------
def import_rooms(conn):
    cursor = conn.cursor()
    rooms_path = os.path.join(BASE_DIR, "rooms.csv")

    try:
        with open(rooms_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:

                # --- skip if room_number exists ---
                cursor.execute("SELECT room_id FROM rooms WHERE room_number = %s", (row["room_number"],))
                existing = cursor.fetchone()

                if existing:
                    print("Skipped existing room:", row["room_number"])
                    continue

                # --- find building_id ---
                cursor.execute("SELECT building_id FROM buildings WHERE address = %s", (row["building_address"],))
                building = cursor.fetchone()

                if not building:
                    print("ERROR: Building not found:", row["building_address"])
                    continue

                # --- insert ---
                cursor.execute("""
                    INSERT INTO rooms (room_number, capacity, floor, building_id)
                    VALUES (%s, %s, %s, %s)
                """, (
                    row["room_number"],
                    int(row["capacity"]),
                    int(row["floor"]),
                    building[0]
                ))

                print("Imported room:", row["room_number"])

        conn.commit()

    except FileNotFoundError:
        print("ERROR: rooms.csv not found at:", rooms_path)
    except Exception as e:
        print("ERROR importing rooms:", e)
        conn.rollback()
    finally:
        cursor.close()


# ----------------------------
# MAIN
# ----------------------------
def main():
    print("=== Import CSV started ===")

    conn = connect_db()
    print("Connected to DB")

    print("\n--- Importing users ---")
    import_users(conn)

    print("\n--- Importing rooms ---")
    import_rooms(conn)

    conn.close()
    print("\nImport completed successfully.")


if __name__ == "__main__":
    main()
