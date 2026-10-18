import React from "react";
import ReactDOM from "react-dom/client";
import App, { applySavedTheme } from "./App";
import { routeExternalLinksToBrowser } from "./desktop";
import "./index.css";

routeExternalLinksToBrowser();
applySavedTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
