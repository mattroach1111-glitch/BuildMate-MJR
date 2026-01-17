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
  verify: (req: any, res, buf, encoding) => {
    // Log large requests for monitoring
    if (buf.length > 10 * 1024 * 1024) { // 10MB
      console.log(`⚠️ Large request: ${buf.length} bytes to ${req.path}`);
    }
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Request timeout middleware with special handling for AI processing
app.use((req: any, res, next) => {
  // AI processing endpoints need longer timeout
  const isLongRunning = req.path === '/api/email-inbox/process' || 
                        req.path === '/api/quotes/ai-estimate' ||
                        req.path === '/api/quotes/ai-suggest';
  const timeoutDuration = isLongRunning ? 120000 : 30000; // 2 minutes for AI processing, 30 seconds for others
  
  console.log(`⏰ Setting timeout: ${timeoutDuration/1000}s for ${req.method} ${req.path}`);
  
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`🚨 Request timeout: ${req.method} ${req.path} after ${timeoutDuration/1000}s`);
      res.status(408).json({ message: 'Request timeout' });
    }
  }, timeoutDuration);
  
  res.on('finish', () => {
    clearTimeout(timeout);
  });
  
  next();
});

// Setup email webhook
import { setupEmailWebhook } from "./emailWebhook";
setupEmailWebhook(app);

// Email secrets health check - verify all required secrets are present
function checkEmailSecretsHealth() {
  const requiredSecrets = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
  const missingSecrets: string[] = [];
  
  console.log('🔍 Checking email secrets configuration...');
  
  for (const secret of requiredSecrets) {
    if (!process.env[secret]) {
      missingSecrets.push(secret);
    }
  }
  
  if (missingSecrets.length > 0) {
    console.error('');
    console.error('⚠️⚠️⚠️ EMAIL CONFIGURATION WARNING ⚠️⚠️⚠️');
    console.error(`❌ Missing required email secrets: ${missingSecrets.join(', ')}`);
    console.error('📧 Email document processing will NOT work until these secrets are added!');
    console.error('💡 Add missing secrets in the Replit Secrets panel (🔒 icon)');
    console.error('');
  } else {
    console.log('✅ All email secrets configured correctly');
  }
  
  return missingSecrets.length === 0;
}

// Run health check on startup
checkEmailSecretsHealth();


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

  // Migrate existing user Google Drive tokens to system-wide storage
  try {
    const { storage } = await import('./storage');
    
    // Check if system already has tokens
    const systemTokens = await storage.getSystemGoogleDriveTokens();
    
    if (!systemTokens) {
      // No system tokens yet, check if any user has tokens
      const allUsers = await storage.getAllUsers();
      const userWithTokens = allUsers.find(u => u.googleDriveTokens);
      
      if (userWithTokens) {
        console.log(`🔄 Migrating Google Drive tokens from user ${userWithTokens.id} to system-wide storage...`);
        await storage.setSystemGoogleDriveTokens(userWithTokens.googleDriveTokens, userWithTokens.id);
        console.log(`✅ Google Drive tokens migrated to system-wide storage`);
        
        // Clear user tokens as they're no longer needed
        for (const user of allUsers) {
          if (user.googleDriveTokens) {
            await storage.updateUserGoogleDriveTokens(user.id, null);
          }
        }
        console.log(`🧹 Cleared user Google Drive tokens (now using system-wide tokens)`);
      } else {
        console.log(`ℹ️ No existing Google Drive tokens to migrate`);
      }
    } else {
      console.log(`✅ System-wide Google Drive tokens already configured`);
    }
  } catch (migrationError) {
    console.error('⚠️ Error during Google Drive token migration:', migrationError);
    // Don't crash the server on migration errors
  }

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
