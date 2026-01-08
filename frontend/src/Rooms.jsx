import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TimeSelector from "./TimeSelector.jsx";

export default function Rooms({ canBook = false, canDelete = false, userBuilding = null }) {
  const API_URL = import.meta.env.VITE_API_URL || "https://book-my-room-pn00.onrender.com";
  
  const CLIENT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("all");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [overlappingReservations, setOverlappingReservations] = useState([]);
  const [selectedReservationIds, setSelectedReservationIds] = useState(new Set());
  const [suggestedSlot, setSuggestedSlot] = useState(null);
  
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    const h = now.getHours();
    const m = Math.ceil(now.getMinutes() / 5) * 5;
    
    if (m >= 60) {
      return "00:00";
    }
    
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });
  
  const [duration, setDuration] = useState("1 hour");
  const [search, setSearch] = useState("");
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const getDurationInMinutes = (dur) => {
    const map = {
      "15 minutes": 15,
      "30 minutes": 30,
      "1 hour": 60,
      "1.5 hours": 90,
      "2 hours": 120,
      "24 hours": 1440,
    };
    return map[dur] || 60;
  };

  const calculateEndTime = (start, dur) => {
    const [h, m] = start.split(":").map(Number);
    const totalMinutes = h * 60 + m + getDurationInMinutes(dur);
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  };

  // ✅ NEW: Check if booking crosses midnight
  const bookingCrossesMidnight = (start, dur) => {
    const [h, m] = start.split(":").map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + getDurationInMinutes(dur);
    return endMinutes >= 1440; // Crosses midnight if >= 24 hours
  };

  // ✅ NEW: Get next date
  const getNextDate = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };

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

    if (!crosses1 && !crosses2) {
      return s1 < e2 && s2 < e1;
    }

    if (crosses1) e1 += 1440;
    if (crosses2) e2 += 1440;

    return s1 < e2 && s2 < e1;
  };

  const calculateNextFreeSlotForRoom = (room, startTime, selectedDate) => {
    const today = new Date().toISOString().slice(0, 10);

    if (selectedDate < today) return null;

    let currentTime = startTime;
    if (selectedDate === today) {
      const now = new Date();
      const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (startTime < nowTime) currentTime = nowTime;
    }

    const isTimeFree = (time) => {
      const testEnd = calculateEndTime(time, duration);
      return !(room.reservations || []).some((res) => {
        return checkOverlap(time, testEnd, res.local_start_time, res.local_end_time);
      });
    };

    let [hours, minutes] = currentTime.split(":").map(Number);

    while (hours < 24) {
      const testTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      if (isTimeFree(testTime)) return testTime;

      minutes += 15;
      if (minutes >= 60) {
        hours += 1;
        minutes = 0;
      }
    }
    return null;
  };

  // ✅ UPDATED: Fetch rooms with reservations from current AND next day if needed
  useEffect(() => {
    setLoading(true);

    const crossesMidnight = bookingCrossesMidnight(startTime, duration);
    const nextDate = crossesMidnight ? getNextDate(selectedDate) : null;

    // Fetch current day
    const fetchCurrentDay = fetch(
      `${API_URL}/api/rooms?localDate=${selectedDate}&localTime=${startTime}&search=${search}&clientTz=${CLIENT_TIMEZONE}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(res => res.json());

    // Fetch next day if crossing midnight
    const fetchNextDay = crossesMidnight
      ? fetch(
          `${API_URL}/api/rooms?localDate=${nextDate}&localTime=00:00&search=${search}&clientTz=${CLIENT_TIMEZONE}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(res => res.json())
      : Promise.resolve(null);

    Promise.all([fetchCurrentDay, fetchNextDay])
      .then(([currentData, nextData]) => {
        if (!currentData || !currentData.rooms) {
          console.error("Invalid response:", currentData);
          setRooms([]);
          return;
        }

        // Merge reservations from both days
        const processed = currentData.rooms.map((room) => {
          let allReservations = [...(room.reservations || [])];

          // Add next day reservations if we're crossing midnight
          if (nextData && nextData.rooms) {
            const nextDayRoom = nextData.rooms.find(r => r.room_id === room.room_id);
            if (nextDayRoom && nextDayRoom.reservations) {
              // Tag next day reservations
              const nextDayReservations = nextDayRoom.reservations.map(res => ({
                ...res,
                is_next_day: true,
                display_date: nextDate
              }));
              allReservations = [...allReservations, ...nextDayReservations];
            }
          }

          const requestedEnd = calculateEndTime(startTime, duration);
          
          const hasOverlap = allReservations.some((res) => {
            if (res.is_next_day) {
              // For next day reservations, check if they overlap with the portion after midnight
              const bookingEndTime = calculateEndTime(startTime, duration);
              const bookingCrosses = bookingCrossesMidnight(startTime, duration);
              
              if (!bookingCrosses) return false;
              
              // The booking continues into next day from 00:00 to bookingEndTime
              return checkOverlap("00:00", bookingEndTime, res.local_start_time, res.local_end_time);
            } else {
              return checkOverlap(startTime, requestedEnd, res.local_start_time, res.local_end_time);
            }
          });

          return {
            ...room,
            reservations: allReservations,
            status: hasOverlap ? "occupied" : "free",
          };
        });

        setRooms(processed);
      })
      .catch((err) => {
        console.error("Error fetching rooms:", err);
        setRooms([]);
      })
      .finally(() => setLoading(false));
  }, [selectedDate, startTime, duration, search, token]);

  const filteredRooms = rooms.filter((r) => {
    const statusMatch = filter === "all" ? true : r.status === filter;
    let buildingMatch = true;

    if (buildingFilter === "my") {
      buildingMatch = String(r.building_id) === String(userBuilding);
    }

    return statusMatch && buildingMatch;
  });

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

    const confirmMsg = `Reserve room ${roomId} on ${bookingDate} at ${bookingTime} for ${duration}?`;

    if (!window.confirm(confirmMsg)) return;

    const body = {
      room_id: roomId,
      localDate: bookingDate,
      localTime: bookingTime,
      duration,
      clientTz: CLIENT_TIMEZONE,
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
        window.location.reload();
      } else {
        alert(data.error || "Reservation failed");
      }
    } catch (err) {
      console.error(err);
      alert("❌ Server connection error");
    }
  };

  // ✅ UPDATED: Get overlapping reservations including next day
  const handleCancelClick = (room) => {
    const requestedEnd = calculateEndTime(startTime, duration);
    
    const overlapping = (room.reservations || []).filter((res) => {
      if (res.is_next_day) {
        // For next day reservations, check against portion after midnight
        const bookingCrosses = bookingCrossesMidnight(startTime, duration);
        if (!bookingCrosses) return false;
        return checkOverlap("00:00", requestedEnd, res.local_start_time, res.local_end_time);
      } else {
        return checkOverlap(startTime, requestedEnd, res.local_start_time, res.local_end_time);
      }
    });

    if (overlapping.length === 0) {
      alert("No reservations overlap with the selected time.");
      return;
    }

    setSelectedRoom(room);
    setOverlappingReservations(overlapping);
    setSelectedReservationIds(new Set());
    setShowCancelModal(true);
  };

  const toggleReservationSelection = (reservationId) => {
    const newSet = new Set(selectedReservationIds);
    if (newSet.has(reservationId)) {
      newSet.delete(reservationId);
    } else {
      newSet.add(reservationId);
    }
    setSelectedReservationIds(newSet);
  };

  const selectAllReservations = () => {
    setSelectedReservationIds(new Set(overlappingReservations.map(r => r.reservation_id)));
  };

  const handleConfirmCancel = async () => {
    if (selectedReservationIds.size === 0) {
      alert("Please select at least one reservation to cancel");
      return;
    }

    if (!window.confirm(`Cancel ${selectedReservationIds.size} reservation(s)?`)) {
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const reservationId of selectedReservationIds) {
      try {
        const res = await fetch(
          `${API_URL}/api/cancel-reservation/${reservationId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        console.error(err);
        errorCount++;
      }
    }

    setShowCancelModal(false);
    setSelectedReservationIds(new Set());

    if (successCount > 0) {
      alert(`✅ Cancelled ${successCount} reservation(s)`);
      window.location.reload();
    } else {
      alert("❌ Failed to cancel reservations");
    }
  };

  // ✅ UPDATED: Get overlapping reservations including next day
  const getOverlappingReservations = (room) => {
    const requestedEnd = calculateEndTime(startTime, duration);
    return (room.reservations || []).filter((res) => {
      if (res.is_next_day) {
        const bookingCrosses = bookingCrossesMidnight(startTime, duration);
        if (!bookingCrosses) return false;
        return checkOverlap("00:00", requestedEnd, res.local_start_time, res.local_end_time);
      } else {
        return checkOverlap(startTime, requestedEnd, res.local_start_time, res.local_end_time);
      }
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const getMinTime = () => {
    if (selectedDate !== today) return "00:00";
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };
  const blockPastDate = selectedDate < today;
  const blockPastTime = selectedDate === today && startTime < getMinTime();
  const blockBooking = blockPastDate || blockPastTime;

  const getTimezoneDisplay = () => {
    try {
      const localOffset = new Date().getTimezoneOffset();
      const bratislavaOffset = -60;

      if (localOffset === bratislavaOffset) {
        return null;
      }

      const offsetHours = Math.abs(localOffset / 60);
      const offsetSign = localOffset > 0 ? "-" : "+";

      return `Times shown in your local timezone (UTC${offsetSign}${offsetHours}). Server uses Europe/Bratislava (UTC+1).`;
    } catch (error) {
      return null;
    }
  };

  return (
    <>
      <div className="card">
        <h2>Room Reservations</h2>

        {getTimezoneDisplay() && (
          <div className="info-box">{getTimezoneDisplay()}</div>
        )}

        <div className="filters">
          <div className="field">
            <label>Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Room, floor, capacity…"
            />
          </div>

          <div className="field">
            <label>Date</label>
            <input
              type="date"
              value={selectedDate}
              min={today}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <TimeSelector
            value={startTime}
            onChange={setStartTime}
            minTime={getMinTime()}
            label="Start Time"
          />

          <div className="field">
            <label>Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="15 minutes">15 minutes</option>
              <option value="30 minutes">30 minutes</option>
              <option value="1 hour">1 hour</option>
              <option value="1.5 hours">1.5 hours</option>
              <option value="2 hours">2 hours</option>
              <option value="24 hours">Whole day</option>
            </select>
          </div>

          <div className="status-toggle">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              className={filter === "free" ? "active" : ""}
              onClick={() => setFilter("free")}
            >
              Free
            </button>
            <button
              className={filter === "occupied" ? "active" : ""}
              onClick={() => setFilter("occupied")}
            >
              Occupied
            </button>
          </div>
        </div>

        {userBuilding && (
          <div className="building-filter-wrapper">
            <span className="building-filter-label">Building:</span>
            <div className="status-toggle">
              <button
                className={buildingFilter === "all" ? "active" : ""}
                onClick={() => setBuildingFilter("all")}
              >
                All Buildings
              </button>
              <button
                className={buildingFilter === "my" ? "active" : ""}
                onClick={() => setBuildingFilter("my")}
              >
                My Building Only
              </button>
            </div>
          </div>
        )}

        {search && filteredRooms.length === 1 && suggestedSlot && (
          <div className="suggestion">
            Next free slot for <b>{filteredRooms[0].room_number}</b>:{" "}
            <b>{suggestedSlot}</b>
          </div>
        )}

        {loading ? (
          <p className="loading">Loading...</p>
        ) : (
          <>
            <table className="rooms-table-desktop">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Building</th>
                  <th>Floor</th>
                  <th>Capacity</th>
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
                      <td>
                        <div className="building-address">{r.address}</div>
                        <div className="building-city">{r.city}</div>
                      </td>
                      <td>{r.floor}</td>
                      <td>{r.capacity}</td>
                      <td>
                        <span className={`badge ${r.status}`}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                        {overlapping.length > 0 && (
                          <span className="overlap-count">
                            ({overlapping.length} overlap)
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="row-actions">
                          {r.status === "free" && canBook && !blockBooking && (
                            <button
                              className="book"
                              onClick={() => handleBook(r.room_id)}
                            >
                              Book
                            </button>
                          )}
                          {overlapping.length > 0 && canDelete && (
                            <button
                              className="cancel"
                              onClick={() => handleCancelClick(r)}
                            >
                              Cancel
                            </button>
                          )}

                          <button
                            onClick={() =>
                              navigate(`/schedule/${r.room_id}?date=${selectedDate}`)
                            }
                          >
                            Schedule
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="rooms-mobile-cards">
              {filteredRooms.map((r) => {
                const overlapping = getOverlappingReservations(r);
                return (
                  <div key={r.room_id} className="room-card-mobile">
                    <div className="room-card-header">
                      <div className="room-card-title">
                        <span className="room-number">{r.room_number}</span>
                        <span className={`badge ${r.status}`}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </div>
                      {overlapping.length > 0 && (
                        <span className="overlap-count-mobile">
                          {overlapping.length} overlap
                        </span>
                      )}
                    </div>

                    <div className="room-card-info">
                      <div className="room-info-item">
                        <span className="label">Building:</span>
                        <span className="value">
                          {r.address}, {r.city}
                        </span>
                      </div>
                      <div className="room-info-row">
                        <div className="room-info-item">
                          <span className="label">Floor:</span>
                          <span className="value">{r.floor}</span>
                        </div>
                        <div className="room-info-item">
                          <span className="label">Capacity:</span>
                          <span className="value">{r.capacity}</span>
                        </div>
                      </div>
                    </div>

                    <div className="room-card-actions">
                      {r.status === "free" && canBook && !blockBooking && (
                        <button
                          className="book"
                          onClick={() => handleBook(r.room_id)}
                        >
                          Book
                        </button>
                      )}
                      {overlapping.length > 0 && canDelete && (
                        <button
                          className="cancel"
                          onClick={() => handleCancelClick(r)}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() =>
                          navigate(`/schedule/${r.room_id}?date=${selectedDate}`)
                        }
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showCancelModal && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cancel Reservations</h3>
              <button className="modal-close" onClick={() => setShowCancelModal(false)}>✕</button>
            </div>
            
            <div className="modal-body">
              <p className="modal-subtitle">
                Found {overlappingReservations.length} overlapping reservation(s) for room <strong>{selectedRoom?.room_number}</strong>
              </p>
              
              <div className="modal-actions-top">
                <button 
                  className="btn-secondary" 
                  onClick={selectAllReservations}
                >
                  Select All
                </button>
              </div>

              <div className="reservations-list">
                {overlappingReservations.map((res) => (
                  <label key={res.reservation_id} className="reservation-item">
                    <input
                      type="checkbox"
                      checked={selectedReservationIds.has(res.reservation_id)}
                      onChange={() => toggleReservationSelection(res.reservation_id)}
                    />
                    <div className="reservation-details">
                      <div className="reservation-time">
                        {/* ✅ Show date if it's a next-day reservation */}
                        {res.is_next_day && <span className="next-day-badge">{res.display_date}</span>}
                        {res.local_start_time} — {res.local_end_time}
                      </div>
                      {res.user_name && (
                        <div className="reservation-user">by {res.user_name}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setShowCancelModal(false)}>
                Cancel
              </button>
              <button 
                className="btn-danger" 
                onClick={handleConfirmCancel}
                disabled={selectedReservationIds.size === 0}
              >
                Cancel {selectedReservationIds.size > 0 ? `(${selectedReservationIds.size})` : ''} Reservation{selectedReservationIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}