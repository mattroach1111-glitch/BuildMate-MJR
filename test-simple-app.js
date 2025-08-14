// Simple test to see if the app loads
fetch('/api/auth/user')
  .then(res => res.json())
  .then(data => console.log('API working:', data))
  .catch(err => console.error('API error:', err));

console.log('JavaScript is running');
console.log('React app container:', document.getElementById('root'));