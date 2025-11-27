import React, { useEffect, useState } from "react";
import "./App.css";
import Rooms from "./Rooms.jsx";
import RoomSchedule from "./RoomSchedule.jsx";
import { Routes, Route } from "react-router-dom";

function App() {
  // Používa premennú z Vite .env
  const API_URL = import.meta.env.VITE_API_URL || "https://book-my-room-pn00.onrender.com";

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

    // Po načítaní tokenu prepis URL na "/"
    if (params.get("token")) {
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

  const runImportCsv = async () => {
  const res = await fetch(`${API_URL}/api/admin/import-csv`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  alert(data.message || data.error);
  };

  const runExportCsv = async () => {
  const res = await fetch(`${API_URL}/api/admin/export-csv`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  alert(data.message || data.error);
  };

  const deleteUser = async () => {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const users = data.users;

  let msg = "Select user to delete:\n\n";
  users.forEach((u, i) => {
    msg += `${i + 1}) ${u.name} (${u.email})\n`;
  });

  const sel = parseInt(prompt(msg));
  if (!sel || isNaN(sel) || sel < 1 || sel > users.length) return;

  const userId = users[sel - 1].user_id;

  const del = await fetch(`${API_URL}/api/admin/delete-user/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const out = await del.json();
  alert(out.message || out.error);
};

const deleteRoom = async () => {
  const res = await fetch(`${API_URL}/api/rooms?date=2025-01-01`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const rooms = (await res.json()).rooms;

  let msg = "Select room to delete:\n\n";
  rooms.forEach((r, i) => {
    msg += `${i + 1}) ${r.room_number} — capacity ${r.capacity}\n`;
  });

  const sel = parseInt(prompt(msg));
  if (!sel || isNaN(sel) || sel < 1 || sel > rooms.length) return;

  const roomId = rooms[sel - 1].room_id;

  const del = await fetch(`${API_URL}/api/admin/delete-room/${roomId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const out = await del.json();
  alert(out.message || out.error);
};

const modifyRole = async () => {
  // OPRAVA: fetch() namiesto fetch``
  const res = await fetch(`${API_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const users = data.users;
  
  let msg = "Select user to modify role:\n\n";
  users.forEach((u, i) => {
    msg += `${i + 1}) ${u.name} (${u.email}) — current role: ${u.role_name}\n`;
  });
  
  const sel = parseInt(prompt(msg));
  if (!sel || isNaN(sel) || sel < 1 || sel > users.length) return;
  
  const userId = users[sel - 1].user_id;
  const newRole = prompt("Enter new role: viewer / employer / admin");
  if (!newRole) return;
  
  // OPRAVA: fetch() namiesto fetch``
  const req = await fetch(`${API_URL}/api/admin/change-role`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user_id: userId, role: newRole })
  });
  
  const out = await req.json();
  alert(out.message || out.error);
};

  return (
    <>
    <div className="App">
      <h1>BookMyRoom</h1>
      <p>
        Role: <b>{role}</b>
      </p>

      {!token ? (
        <button onClick={() => (window.location.href = `${API_URL}/auth/github?redirect=${import.meta.env.VITE_FRONTEND_URL}`)}>
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
                  <button onClick={runImportCsv} style={{ marginLeft: "0.5rem" }}>Import CSV</button>
                  <button onClick={runExportCsv} style={{ marginLeft: "0.5rem" }}>Export CSV</button>
                  <button onClick={deleteUser} style={{ marginLeft: "0.5rem" }}>Delete user</button>
                  <button onClick={deleteRoom} style={{ marginLeft: "0.5rem" }}>Delete room</button>
                  <button onClick={modifyRole} style={{ marginLeft: "0.5rem" }}>Modify roles</button>
                  <Rooms canBook canDelete />
                </>
              )}
            </>
          }
        />

        {/* SCHEDULE PAGE */}
        <Route path="/schedule/:roomId" element={<RoomSchedule />} />
      </Routes>
        </div>
    </>
  );
}

export default App;
