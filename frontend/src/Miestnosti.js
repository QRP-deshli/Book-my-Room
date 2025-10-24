import { useEffect, useState } from "react";

export default function Miestnosti() {
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  // 🔹 Load rooms from backend
  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:5000/api/rooms?date=${selectedDate}`)
      .then((res) => res.json())
      .then((data) => setRooms(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  // 🔹 Filter (all / free / occupied)
  const filteredRooms = rooms.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  // 🔹 Reservation handler
  const handleBook = async (roomId) => {
    const confirm = window.confirm(
      `Chceš rezervovať miestnosť s ID: ${roomId} pre ${selectedDate}?`
    );
    if (!confirm) return;

    const body = {
      miestnost_id: roomId,
      uzivatel_id: 1, // For testing; later replace with logged-in user
      datum_rezervacie: selectedDate,
      dlzka_rezervacie: "2 hours",
    };

    try {
      const res = await fetch("http://localhost:5000/api/book-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        alert("✅ Rezervácia bola vytvorená!");
        // update local state (mark as occupied)
        setRooms((prev) =>
          prev.map((r) =>
            r.miestnost_id === roomId ? { ...r, status: "occupied" } : r
          )
        );
      } else {
        alert(`❌ ${data.error || "Nepodarilo sa vytvoriť rezerváciu"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Chyba pripojenia k serveru");
    }
  };

  // 🔹 Render
  return (
    <div style={{ padding: "1rem" }}>
      <h2>Zoznam miestností</h2>

      {/* Date selector */}
      <div style={{ marginBottom: "1rem" }}>
        <label>
          Dátum:&nbsp;
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setFilter("all")}>Všetky</button>
        <button onClick={() => setFilter("free")}>Voľné</button>
        <button onClick={() => setFilter("occupied")}>Obsadené</button>
      </div>

      {loading ? (
        <p>Načítavam...</p>
      ) : (
        <table border="1" cellPadding="8" width="100%">
          <thead>
            <tr>
              <th>ID</th>
              <th>Číslo miestnosti</th>
              <th>Kapacita</th>
              <th>Poschodie</th>
              <th>Stav</th>
              <th>Rezervácia</th>
            </tr>
          </thead>
          <tbody>
            {filteredRooms.length > 0 ? (
              filteredRooms.map((r) => (
                <tr key={r.miestnost_id}>
                  <td>{r.miestnost_id}</td>
                  <td>{r.cislo_miestnosti}</td>
                  <td>{r.kapacita}</td>
                  <td>{r.poschodie}</td>
                  <td>{r.status === "free" ? "Voľná" : "Obsadená"}</td>
                  <td>
                    {r.status === "free" ? (
                      <button onClick={() => handleBook(r.miestnost_id)}>
                        Rezervovať
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">Žiadne miestnosti sa nenašli.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
