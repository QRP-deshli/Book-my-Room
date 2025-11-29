import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Rooms({ canBook = false, canDelete = false }) {
  const API_URL = "http://localhost:5000";

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
    const [year, month, day] = serverDate.split("-");
    const [hours, minutes] = serverTime.split(":");
    const utcDate = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours) - 1,
      Number(minutes)
    ));
    const localDate = utcDate.toISOString().slice(0, 10);
    const localTime = `${String(utcDate.getHours()).padStart(2, "0")}:${String(
      utcDate.getMinutes()
    ).padStart(2, "0")}`;
    return { localDate, localTime };
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

  // NEXT FREE SLOT
  const calculateNextFreeSlotForRoom = (room, startTime, selectedDate) => {
    const today = getCurrentLocal().localDate;

    if (selectedDate < today) return null;

    let currentTime = startTime;
    if (selectedDate === today) {
      const now = getCurrentLocal().localTime;
      if (startTime < now) currentTime = now;
    }

    const isTimeFree = (time) => {
      const testEnd = calculateEndTime(time, duration);
      return !(room.allReservations || []).some((res) =>
        checkOverlap(time, testEnd, res.start_time, res.end_time)
      );
    };

    let [hours, minutes] = currentTime.split(":").map(Number);

    // NO ROUNDING FIXED
    while (hours < 24) {
      const testTime = `${String(hours).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}`;
      if (isTimeFree(testTime)) return testTime;

      // Keep stepping by 15 minutes (but without rounding the start!)
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

    const { serverDate, serverTime } = localToServer(selectedDate, startTime);

    fetch(
      `${API_URL}/api/rooms?date=${serverDate}&time=${serverTime}&search=${search}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((res) => res.json())
      .then((data) => {
        const processed = data.rooms.map((r) => {
          const allReservations = (r.all_reservations || []).map((res) => {
            const { localTime: s } = serverToLocal(serverDate, res.start_time);
            const { localTime: e } = serverToLocal(serverDate, res.end_time);
            return { ...res, start_time: s, end_time: e };
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
      .finally(() => setLoading(false));
  }, [selectedDate, startTime, duration, search, token]);

  const filteredRooms = rooms.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  useEffect(() => {
    if (search && filteredRooms.length === 1) {
      setSuggestedSlot(
        calculateNextFreeSlotForRoom(filteredRooms[0], startTime, selectedDate)
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

  const today = new Date().toISOString().slice(0, 10);
  const blockPastDate = selectedDate < today;
  const blockPastTime = selectedDate === today && startTime < getMinTime();
  const blockBooking = blockPastDate || blockPastTime;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Room Reservations</h2>

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
        <div style={{ color: "green", marginBottom: "1rem" }}>
          Next free slot for <b>{filteredRooms[0].room_number}</b>:{" "}
          <b>{suggestedSlot}</b>
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
