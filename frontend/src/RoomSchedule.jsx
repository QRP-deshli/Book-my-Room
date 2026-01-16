import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function RoomSchedule() {
  const API_URL = import.meta.env.VITE_API_URL || "https://book-my-room-pn00.onrender.com";
  
  const CLIENT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const [reservations, setReservations] = useState([]);
  const [duration, setDuration] = useState("1 hour");
  const [pendingTime, setPendingTime] = useState(null);
  const [dragY, setDragY] = useState(null);
  const [currentY, setCurrentY] = useState(null);
  
  // Touch tracking for mobile scroll vs tap
  const [touchStart, setTouchStart] = useState(null);
  const [isTouchScrolling, setIsTouchScrolling] = useState(false);
  
  const timelineRef = useRef(null);
  const containerRef = useRef(null);
  
  const roomId = window.location.pathname.split("/").pop();
  const [urlDate, setUrlDate] = useState(
    new URLSearchParams(window.location.search).get("date") || new Date().toISOString().slice(0, 10)
  );
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  
  const HOUR_HEIGHT = 56;

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

  // Fetch schedule
  useEffect(() => {
    if (!roomId || !urlDate) return;

    fetch(
      `${API_URL}/api/schedule?room_id=${roomId}&localDate=${urlDate}&clientTz=${CLIENT_TIMEZONE}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((res) => res.json())
      .then((data) => {
        setReservations(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Error fetching schedule:", err);
        setReservations([]);
      });
  }, [roomId, urlDate, token]);

  // Update current time indicator
  useEffect(() => {
    function updateCurrentTime() {
      const now = new Date();
      const today = new Date().toISOString().split("T")[0];

      if (urlDate !== today) {
        setCurrentY(null);
        return;
      }

      const h = now.getHours();
      const m = now.getMinutes();
      const y = h * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;

      setCurrentY(y);
    }

    updateCurrentTime();
    const timer = setInterval(updateCurrentTime, 60000);
    return () => clearInterval(timer);
  }, [urlDate]);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const today = new Date().toISOString().split("T")[0];
    
    if (urlDate === today) {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const scrollY = h * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
      
      setTimeout(() => {
        containerRef.current.scrollTop = Math.max(0, scrollY - 150);
      }, 100);
    }
  }, [urlDate]);

  // Handle touch start for mobile
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const y = touch.clientY - rect.top;
    
    setTouchStart({ y, time: Date.now() });
    setIsTouchScrolling(false);
  };

  // Detect if user is scrolling or tapping
  const handleTouchMove = (e) => {
    if (!touchStart) return;
    
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const y = touch.clientY - rect.top;
    
    if (Math.abs(y - touchStart.y) > 10) {
      setIsTouchScrolling(true);
    }
  };

  // Only book if it was a tap, not a scroll
  const handleTouchEnd = (e) => {
    if (!touchStart || isTouchScrolling) {
      setTouchStart(null);
      setIsTouchScrolling(false);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const y = touchStart.y;
    
    handleTimelineClick({ currentTarget: e.currentTarget, clientY: rect.top + y });
    
    setTouchStart(null);
    setIsTouchScrolling(false);
  };

  // Handle clicking on timeline
  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    setDragY(y);
    
    const hours = Math.floor(y / HOUR_HEIGHT);
    const minutes = Math.floor(((y % HOUR_HEIGHT) / HOUR_HEIGHT) * 60);
    const roundedMinutes = Math.round(minutes / 5) * 5;
    
    const hh = String(hours).padStart(2, "0");
    const mm = String(roundedMinutes).padStart(2, "0");
    const clickedLocalTime = `${hh}:${mm}`;
    
    // Don't allow past times
    const now = new Date();
    const today = new Date().toISOString().slice(0, 10);
    
    if (urlDate === today) {
      const clicked = new Date(`${urlDate}T${clickedLocalTime}:00`);
      if (clicked < now) {
        alert("Cannot reserve past time.");
        setDragY(null);
        return;
      }
    }
    
    setPendingTime(clickedLocalTime);
  };

  // Handle reservation cancellation
  const handleCancelReservation = async (reservation, e) => {
    e.stopPropagation();
    e.preventDefault(); // Also prevent default behavior
    
    // Get current user info
    const currentUserId = getCurrentUserId();
    const userRole = getUserRole();
    
    // Check permissions: admin can cancel all, users can only cancel their own
    if (userRole !== 'admin' && reservation.user_id !== currentUserId) {
      alert("You can only cancel your own reservations.");
      return;
    }
    
    if (!window.confirm(`Cancel reservation ${reservation.local_start_time} — ${reservation.local_end_time}?`)) {
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/cancel-reservation/${reservation.reservation_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        alert("✅ Reservation cancelled");
        
        const refreshRes = await fetch(
          `${API_URL}/api/schedule?room_id=${roomId}&localDate=${urlDate}&clientTz=${CLIENT_TIMEZONE}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const refreshData = await refreshRes.json();
        setReservations(Array.isArray(refreshData) ? refreshData : []);
      } else {
        const data = await res.json();
        alert(`❌ ${data.error || "Failed to cancel"}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Server error");
    }
  };

  // Handle booking
  const handleBook = async () => {
    if (!pendingTime) return;

    const now = new Date();
    const today = new Date().toISOString().slice(0, 10);
    if (urlDate === today) {
      const clicked = new Date(`${urlDate}T${pendingTime}:00`);
      if (clicked < now) {
        alert("Cannot reserve past time.");
        return;
      }
    }

    const confirmMsg = `Reserve room ${roomId} on ${urlDate} at ${pendingTime} (local time) for ${duration}?`;

    if (!window.confirm(confirmMsg)) return;

    const body = {
      room_id: roomId,
      localDate: urlDate,
      localTime: pendingTime,
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
        alert(`✅ Reservation confirmed at ${pendingTime}`);
        setPendingTime(null);
        setDragY(null);

        const refreshRes = await fetch(
          `${API_URL}/api/schedule?room_id=${roomId}&localDate=${urlDate}&clientTz=${CLIENT_TIMEZONE}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const refreshData = await refreshRes.json();
        setReservations(Array.isArray(refreshData) ? refreshData : []);
      } else {
        alert(`❌ ${data.error || "Reservation failed"}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Server connection error");
    }
  };

  // Calculate end time for preview
  const calculateEndTime = (start, dur) => {
    const [h, m] = start.split(":").map(Number);
    const totalMinutes = h * 60 + m + getDurationInMinutes(dur);
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  };

  // Get current user info from token
  const getCurrentUserId = () => {
    try {
      const tokenUser = JSON.parse(atob(token.split(".")[1]));
      return tokenUser.id;
    } catch {
      return null;
    }
  };

  // Get user role from token
  const getUserRole = () => {
    try {
      const tokenUser = JSON.parse(atob(token.split(".")[1]));
      return tokenUser.role;
    } catch {
      return null;
    }
  };

  // Generate time options in 5-minute increments
  const generateHourOptions = () => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      options.push(String(h).padStart(2, "0"));
    }
    return options;
  };

  const generateMinuteOptions = () => {
    const options = [];
    for (let m = 0; m < 60; m += 5) {
      options.push(String(m).padStart(2, "0"));
    }
    return options;
  };

  // Handle time change from dropdowns
  const handleTimeChange = (hour, minute) => {
    const newTime = `${hour}:${minute}`;
    
    const now = new Date();
    const today = new Date().toISOString().slice(0, 10);
    
    if (urlDate === today) {
      const selected = new Date(`${urlDate}T${newTime}:00`);
      if (selected < now) {
        alert("Cannot select past time.");
        return;
      }
    }
    
    setPendingTime(newTime);
    
    // Update drag line position
    const [h, m] = newTime.split(":").map(Number);
    const y = h * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
    setDragY(y);
  };

  // Render timeline
  const renderTimeline = () => {
    const currentUserId = getCurrentUserId();
    const userRole = getUserRole();

    // Group overlapping reservations - IMPROVED algorithm
    const groupOverlapping = (reservations) => {
      if (reservations.length === 0) return [];
      
      const groups = [];
      const processed = new Set();
      
      reservations.forEach((res, idx) => {
        if (processed.has(idx)) return;
        
        const resStart = res.local_start_time.split(':').map(Number);
        const resEnd = res.local_end_time.split(':').map(Number);
        const resStartMins = resStart[0] * 60 + resStart[1];
        const resEndMins = resEnd[0] * 60 + resEnd[1];
        
        const group = [res];
        processed.add(idx);
        
        // Find ALL reservations that overlap with ANY reservation in this group
        let foundNew = true;
        while (foundNew) {
          foundNew = false;
          
          reservations.forEach((r, rIdx) => {
            if (processed.has(rIdx)) return;
            
            const rStart = r.local_start_time.split(':').map(Number);
            const rEnd = r.local_end_time.split(':').map(Number);
            const rStartMins = rStart[0] * 60 + rStart[1];
            const rEndMins = rEnd[0] * 60 + rEnd[1];
            
            // Check if this reservation overlaps with ANY in the current group
            const overlapsWithGroup = group.some(groupRes => {
              const gStart = groupRes.local_start_time.split(':').map(Number);
              const gEnd = groupRes.local_end_time.split(':').map(Number);
              const gStartMins = gStart[0] * 60 + gStart[1];
              const gEndMins = gEnd[0] * 60 + gEnd[1];
              
              return (rStartMins < gEndMins && rEndMins > gStartMins);
            });
            
            if (overlapsWithGroup) {
              group.push(r);
              processed.add(rIdx);
              foundNew = true;
            }
          });
        }
        
        groups.push(group);
      });
      
      return groups;
    };

    const groups = groupOverlapping(reservations);

    return (
      <div
        id="timeline"
        ref={timelineRef}
        className="timeline"
        onClick={handleTimelineClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          touchAction: "pan-y",
          position: "relative"
        }}
      >
        {dragY !== null && (
          <div className="drag-line" style={{ top: dragY }}></div>
        )}

        {currentY !== null && (
          <div className="current-time-line" style={{ top: currentY }}></div>
        )}

        {/* Hour markers */}
        {[...Array(24)].map((_, h) => (
          <div key={h} className="hour-slot">
            <span className="time-label">
              {String(h).padStart(2, "0")}:00
            </span>
          </div>
        ))}

        {/* Existing reservations */}
        {groups.map((group, groupIdx) => 
          group.map((r, indexInGroup) => {
            function offset(time) {
              const [h, m] = time.split(":").map(Number);
              return h * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
            }

            const isMine = currentUserId && r.user_id === currentUserId;
            const canCancel = userRole === 'admin' || isMine;
            
            const groupSize = group.length;
            const widthPercent = groupSize > 1 ? (95 / groupSize) : 100;
            const leftOffset = groupSize > 1 ? (indexInGroup * widthPercent) : 0;
            
            // Different positioning for mobile
            const isMobile = window.innerWidth <= 768;
            const baseLeft = isMobile ? 60 : 80;

            return (
              <div
                key={`${groupIdx}-${indexInGroup}`}
                className={`reservation-block ${isMine ? "mine" : "other"}`}
                style={{
                  top: offset(r.local_start_time),
                  height: offset(r.local_end_time) - offset(r.local_start_time),
                  left: groupSize > 1 ? `calc(${baseLeft}px + ${leftOffset}%)` : `${baseLeft}px`,
                  width: groupSize > 1 ? `calc(${widthPercent}% - 20px)` : `calc(100% - ${baseLeft + 20}px)`,
                }}
                title={isMine ? "" : `Reserved by ${r.user_name || "someone"}`}
              >
                <div className="reservation-content">
                  <strong>{r.local_start_time} — {r.local_end_time}</strong>
                </div>
                {canCancel && (
                  <button 
                    className="reservation-delete-btn"
                    onClick={(e) => handleCancelReservation(r, e)}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleCancelReservation(r, e);
                    }}
                    title="Cancel reservation"
                  >
                    X
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="App">
      <div className="schedule-header">
        <div className="schedule-header-left">
          <h2>Room {roomId}</h2>
          <input
            type="date"
            value={urlDate}
            min={today}
            onChange={(e) => setUrlDate(e.target.value)}
            className="date-picker-schedule"
          />
        </div>
        <div className="actions">
          <button className="btn-outline" onClick={() => navigate("/")}>
            ← Back
          </button>
        </div>
      </div>

      {getTimezoneDisplay() && (
        <div className="info-box">
          {getTimezoneDisplay()}
        </div>
      )}

      {/* Floating time indicator with booking controls */}
      {pendingTime && (
        <div className="floating-time-indicator">
          <div className="time-display">
            <div className="time-field">
              <label>Start Time</label>
              <div className="time-dropdowns">
                <select
                  value={pendingTime.split(":")[0]}
                  onChange={(e) => handleTimeChange(e.target.value, pendingTime.split(":")[1])}
                  className="time-select"
                >
                  {generateHourOptions().map(hour => (
                    <option key={hour} value={hour}>{hour}</option>
                  ))}
                </select>
                <span className="time-colon">:</span>
                <select
                  value={pendingTime.split(":")[1]}
                  onChange={(e) => handleTimeChange(pendingTime.split(":")[0], e.target.value)}
                  className="time-select"
                >
                  {generateMinuteOptions().map(minute => (
                    <option key={minute} value={minute}>{minute}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="time-separator">↓</div>
            
            <div className="time-end">{calculateEndTime(pendingTime, duration)}</div>
          </div>
          
          <div className="duration-field">
            <label>Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="15 minutes">15 min</option>
              <option value="30 minutes">30 min</option>
              <option value="1 hour">1 hour</option>
              <option value="1.5 hours">1.5 hours</option>
              <option value="2 hours">2 hours</option>
              <option value="24 hours">Whole day</option>
            </select>
          </div>

          <div className="floating-actions">
            <button className="btn-book" onClick={handleBook}>
              Book Now
            </button>
            <button className="btn-cancel-floating" onClick={() => {
              setPendingTime(null);
              setDragY(null);
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="schedule-container" ref={containerRef}>
        {renderTimeline()}
      </div>
    </div>
  );
}