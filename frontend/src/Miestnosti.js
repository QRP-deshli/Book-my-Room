import { useEffect, useState } from "react";

export default function Miestnosti() {
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState("1 hour");

  // Fetch available rooms for a given date and time
  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:5000/api/rooms?date=${selectedDate}&time=${startTime}`)
      .then(res => res.json())
      .then(data => setRooms(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedDate, startTime]);

  const filteredRooms = rooms.filter(r =>
    filter === "all" ? true : r.status === filter
  );

  // Create a reservation
  const handleBook = async (roomId) => {
    const confirm = window.confirm(
      `Reserve room ${roomId} on ${selectedDate} at ${startTime} for ${duration}?`
    );
    if (!confirm) return;

    const body = {
      miestnost_id: roomId,
      uzivatel_id: 1, // test user ID
      datum_rezervacie: selectedDate,
      zaciatok_rezervacie: startTime,
      dlzka_rezervacie: duration
    };

    try {
      const res = await fetch("http://localhost:5000/api/book-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ Reservation confirmed at ${startTime}`);
        setRooms(prev =>
          prev.map(r =>
            r.miestnost_id === roomId ? { ...r, status: "occupied" } : r
          )
        );
      } else {
        alert(`❌ ${data.error || "Reservation failed"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Server connection error");
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Room Reservations</h2>

      {/* Date & Time selection */}
      <div style={{ marginBottom: "1rem" }}>
        <label>
          📅 Date:
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          />
        </label>

        <label style={{ marginLeft: "1rem" }}>
          ⏰ Start time:
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          />
        </label>

        <label style={{ marginLeft: "1rem" }}>
          ⏳ Duration:
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          >
            <option value="30 minutes">30 minutes</option>
            <option value="1 hour">1 hour</option>
            <option value="2 hours">2 hours</option>
            <option value="3 hours">3 hours</option>
          </select>
        </label>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setFilter("all")}>All</button>
        <button onClick={() => setFilter("free")}>Free</button>
        <button onClick={() => setFilter("occupied")}>Occupied</button>
      </div>

      {/* Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table border="1" cellPadding="8" width="100%">
          <thead>
            <tr>
              <th>ID</th>
              <th>Room</th>
              <th>Capacity</th>
              <th>Floor</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRooms.length > 0 ? (
              filteredRooms.map(r => (
                <tr key={r.miestnost_id}>
                  <td>{r.miestnost_id}</td>
                  <td>{r.cislo_miestnosti}</td>
                  <td>{r.kapacita}</td>
                  <td>{r.poschodie}</td>
                  <td>{r.status === "free" ? "Free" : "Occupied"}</td>
                  <td>
                    {r.status === "free" ? (
                      <button onClick={() => handleBook(r.miestnost_id)}>Book</button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">No rooms found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
