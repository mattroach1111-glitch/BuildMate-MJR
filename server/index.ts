import express from "express";
import { createServer } from "http";

const app = express();
const PORT = process.env.PORT || 5000;

// Simple test server to get the app running
app.use(express.json());

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working', timestamp: new Date().toISOString() });
});

// Serve static files from Vite
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist/public'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../dist/public/index.html'));
  });
}

const httpServer = createServer(app);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});