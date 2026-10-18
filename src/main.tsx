import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { routeExternalLinksToBrowser } from "./desktop";
import "./index.css";

routeExternalLinksToBrowser();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
