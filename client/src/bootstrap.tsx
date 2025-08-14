import { createRoot } from "react-dom/client";

console.log("Bootstrap loading...", new Date().toISOString());

function EmergencyApp() {
  console.log("EmergencyApp rendering...");
  
  return (
    <div>
      <h1>EMERGENCY MODE ACTIVE</h1>
      <p>Time: {new Date().toLocaleString()}</p>
      <p>If you see this, the cache issue is resolved!</p>
      <button onClick={() => alert("Working!")}>Test</button>
    </div>
  );
}

const root = document.getElementById("root");
console.log("Root element:", root);

if (root) {
  console.log("Creating React root...");
  createRoot(root).render(<EmergencyApp />);
  console.log("React root created and rendered");
} else {
  console.error("No root element found!");
}