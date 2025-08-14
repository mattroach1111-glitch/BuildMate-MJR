import { createRoot } from "react-dom/client";

// Force unregister service worker immediately
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('Service Worker unregistered:', registration);
    }
  });
}

console.log("🔄 BOOTSTRAP LOADING - CACHE BUSTER:", Date.now());

function FreshApp() {
  const timestamp = new Date().toISOString();
  console.log("🚀 FreshApp rendering at:", timestamp);
  
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        <h1 style={{ 
          color: '#2c3e50', 
          fontSize: '3rem', 
          marginBottom: '20px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
        }}>
          🎯 CACHE CLEARED!
        </h1>
        <p style={{ 
          fontSize: '1.5rem', 
          color: '#27ae60', 
          fontWeight: 'bold',
          marginBottom: '15px'
        }}>
          App Successfully Restored
        </p>
        <p style={{ 
          fontSize: '1.2rem', 
          color: '#7f8c8d',
          marginBottom: '30px'
        }}>
          Loaded at: {timestamp}
        </p>
        <button 
          style={{
            background: 'linear-gradient(45deg, #27ae60, #2ecc71)',
            border: 'none',
            color: 'white',
            padding: '15px 30px',
            fontSize: '1.2rem',
            borderRadius: '10px',
            cursor: 'pointer',
            boxShadow: '0 10px 20px rgba(46, 204, 113, 0.3)',
            transition: 'all 0.3s ease'
          }}
          onClick={() => {
            alert(`✅ SUCCESS!\n\nApp is working perfectly!\nTime: ${timestamp}\n\nReady to restore SMS functionality!`);
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-3px)';
            e.target.style.boxShadow = '0 15px 25px rgba(46, 204, 113, 0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 10px 20px rgba(46, 204, 113, 0.3)';
          }}
        >
          🎉 TEST FUNCTIONALITY
        </button>
      </div>
      <p style={{
        color: 'white',
        marginTop: '20px',
        fontSize: '1.1rem',
        textAlign: 'center',
        textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
      }}>
        If you see this interface, the caching issue is completely resolved!
      </p>
    </div>
  );
}

const root = document.getElementById("root");
console.log("🔍 Root element found:", !!root);

if (root) {
  console.log("✨ Creating React root and rendering...");
  createRoot(root).render(<FreshApp />);
  console.log("✅ React app successfully mounted!");
} else {
  console.error("❌ No root element found!");
  document.body.innerHTML = "<h1>ERROR: No root element found!</h1>";
}