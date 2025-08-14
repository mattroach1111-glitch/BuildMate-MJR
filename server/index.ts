import express from "express";
import { createServer } from "http";
import path from "path";
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// API routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working', timestamp: new Date().toISOString() });
});

// Development: Set up Vite with middleware
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      host: '0.0.0.0'
    },
    appType: 'spa',
    root: path.resolve(process.cwd(), 'client'),
  });
  
  app.use(vite.ssrFixStacktrace);
  app.use(vite.middlewares);
  console.log('✅ Vite development server configured');
} else {
  // Production: Serve static files
  app.use(express.static(path.resolve(process.cwd(), 'dist/public')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'dist/public/index.html'));
  });
}

const httpServer = createServer(app);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`🌐 External: http://0.0.0.0:${PORT}`);
});