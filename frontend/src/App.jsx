import React, { useEffect, useState } from "react";
import "./App.css";
import Rooms from "./Rooms.jsx";
import RoomSchedule from "./RoomSchedule.jsx";
import AdminPanel from "./AdminPanel.jsx";
import UserSettings from "./UserSettings.jsx";
import { Routes, Route } from "react-router-dom";

function App() {
  const API_URL =
    import.meta.env.VITE_API_URL || "https://book-my-room-pn00.onrender.com";

  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [role, setRole] = useState("viewer");
  const [userProfile, setUserProfile] = useState(null);

  // Initialize token from URL or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    if (urlToken) {
      localStorage.setItem("token", urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  // Fetch user profile when token is available
  const loadUserProfile = () => {
    if (!token) {
      setUserProfile(null);
      return;
    }

    fetch(`${API_URL}/api/user/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error("Error fetching profile:", data.error);
        } else {
          setUserProfile(data);
        }
      })
      .catch(err => {
        console.error("Error fetching user profile:", err);
      });
  };

  useEffect(() => {
    loadUserProfile();
  }, [token, API_URL]);

  // Update role and set auto-logout
  useEffect(() => {
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setRole(payload.role);

      const expiresAt = payload.exp * 1000;
      const timeLeft = expiresAt - Date.now();

      if (timeLeft > 0) {
        const timer = setTimeout(() => {
          alert("Session ended");
          localStorage.removeItem("token");
          setToken(null);
          setRole("viewer");
          setUserProfile(null);
        }, timeLeft);

        return () => clearTimeout(timer);
      } else {
        localStorage.removeItem("token");
        setToken(null);
        setRole("viewer");
        setUserProfile(null);
      }
    } catch (e) {
      console.error("Invalid token", e);
      localStorage.removeItem("token");
      setToken(null);
      setRole("viewer");
      setUserProfile(null);
    }
  }, [token]);

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setRole("viewer");
    setUserProfile(null);
  };

  return (
    <div className="App">
      <div className="app-header">
        <div className="app-title">
          <h1>BookMe</h1>
          {userProfile ? (
            <p>
              <b>{userProfile.name}</b> • Role: <b>{role}</b>
              {userProfile.building_id && (
                <> • Building: <b>{userProfile.address}, {userProfile.city}</b></>
              )}
            </p>
          ) : (
            <p>Role: <b>{role}</b></p>
          )}
        </div>

        {!token ? (
          <button
            className="btn-primary"
            onClick={() =>
              (window.location.href = `${API_URL}/auth/github?redirect=${API_URL}`)
            }
          >
            Sign in with GitHub
          </button>
        ) : (
          <button className="btn-outline" onClick={logout}>
            Log out
          </button>
        )}
      </div>

      <Routes>
        <Route
          path="/"
          element={
            <>
              {role === "viewer" && (
                <>
                  <Rooms userBuilding={userProfile?.building_id} />
                </>
              )}
              {role === "employee" && (
                <>
                  <Rooms canBook canDelete userBuilding={userProfile?.building_id} />
                  <UserSettings 
                    token={token} 
                    apiUrl={API_URL} 
                    userProfile={userProfile}
                    onProfileUpdate={loadUserProfile}
                  />
                </>
              )}
              {role === "admin" && (
                <>
                  <div className="card">
                    <h2>Administration</h2>
                    <p className="card-description">
                      Manage users, rooms, and system data
                    </p>
                  </div>
                  <AdminPanel token={token} apiUrl={API_URL} />
                  <Rooms canBook canDelete userBuilding={userProfile?.building_id} />
                  <UserSettings 
                    token={token} 
                    apiUrl={API_URL} 
                    userProfile={userProfile}
                    onProfileUpdate={loadUserProfile}
                  />
                </>
              )}
            </>
          }
        />
        <Route path="/schedule/:roomId" element={<RoomSchedule />} />
      </Routes>
    </div>
  );
}

export default App;