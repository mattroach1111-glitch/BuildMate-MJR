import { createRoot } from "react-dom/client";
import TestApp from "./TestApp";
import "./index.css";

// Test version for GST functionality
console.log('GST Test Version:', Date.now());

createRoot(document.getElementById("root")!).render(<TestApp />);
