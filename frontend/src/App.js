import React, { useEffect, useState } from "react";
import "./App.css";
import Rooms from "./Rooms";
import RoomSchedule from "./RoomSchedule";
import { Routes, Route } from "react-router-dom";

function App() {
  const API_URL =
    process.env.REACT_APP_API_URL ||
    "https://book-my-room-pn00.onrender.com";

  const [role, setRole] = useState("viewer");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || localStorage.getItem("token");

    if (token) {
      localStorage.setItem("token", token);

      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setRole(payload.role);
      } catch (e) {
        console.error("Invalid token");
        localStorage.removeItem("token");
      }
    }
    if (window.location.search.includes("token")) {
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setRole("viewer");
    window.location.reload();
  };

  const token = localStorage.getItem("token");

  const addUser = async () => {
    const name = prompt("Enter user name:");
    const email = prompt("Enter email:");
    const role = prompt("Role: viewer, employer, admin");

    if (!name || !email || !role) {
      alert("❌ All fields are required");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/add-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, role }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ User '${name}' added.`);
      } else {
        alert(`❌ ${data.error || "Failed to add user"}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Server error");
    }
  };

  const addRoom = async () => {
    const room_number = prompt("Room number:");
    const capacity = prompt("Capacity:");
    const floor = prompt("Floor:");
    const building_id = prompt("Building ID:");

    if (!room_number || !capacity || !floor || !building_id) {
      alert("❌ All fields are required");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/add-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          room_number,
          capacity: Number(capacity),
          floor: Number(floor),
          building_id: Number(building_id),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ Room '${room_number}' added.`);
      } else {
        alert(`❌ ${data.error || "Failed to add room"}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Server error");
    }
  };

  return (
    <>
      <h1>BookMyRoom</h1>
      <p>
        Role: <b>{role}</b>
      </p>

      {!token ? (
        <button onClick={() => (window.location.href = `${API_URL}/auth/github`)}>
          Sign in with GitHub
        </button>
      ) : (
        <button onClick={logout}>Log out</button>
      )}

      <Routes>
        {/* HOME PAGE */}
        <Route
          path="/"
          element={
            <>
              {role === "viewer" && (
                <>
                  <h3>Room Overview</h3>
                  <Rooms />
                </>
              )}

              {role === "employer" && (
                <>
                  <h3>Reservations</h3>
                  <Rooms canBook canDelete />
                </>
              )}

              {role === "admin" && (
                <>
                  <h3>Administration</h3>
                  <button onClick={addUser}>Add user</button>
                  <button onClick={addRoom} style={{ marginLeft: "0.5rem" }}>
                    Add room
                  </button>
                  <Rooms canBook canDelete />
                </>
              )}
            </>
          }
        />

        {/* SCHEDULE PAGE */}
        <Route path="/schedule/:roomId" element={<RoomSchedule />} />
      </Routes>
    </>
  );
}

export default App;
