import React, { useEffect, useState } from "react";
import "./App.css";
import Rooms from "./Rooms"; 
import Login from "./Login";

function App() {
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
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setRole("viewer");
  };

  const token = localStorage.getItem("token");

  // 🔹 Add user
  const addUser = async () => {
    const name = prompt("Enter the name of the new user:");
    const email = prompt("Enter email:");
    const role = prompt("Enter role (viewer, employer, admin):");

    if (!name || !email || !role) {
      alert("❌ You must fill out all fields.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/admin/add-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, role }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ User '${name}' has been added.`);
      } else {
        alert(`❌ ${data.error || "Error adding user"}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Server error.");
    }
  };

  // 🔹 Add room
  const addRoom = async () => {
    const room_number = prompt("Room number (e.g., E101):");
    const capacity = prompt("Capacity:");
    const floor = prompt("Floor:");
    const building_id = prompt("Building ID (e.g., 1):");

    if (!room_number || !capacity || !floor || !building_id) {
      alert("❌ You must fill out all fields.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/admin/add-room", {
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
        alert(`✅ Room '${room_number}' has been added.`);
      } else {
        alert(`❌ ${data.error || "Error adding room"}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Server error.");
    }
  };

  return (
    <div className="App">
      <h1>BookMyRoom</h1>
      <p>
        Role: <b>{role}</b>
      </p>

      {!localStorage.getItem("token") ? (
        <button
          onClick={() =>
            (window.location.href = "http://localhost:5000/auth/github")
          }
        >
          Sign in with GitHub
        </button>
      ) : (
        <button onClick={logout}>Log out</button>
      )}

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
    </div>
  );
}

export default App;
