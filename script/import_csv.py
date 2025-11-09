import csv
import psycopg2
from psycopg2 import sql
import sys

# Konfigurácia databázy
DB_CONFIG = {
    'host': 'localhost',
    'database': 'BookMyRoom',
    'user': 'postgres',
    'password': 'heslo'
}

def connect_db():
    """Pripojenie k databáze"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Chyba pripojenia k databáze: {e}")
        sys.exit(1)

def import_users_from_csv(csv_file, conn):
    """
    Import používateľov z CSV súboru do tabuľky uzivatel
    CSV formát: meno,email,rola
    Príklad: Jan Novak,jan@example.com,viewer
    """
    cursor = conn.cursor()
    imported = 0
    errors = 0
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                try:
                    # Získaj rola_id na základe názvu role
                    cursor.execute(
                        "SELECT rola_id FROM public.rola WHERE nazov = %s",
                        (row['rola'],)
                    )
                    result = cursor.fetchone()
                    
                    if not result:
                        print(f"Chyba: Rola '{row['rola']}' neexistuje pre {row['email']}")
                        errors += 1
                        continue
                    
                    rola_id = result[0]
                    
                    # Vlož používateľa
                    cursor.execute(
                        """INSERT INTO public.uzivatel (meno, email, rola_id) 
                           VALUES (%s, %s, %s)
                           ON CONFLICT (email) DO NOTHING""",
                        (row['meno'], row['email'], rola_id)
                    )
                    
                    if cursor.rowcount > 0:
                        imported += 1
                        print(f"✓ Importovaný: {row['meno']} ({row['email']})")
                    else:
                        print(f"⊘ Preskočený (už existuje): {row['email']}")
                        
                except Exception as e:
                    print(f"✗ Chyba pri importe {row.get('email', 'neznámy')}: {e}")
                    errors += 1
                    
        conn.commit()
        print(f"\n=== Súhrn importu používateľov ===")
        print(f"Úspešne importované: {imported}")
        print(f"Chyby: {errors}")
        
    except FileNotFoundError:
        print(f"Súbor {csv_file} nebol najdený!")
    except Exception as e:
        print(f"Chyba pri čítaní CSV: {e}")
        conn.rollback()
    finally:
        cursor.close()

def import_rooms_from_csv(csv_file, conn):
    """
    Import miestností z CSV súboru do tabuľky miestnost
    CSV formát: cislo_miestnosti,kapacita,poschodie,budova_adresa
    Príklad: A103,15,1,Letná 9
    """
    cursor = conn.cursor()
    imported = 0
    errors = 0
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                try:
                    # Nájdi budova_id na základe adresy
                    cursor.execute(
                        "SELECT budova_id FROM public.budova WHERE adresa = %s",
                        (row['budova_adresa'],)
                    )
                    result = cursor.fetchone()
                    
                    if not result:
                        print(f"Chyba: Budova '{row['budova_adresa']}' neexistuje")
                        errors += 1
                        continue
                    
                    budova_id = result[0]
                    
                    # Vlož miestnosť
                    cursor.execute(
                        """INSERT INTO public.miestnost 
                           (cislo_miestnosti, kapacita, poschodie, budova_id) 
                           VALUES (%s, %s, %s, %s)""",
                        (row['cislo_miestnosti'], int(row['kapacita']), 
                         int(row['poschodie']), budova_id)
                    )
                    
                    imported += 1
                    print(f"✓ Importovaná miestnosť: {row['cislo_miestnosti']}")
                    
                except Exception as e:
                    print(f"✗ Chyba pri importe miestnosti {row.get('cislo_miestnosti', 'neznáma')}: {e}")
                    errors += 1
                    
        conn.commit()
        print(f"\n=== Súhrn importu miestností ===")
        print(f"Úspešne importované: {imported}")
        print(f"Chyby: {errors}")
        
    except FileNotFoundError:
        print(f"Súbor {csv_file} nebol najdený!")
    except Exception as e:
        print(f"Chyba pri čítaní CSV: {e}")
        conn.rollback()
    finally:
        cursor.close()

def main():
    """Hlavná funkcia"""
    print("=== Import dát z CSV do databázy ===\n")
    
    # Pripoj sa k databáze
    conn = connect_db()
    print("✓ Pripojené k databáze\n")
    
    # Import používateľov
    print("--- Import používateľov ---")
    import_users_from_csv('users.csv', conn)
    
    print("\n--- Import miestností ---")
    import_rooms_from_csv('rooms.csv', conn)
    
    conn.close()
    print("\n✓ Import dokončený!")

if __name__ == "__main__":
    main()
