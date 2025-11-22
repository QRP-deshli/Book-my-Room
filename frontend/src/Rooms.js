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
  
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    
    let hours = now.getHours();
    let mins = roundedMinutes;
    
    if (mins >= 60) {
      hours += 1;
      mins = 0;
    }
    
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  });

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

  // 🔥 VÝPOČET NAJBLIŽŠIEHO VOĽNÉHO ČASU (len pre konkrétnu miestnosť)
  const calculateNextFreeSlotForRoom = (room, startTime, selectedDate) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    
    // Ak je vybraný minulý deň, nie je žiadny voľný slot
    if (selectedDate < today) return null;
    
    // Aktuálny čas alebo zadaný čas
    let currentTime = startTime;
    if (selectedDate === today) {
      const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (startTime < nowTime) {
        currentTime = nowTime;
      }
    }

    // Funkcia na kontrolu, či je čas voľný v danej miestnosti
    const isTimeFree = (time) => {
      const [h, m] = time.split(":").map(Number);
      const timeInMinutes = h * 60 + m;

      const reservations = room.allReservations || [];
      
      for (const res of reservations) {
        const [sh, sm] = res.start_time.split(":").map(Number);
        const [eh, em] = res.end_time.split(":").map(Number);
        
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;
        
        // Ak čas koliduje s rezerváciou
        if (timeInMinutes >= startMinutes && timeInMinutes < endMinutes) {
          return false;
        }
      }
      return true;
    };

    // Hľadaj najbližší voľný 15-min slot
    let [hours, minutes] = currentTime.split(":").map(Number);
    
    // Zaokrúhli na najbližších 15 minút
    minutes = Math.ceil(minutes / 15) * 15;
    if (minutes >= 60) {
      hours += 1;
      minutes = 0;
    }

    // Kontroluj každých 15 minút až do 23:45
    while (hours < 24) {
      const testTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      
      if (isTimeFree(testTime)) {
        return testTime;
      }
      
      minutes += 15;
      if (minutes >= 60) {
        hours += 1;
        minutes = 0;
      }
    }

    return null; // Žiadny voľný slot dnes
  };

  // FETCH ROOMS
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
        setSuggestedSlot(null); // Vynuluj - vypočíta sa neskôr
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedDate, startTime, search, token, location.key]);

  const filteredRooms = rooms.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  // 🔥 Vypočítaj next free slot len ak je presne 1 výsledok
  useEffect(() => {
    if (search && filteredRooms.length === 1) {
      const slot = calculateNextFreeSlotForRoom(filteredRooms[0], startTime, selectedDate);
      setSuggestedSlot(slot);
    } else {
      setSuggestedSlot(null);
    }
  }, [filteredRooms, startTime, selectedDate, search]);

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
  const handleCancel = async (room) => {
    const all = room.allReservations || [];

    if (all.length === 0) {
      alert("This room has no reservations for selected day.");
      return;
    }

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

      setRooms((prev) =>
        prev.map((r) =>
          r.room_id === room.room_id
            ? {
                ...r,
                status: r.allReservations.length - 1 > 0 ? "occupied" : "free",
                active_reservation_id:
                  r.allReservations.length - 1 > 0
                    ? r.allReservations[0].reservation_id
                    : null,
                allReservations: r.allReservations.filter(
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
  const blockPastTime = selectedDate === today && startTime < getMinTime();
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

      {/* Suggested slot - zobraz len ak je presne zadaná miestnosť */}
      {search && filteredRooms.length === 1 && suggestedSlot && (
        <div style={{ color: "green", marginBottom: "1rem" }}>
          Next free slot for <b>{filteredRooms[0].room_number}</b>: <b>{suggestedSlot}</b>
        </div>
      )}

      {search && filteredRooms.length === 1 && !suggestedSlot && selectedDate >= today && (
        <div style={{ color: "orange", marginBottom: "1rem" }}>
          No free slots available for <b>{filteredRooms[0].room_number}</b> today
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