import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Global error handlers to prevent server crashes
process.on('unhandledRejection', (reason: any, promise) => {
  console.error('🚨 UNHANDLED PROMISE REJECTION:', reason);
  console.error('🚨 Promise:', promise);
  
  // Handle database suspension errors gracefully
  if (reason?.code === '57P01' || reason?.message?.includes('admin shutdown')) {
    console.log('💤 Database suspension in unhandled rejection - handled gracefully');
    return; // Don't crash on database suspensions
  }
  
  // Don't exit the process, just log and continue
});

process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', error);
  console.error('🚨 Stack:', error.stack);
  
  // Handle database suspension errors gracefully  
  if (error.message?.includes('admin shutdown') || (error as any).code === '57P01') {
    console.log('💤 Database suspension in uncaught exception - handled gracefully');
    return; // Don't crash on database suspensions
  }
  
  // Log but don't exit - let the app continue running
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📤 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📤 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

const app = express();

// Enhanced request handling with timeouts and memory protection
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf, encoding) => {
    // Log large requests for monitoring
    if (buf.length > 10 * 1024 * 1024) { // 10MB
      console.log(`⚠️ Large request: ${buf.length} bytes to ${req.path}`);
    }
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Request timeout middleware (30 seconds)
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`🚨 Request timeout: ${req.method} ${req.path}`);
      res.status(408).json({ message: 'Request timeout' });
    }
  }, 30000);
  
  res.on('finish', () => {
    clearTimeout(timeout);
  });
  
  next();
});

// Setup email webhook
import { setupEmailWebhook } from "./emailWebhook";
setupEmailWebhook(app);


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Enhanced error handler with detailed logging
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Enhanced error logging
    console.error("🚨 Server error:", {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    });
    
    // Check if response already sent to prevent double responses
    if (!res.headersSent) {
      res.status(status).json({ 
        message,
        timestamp: new Date().toISOString(),
        requestId: Math.random().toString(36).substr(2, 9)
      });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
