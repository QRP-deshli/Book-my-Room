import { useEffect, useState } from "react";

export default function Rooms({ canBook = false, canDelete = false }) {
  const API_URL =
    process.env.REACT_APP_API_URL ||
    "https://book-my-room-pn00.onrender.com";

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

  // 🔥 Minimum allowed time
  const getMinTime = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate !== today) return "00:00";

    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
  };

  // Fetch rooms
  useEffect(() => {
    setLoading(true);

    fetch(
      `${API_URL}/api/rooms?date=${selectedDate}&time=${startTime}&search=${search}`,
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
  }, [selectedDate, startTime, search, token, API_URL]);

  const filteredRooms = rooms.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  // BOOK ROOM
  const handleBook = async (roomId, customTime = null) => {
    const bookingTime = customTime || startTime;

    if (
      !window.confirm(
        `Reserve room ${roomId} on ${selectedDate} at ${bookingTime} for ${duration}?`
      )
    )
      return;

    const body = {
      room_id: roomId,
      reservation_date: selectedDate,
      start_time: bookingTime,
      duration,
    };

    try {
      const res = await fetch(`${API_URL}/api/book-room`, {
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
            r.room_id === roomId
              ? {
                  ...r,
                  status: "occupied",
                  active_reservation_id: data.reservation_id,
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

  // CANCEL RESERVATION
  const handleCancel = async (room) => {
    if (!room.active_reservation_id) {
      alert("❌ No active reservation found");
      return;
    }

    try {
      const resInfo = await fetch(
        `${API_URL}/api/reservation/${room.active_reservation_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const info = await resInfo.json();
      if (!resInfo.ok) {
        alert(`❌ ${info.error || "Reservation not found"}`);
        return;
      }

      if (
        !window.confirm(
          `Cancel reservation for room ${info.room_number}\n` +
            `📅 Date: ${info.reservation_date}\n` +
            `⏰ Time: ${info.start_time}`
        )
      )
        return;

      const res = await fetch(
        `${API_URL}/api/cancel-reservation/${room.active_reservation_id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        alert("✅ Reservation canceled");
        setRooms((prev) =>
          prev.map((r) =>
            r.room_id === room.room_id
              ? { ...r, status: "free", active_reservation_id: null }
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

  // past-time lock
  const today = new Date().toISOString().slice(0, 10);
  const blockPastDate = selectedDate < today;
  const blockPastTime = selectedDate === today && startTime < getMinTime();
  const blockBooking = blockPastDate || blockPastTime;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Room Reservations</h2>

      {/* Search */}
      <div style={{ marginBottom: "1rem" }}>
        <label>
          🔍 Search:
          <input
            type="text"
            placeholder="e.g., A101"
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
            min={today}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          />
        </label>

        <label style={{ marginLeft: "1rem" }}>
          ⏰ Time:
          <input
            type="time"
            value={startTime}
            min={getMinTime()}
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

      {/* Next free slot */}
      {suggestedSlot && (
        <div style={{ marginBottom: "1rem", color: "green" }}>
          Next available slot: <b>{suggestedSlot}</b>
          {canBook && !blockBooking && (
            <button
              style={{ marginLeft: "0.5rem" }}
              onClick={() => handleBook(rooms[0].room_id, suggestedSlot)}
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
                <tr key={r.room_id}>
                  <td>{r.room_number}</td>
                  <td>{r.capacity}</td>
                  <td>{r.floor}</td>
                  <td>{r.status === "free" ? "Free" : "Occupied"}</td>
                  <td>
                    {r.status === "free" && canBook && !blockBooking && (
                      <button onClick={() => handleBook(r.room_id)}>
                        Book
                      </button>
                    )}

                    {r.status === "occupied" && canDelete && (
                      <button onClick={() => handleCancel(r)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5">No rooms found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
