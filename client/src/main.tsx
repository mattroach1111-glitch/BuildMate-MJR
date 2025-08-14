import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/pwa"; // Initialize PWA service

createRoot(document.getElementById("root")!).render(<App />);
