import React from "react";
import "./App.css";
import Miestnosti from "./Miestnosti"; // ⬅️ import tvojho komponentu

function App() {
  return (
    <div className="App">
      <h1>Prehľad miestností</h1>
      <Miestnosti /> {/* ⬅️ tu sa zobrazí tvoja tabuľka miestností */}
    </div>
  );
}

export default App;
