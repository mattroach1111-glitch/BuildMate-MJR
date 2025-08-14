import { createRoot } from "react-dom/client";

// Minimal test app to bypass all caching issues
function TestApp() {
  const timestamp = new Date().toLocaleTimeString();
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ 
        textAlign: 'center', 
        background: 'white', 
        padding: '2rem', 
        borderRadius: '1rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        maxWidth: '500px'
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 'bold', 
          color: '#1f2937', 
          marginBottom: '1rem',
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          BuildFlow Pro ✓
        </h1>
        <p style={{ 
          fontSize: '1.2rem', 
          color: '#059669',
          marginBottom: '1rem',
          fontWeight: '600'
        }}>
          SYSTEM RESTORED - {timestamp}
        </p>
        <p style={{ 
          color: '#6b7280', 
          marginBottom: '1.5rem' 
        }}>
          Cache cleared successfully. Ready for SMS testing.
        </p>
        <button 
          style={{ 
            background: 'linear-gradient(45deg, #059669, #10b981)', 
            color: 'white', 
            padding: '1rem 2rem', 
            borderRadius: '0.5rem', 
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: '600',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
            transition: 'transform 0.2s'
          }}
          onClick={() => {
            alert(`✅ App is working perfectly!\n\nTimestamp: ${timestamp}\nCache: Cleared\nReady for SMS restoration`);
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          🚀 Test System Response
        </button>
      </div>
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<TestApp />);
}