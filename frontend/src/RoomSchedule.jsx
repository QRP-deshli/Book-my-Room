import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function RoomSchedule() {
    const API_URL = "http://localhost:5000";

    const [reservations, setReservations] = useState([]);
    const [duration, setDuration] = useState("1 hour");

    const roomId = window.location.pathname.split("/").pop();
    const date = new URLSearchParams(window.location.search).get("date");
    const token = localStorage.getItem("token");
    const navigate = useNavigate();

    const HOUR_HEIGHT = 51;
    const [pendingTime, setPendingTime] = useState(null);

    // Klik na timeline
    function handleTimelineClick(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;

        const hours = Math.floor(y / HOUR_HEIGHT);
        const minutes = Math.floor(((y % HOUR_HEIGHT) / HOUR_HEIGHT) * 60);

        const hh = String(hours).padStart(2, "0");
        const mm = String(minutes - (minutes % 15)).padStart(2, "0");

        setPendingTime(`${hh}:${mm}`);

        // Zákaz booking na minulé časy (len pre dnešný deň)
        const now = new Date();
        const today = new Date().toISOString().slice(0, 10);

        if (date === today) {
            const clicked = new Date(`${date}T${hh}:${mm}:00`);
            if (clicked < now) {
                alert("Cannot reserve past time.");
                return;
            }
        }

    }

    // Načítanie rezervácií
    useEffect(() => {
        console.log("Fetching schedule:", `${API_URL}/api/schedule?room_id=${roomId}&date=${date}`);

        fetch(`${API_URL}/api/schedule?room_id=${roomId}&date=${date}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                console.log("Loaded reservations:", data);
                setReservations(data || []);
            })
            .catch(err => {
                console.error("Error loading schedule:", err);
                setReservations([]);
            });
    }, [roomId, date, token]);

    // 🔥 PRIAME BOOKOVANIE
    const handleBook = async () => {
        if (!pendingTime) return;

        // Kontrola proti minulému času
        const now = new Date();
        const today = new Date().toISOString().slice(0, 10);
        if (date === today) {
            const clicked = new Date(`${date}T${pendingTime}:00`);
            if (clicked < now) {
                alert("Cannot reserve past time.");
                return;
            }
        }

        const confirm = window.confirm(
            `Reserve room ${roomId} on ${date} at ${pendingTime} for ${duration}?`
        );
        if (!confirm) return;

        const body = {
            room_id: roomId,
            reservation_date: date,
            start_time: pendingTime,
            duration: duration,
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

                // Refresh rezervácií
                const refreshRes = await fetch(
                    `${API_URL}/api/schedule?room_id=${roomId}&date=${date}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const refreshData = await refreshRes.json();
                setReservations(refreshData || []);

            } else {
                alert(`❌ ${data.error || "Reservation failed"}`);
            }
        } catch (err) {
            console.error(err);
            alert("❌ Server connection error");
        }
    };

    return (
        <div style={{ padding: "1rem" }}>
            <h2>Room {roomId} – {date}</h2>

            <button onClick={() => navigate("/")}>← Back</button>

            {pendingTime && (
                <div style={{ margin: "1rem 0", padding: "1rem", background: "#f0f0f0", borderRadius: "4px" }}>
                    <b>Selected time:</b> {pendingTime}

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
                onClick={handleTimelineClick}
                style={{
                    position: "relative",
                    borderLeft: "1px solid #555",
                    marginTop: "1rem",
                    height: 24 * HOUR_HEIGHT,
                    width: "100%",
                    cursor: "pointer",
                }}
            >
                {/* Časová mriežka */}
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
                        {h}:00
                    </div>
                ))}

                {/* Rezervácie */}
                {reservations.map((r, i) => {
                    function offset(time) {
                        const [h, m] = time.split(":").map(Number);
                        return h * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
                    }

                    return (
                        <div
                            key={i}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: "absolute",
                                top: offset(r.start_time),
                                height: offset(r.end_time) - offset(r.start_time),
                                left: "100px",
                                right: "20px",
                                background: "#d47cb3",
                                opacity: 0.8,
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
                            Reserved: {r.start_time} - {r.end_time}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}