import csv
import psycopg2
from psycopg2 import sql
import sys
from datetime import datetime

# Konfigurácia databázy
DB_CONFIG = {
    'host': 'localhost',
    'database': 'bmr_db',
    'user': 'postgres',
    'password': 'feetlover'
}

def connect_db():
    """Pripojenie k databáze"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Chyba pripojenia k databáze: {e}")
        sys.exit(1)

def export_users_to_csv(output_file, conn):
    """
    Export používateľov do CSV súboru
    Výstupný formát: meno,email,rola
    """
    cursor = conn.cursor()
    exported = 0
    
    try:
        # SQL dotaz s JOIN pre získanie názvu role
        cursor.execute("""
            SELECT u.meno, u.email, r.nazov as rola
            FROM public.uzivatel u
            LEFT JOIN public.rola r ON u.rola_id = r.rola_id
            ORDER BY u.uzivatel_id
        """)
        
        rows = cursor.fetchall()
        
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            # Hlavička
            writer.writerow(['meno', 'email', 'rola'])
            
            # Dáta
            for row in rows:
                writer.writerow(row)
                exported += 1
                print(f"✓ Exportovaný: {row[0]} ({row[1]})")
        
        print(f"\n=== Súhrn exportu používateľov ===")
        print(f"Exportované záznamy: {exported}")
        print(f"Súbor: {output_file}")
        
    except Exception as e:
        print(f"Chyba pri exporte používateľov: {e}")
    finally:
        cursor.close()

def export_rooms_to_csv(output_file, conn):
    """
    Export miestností do CSV súboru
    Výstupný formát: cislo_miestnosti,kapacita,poschodie,budova_adresa
    """
    cursor = conn.cursor()
    exported = 0
    
    try:
        # SQL dotaz s JOIN pre získanie adresy budovy
        cursor.execute("""
            SELECT m.cislo_miestnosti, m.kapacita, m.poschodie, b.adresa as budova_adresa
            FROM public.miestnost m
            JOIN public.budova b ON m.budova_id = b.budova_id
            ORDER BY m.miestnost_id
        """)
        
        rows = cursor.fetchall()
        
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            # Hlavička
            writer.writerow(['cislo_miestnosti', 'kapacita', 'poschodie', 'budova_adresa'])
            
            # Dáta
            for row in rows:
                writer.writerow(row)
                exported += 1
                print(f"✓ Exportovaná: {row[0]} (kapacita: {row[1]})")
        
        print(f"\n=== Súhrn exportu miestností ===")
        print(f"Exportované záznamy: {exported}")
        print(f"Súbor: {output_file}")
        
    except Exception as e:
        print(f"Chyba pri exporte miestností: {e}")
    finally:
        cursor.close()

def export_buildings_to_csv(output_file, conn):
    """
    Export budov do CSV súboru
    Výstupný formát: adresa,mesto
    """
    cursor = conn.cursor()
    exported = 0
    
    try:
        cursor.execute("""
            SELECT adresa, mesto
            FROM public.budova
            ORDER BY budova_id
        """)
        
        rows = cursor.fetchall()
        
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['adresa', 'mesto'])
            
            for row in rows:
                writer.writerow(row)
                exported += 1
                print(f"✓ Exportovaná: {row[0]}, {row[1]}")
        
        print(f"\n=== Súhrn exportu budov ===")
        print(f"Exportované záznamy: {exported}")
        print(f"Súbor: {output_file}")
        
    except Exception as e:
        print(f"Chyba pri exporte budov: {e}")
    finally:
        cursor.close()

def export_reservations_to_csv(output_file, conn):
    """
    Export rezervácií do CSV súboru
    Výstupný formát: cislo_miestnosti,uzivatel_email,datum_rezervacie,
                     zaciatok_rezervacie,dlzka_rezervacie,datum_vytvorenia
    """
    cursor = conn.cursor()
    exported = 0
    
    try:
        cursor.execute("""
            SELECT 
                m.cislo_miestnosti,
                u.email as uzivatel_email,
                r.datum_rezervacie,
                r.zaciatok_rezervacie,
                r.dlzka_rezervacie,
                r.datum_vytvorenia
            FROM public.rezervacia r
            JOIN public.miestnost m ON r.miestnost_id = m.miestnost_id
            JOIN public.uzivatel u ON r.uzivatel_id = u.uzivatel_id
            ORDER BY r.datum_rezervacie, r.zaciatok_rezervacie
        """)
        
        rows = cursor.fetchall()
        
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['cislo_miestnosti', 'uzivatel_email', 'datum_rezervacie', 
                           'zaciatok_rezervacie', 'dlzka_rezervacie', 'datum_vytvorenia'])
            
            for row in rows:
                writer.writerow(row)
                exported += 1
                print(f"✓ Exportovaná: {row[0]} - {row[1]} ({row[2]})")
        
        print(f"\n=== Súhrn exportu rezervácií ===")
        print(f"Exportované záznamy: {exported}")
        print(f"Súbor: {output_file}")
        
    except Exception as e:
        print(f"Chyba pri exporte rezervácií: {e}")
    finally:
        cursor.close()

def export_all(conn):
    """Export všetkých tabuliek"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    print("=== Export všetkých tabuliek ===\n")
    
    print("--- Export budov ---")
    export_buildings_to_csv(f'buildings_{timestamp}.csv', conn)
    
    print("\n--- Export miestností ---")
    export_rooms_to_csv(f'rooms_{timestamp}.csv', conn)
    
    print("\n--- Export používateľov ---")
    export_users_to_csv(f'users_{timestamp}.csv', conn)
    
    print("\n--- Export rezervácií ---")
    export_reservations_to_csv(f'reservations_{timestamp}.csv', conn)

def main():
    """Hlavná funkcia"""
    print("=== Export dát z databázy do CSV ===\n")
    print("Možnosti:")
    print("1 - Export používateľov")
    print("2 - Export miestností")
    print("3 - Export budov")
    print("4 - Export rezervácií")
    print("5 - Export všetkého")
    print("0 - Koniec")
    
    choice = input("\nVyber možnosť (0-5): ").strip()
    
    if choice == '0':
        print("Ukončenie...")
        return
    
    # Pripoj sa k databáze
    conn = connect_db()
    print("\n✓ Pripojené k databáze\n")
    
    if choice == '1':
        export_users_to_csv('users_export.csv', conn)
    elif choice == '2':
        export_rooms_to_csv('rooms_export.csv', conn)
    elif choice == '3':
        export_buildings_to_csv('buildings_export.csv', conn)
    elif choice == '4':
        export_reservations_to_csv('reservations_export.csv', conn)
    elif choice == '5':
        export_all(conn)
    else:
        print("Neplatná voľba!")
    
    conn.close()
    print("\n✓ Export dokončený!")

if __name__ == "__main__":
    main()