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

// Enhanced database configuration with error handling
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000, // 10 second timeout
  idleTimeoutMillis: 300000, // 5 minutes idle timeout (matches Replit DB behavior)
  max: 10, // Maximum 10 connections
  min: 1, // Keep at least 1 connection alive
});

// Database connection error handling
pool.on('error', (err) => {
  console.error('🚨 Database pool error:', err);
});

pool.on('connect', () => {
  console.log('🔗 Database pool connection established');
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

// More aggressive keepalive to prevent suspensions  
setInterval(async () => {
  try {
    await checkDbHealth();
  } catch (error) {
    console.error('🚨 Database keepalive failed, but continuing...', error);
    // Don't crash on keepalive failures
  }
}, 120000); // Check every 2 minutes instead of 4