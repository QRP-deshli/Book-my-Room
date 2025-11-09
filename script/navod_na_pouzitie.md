# NÁVOD NA POUŽITIE CSV IMPORT/EXPORT SKRIPTOV
===============================================

## OBSAH
1. Príprava prostredia
2. Konfigurácia databázy
3. Import dát do databázy
4. Export dát z databázy
5. Riešenie problémov

---

## 1. PRÍPRAVA PROSTREDIA

### Krok 1: Inštalácia Python knižníc
Otvor terminál/príkazový riadok a spusti:

```
pip install psycopg2-binary
```

### Krok 2: Stiahni/vytvor potrebné súbory
- import_csv.py (import skript)
- export_csv.py (export skript)
- users.csv (vzorový súbor používateľov)
- rooms.csv (vzorový súbor miestností)

---

## 2. KONFIGURÁCIA DATABÁZY

### V oboch skriptoch (import_csv.py a export_csv.py) uprav:

```python
DB_CONFIG = {
    'host': 'localhost',           # adresa servera (zvyčajne localhost)
    'database': 'tvoj_nazov_db',   # názov tvojej databázy
    'user': 'postgres',            # tvoj database user
    'password': 'tvoje_heslo'      # tvoje heslo
}
```

**DÔLEŽITÉ:** Uisti sa, že databáza obsahuje všetky potrebné tabuľky!

---

## 3. IMPORT DÁT DO DATABÁZY

### Krok 1: Priprav CSV súbory

**users.csv** - formát:
```
meno,email,rola
Peter Kovac,peter@example.com,viewer
Maria Novakova,maria@example.com,employer
```

**rooms.csv** - formát:
```
cislo_miestnosti,kapacita,poschodie,budova_adresa
A103,18,1,Letná 9
B202,35,2,Technická 1
```

**POZOR:** 
- Budova s danou adresou MUSÍ už existovať v databáze!
- Rola (viewer/employer/admin) MUSÍ existovať v tabuľke rola!

### Krok 2: Spusti import skript

```
python import_csv.py
```

### Čo sa stane:
- Skript načíta users.csv a rooms.csv
- Skontroluje či existujú závislé záznamy (budovy, role)
- Importuje dáta do databázy
- Vypíše report o úspešných/neúspešných importoch

### Výstup:
```
=== Import dát z CSV do databázy ===

✓ Pripojené k databáze

--- Import používateľov ---
✓ Importovaný: Peter Kovac (peter@example.com)
✓ Importovaný: Maria Novakova (maria@example.com)

=== Súhrn importu používateľov ===
Úspešne importované: 2
Chyby: 0
```

---

## 4. EXPORT DÁT Z DATABÁZY

### Krok 1: Spusti export skript

```
python export_csv.py
```

### Krok 2: Vyber možnosť z menu

```
=== Export dát z databázy do CSV ===

Možnosti:
1 - Export používateľov
2 - Export miestností
3 - Export budov
4 - Export rezervácií
5 - Export všetkého
0 - Koniec

Vyber možnosť (0-5): 
```

### Príklad: Export všetkého

Zadaj: **5**

Vytvorí súbory:
- buildings_20251109_143022.csv
- rooms_20251109_143022.csv
- users_20251109_143022.csv
- reservations_20251109_143022.csv

### Výstup:
```
--- Export používateľov ---
✓ Exportovaný: Peter Kovac (peter@example.com)
✓ Exportovaný: Maria Novakova (maria@example.com)

=== Súhrn exportu používateľov ===
Exportované záznamy: 2
Súbor: users_20251109_143022.csv
```
