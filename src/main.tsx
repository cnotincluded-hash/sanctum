import React from "react";
import ReactDOM from "react-dom/client";
import App, { applySavedTheme } from "./App";
import { routeExternalLinksToBrowser } from "./desktop";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/manrope";
import "./index.css";
import "./sanctum.css";

routeExternalLinksToBrowser();
applySavedTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
