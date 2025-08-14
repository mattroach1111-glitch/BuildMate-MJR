function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>BuildFlow Pro</h1>
        <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>System Online - Testing Mode</p>
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#e5e7eb', borderRadius: '0.5rem', maxWidth: '400px' }}>
          <p style={{ color: '#374151', marginBottom: '0.5rem' }}>Core systems restored</p>
          <button 
            style={{ 
              background: '#3b82f6', 
              color: 'white', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.25rem', 
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => alert('App is working! Ready to restore full functionality.')}
          >
            Test App Response
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;