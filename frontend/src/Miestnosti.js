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
  const [search, setSearch] = useState(""); // Room or address search input
  const [suggestedSlot, setSuggestedSlot] = useState(null); // Next free time suggestion

  // Fetch available rooms for a given date and time
  useEffect(() => {
    setLoading(true);
    fetch(
      `http://localhost:5000/api/rooms?date=${selectedDate}&time=${startTime}&search=${search}`
    )
      .then((res) => res.json())
      .then((data) => {
        setRooms(data.rooms || []);
        setSuggestedSlot(data.nextFreeSlot || null); // server may include suggestion
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedDate, startTime, search]);

  const filteredRooms = rooms.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

const handleBook = async (roomId, customTime = null) => {
  const bookingTime = customTime || startTime;
  const confirm = window.confirm(
    `Reserve room ${roomId} on ${selectedDate} at ${bookingTime} for ${duration}?`
  );
  if (!confirm) return;

  const body = {
    miestnost_id: roomId,
    uzivatel_id: 1, // test user ID
    datum_rezervacie: selectedDate,
    zaciatok_rezervacie: bookingTime,
    dlzka_rezervacie: duration,
  };

  try {
    const res = await fetch("http://localhost:5000/api/book-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok) {
      alert(`✅ Reservation confirmed at ${bookingTime}`);

      // ✅ Update the room immediately with new reservation info
      setRooms((prev) =>
        prev.map((r) =>
          r.miestnost_id === roomId
            ? {
                ...r,
                status: "occupied",
                active_rezervacia_id: data.rezervacia_id, // new line
              }
            : r
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


const handleCancel = async (room) => {
  if (!room.active_rezervacia_id) {
    alert("❌ No active reservation found for this room");
    return;
  }

  try {
    // 🔹 Get reservation info before confirming
    const resInfo = await fetch(
      `http://localhost:5000/api/reservation/${room.active_rezervacia_id}`
    );
    const info = await resInfo.json();

    if (!resInfo.ok) {
      alert(`❌ ${info.error || "Reservation not found"}`);
      return;
    }

    // 🔹 Show details to the user
    const confirm = window.confirm(
      `Cancel reservation for room ${info.cislo_miestnosti}\n` +
      `📅 Date: ${info.datum_rezervacie}\n` +
      `⏰ Start time: ${info.zaciatok_rezervacie}\n\n` +
      `Are you sure you want to cancel it?`
    );

    if (!confirm) return;

    // 🔹 Proceed to delete
    const res = await fetch(
      `http://localhost:5000/api/cancel-reservation/${room.active_rezervacia_id}`,
      { method: "DELETE" }
    );
    const data = await res.json();

    if (res.ok) {
      alert("✅ Reservation canceled");
      setRooms((prev) =>
        prev.map((r) =>
          r.miestnost_id === room.miestnost_id
            ? { ...r, status: "free", active_rezervacia_id: null }
            : r
        )
      );
    } else {
      alert(`❌ ${data.error || "Cancelation failed"}`);
    }
  } catch (err) {
    console.error(err);
    alert("Server connection error");
  }
};




  return (
    <div style={{ padding: "1rem" }}>
      <h2>Room Reservations</h2>

      {/* Search bar */}
      <div style={{ marginBottom: "1rem" }}>
        <label>
          🔍 Search room or address:
          <input
            type="text"
            placeholder="e.g., A101 or Main Street"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          />
        </label>
      </div>

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
        <option value="15 minutes">15 minutes</option>
        <option value="30 minutes">30 minutes</option>
        <option value="1 hour">1 hour</option>
        <option value="1.5 hours">1.5 hours</option>
        <option value="2 hours">2 hours</option>
        <option value="24 hours">Whole day</option>
        </select>
      </label>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setFilter("all")}>All</button>
        <button onClick={() => setFilter("free")}>Free</button>
        <button onClick={() => setFilter("occupied")}>Occupied</button>
      </div>

      {suggestedSlot && (
      <div style={{ marginBottom: "1rem", color: "green" }}>
        Next available slot for this room: <b>{suggestedSlot}</b>{" "}
        <button
        style={{ marginLeft: "0.5rem" }}
        onClick={() => handleBook(rooms[0].miestnost_id, suggestedSlot)}
        >
        Reserve this slot
        </button>
      </div>
    )}


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
              filteredRooms.map((r) => (
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
                    <>
                    <button onClick={() => handleCancel(r)}>Cancel</button>
                    </>
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
