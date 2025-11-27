import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Rooms({ canBook = false, canDelete = false }) {
  const API_URL = "http://localhost:5000";
  
  // Server timezone (Bratislava = UTC+1, but respects DST)
  const SERVER_TIMEZONE = "Europe/Bratislava";

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

  // ===== TIMEZONE CONVERSION HELPERS =====
  
  // Helper to get current local date and time
  function getCurrentLocal() {
    const now = new Date();
    const localDate = now.toISOString().slice(0, 10);
    
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    let hours = now.getHours();
    let mins = roundedMinutes;

    if (mins >= 60) {
      hours += 1;
      mins = 0;
    }

    const localTime = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    
    return { localDate, localTime };
  }
  
  // Convert server date+time (Bratislava) to local date+time
  const serverToLocal = (serverDate, serverTime) => {
    // Simple approach: treat server time as UTC+1 and convert to local
    const [year, month, day] = serverDate.split("-");
    const [hours, minutes] = serverTime.split(":");
    
    // Create UTC date (server is UTC+1, so subtract 1 hour to get UTC)
    const utcDate = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours) - 1, // Bratislava is UTC+1
      parseInt(minutes)
    ));
    
    // Convert to local
    const localDate = utcDate.toISOString().slice(0, 10);
    const localHours = utcDate.getHours();
    const localMinutes = utcDate.getMinutes();
    const localTime = `${String(localHours).padStart(2, "0")}:${String(localMinutes).padStart(2, "0")}`;
    
    return { localDate, localTime };
  };

  // Convert local date+time to server date+time (Bratislava)
  const localToServer = (localDate, localTime) => {
    // Create local date object
    const [year, month, day] = localDate.split("-");
    const [hours, minutes] = localTime.split(":");
    
    const localDateTime = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    );
    
    // Get UTC time
    const utcHours = localDateTime.getUTCHours();
    const utcMinutes = localDateTime.getUTCMinutes();
    const utcDate = localDateTime.getUTCDate();
    const utcMonth = localDateTime.getUTCMonth() + 1;
    const utcYear = localDateTime.getUTCFullYear();
    
    // Convert UTC to Bratislava (UTC+1)
    let serverHours = utcHours + 1;
    let serverDate = `${utcYear}-${String(utcMonth).padStart(2, "0")}-${String(utcDate).padStart(2, "0")}`;
    
    // Handle day overflow
    if (serverHours >= 24) {
      serverHours -= 24;
      const nextDay = new Date(localDateTime);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      serverDate = nextDay.toISOString().slice(0, 10);
    }
    
    const serverTime = `${String(serverHours).padStart(2, "0")}:${String(utcMinutes).padStart(2, "0")}`;
    
    return { serverDate, serverTime };
  };

  // ===== END TIMEZONE HELPERS =====

  // Convert duration to minutes
  const getDurationInMinutes = (dur) => {
    if (dur === "15 minutes") return 15;
    if (dur === "30 minutes") return 30;
    if (dur === "1 hour") return 60;
    if (dur === "1.5 hours") return 90;
    if (dur === "2 hours") return 120;
    if (dur === "24 hours") return 1440;
    return 60;
  };

  // Calculate end time based on start time and duration (returns total minutes for proper comparison)
  const calculateEndTimeInMinutes = (start, durationStr) => {
    const [h, m] = start.split(":").map(Number);
    return h * 60 + m + getDurationInMinutes(durationStr);
  };

  // Calculate end time based on start time and duration (returns time string)
  const calculateEndTime = (start, durationStr) => {
    const totalMinutes = calculateEndTimeInMinutes(start, durationStr);
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
  };

  // Check if two time ranges overlap (handles times crossing midnight)
  const checkOverlap = (start1, end1, start2, end2) => {
    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    let s1 = toMinutes(start1);
    let e1 = toMinutes(end1);
    let s2 = toMinutes(start2);
    let e2 = toMinutes(end2);

    // Normalize ranges that cross midnight
    const crosses1 = e1 <= s1;
    const crosses2 = e2 <= s2;

    if (!crosses1 && !crosses2) {
      // Neither crosses midnight - simple case
      // Overlap only if one starts BEFORE the other ends (not AT)
      // 23:15-23:35 and 23:35-23:50 should NOT overlap (adjacent is OK)
      return s1 < e2 && s2 < e1;
    } else if (crosses1 && !crosses2) {
      // Range 1 crosses midnight
      e1 += 1440;
      // If range 2 is in the late evening (near range 1 start), check normally
      // If range 2 is in early morning (near range 1 end), add 1440 to it
      if (s2 >= s1) {
        // Late evening comparison
        return s2 < e1 && s1 < e2;
      } else {
        // Early morning comparison
        return (s2 + 1440) < e1 && s1 < (e2 + 1440);
      }
    } else if (!crosses1 && crosses2) {
      // Range 2 crosses midnight
      e2 += 1440;
      if (s1 >= s2) {
        // Late evening comparison
        return s1 < e2 && s2 < e1;
      } else {
        // Early morning comparison
        return (s1 + 1440) < e2 && s2 < (e1 + 1440);
      }
    } else {
      // Both cross midnight - they always overlap
      return true;
    }
  };

  // Get overlapping reservations for selected time
  const getOverlappingReservations = (room) => {
    const requestedEnd = calculateEndTime(startTime, duration);
    const reservations = room.allReservations || [];
    
    return reservations.filter((res) =>
      checkOverlap(startTime, requestedEnd, res.start_time, res.end_time)
    );
  };

  // MIN TIME
  const getMinTime = () => {
    const { localDate: today } = getCurrentLocal();
    if (selectedDate !== today) return "00:00";

    const { localTime } = getCurrentLocal();
    return localTime;
  };

  // Calculate next free slot for room
  const calculateNextFreeSlotForRoom = (room, startTime, selectedDate) => {
    const { localDate: today } = getCurrentLocal();

    if (selectedDate < today) return null;

    let currentTime = startTime;
    if (selectedDate === today) {
      const { localTime: nowTime } = getCurrentLocal();
      if (startTime < nowTime) {
        currentTime = nowTime;
      }
    }

    const isTimeFree = (time) => {
      const testEnd = calculateEndTime(time, duration);
      const reservations = room.allReservations || [];
      
      for (const res of reservations) {
        if (checkOverlap(time, testEnd, res.start_time, res.end_time)) {
          return false;
        }
      }
      return true;
    };

    let [hours, minutes] = currentTime.split(":").map(Number);
    minutes = Math.ceil(minutes / 15) * 15;
    if (minutes >= 60) {
      hours += 1;
      minutes = 0;
    }

    while (hours < 24) {
      const testTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}`;

      if (isTimeFree(testTime)) return testTime;

      minutes += 15;
      if (minutes >= 60) {
        hours += 1;
        minutes = 0;
      }
    }

    return null;
  };

  // FETCH ROOMS
  useEffect(() => {
    setLoading(true);

    // Convert local time to server time for the API request
    const { serverDate, serverTime } = localToServer(selectedDate, startTime);

    fetch(
      `${API_URL}/api/rooms?date=${serverDate}&time=${serverTime}&search=${search}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((res) => res.json())
      .then((data) => {
        let processed = data.rooms.map((r) => {
          // Convert all reservation times from server to local
          const allReservations = (r.all_reservations || []).map((res) => {
            const { localTime: localStartTime } = serverToLocal(serverDate, res.start_time);
            const { localTime: localEndTime } = serverToLocal(serverDate, res.end_time);
            
            return {
              ...res,
              start_time: localStartTime,
              end_time: localEndTime,
            };
          });
          
          const requestedEnd = calculateEndTime(startTime, duration);
          
          // Determine status based on overlap with selected time
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
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedDate, startTime, duration, search, token]);

  const filteredRooms = rooms.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  // Calculate next free slot if exactly 1 result
  useEffect(() => {
    if (search && filteredRooms.length === 1) {
      const slot = calculateNextFreeSlotForRoom(
        filteredRooms[0],
        startTime,
        selectedDate
      );
      setSuggestedSlot(slot);
    } else {
      setSuggestedSlot(null);
    }
  }, [filteredRooms, startTime, selectedDate, search, duration]);

  // BOOK
  const handleBook = async (roomId, customTime = null, customDate = null) => {
    const bookingTime = customTime || startTime;
    const bookingDate = customDate || selectedDate;

    const confirm = window.confirm(
      `Reserve room ${roomId} on ${bookingDate} at ${bookingTime} (local time) for ${duration}?`
    );
    if (!confirm) return;

    // Convert local time to server time
    const { serverDate, serverTime } = localToServer(bookingDate, bookingTime);

    const body = {
      room_id: roomId,
      reservation_date: serverDate,
      start_time: serverTime,
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
        // Refresh the rooms to get updated status
        window.location.reload();
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
          ℹ️ {getTimezoneDisplay()}
        </div>
      )}

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
                      <span style={{ fontSize: "0.8em", color: "#666", marginLeft: "0.5rem" }}>
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