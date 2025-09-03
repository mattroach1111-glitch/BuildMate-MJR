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

export const db = drizzle({ client: pool, schema });

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

// Robust database query wrapper that handles suspensions
export const safeDbQuery = async (queryFn: () => Promise<any>) => {
  try {
    return await queryFn();
  } catch (error: any) {
    if (error.code === '57P01' || error.message?.includes('admin shutdown')) {
      console.log('💤 Database suspension detected, retrying query...');
      // Wait a moment for database to wake up, then retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await queryFn();
    }
    throw error;
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