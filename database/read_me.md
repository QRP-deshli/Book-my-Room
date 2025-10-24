Databáza bola vytvorená v jazyku PostgreSQL.

Subor create.sql obsahuje sql querry.
Skript definuje nasledujúce tabuľky:

budova – obsahuje informácie o budovách (adresa, mesto).

miestnost – miestnosti priradené k budovám (číslo, kapacita, poschodie).

uzivatel – zoznam používateľov systému (meno, priezvisko, osobné číslo).

rezervacia – prepojenie medzi používateľmi a miestnosťami s dátumom a dĺžkou rezervácie.

Súbor insert.sql obsahuje sql querry s dočasným naplnením tabuľky pre testovanie backendu a frontendu.