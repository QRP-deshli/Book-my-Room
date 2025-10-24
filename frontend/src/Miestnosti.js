import { useEffect, useState } from "react";

export default function Miestnosti() {
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("all");

  // 1. API call – načítanie miestností
  useEffect(() => {
    fetch("http://localhost:5000/api/rooms") // ← tu backend poskytuje JSON
      .then(res => res.json())
      .then(data => setRooms(data))
      .catch(err => console.error(err));
  }, []);

  // filtrácia (všetky / voľné / obsadené)
  const filteredRooms = rooms.filter(r =>
    filter === "all" ? true : r.status === filter
  );

  // ✅ 2. Akcia – rezervácia miestnosti
  const handleBook = (roomId) => {
    alert(`Klikol si na rezerváciu miestnosti s ID: ${roomId}`);
    // Tu POST /api/book-room
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Zoznam miestností</h2>

      {/* Filter */}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setFilter("all")}>Všetky</button>
        <button onClick={() => setFilter("free")}>Voľné</button>
        <button onClick={() => setFilter("occupied")}>Obsadené</button>
      </div>

      {/* Tabuľka */}
      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Číslo</th>
            <th>Kapacita</th>
            <th>Poschodie</th>
            <th>Stav</th>
            <th>Rezervácia</th>
          </tr>
        </thead>
        <tbody>
          {filteredRooms.map(r => (
            <tr key={r.miestnost_id}>
              <td>{r.cislo_miestnosti}</td>
              <td>{r.kapacita}</td>
              <td>{r.poschodie}</td>
              <td>{r.status}</td>
              <td>
                {r.status === "free" ? (
                  <button onClick={() => handleBook(r.miestnost_id)}>✅</button>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
