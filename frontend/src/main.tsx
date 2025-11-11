import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" toastOptions={{ style: { background: "#0f172a", color: "#f8fafc" } }} />
  </React.StrictMode>
);
