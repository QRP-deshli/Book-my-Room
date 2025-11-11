import React, { useEffect, useState } from "react";
import "./App.css";
import Miestnosti from "./Miestnosti";
import Login from "./Login";

function App() {
  const [role, setRole] = useState("viewer");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || localStorage.getItem("token");

    if (token) {
      localStorage.setItem("token", token);
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setRole(payload.role);
      } catch (e) {
        console.error("Invalid token");
        localStorage.removeItem("token");
      }
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setRole("viewer");
  };

  const token = localStorage.getItem("token");

  // 🔹 Pridať používateľa
  const addUser = async () => {
    const meno = prompt("Zadaj meno nového používateľa:");
    const email = prompt("Zadaj email:");
    const rola = prompt("Zadaj rolu (viewer, employer, admin):");

    if (!meno || !email || !rola) {
      alert("❌ Musíš vyplniť všetky polia.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/admin/add-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ meno, email, rola }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ Používateľ '${meno}' bol pridaný.`);
      } else {
        alert(`❌ ${data.error || "Chyba pri pridávaní používateľa"}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Serverová chyba.");
    }
  };

  // 🔹 Pridať miestnosť
  const addRoom = async () => {
    const cislo_miestnosti = prompt("Číslo miestnosti (napr. E101):");
    const kapacita = prompt("Kapacita:");
    const poschodie = prompt("Poschodie:");
    const budova_id = prompt("ID budovy (napr. 1):");

    if (!cislo_miestnosti || !kapacita || !poschodie || !budova_id) {
      alert("❌ Musíš vyplniť všetky polia.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/admin/add-room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cislo_miestnosti,
          kapacita: Number(kapacita),
          poschodie: Number(poschodie),
          budova_id: Number(budova_id),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ Miestnosť '${cislo_miestnosti}' bola pridaná.`);
      } else {
        alert(`❌ ${data.error || "Chyba pri pridávaní miestnosti"}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Serverová chyba.");
    }
  };


  return (
    <div className="App">
      <h1>BookMyRoom</h1>
<p>Role: <b>{role}</b></p>

{!localStorage.getItem("token") ? (
  <button onClick={() => (window.location.href = "http://localhost:5000/auth/github")}>
    Prihlásiť sa cez GitHub
  </button>
) : (
  <button onClick={logout}>Odhlásiť</button>
)}


      {role === "viewer" && (
        <>
          <h3>Len prezeranie miestností</h3>
          <Miestnosti />
        </>
      )}

      {role === "employer" && (
        <>
          <h3>Rezervácie</h3>
          <Miestnosti canBook />
        </>
      )}

      {role === "admin" && (
        <>
          <h3>Administrácia</h3>
          <button onClick={addUser}>Pridať používateľa</button>
          <button onClick={addRoom} style={{ marginLeft: "0.5rem" }}>
            Pridať miestnosť
          </button>
          <Miestnosti canBook canDelete />
        </>
      )}
    </div>
  );
}

export default App;
