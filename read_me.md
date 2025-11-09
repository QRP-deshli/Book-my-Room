\# 🧩 Room Reservation – Spustenie projektu



\## 🗄️ 1. Inštalácia PostgreSQL



1\. Stiahni a nainštaluj PostgreSQL (verzia 18 alebo novšia):  

&nbsp;  👉 \[https://www.postgresql.org/download/](https://www.postgresql.org/download/)



2\. Po inštalácii vytvor novú databázu, napríklad:

&nbsp;  ```

&nbsp;  bmr\_db

&nbsp;  ```



3\. V databáze spusti SQL skripty pre vytvorenie tabuliek (`budova`, `miestnost`, `uzivatel`, `rezervacia`).



---



\## ⚙️ 2. Spustenie backendu



1\. Otvor priečinok backendu v príkazovom riadku:

&nbsp;  ```bash

&nbsp;  cd priecinok\_s\_backendom

&nbsp;  ```



2\. Nainštaluj potrebné závislosti:

&nbsp;  ```bash

&nbsp;  npm install
&nbsp;  npm install passport-github2

&nbsp;  ```



3\. Uprav súbor `.env` (nastav názov databázy a heslo podľa svojho PostgreSQL):

&nbsp;  ```env

&nbsp;  PGHOST=localhost

&nbsp;  PGUSER=postgres

&nbsp;  PGPASSWORD=your\_password

&nbsp;  PGDATABASE=bmr\_db

&nbsp;  PGPORT=5432

&nbsp;  PORT=5000

&nbsp;  ```



4\. Spusť backend:

&nbsp;  ```bash

&nbsp;  node server.js

&nbsp;  ```



✅ Ak je všetko správne, v konzole sa zobrazí:

```

✅ Connected to PostgreSQL

🚀 Server running on port 5000

```



---



\## 💻 3. Spustenie frontendu



1\. Otvor priečinok frontendu:

&nbsp;  ```bash

&nbsp;  cd priecinok\_s\_frontendom

&nbsp;  ```



2\. Nainštaluj závislosti:

&nbsp;  ```bash

&nbsp;  npm install

&nbsp;  ```



3\. Spusť frontend aplikáciu:

&nbsp;  ```bash

&nbsp;  npm start

&nbsp;  ```



Po spustení sa otvorí webová aplikácia (zvyčajne na adrese):  

👉 \[http://localhost:3000](http://localhost:3000)



---



\## 🧠 Poznámky

\- Backend beží na porte \*\*5000\*\*, frontend na \*\*3000\*\* (alebo podľa nastavenia).  

\- Databáza musí byť spustená pred štartom backendu.  

\- Po úspešnom spustení sa frontend automaticky spojí s backendom a zobrazí zoznam miestností.



