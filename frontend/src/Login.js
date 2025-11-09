import React from "react";

export default function Login() {
  const handleLogin = () => {
    // presmerovanie na backend – GitHub OAuth
    window.location.href = "http://localhost:5000/auth/github";
  };

  return (
    <div style={{
      textAlign: "center",
      marginTop: "100px",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1>BookMyRoom</h1>
      <h3>Prihlásenie cez GitHub</h3>
      <button
        onClick={handleLogin}
        style={{
          backgroundColor: "#24292e",
          color: "white",
          border: "none",
          padding: "10px 20px",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "16px"
        }}
      >
        Prihlásiť sa cez GitHub
      </button>
    </div>
  );
}
