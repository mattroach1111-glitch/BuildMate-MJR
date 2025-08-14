import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log('main.tsx loading');
console.log('Root element:', document.getElementById("root"));

try {
  const root = createRoot(document.getElementById("root")!);
  console.log('Root created, rendering App');
  root.render(<App />);
  console.log('App rendered');
} catch (error) {
  console.error('Error in main.tsx:', error);
}
