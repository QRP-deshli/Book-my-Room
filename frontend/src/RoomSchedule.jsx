import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function RoomSchedule() {
     const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://book-my-room-pn00.onrender.com";

    // Server timezone (Bratislava = UTC+1)
    const SERVER_TIMEZONE = "Europe/Bratislava";

    const [reservations, setReservations] = useState([]);
    const [duration, setDuration] = useState("1 hour");

    const roomId = window.location.pathname.split("/").pop();
    const urlDate = new URLSearchParams(window.location.search).get("date");
    const token = localStorage.getItem("token");
    const navigate = useNavigate();

    const HOUR_HEIGHT = 51;
    const [pendingTime, setPendingTime] = useState(null);

    // draggable selection line
    const [dragY, setDragY] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    // current time line
    const [currentY, setCurrentY] = useState(null);


    // ===== TIMEZONE CONVERSION HELPERS =====

    // Convert server date+time (Bratislava) to local date+time
    const serverToLocal = (serverDate, serverTime) => {
        const [year, month, day] = serverDate.split("-");
        const [hours, minutes] = serverTime.split(":");

        // Create UTC date (server is UTC+1, so subtract 1 hour to get UTC)
        const utcDate = new Date(Date.UTC(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hours) - 1,
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

    // Get timezone info for display
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

    // ===== END TIMEZONE HELPERS =====

    // Convert URL date (which is in local timezone from Rooms page) to server date
    const { serverDate: date } = localToServer(urlDate, "12:00"); // Use noon to avoid day boundary issues

    // Click on timeline
    function handleTimelineClick(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;

        setDragY(y);

        const hours = Math.floor(y / HOUR_HEIGHT);
        const minutes = Math.floor(((y % HOUR_HEIGHT) / HOUR_HEIGHT) * 60);

        const hh = String(hours).padStart(2, "0");
        const mm = String(minutes - (minutes % 15)).padStart(2, "0");

        const clickedLocalTime = `${hh}:${mm}`;
        setPendingTime(clickedLocalTime);

        // Check against past time
        const now = new Date();
        const today = new Date().toISOString().slice(0, 10);

        if (urlDate === today) {
            const clicked = new Date(`${urlDate}T${clickedLocalTime}:00`);
            if (clicked < now) {
                alert("Cannot reserve past time.");
                setPendingTime(null);
                return;
            }
        }
    }


    // Load reservations
    useEffect(() => {
        console.log("Fetching schedule:", `${API_URL}/api/schedule?room_id=${roomId}&date=${date}`);

        fetch(`${API_URL}/api/schedule?room_id=${roomId}&date=${date}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                console.log("Loaded reservations from server:", data);

                // Convert all reservation times from server to local
                const localReservations = (data || []).map((res) => {
                    const startConverted = serverToLocal(res.reservation_date, res.start_time);
                    const endConverted = serverToLocal(res.reservation_date, res.end_time);

                    return {
                        ...res,
                        start_time: startConverted.localTime,
                        end_time: endConverted.localTime,
                        start_date: startConverted.localDate,
                        end_date: endConverted.localDate,
                    };
                }).filter((res) => {
                    // Only show reservations that touch the selected date
                    return res.start_date === urlDate || res.end_date === urlDate;
                });

                console.log("Converted to local time:", localReservations);
                setReservations(localReservations);
            })
            .catch(err => {
                console.error("Error loading schedule:", err);
                setReservations([]);
            });
    }, [roomId, date, token]);

    // CURRENT TIME LINE EFFECT
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


    // Direct booking
    const handleBook = async () => {
        if (!pendingTime) return;

        // Check against past time (in local timezone)
        const now = new Date();
        const today = new Date().toISOString().slice(0, 10);
        if (urlDate === today) {
            const clicked = new Date(`${urlDate}T${pendingTime}:00`);
            if (clicked < now) {
                alert("Cannot reserve past time.");
                return;
            }
        }

        const confirm = window.confirm(
            `Reserve room ${roomId} on ${urlDate} at ${pendingTime} (local time) for ${duration}?`
        );
        if (!confirm) return;

        // Convert local time to server time
        const { serverDate: bookingServerDate, serverTime: bookingServerTime } = localToServer(urlDate, pendingTime);

        const body = {
            room_id: roomId,
            reservation_date: bookingServerDate,
            start_time: bookingServerTime,
            duration: duration,
        };

        console.log("Booking with server time:", body);

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
                alert(`✅ Reservation confirmed at ${pendingTime} (local time)`);
                setPendingTime(null);

                // Refresh reservations
                const refreshRes = await fetch(
                    `${API_URL}/api/schedule?room_id=${roomId}&date=${date}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const refreshData = await refreshRes.json();

                // Convert refreshed data to local time
                const localReservations = (refreshData || []).map((res) => {
                    const startConverted = serverToLocal(res.reservation_date, res.start_time);
                    const endConverted = serverToLocal(res.reservation_date, res.end_time);

                    return {
                        ...res,
                        start_time: startConverted.localTime,
                        end_time: endConverted.localTime,
                        start_date: startConverted.localDate,
                        end_date: endConverted.localDate,
                    };
                }).filter((res) => {
                    // Only show reservations that touch the selected date
                    return res.start_date === urlDate || res.end_date === urlDate;
                });

                setReservations(localReservations);

            } else {
                alert(`❌ ${data.error || "Reservation failed"}`);
            }
        } catch (err) {
            console.error(err);
            alert("❌ Server connection error");
        }
    };

    // DRAGGING HANDLERS
    function startDrag(e) {
        setIsDragging(true);
    }

    function onDrag(e) {
        if (!isDragging) return;

        const container = document.getElementById("timeline");
        const rect = container.getBoundingClientRect();

        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const y = clientY - rect.top;

        setDragY(y);

        // convert Y to time
        const hours = Math.floor(y / HOUR_HEIGHT);
        const minutes = Math.floor(((y % HOUR_HEIGHT) / HOUR_HEIGHT) * 60);

        const hh = String(hours).padStart(2, "0");
        const mm = String(minutes - (minutes % 15)).padStart(2, "0");

        setPendingTime(`${hh}:${mm}`);
    }

    function endDrag() {
        setIsDragging(false);
    }


    return (
        <div style={{ padding: "1rem" }}>
            <h2>Room {roomId} – {urlDate}</h2>

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

            <button onClick={() => navigate("/")}>← Back</button>

            {pendingTime && (
                <div style={{ margin: "1rem 0", padding: "1rem", background: "#f0f0f0", borderRadius: "4px" }}>
                    <b>Selected time:</b> {pendingTime} (local time)

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

                    <button
                        style={{ marginLeft: "1rem", background: "#4CAF50", color: "white", padding: "0.5rem 1rem", border: "none", borderRadius: "4px", cursor: "pointer" }}
                        onClick={handleBook}
                    >
                        Book Now
                    </button>

                    <button
                        style={{ marginLeft: "0.5rem" }}
                        onClick={() => setPendingTime(null)}
                    >
                        Cancel
                    </button>
                </div>
            )}

            <div
                id="timeline"
                onClick={handleTimelineClick}
                onMouseDown={startDrag}
                onMouseMove={onDrag}
                onMouseUp={endDrag}
                onTouchStart={startDrag}
                onTouchMove={onDrag}
                onTouchEnd={endDrag}
                style={{
                    position: "relative",
                    borderLeft: "1px solid #555",
                    marginTop: "1rem",
                    height: 24 * HOUR_HEIGHT,
                    width: "100%",
                    cursor: "pointer",
                    touchAction: "none"
                }}
            >
                {/* DRAG LINE */}
                {dragY !== null && (
                    <div
                        style={{
                            position: "absolute",
                            top: dragY,
                            left: 0,
                            right: 0,
                            borderTop: "2px solid #2196F3",
                            zIndex: 20
                        }}
                    ></div>
                )}

                {/* CURRENT TIME LINE */}
                {currentY !== null && (
                    <div
                        style={{
                            position: "absolute",
                            top: currentY,
                            left: 0,
                            right: 0,
                            borderTop: "2px solid red",
                            zIndex: 15
                        }}
                    ></div>
                )}



                {/* Time grid - shows local time */}
                {[...Array(24)].map((_, h) => (
                    <div
                        key={h}
                        style={{
                            height: HOUR_HEIGHT,
                            borderTop: "1px solid #444",
                            paddingLeft: "5px",
                            color: "#777",
                            margin: 0,
                            boxSizing: "border-box",
                            display: "flex",
                        }}
                    >
                        {String(h).padStart(2, "0")}:00
                    </div>
                ))}

                {/* Reservations - already converted to local time */}
                {reservations.map((r, i) => {
                    function offset(time) {
                        const [h, m] = time.split(":").map(Number);
                        return h * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
                    }

                    // Calculate start and end offsets, handling midnight crossing
                    let startOffset = offset(r.start_time);
                    let endOffset = offset(r.end_time);

                    // If reservation starts on a different date, clip to start of day
                    if (r.start_date !== urlDate) {
                        startOffset = 0;
                    }

                    // If reservation ends on a different date, clip to end of day
                    if (r.end_date !== urlDate) {
                        endOffset = 24 * HOUR_HEIGHT;
                    }

                    // Handle midnight crossing within the same visual day
                    if (r.start_date === urlDate && r.end_date === urlDate && endOffset < startOffset) {
                        endOffset = 24 * HOUR_HEIGHT;
                    }

                    const height = endOffset - startOffset;

                    // Skip if height is invalid
                    if (height <= 0) return null;

                    // bezpečné načítanie tokenu
                    let tokenUser = null;
                    try {
                        tokenUser = JSON.parse(atob(token.split(".")[1]));
                    } catch { }

                    // porovnanie rezervácie a používateľa
                    const isMine = tokenUser && r.user_id === tokenUser.id;

                    // farba podľa toho, či je rezervácia moja alebo cudzieho používateľa
                    const color = isMine ? "#d47cb3" : "#3F51B5";

                    // Display times
                    let displayText = `Reserved: ${r.start_time} - ${r.end_time}`;
                    if (r.start_date !== urlDate) {
                        displayText = `Reserved: (from ${r.start_date}) - ${r.end_time}`;
                    } else if (r.end_date !== urlDate) {
                        displayText = `Reserved: ${r.start_time} - (to ${r.end_date})`;
                    }

                    return (
                        <div
                            key={i}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: "absolute",
                                top: startOffset,
                                height: height,
                                left: "100px",
                                right: "20px",
                                background: color,
                                opacity: 0.85,
                                borderRadius: "4px",
                                padding: "4px",
                                cursor: "default",
                                zIndex: 10,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontWeight: "bold",
                                boxSizing: "border-box"
                            }}
                        >
                            {displayText}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}