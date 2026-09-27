import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@polyxd/react/styles.css";
import "@polyxd/react/themes/shadcn.css";
import "../kit/kit.css";
import "./foundry.css";
import { App } from "./app.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/demos/foundry">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
