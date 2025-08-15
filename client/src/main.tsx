import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Cache buster: force new build hash
console.log("BuildFlow Pro loaded fresh:", new Date().toISOString());

// Force cache refresh with version - DELETED JOBS REMOVED
console.log('BuildFlow Pro v2.0.0 - DELETED JOBS FUNCTIONALITY COMPLETELY REMOVED:', Date.now());

// Clear ALL caches on load - force fresh start
if ('caches' in window) {
  caches.keys().then((names) => {
    names.forEach(name => {
      caches.delete(name);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
