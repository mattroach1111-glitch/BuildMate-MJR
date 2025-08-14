import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/pwa"; // Initialize PWA service
import "./lib/samsung-rotation-fix"; // Fix Samsung Internet rotation

createRoot(document.getElementById("root")!).render(<App />);
