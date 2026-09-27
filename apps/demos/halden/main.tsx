import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@polyxd/react/styles.css";
import "@polyxd/react/themes/material3.css";
import "../kit/kit.css";
import "./halden.css";
import { App } from "./app.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/demos/halden">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
