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

// Database health check function
export const checkDbHealth = async () => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('🚨 Database health check failed:', error);
    return false;
  }
};

// Keep database connection alive
setInterval(async () => {
  try {
    await checkDbHealth();
  } catch (error) {
    console.error('🚨 Database keepalive failed:', error);
  }
}, 240000); // Check every 4 minutes (before 5-minute idle timeout)