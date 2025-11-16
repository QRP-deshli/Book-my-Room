import { useEffect, useState } from "react";

export default function Miestnosti({ canBook = false, canDelete = false }) {
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState("09:00");

  const [duration, setDuration] = useState("1 hour");
  const [search, setSearch] = useState("");
  const [suggestedSlot, setSuggestedSlot] = useState(null);

  const token = localStorage.getItem("token");

  // ------------------------------------------------------------------------------------
  // 🔥 Funkcia: MIN čas (blokuje čas v minulosti, ak je vybraný dnešný dátum)
  // ------------------------------------------------------------------------------------
  const getMinTime = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate !== today) return "00:00";

    const now = new Date();
    const h = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  // ------------------------------------------------------------------------------------
  // Fetch rooms
  // ------------------------------------------------------------------------------------
  useEffect(() => {
    setLoading(true);
    fetch(
      `http://localhost:5000/api/rooms?date=${selectedDate}&time=${startTime}&search=${search}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRooms(data);
        } else {
          setRooms(data.rooms || []);
          setSuggestedSlot(data.nextFreeSlot || null);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedDate, startTime, search, token]);

  const filteredRooms = rooms.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  // ------------------------------------------------------------------------------------
  // Rezervácia
  // ------------------------------------------------------------------------------------
  const handleBook = async (roomId, customTime = null) => {
    const bookingTime = customTime || startTime;

    const confirm = window.confirm(
      `Reserve room ${roomId} on ${selectedDate} at ${bookingTime} for ${duration}?`
    );
    if (!confirm) return;

    const body = {
      miestnost_id: roomId,
      datum_rezervacie: selectedDate,
      zaciatok_rezervacie: bookingTime,
      dlzka_rezervacie: duration,
    };

    try {
      const res = await fetch("http://localhost:5000/api/book-room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ Reservation confirmed at ${bookingTime}`);
        setRooms((prev) =>
          prev.map((r) =>
            r.miestnost_id === roomId
              ? { ...r, status: "occupied", active_rezervacia_id: data.rezervacia_id }
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

  // ------------------------------------------------------------------------------------
  // Zrušenie rezervácie
  // ------------------------------------------------------------------------------------
  const handleCancel = async (room) => {
    if (!room.active_rezervacia_id) {
      alert("❌ No active reservation found for this room");
      return;
    }

    try {
      const resInfo = await fetch(
        `http://localhost:5000/api/reservation/${room.active_rezervacia_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const info = await resInfo.json();

      if (!resInfo.ok) {
        alert(`❌ ${info.error || "Reservation not found"}`);
        return;
      }

      const confirm = window.confirm(
        `Cancel reservation for room ${info.cislo_miestnosti}\n` +
          `📅 Date: ${info.datum_rezervacie}\n` +
          `⏰ Start time: ${info.zaciatok_rezervacie}\n\n` +
          `Are you sure?`
      );
      if (!confirm) return;

      const res = await fetch(
        `http://localhost:5000/api/cancel-reservation/${room.active_rezervacia_id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );

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
        const data = await res.json();
        alert(`❌ ${data.error || "Cancelation failed"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Server connection error");
    }
  };

  // ------------------------------------------------------------------------------------
  // BLOKOVANIE BOOK tlačidla → minulosť
  // ------------------------------------------------------------------------------------
  const nowDate = new Date().toISOString().slice(0, 10);
  const isPastDate = selectedDate < nowDate;
  const isPastTime =
    selectedDate === nowDate && startTime < getMinTime();

  const blockBooking = isPastDate || isPastTime;

  // ------------------------------------------------------------------------------------

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Room Reservations</h2>

      {/* Search */}
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

      {/* Date & Time */}
      <div style={{ marginBottom: "1rem" }}>
        <label>
          📅 Date:
          <input
            type="date"
            value={selectedDate}
            min={nowDate}           // 🔥 BLOK DÁTUMU
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          />
        </label>

        <label style={{ marginLeft: "1rem" }}>
          ⏰ Start time:
          <input
            type="time"
            value={startTime}
            min={getMinTime()}     // 🔥 BLOK ČASU
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

      {/* Filter */}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setFilter("all")}>All</button>
        <button onClick={() => setFilter("free")}>Free</button>
        <button onClick={() => setFilter("occupied")}>Occupied</button>
      </div>

      {/* Suggested slot */}
      {suggestedSlot && (
        <div style={{ marginBottom: "1rem", color: "green" }}>
          Next available slot: <b>{suggestedSlot}</b>
          {canBook && !blockBooking && (
            <button
              style={{ marginLeft: "0.5rem" }}
              onClick={() => handleBook(rooms[0].miestnost_id, suggestedSlot)}
            >
              Reserve this slot
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table border="1" cellPadding="8" width="100%">
          <thead>
            <tr>
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
                  <td>{r.cislo_miestnosti}</td>
                  <td>{r.kapacita}</td>
                  <td>{r.poschodie}</td>
                  <td>{r.status === "free" ? "Free" : "Occupied"}</td>

                  <td>
                    {/* BOOK tlačidlo → blokované pre minulosť */}
                    {r.status === "free" && canBook && !blockBooking && (
                      <button onClick={() => handleBook(r.miestnost_id)}>
                        Book
                      </button>
                    )}

                    {/* CANCEL */}
                    {r.status === "occupied" && canDelete && (
                      <button onClick={() => handleCancel(r)}>Cancel</button>
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
