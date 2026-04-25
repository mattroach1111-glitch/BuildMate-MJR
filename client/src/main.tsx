import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register the service worker (handles web push notifications + offline cache)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('✅ Service worker registered:', reg.scope);
      })
      .catch((err) => {
        console.error('❌ Service worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
