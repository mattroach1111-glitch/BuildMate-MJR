import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Force cache refresh with version
console.log('BuildFlow Pro v1.0.1 - Cache Refresh:', Date.now());

// Clear any existing caches on load
if ('caches' in window) {
  caches.keys().then((names) => {
    names.forEach(name => {
      if (name.startsWith('buildflow-pro-v1.0.0')) {
        caches.delete(name);
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
