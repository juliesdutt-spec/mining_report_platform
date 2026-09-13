import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const container = document.getElementById("root")!;

// index.html paints a wordmark and a line of text into #root so that a slow
// connection has something to look at. Clearing it here rather than leaving it
// to React means there is no window in which the boot screen and the app are
// both on the page.
container.replaceChildren();

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
