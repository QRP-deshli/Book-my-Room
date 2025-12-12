import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Rooms({ canBook = false, canDelete = false }) {
   const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://book-my-room-pn00.onrender.com";

  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(() => {
    const { localDate } = getCurrentLocal();
    return localDate;
  });

  const [startTime, setStartTime] = useState(() => {
    const { localTime } = getCurrentLocal();
    return localTime;
  });

  const [duration, setDuration] = useState("1 hour");
  const [search, setSearch] = useState("");
  const [suggestedSlot, setSuggestedSlot] = useState(null);

  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  // ===========================
  // FIXED: NO MORE ROUNDING TIME
  // ===========================
  function getCurrentLocal() {
    const now = new Date();
    const localDate = now.toISOString().slice(0, 10);
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const localTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    return { localDate, localTime };
  }

  // SERVER -> LOCAL
  const serverToLocal = (serverDate, serverTime) => {
    try {
      if (!serverDate || !serverTime) {
        console.error("Invalid date or time:", serverDate, serverTime);
        return { localDate: selectedDate, localTime: "00:00" };
      }

      const [year, month, day] = serverDate.split("-");
      const [hours, minutes] = serverTime.split(":");
      
      // Validate parsed values
      if (!year || !month || !day || !hours || !minutes) {
        console.error("Failed to parse date/time:", serverDate, serverTime);
        return { localDate: selectedDate, localTime: "00:00" };
      }

      const utcDate = new Date(Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours) - 1,
        Number(minutes)
      ));

      // Check if date is valid
      if (isNaN(utcDate.getTime())) {
        console.error("Invalid date created:", serverDate, serverTime);
        return { localDate: selectedDate, localTime: "00:00" };
      }

      const localDate = utcDate.toISOString().slice(0, 10);
      const localTime = `${String(utcDate.getHours()).padStart(2, "0")}:${String(
        utcDate.getMinutes()
      ).padStart(2, "0")}`;
      
      return { localDate, localTime };
    } catch (err) {
      console.error("Error in serverToLocal:", err, serverDate, serverTime);
      return { localDate: selectedDate, localTime: "00:00" };
    }
  };

  // LOCAL -> SERVER
  const localToServer = (localDate, localTime) => {
    const [year, month, day] = localDate.split("-");
    const [hours, minutes] = localTime.split(":");
    const localDateTime = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes)
    );
    const utcHours = localDateTime.getUTCHours();
    const utcMinutes = localDateTime.getUTCMinutes();
    const utcDate = localDateTime.getUTCDate();
    const utcMonth = localDateTime.getUTCMonth() + 1;
    const utcYear = localDateTime.getUTCFullYear();

    let serverHours = utcHours + 1;
    let serverDate = `${utcYear}-${String(utcMonth).padStart(2, "0")}-${String(
      utcDate
    ).padStart(2, "0")}`;

    if (serverHours >= 24) {
      serverHours -= 24;
      const nextDay = new Date(localDateTime);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      serverDate = nextDay.toISOString().slice(0, 10);
    }

    const serverTime = `${String(serverHours).padStart(2, "0")}:${String(
      utcMinutes
    ).padStart(2, "0")}`;

    return { serverDate, serverTime };
  };

  // DURATIONS
  const getDurationInMinutes = (dur) => {
    if (dur === "15 minutes") return 15;
    if (dur === "30 minutes") return 30;
    if (dur === "1 hour") return 60;
    if (dur === "1.5 hours") return 90;
    if (dur === "2 hours") return 120;
    if (dur === "24 hours") return 1440;
    return 60;
  };

  const calculateEndTimeInMinutes = (start, durationStr) => {
    const [h, m] = start.split(":").map(Number);
    return h * 60 + m + getDurationInMinutes(durationStr);
  };

  const calculateEndTime = (start, durationStr) => {
    const totalMinutes = calculateEndTimeInMinutes(start, durationStr);
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(
      2,
      "0"
    )}`;
  };



  // OVERLAP CHECK
  const checkOverlap = (start1, end1, start2, end2) => {
    const toMinutes = (t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    let s1 = toMinutes(start1);
    let e1 = toMinutes(end1);
    let s2 = toMinutes(start2);
    let e2 = toMinutes(end2);

    const crosses1 = e1 <= s1;
    const crosses2 = e2 <= s2;

    if (!crosses1 && !crosses2) return s1 < e2 && s2 < e1;

    if (crosses1) e1 += 1440;
    if (crosses2) e2 += 1440;

    return s1 < e2 && s2 < e1;
  };

  const getOverlappingReservations = (room) => {
    const requestedEnd = calculateEndTime(startTime, duration);
    return (room.allReservations || []).filter((res) =>
      checkOverlap(startTime, requestedEnd, res.start_time, res.end_time)
    );
  };

  // MIN TIME FOR TODAY
  const getMinTime = () => {
    const { localDate: today } = getCurrentLocal();
    if (selectedDate !== today) return "00:00";
    return getCurrentLocal().localTime;
  };

const calculateNextFreeSlotForRoom = (room, startTime, selectedDate) => {
  if (!room || !room.allReservations) return null;

  // Convert start time
  const [h, m] = startTime.split(":").map(Number);
  const desiredStart = h * 60 + m;
  const durationMin = getDurationInMinutes(duration);

  // Convert reservations → minutes, handle midnight crossing
  const reservations = room.allReservations
    .map((r) => {
      const [sh, sm] = r.start_time.split(":").map(Number);
      const [eh, em] = r.end_time.split(":").map(Number);
      let start = sh * 60 + sm;
      let end = eh * 60 + em;
      
      // If end crosses midnight
      if (end < start) {
        end += 1440;
      }
      
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);

  let current = desiredStart;

  for (const r of reservations) {
    // Check if we can fit before this reservation
    if (current + durationMin <= r.start) {
      return minutesToTime(current);
    }
    // Move current to end of this reservation if it blocks us
    if (current < r.end) {
      current = r.end;
    }
  }

  // Check if final slot fits in the day (before midnight + 1440)
  if (current + durationMin <= 1440) {
    return minutesToTime(current);
  }

  return null; // No slot available today
};

function minutesToTime(m) {
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}


  // FETCH ROOMS
  useEffect(() => {
    setLoading(true);

    const { serverDate, serverTime } = localToServer(selectedDate, startTime);

    fetch(
      `${API_URL}/api/rooms?date=${serverDate}&time=${serverTime}&search=${search}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((res) => res.json())
      .then((data) => {
        console.log("API Response:", data); // Debug log
        
        const processed = data.rooms.map((r) => {
          const allReservations = (r.all_reservations || []).map((res) => {
            // Use the query date if reservation_date is not provided
            const resDate = res.reservation_date || serverDate;
            
            console.log("Processing reservation:", res); // Debug log
            
            // Convert both start and end times with their dates
            const startConverted = serverToLocal(resDate, res.start_time);
            const endConverted = serverToLocal(resDate, res.end_time);
            
            return { 
              ...res, 
              start_time: startConverted.localTime, 
              end_time: endConverted.localTime,
              start_date: startConverted.localDate,
              end_date: endConverted.localDate
            };
          }).filter((res) => {
            // Only include reservations that overlap with selected date
            return res.start_date === selectedDate || res.end_date === selectedDate;
          });

          const requestedEnd = calculateEndTime(startTime, duration);
          const hasOverlap = allReservations.some((res) =>
            checkOverlap(startTime, requestedEnd, res.start_time, res.end_time)
          );

          return {
            ...r,
            allReservations,
            status: hasOverlap ? "occupied" : "free",
          };
        });

        setRooms(processed);
        setSuggestedSlot(null);
      })
      .catch((err) => {
        console.error("Error loading rooms:", err);
        setRooms([]);
      })
      .finally(() => setLoading(false));
  }, [selectedDate, startTime, duration, search, token]);

  const filteredRooms = rooms.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  useEffect(() => {
  if (
    search &&
    filteredRooms.length === 1 &&
    filteredRooms[0].status === "occupied"
  ) {
    setSuggestedSlot(
      calculateNextFreeSlotForRoom(
        filteredRooms[0],
        startTime,
        selectedDate
      )
    );
  } else {
    setSuggestedSlot(null);
  }
}, [filteredRooms, startTime, selectedDate, search, duration]);


  

  const handleBook = async (roomId, customTime = null, customDate = null) => {
    const bookingTime = customTime || startTime;
    const bookingDate = customDate || selectedDate;

    if (
      !window.confirm(
        `Reserve room ${roomId} on ${bookingDate} at ${bookingTime} for ${duration}?`
      )
    )
      return;

    const { serverDate, serverTime } = localToServer(bookingDate, bookingTime);

    const body = {
      room_id: roomId,
      reservation_date: serverDate,
      start_time: serverTime,
      duration,
    };

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
      window.location.reload();
    } else {
      alert(data.error || "Reservation failed");
    }
  };

    // CANCEL
  const handleCancel = async (room) => {
    const overlapping = getOverlappingReservations(room);

    if (overlapping.length === 0) {
      alert("No reservations overlap with the selected time.");
      return;
    }

    let msg = `Found ${overlapping.length} overlapping reservation(s):\n\n`;
    overlapping.forEach((r, i) => {
      msg += `${i + 1}) ${r.start_time} - ${r.end_time}\n`;
    });
    
    if (overlapping.length === 1) {
      msg += "\nCancel this reservation?";
      const ok = window.confirm(msg);
      if (!ok) return;
      
      await cancelReservation(overlapping[0], room);
    } else {
      msg += "\nOptions:\n";
      msg += "- Enter number(s) separated by comma (e.g., 1,3)\n";
      msg += "- Enter 'all' to cancel all\n";
      msg += "- Click Cancel to abort";
      
      const input = prompt(msg);
      if (!input) return;

      let toCancelIndices = [];
      
      if (input.toLowerCase().trim() === "all") {
        toCancelIndices = overlapping.map((_, i) => i);
      } else {
        const parts = input.split(",").map(s => s.trim());
        for (const part of parts) {
          const idx = parseInt(part) - 1;
          if (!isNaN(idx) && idx >= 0 && idx < overlapping.length) {
            toCancelIndices.push(idx);
          }
        }
      }

      if (toCancelIndices.length === 0) {
        alert("Invalid selection.");
        return;
      }

      const confirmMsg = `Cancel ${toCancelIndices.length} reservation(s)?`;
      if (!window.confirm(confirmMsg)) return;

      for (const idx of toCancelIndices) {
        await cancelReservation(overlapping[idx], room);
      }
    }

    // Refresh after cancellation
    window.location.reload();
  };

  const cancelReservation = async (reservation, room) => {
    try {
      const res = await fetch(
        `${API_URL}/api/cancel-reservation/${reservation.reservation_id}`,
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
        return false;
      }

      return true;
    } catch (err) {
      console.error(err);
      alert("Server error.");
      return false;
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const blockPastDate = selectedDate < today;
  const blockPastTime = selectedDate === today && startTime < getMinTime();
  const blockBooking = blockPastDate || blockPastTime;

    // Get timezone info for display
  const getTimezoneDisplay = () => {
    try {
      const localOffset = new Date().getTimezoneOffset();
      const bratislavaOffset = -60; // Bratislava is UTC+1 (offset in minutes, negative means ahead)
      
      if (localOffset === bratislavaOffset) {
        return null; // Same timezone, no need to show
      }
      
      const offsetHours = Math.abs(localOffset / 60);
      const offsetSign = localOffset > 0 ? "-" : "+";
      
      return `Times shown in your local timezone (UTC${offsetSign}${offsetHours}). Server uses Europe/Bratislava (UTC+1).`;
    } catch (error) {
      return null;
    }
  };


  return (
    <div style={{ padding: "1rem" }}>
      <h2>Room Reservations</h2>

       {/* Timezone info */}
      {getTimezoneDisplay() && (
        <div style={{ 
          backgroundColor: "#f0f8ff", 
          padding: "0.5rem", 
          marginBottom: "1rem", 
          borderRadius: "4px",
          fontSize: "0.9em",
          color: "#555"
        }}>
            {getTimezoneDisplay()}
        </div>
      )}


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
            step="300"
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

      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setFilter("all")}>All</button>
        <button onClick={() => setFilter("free")}>Free</button>
        <button onClick={() => setFilter("occupied")}>Occupied</button>
      </div>

      {search && filteredRooms.length === 1 && suggestedSlot && (
        <div style={{ color: "green", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <span>
            Next free slot for <b>{filteredRooms[0].room_number}</b>:{" "}
            <b>{suggestedSlot}</b>
          </span>
          {canBook && !blockBooking && (
            <button 
              onClick={() => handleBook(filteredRooms[0].room_id, suggestedSlot, selectedDate)}
              style={{ padding: "0.5rem 1rem" }}
            >
              Book at {suggestedSlot}
            </button>
          )}
        </div>
      )}

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
            {filteredRooms.map((r) => {
              const overlapping = getOverlappingReservations(r);
              return (
                <tr key={r.room_id}>
                  <td>{r.room_number}</td>
                  <td>{r.capacity}</td>
                  <td>{r.floor}</td>
                  <td>
                    {r.status}
                    {overlapping.length > 0 && (
                      <span style={{ fontSize: "0.8em", color: "#666" }}>
                        ({overlapping.length} overlap)
                      </span>
                    )}
                  </td>

                  <td>
                    {r.status === "free" && canBook && !blockBooking && (
                      <button onClick={() => handleBook(r.room_id)}>Book</button>
                    )}
                    {overlapping.length > 0 && canDelete && (
                      <button onClick={() => handleCancel(r)}>Cancel</button>
                    )}

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
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}