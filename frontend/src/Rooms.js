import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Rooms({ canBook = false, canDelete = false }) {
  const API_URL = "http://localhost:5000";

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
  const navigate = useNavigate();
  const location = useLocation();

  // MIN TIME
  const getMinTime = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate !== today) return "00:00";

    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
  };

  // FETCH ROOMS - PRIDANÝ location.key do dependencies
  useEffect(() => {
    setLoading(true);

    fetch(
      `${API_URL}/api/rooms?date=${selectedDate}&time=${startTime}&search=${search}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((res) => res.json())
      .then((data) => {
        let processed = data.rooms.map(r => ({
          ...r,
          allReservations: r.all_reservations || []
        }));

        setRooms(processed);
        setSuggestedSlot(data.nextFreeSlot || null);
      })

      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedDate, startTime, search, token, location.key]); // 🔥 location.key spôsobí refresh

  const filteredRooms = rooms.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  // BOOK
  const handleBook = async (roomId, customTime = null, customDate = null) => {
    const bookingTime = customTime || startTime;
    const bookingDate = customDate || selectedDate;

    const confirm = window.confirm(
      `Reserve room ${roomId} on ${bookingDate} at ${bookingTime} for ${duration}?`
    );
    if (!confirm) return;

    const body = {
      room_id: roomId,
      reservation_date: bookingDate,
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
        alert(`Reservation confirmed at ${bookingTime}`);
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
        alert(`${data.error || "Reservation failed"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Server connection error");
    }
  };

  // CANCEL
  /*const handleCancel = async (room) => {
    if (!room.active_reservation_id) {
      alert("No active reservation found");
      return;
    }

    try {
      const resInfo = await fetch(
        `${API_URL}/api/reservation/${room.active_reservation_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const info = await resInfo.json();
      if (!resInfo.ok) {
        alert(`${info.error || "Reservation not found"}`);
        return;
      }

      const confirm = window.confirm(
        `Cancel reservation for room ${info.room_number}\nDate: ${info.reservation_date}\nStart: ${info.start_time}`
      );
      if (!confirm) return;

      const res = await fetch(
        `${API_URL}/api/cancel-reservation/${room.active_reservation_id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        alert("Reservation canceled");
        setRooms((prev) =>
          prev.map((r) =>
            r.room_id === room.room_id
              ? { ...r, status: "free", active_reservation_id: null }
              : r
          )
        );
      } else {
        const data = await res.json();
        alert(`${data.error || "Cancellation failed"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Server connection error");
    }
  };*/

  // CANCEL
  const handleCancel = async (room) => {
  const all = room.all_reservations || [];

  if (all.length === 0) {
    alert("This room has no reservations for selected day.");
    return;
  }

  // Výpis rezervácií
  let msg = "Which reservation do you want to cancel?\n\n";
  all.forEach((r, i) => {
    msg += `${i + 1}) ${r.start_time} - ${r.end_time}\n`;
  });
  msg += "\nEnter number:";

  const input = prompt(msg);
  if (!input) return;

  const index = parseInt(input) - 1;
  if (isNaN(index) || index < 0 || index >= all.length) {
    alert("Invalid selection.");
    return;
  }

  const chosen = all[index];

  // Potvrdenie
  const ok = window.confirm(
    `Cancel reservation?\n\nRoom: ${room.room_number}\nTime: ${chosen.start_time} - ${chosen.end_time}`
  );
  if (!ok) return;

  try {
    const res = await fetch(
      `${API_URL}/api/cancel-reservation/${chosen.reservation_id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Cancellation failed");
      return;
    }

    alert("Reservation canceled");

    // Lokálny update tabuľky
    setRooms((prev) =>
      prev.map((r) =>
        r.room_id === room.room_id
          ? {
              ...r,
              status: r.all_reservations.length - 1 > 0 ? "occupied" : "free",
              active_reservation_id:
                r.all_reservations.length - 1 > 0
                  ? r.all_reservations[0].reservation_id
                  : null,
              all_reservations: r.all_reservations.filter(
                (x) => x.reservation_id !== chosen.reservation_id
              ),
            }
          : r
      )
    );
  } catch (err) {
    console.error(err);
    alert("Server error.");
  }
};


  const today = new Date().toISOString().slice(0, 10);
  const blockPastDate = selectedDate < today;
  const blockPastTime =
    selectedDate === today && startTime < getMinTime();
  const blockBooking = blockPastDate || blockPastTime;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Room Reservations</h2>

      {/* Search */}
      <div>
        <label>
          Search:
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          />
        </label>
      </div>

      {/* Date & Time */}
      <div style={{ margin: "1rem 0" }}>
        <label>
          Date:
          <input
            type="date"
            value={selectedDate}
            min={today}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          />
        </label>

        <label style={{ marginLeft: "1rem" }}>
          Time:
          <input
            type="time"
            value={startTime}
            min={getMinTime()}
            onChange={(e) => setStartTime(e.target.value)}
            style={{ marginLeft: "0.5rem" }}
          />
        </label>

        <label style={{ marginLeft: "1rem" }}>
          Duration:
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
        <div style={{ color: "green" }}>
          Next free slot: <b>{suggestedSlot}</b>
        </div>
      )}

      {/* TABLE */}
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
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRooms.map((r) => (
              <tr key={r.room_id}>
                <td>{r.room_number}</td>
                <td>{r.capacity}</td>
                <td>{r.floor}</td>
                <td>{r.status}</td>

                <td>
                  {/* Book */}
                  {r.status === "free" && canBook && !blockBooking && (
                    <button onClick={() => handleBook(r.room_id)}>Book</button>
                  )}

                  {/* Cancel */}
                  {r.status === "occupied" && canDelete && (
                    <button onClick={() => handleCancel(r)}>Cancel</button>
                  )}

                  {/* Schedule */}
                  <button
                    style={{ marginLeft: "0.5rem" }}
                    onClick={() =>
                      navigate(`/schedule/${r.room_id}?date=${selectedDate}`)
                    }
                  >
                    Schedule
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}