import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced database configuration for suspension resilience
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000, // Increased timeout
  idleTimeoutMillis: 60000,       // Shorter idle timeout to prevent suspensions
  max: 3,                         // Reduced pool size for stability
  min: 0,                         // Allow pool to empty when inactive
  allowExitOnIdle: true           // Clean up idle connections
});

// Enhanced database connection error handling
pool.on('error', (err, client) => {
  console.error('🚨 Database pool error:', err);
  
  // Handle suspension errors gracefully without crashing
  if ((err as any).code === '57P01' || err.message?.includes('admin shutdown')) {
    console.log('💤 Database suspension detected - pool will auto-recover');
    return; // Don't propagate suspension errors
  }
  
  // Handle WebSocket connection errors
  if (err.message?.includes('WebSocket') || err.message?.includes('connection')) {
    console.log('🔌 Connection error detected - will reconnect automatically');
    return;
  }
});

pool.on('connect', (client) => {
  console.log('🔗 Database pool connection established');
  
  // Handle client-level errors to prevent crashes
  client.on('error', (err) => {
    if ((err as any).code === '57P01' || err.message?.includes('admin shutdown')) {
      console.log('💤 Client suspension detected - handled gracefully');
      return;
    }
    console.error('🚨 Client error:', err);
  });
});

pool.on('remove', () => {
  console.log('🔌 Database connection removed from pool');
});

const rawDb = drizzle({ client: pool, schema });

// Create a resilient database wrapper that automatically handles suspensions
export const db = new Proxy(rawDb, {
  get(target, prop) {
    const originalMethod = target[prop as keyof typeof target];
    
    if (typeof originalMethod === 'function') {
      return async (...args: any[]) => {
        return await safeDbQuery(() => originalMethod.apply(target, args));
      };
    }
    
    return originalMethod;
  }
});

// Database health check function with auto-recovery
export const checkDbHealth = async () => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error: any) {
    console.error('🚨 Database health check failed:', error);
    
    // Handle database suspension gracefully
    if (error.code === '57P01' || error.message?.includes('admin shutdown')) {
      console.log('💤 Database was suspended, will auto-reconnect on next query');
      return false;
    }
    
    return false;
  }
};

// Robust database query wrapper that handles suspensions with multiple retries
export const safeDbQuery = async (queryFn: () => Promise<any>, maxRetries = 3) => {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      return await queryFn();
    } catch (error: any) {
      attempts++;
      
      if (error.code === '57P01' || error.message?.includes('admin shutdown')) {
        console.log(`💤 Database suspension detected (attempt ${attempts}/${maxRetries}), retrying...`);
        
        if (attempts >= maxRetries) {
          console.error('🚨 Max retries exceeded for database suspension');
          throw new Error('Database temporarily unavailable - please try again in a moment');
        }
        
        // Exponential backoff: wait longer each retry
        const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Non-suspension errors should be thrown immediately
      throw error;
    }
  }
};

// Aggressive keepalive to prevent suspensions
setInterval(async () => {
  try {
    await checkDbHealth();
  } catch (error: any) {
    if (error?.code === '57P01' || error?.message?.includes('admin shutdown')) {
      console.log('💤 Keepalive detected suspension - normal behavior');
    } else {
      console.error('🚨 Database keepalive failed, but continuing...', error);
    }
    // Never crash on keepalive failures
  }
}, 90000); // Check every 1.5 minutes for more aggressive prevention