import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// The AI curation feature (and the API key it stored) was removed.
try {
  localStorage.removeItem("lifescribe_anthropic_key");
} catch {
  /* storage unavailable: nothing to clean up */
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
