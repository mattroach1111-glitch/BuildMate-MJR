import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { db } from "./db";
import { 
  timesheetEntries, laborEntries, users, staffNotes, employees, staffMembers, 
  staffNotesEntries, rewardCatalog, jobs, materials, subTrades, otherCosts, 
  tipFees, jobFiles
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { TimesheetPDFGenerator } from "./pdfGenerator";
import { GoogleDriveService } from "./googleDriveService";
import { GoogleDriveAuth } from "./googleAuth";
import { DocumentProcessor } from "./services/documentProcessor";
import { rewardsService } from "./services/rewardsService";

// In-memory storage for reward settings (could be moved to database later)
let rewardSettings = {
  dailySubmissionPoints: 10,
  weeklyBonusPoints: 50,
  fortnightlyBonusPoints: 100,
  monthlyBonusPoints: 200,
  streakBonusMultiplier: 1.5,
  perfectWeekBonus: 25,
  perfectMonthBonus: 100
};
import {
  insertJobSchema,
  insertEmployeeSchema,
  insertLaborEntrySchema,
  insertMaterialSchema,
  insertSubTradeSchema,
  insertOtherCostSchema,
  insertTipFeeSchema,
  insertTimesheetEntrySchema,
  insertJobFileSchema,
  insertNotificationSchema,
  insertStaffMemberSchema,
  insertStaffNoteEntrySchema,
  insertRewardTransactionSchema,
  insertRewardRedemptionSchema,
  insertRewardCatalogSchema,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import * as fuzz from "fuzzball";

// Admin middleware
const isAdmin = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    next();
  } catch (error) {
    console.error("Error checking admin status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Simple and accurate employee matching function
const findBestClientMatch = async (clientName: string, threshold: number = 80): Promise<{ client: string, score: number } | null> => {
  try {
    const allJobs = await storage.getJobs();
    if (!allJobs || allJobs.length === 0) {
      return null;
    }

    const allClients = Array.from(new Set(allJobs.map(job => job.clientName).filter(Boolean)));
    const cleanName = clientName.toLowerCase().trim();
    console.log(`🔍 Looking for client: "${clientName}"`);

    // Step 1: Try exact match first
    for (const client of allClients) {
      if (client.toLowerCase().trim() === cleanName) {
        console.log(`✅ EXACT CLIENT MATCH: "${clientName}" -> "${client}"`);
        return { client, score: 100 };
      }
    }

    // Step 2: Try partial/fuzzy match with simple ratio
    let bestMatch = null;
    let bestScore = 0;

    for (const client of allClients) {
      const score = fuzz.ratio(cleanName, client.toLowerCase().trim());
      console.log(`🔍 Fuzzy client: "${clientName}" vs "${client}" = ${score}%`);
      
      if (score >= threshold && score > bestScore) {
        bestScore = score;
        bestMatch = client;
      }
    }

    if (bestMatch) {
      console.log(`✅ FUZZY CLIENT MATCH: "${clientName}" -> "${bestMatch}" (${bestScore}%)`);
      return { client: bestMatch, score: bestScore };
    }

    console.log(`❌ NO CLIENT MATCH FOUND for "${clientName}" above ${threshold}% threshold`);
    return null;
  } catch (error) {
    console.error("Error in fuzzy client matching:", error);
    return null;
  }
};

const findBestEmployeeMatch = async (employeeName: string, threshold: number = 80): Promise<{ employee: any, score: number } | null> => {
  try {
    const allEmployees = await storage.getEmployees();
    if (!allEmployees || allEmployees.length === 0) {
      return null;
    }

    const cleanName = employeeName.toLowerCase().trim();
    console.log(`🔍 Looking for employee: "${employeeName}"`);

    // Step 1: Try exact match first
    for (const employee of allEmployees) {
      if (employee.name.toLowerCase().trim() === cleanName) {
        console.log(`✅ EXACT MATCH: "${employeeName}" -> "${employee.name}"`);
        return { employee, score: 100 };
      }
    }

    // Step 2: Try partial/fuzzy match with simple ratio
    let bestMatch = null;
    let bestScore = 0;

    for (const employee of allEmployees) {
      const score = fuzz.ratio(cleanName, employee.name.toLowerCase().trim());
      console.log(`🔍 Fuzzy: "${employeeName}" vs "${employee.name}" = ${score}%`);
      
      if (score >= threshold && score > bestScore) {
        bestScore = score;
        bestMatch = employee;
      }
    }

    if (bestMatch) {
      console.log(`✅ FUZZY MATCH: "${employeeName}" -> "${bestMatch.name}" (${bestScore}%)`);
      return { employee: bestMatch, score: bestScore };
    }

    console.log(`❌ NO MATCH FOUND for "${employeeName}" above ${threshold}% threshold`);
    return null;
  } catch (error) {
    console.error("Error in employee matching:", error);
    return null;
  }
};

// Fuzzy job matching function
const findBestJobMatch = async (timesheetJobDescription: string, threshold: number = 90): Promise<{ job: any, score: number } | null> => {
  try {
    const allJobs = await storage.getJobs();
    if (!allJobs || allJobs.length === 0) {
      return null;
    }
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const job of allJobs) {
      const jobIdentifiers = [
        job.jobAddress,
        job.clientName,
        job.projectName,
        `${job.clientName} ${job.jobAddress}`,
        `${job.projectName} ${job.jobAddress}`
      ].filter(Boolean);
      
      for (const identifier of jobIdentifiers) {
        const score = fuzz.ratio(timesheetJobDescription.toLowerCase(), identifier.toLowerCase());
        if (score > bestScore && score >= threshold) {
          bestScore = score;
          bestMatch = job;
        }
      }
    }
    
    return bestMatch ? { job: bestMatch, score: bestScore } : null;
  } catch (error) {
    console.error("Error in fuzzy job matching:", error);
    return null;
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Google Drive authentication routes
  app.get('/api/google-drive/auth-url', isAuthenticated, async (req: any, res) => {
    try {
      const googleAuth = new GoogleDriveAuth();
      const authUrl = googleAuth.getAuthUrl();
      console.log("🔵 Generated Google Drive auth URL:", authUrl);
      res.json({ authUrl });
    } catch (error) {
      console.error("🔴 Error generating Google Drive auth URL:", error);
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get('/api/google-drive/callback', async (req: any, res) => {
    try {
      const { code, state } = req.query;
      console.log("🔵 Google Drive callback received:", { code: !!code, state });
      
      if (!code) {
        console.error("🔴 No authorization code in callback");
        return res.redirect('/?tab=settings&google_drive_error=no_code');
      }

      // For callback, we need to get user from session or state
      // Since this is a callback from Google, we may not have the authenticated user context
      // Let's try to get the user session
      if (!req.user || !req.user.claims || !req.user.claims.sub) {
        console.error("🔴 No authenticated user in callback");
        return res.redirect('/?tab=settings&google_drive_error=no_user');
      }

      const googleAuth = new GoogleDriveAuth();
      const tokens = await googleAuth.getTokens(code as string);
      console.log("🔵 Google Drive tokens received:", { hasAccessToken: !!tokens.access_token, hasRefreshToken: !!tokens.refresh_token });
      
      // Store tokens in user's database record using the authenticated user ID
      const userId = req.user.claims.sub;
      await storage.updateUserGoogleDriveTokens(userId, JSON.stringify(tokens));
      
      console.log(`✅ Google Drive tokens saved for user ${userId}`);
      
      // Redirect back to the admin dashboard settings tab
      res.redirect('/?tab=settings&google_drive_connected=true');
    } catch (error) {
      console.error("🔴 Error handling Google Drive callback:", error);
      res.redirect('/?tab=settings&google_drive_error=callback_failed');
    }
  });

  app.post('/api/google-drive/connect', isAuthenticated, async (req: any, res) => {
    try {
      const { code } = req.body;
      const userId = req.user.claims.sub;
      
      const googleDriveService = new GoogleDriveService();
      const tokens = await googleDriveService.authorize(code);
      
      // Store tokens in user record
      await storage.updateUserGoogleDriveTokens(userId, JSON.stringify(tokens));
      
      res.json({ message: "Google Drive connected successfully" });
    } catch (error) {
      console.error("Error connecting Google Drive:", error);
      res.status(500).json({ message: "Failed to connect Google Drive" });
    }
  });

  app.get('/api/google-drive/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isConnected = !!(user?.googleDriveTokens);
      console.log(`Google Drive status check for user ${userId}: connected=${isConnected}, has tokens=${!!user?.googleDriveTokens}`);
      res.json({ connected: isConnected });
    } catch (error) {
      console.error("Error checking Google Drive status:", error);
      res.status(500).json({ message: "Failed to check Google Drive status" });
    }
  });

  // User management routes
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`User management access attempt by user: ${userId}`);
      
      const currentUser = await storage.getUser(userId);
      console.log(`Current user found: ${currentUser ? `${currentUser.email} (${currentUser.role})` : 'not found'}`);
      
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const users = await storage.getAllUsers();
      console.log(`Returning ${users.length} users for management`);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/users/:userId/role', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      const { role } = req.body;

      if (!role || !['admin', 'staff'].includes(role)) {
        return res.status(400).json({ message: "Valid role (admin or staff) is required" });
      }

      // Prevent demoting yourself from admin
      if (userId === req.user.claims.sub && role === 'staff') {
        return res.status(400).json({ message: "You cannot demote yourself from admin" });
      }

      await storage.updateUserRole(userId, role);
      res.json({ message: "User role updated successfully" });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Pending users routes  
  app.get('/api/unassigned-users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const unassignedUsers = await storage.getUnassignedUsers();
      res.json(unassignedUsers);
    } catch (error) {
      console.error("Error fetching unassigned users:", error);
      res.status(500).json({ message: "Failed to fetch unassigned users" });
    }
  });

  app.post('/api/assign-user-to-employee', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const { userId, employeeId } = req.body;
      
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      if (!userId || !employeeId) {
        return res.status(400).json({ message: "User ID and Employee ID are required" });
      }
      
      await storage.assignUserToEmployee(userId, employeeId);
      console.log(`User ${userId} assigned to employee ${employeeId}`);
      res.json({ message: "User assigned successfully" });
    } catch (error) {
      console.error("Error assigning user to employee:", error);
      res.status(500).json({ message: "Failed to assign user to employee" });
    }
  });

  app.delete('/api/google-drive/disconnect', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUserGoogleDriveTokens(userId, null);
      res.json({ message: "Google Drive disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Google Drive:", error);
      res.status(500).json({ message: "Failed to disconnect Google Drive" });
    }
  });

  // Employee routes
  app.get("/api/employees", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployeeWithAllJobs(validatedData);
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating employee:", error);
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  app.patch("/api/employees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertEmployeeSchema.partial().parse(req.body);
      const employee = await storage.updateEmployee(req.params.id, validatedData);
      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating employee:", error);
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteEmployee(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting employee:", error);
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });





  // Job routes
  app.get("/api/jobs/total-costs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const totalCosts = await storage.getTotalActiveCosts();
      res.json(totalCosts);
    } catch (error) {
      console.error("Error fetching total costs:", error);
      res.status(500).json({ message: "Failed to fetch total costs" });
    }
  });

  app.get("/api/jobs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Sync employees to this job to ensure all current staff are included
      await storage.syncEmployeesToJob(job.id);

      // Get related data
      const [laborEntries, materials, subTrades, otherCosts, tipFees] = await Promise.all([
        storage.getLaborEntriesForJob(job.id),
        storage.getMaterialsForJob(job.id),
        storage.getSubTradesForJob(job.id),
        storage.getOtherCostsForJob(job.id),
        storage.getTipFeesForJob(job.id),
      ]);

      res.json({
        ...job,
        laborEntries,
        materials,
        subTrades,
        otherCosts,
        tipFees,
      });
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  app.post("/api/jobs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      console.log("Received job data:", JSON.stringify(req.body, null, 2));

      const validatedData = insertJobSchema.parse(req.body);
      const job = await storage.createJob(validatedData);
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating job:", error);
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  app.patch("/api/jobs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Check if this is a simple status update
      if (req.body.status && Object.keys(req.body).length === 1) {
        const job = await storage.updateJobStatus(req.params.id, req.body.status);
        return res.json(job);
      }

      // Otherwise, handle as a full job update
      const validatedData = insertJobSchema.partial().parse(req.body);
      
      // Check if defaultHourlyRate is being updated
      if (validatedData.defaultHourlyRate) {
        console.log(`[HOURLY_RATE] Updating default hourly rate for job ${req.params.id} to ${validatedData.defaultHourlyRate}`);
        // Update all existing labor entries with the new rate
        await storage.updateAllLaborRatesForJob(req.params.id, validatedData.defaultHourlyRate);
      }
      
      const job = await storage.updateJob(req.params.id, validatedData);
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating job:", error);
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  app.delete("/api/jobs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        console.error(`Delete job failed: User ${req.user.claims.sub} is not admin, role: ${user?.role}`);
        return res.status(403).json({ message: "Admin access required" });
      }

      const jobId = req.params.id;
      console.log(`Attempting to delete job: ${jobId}`);
      
      // Check if job exists before attempting deletion
      const existingJob = await storage.getJob(jobId);
      if (!existingJob) {
        console.error(`Delete job failed: Job ${jobId} not found`);
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (existingJob.isDeleted) {
        console.error(`Delete job failed: Job ${jobId} is already deleted`);
        return res.status(400).json({ message: "Job is already deleted" });
      }

      await storage.softDeleteJob(jobId);
      console.log(`Successfully deleted job: ${jobId}`);
      res.json({ message: "Job moved to deleted folder" });
    } catch (error) {
      console.error("Error deleting job:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to delete job", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Add route to get deleted jobs - must come before generic job routes
  app.get("/api/deleted-jobs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const deletedJobs = await storage.getDeletedJobs();
      res.json(deletedJobs);
    } catch (error) {
      console.error("Error fetching deleted jobs:", error);
      res.status(500).json({ message: "Failed to fetch deleted jobs" });
    }
  });

  // Add route to restore deleted job
  app.patch("/api/jobs/:id/restore", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.restoreJob(req.params.id);
      res.json({ message: "Job restored successfully" });
    } catch (error) {
      console.error("Error restoring job:", error);
      res.status(500).json({ message: "Failed to restore job" });
    }
  });

  // Add route to permanently delete a job
  app.delete("/api/jobs/:id/permanent", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.permanentlyDeleteJob(req.params.id);
      res.json({ message: "Job permanently deleted" });
    } catch (error) {
      console.error("Error permanently deleting job:", error);
      res.status(500).json({ message: "Failed to permanently delete job" });
    }
  });

  // Get timesheet data for a specific job
  app.get("/api/jobs/:id/timesheets", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const jobTimesheets = await storage.getJobTimesheets(req.params.id);
      res.json(jobTimesheets);
    } catch (error) {
      console.error("Error fetching job timesheets:", error);
      res.status(500).json({ message: "Failed to fetch job timesheets" });
    }
  });

  // Labor entry routes
  app.patch("/api/labor-entries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertLaborEntrySchema.partial().parse(req.body);
      const laborEntry = await storage.updateLaborEntry(req.params.id, validatedData);
      res.json(laborEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating labor entry:", error);
      res.status(500).json({ message: "Failed to update labor entry" });
    }
  });

  app.patch("/api/labor-entries/:id/add-extra-hours", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { extraHours } = req.body;
      if (!extraHours || isNaN(parseFloat(extraHours)) || parseFloat(extraHours) <= 0) {
        return res.status(400).json({ message: "Valid extra hours amount required" });
      }

      const laborEntry = await storage.addExtraHoursToLaborEntry(req.params.id, extraHours);
      res.json(laborEntry);
    } catch (error) {
      console.error("Error adding extra hours:", error);
      res.status(500).json({ message: "Failed to add extra hours" });
    }
  });

  // Update labor entry hours (admin only)
  app.patch("/api/labor-entries/:id/hours", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { hoursLogged } = req.body;
      if (hoursLogged === undefined || isNaN(parseFloat(hoursLogged)) || parseFloat(hoursLogged) < 0) {
        return res.status(400).json({ message: "Valid hours logged amount required (0 or greater)" });
      }

      const laborEntry = await storage.updateLaborEntry(req.params.id, { 
        hoursLogged: parseFloat(hoursLogged).toString() 
      });
      res.json(laborEntry);
    } catch (error) {
      console.error("Error updating labor hours:", error);
      res.status(500).json({ message: "Failed to update labor hours" });
    }
  });

  app.post("/api/jobs/:jobId/labor", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertLaborEntrySchema.parse({
        ...req.body,
        jobId: req.params.jobId,
      });
      const entry = await storage.createLaborEntry(validatedData);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating labor entry:", error);
      res.status(500).json({ message: "Failed to create labor entry" });
    }
  });

  app.patch("/api/labor/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertLaborEntrySchema.partial().parse(req.body);
      const entry = await storage.updateLaborEntry(req.params.id, validatedData);
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating labor entry:", error);
      res.status(500).json({ message: "Failed to update labor entry" });
    }
  });

  app.delete("/api/labor/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteLaborEntry(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting labor entry:", error);
      res.status(500).json({ message: "Failed to delete labor entry" });
    }
  });

  // Material routes
  app.post("/api/jobs/:jobId/materials", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      console.log("Received material data:", JSON.stringify(req.body, null, 2));

      const validatedData = insertMaterialSchema.parse({
        ...req.body,
        jobId: req.params.jobId,
      });
      const material = await storage.createMaterial(validatedData);
      res.status(201).json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Material validation error:", error.errors);
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating material:", error);
      res.status(500).json({ message: "Failed to create material" });
    }
  });

  app.patch("/api/materials/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertMaterialSchema.partial().parse(req.body);
      const material = await storage.updateMaterial(req.params.id, validatedData);
      res.json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating material:", error);
      res.status(500).json({ message: "Failed to update material" });
    }
  });

  app.delete("/api/materials/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteMaterial(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting material:", error);
      res.status(500).json({ message: "Failed to delete material" });
    }
  });

  // Add consumables to existing jobs that don't have them
  app.post("/api/admin/add-consumables-to-existing-jobs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const jobs = await storage.getJobs();
      let addedCount = 0;

      for (const job of jobs) {
        const materials = await storage.getMaterialsForJob(job.id);
        const hasConsumables = materials.some(material => 
          material.description.toLowerCase() === "consumables"
        );

        if (!hasConsumables) {
          await storage.updateConsumablesForJob(job.id);
          addedCount++;
        }
      }

      res.json({ message: `Added consumables to ${addedCount} jobs` });
    } catch (error) {
      console.error("Error adding consumables to existing jobs:", error);
      res.status(500).json({ error: "Failed to add consumables to existing jobs" });
    }
  });

  // Tip fees routes
  app.post("/api/jobs/:jobId/tipfees", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertTipFeeSchema.parse({
        ...req.body,
        jobId: req.params.jobId,
      });
      const tipFee = await storage.createTipFee(validatedData);
      res.status(201).json(tipFee);
    } catch (error) {
      console.error("Error creating tip fee:", error);
      res.status(500).json({ message: "Failed to create tip fee" });
    }
  });

  app.patch("/api/tipfees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertTipFeeSchema.partial().parse(req.body);
      const tipFee = await storage.updateTipFee(req.params.id, validatedData);
      res.json(tipFee);
    } catch (error) {
      console.error("Error updating tip fee:", error);
      res.status(500).json({ message: "Failed to update tip fee" });
    }
  });

  app.delete("/api/tipfees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteTipFee(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tip fee:", error);
      res.status(500).json({ message: "Failed to delete tip fee" });
    }
  });

  // Sub trade routes
  app.post("/api/jobs/:jobId/subtrades", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertSubTradeSchema.parse({
        ...req.body,
        jobId: req.params.jobId,
      });
      const subTrade = await storage.createSubTrade(validatedData);
      res.status(201).json(subTrade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating sub trade:", error);
      res.status(500).json({ message: "Failed to create sub trade" });
    }
  });

  app.patch("/api/subtrades/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertSubTradeSchema.partial().parse(req.body);
      const subTrade = await storage.updateSubTrade(req.params.id, validatedData);
      res.json(subTrade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating sub trade:", error);
      res.status(500).json({ message: "Failed to update sub trade" });
    }
  });

  app.delete("/api/subtrades/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteSubTrade(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting sub trade:", error);
      res.status(500).json({ message: "Failed to delete sub trade" });
    }
  });

  // Other costs routes
  app.post("/api/jobs/:jobId/othercosts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertOtherCostSchema.parse({
        ...req.body,
        jobId: req.params.jobId,
      });
      const otherCost = await storage.createOtherCost(validatedData);
      res.status(201).json(otherCost);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating other cost:", error);
      res.status(500).json({ message: "Failed to create other cost" });
    }
  });

  app.patch("/api/othercosts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertOtherCostSchema.partial().parse(req.body);
      const otherCost = await storage.updateOtherCost(req.params.id, validatedData);
      res.json(otherCost);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating other cost:", error);
      res.status(500).json({ message: "Failed to update other cost" });
    }
  });

  app.delete("/api/othercosts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteOtherCost(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting other cost:", error);
      res.status(500).json({ message: "Failed to delete other cost" });
    }
  });

  // Timesheet routes
  app.get("/api/timesheet", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Use the same logic as POST - staff_id must be the user ID due to foreign key constraint
      const staffId = userId; // Always use the authenticated user's ID
      
      const entries = await storage.getTimesheetEntries(staffId);
      console.log(`Fetching timesheet entries for user ${user.email} (staffId: ${staffId}), found ${entries.length} entries`);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching timesheet entries:", error);
      res.status(500).json({ message: "Failed to fetch timesheet entries" });
    }
  });

  // Admin timesheet routes
  app.get("/api/admin/timesheets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const entries = await storage.getAllTimesheetEntries();
      res.json(entries);
    } catch (error) {
      console.error("Error fetching all timesheet entries:", error);
      res.status(500).json({ message: "Failed to fetch timesheet entries" });
    }
  });

  // Get specific employee's timesheet entries for admin
  app.get("/api/admin/timesheets/:employeeId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const employeeId = req.params.employeeId;
      const entries = await storage.getTimesheetEntries(employeeId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching employee timesheet entries:", error);
      res.status(500).json({ message: "Failed to fetch employee timesheet entries" });
    }
  });

  // Approve individual timesheet entry (legacy - kept for backwards compatibility)
  app.patch("/api/admin/timesheet/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { approved } = req.body;
      await storage.updateTimesheetApproval(req.params.id, approved);
      res.status(200).json({ message: "Timesheet approval updated" });
    } catch (error) {
      console.error("Error updating timesheet approval:", error);
      res.status(500).json({ message: "Failed to update timesheet approval" });
    }
  });

  // Approve all timesheet entries for a staff member's fortnight
  app.patch("/api/admin/timesheet/approve-fortnight", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { staffId, fortnightStart, fortnightEnd, approved } = req.body;
      
      if (!staffId || !fortnightStart || !fortnightEnd) {
        return res.status(400).json({ message: "staffId, fortnightStart, and fortnightEnd are required" });
      }

      // If approving, check for custom addresses without job sheet matches
      if (approved) {
        const fortnightEntries = await storage.getTimesheetEntriesByPeriod(staffId, fortnightStart, fortnightEnd);
        const unmatchedCustomAddresses = [];
        
        for (const entry of fortnightEntries) {
          if (entry.description && entry.description.startsWith('CUSTOM_ADDRESS:')) {
            const customAddress = entry.description.replace('CUSTOM_ADDRESS: ', '');
            const jobMatch = await findBestJobMatch(customAddress, 80);
            
            if (!jobMatch) {
              unmatchedCustomAddresses.push(customAddress);
            } else {
              // Auto-match and update the entry
              console.log(`✅ Auto-matching custom address "${customAddress}" to job: ${jobMatch.job.jobAddress} (${jobMatch.score}% match)`);
              await storage.updateTimesheetEntry(entry.id, { 
                jobId: jobMatch.job.id, 
                description: null 
              });
            }
          }
        }
        
        // If there are unmatched custom addresses, prevent approval
        if (unmatchedCustomAddresses.length > 0) {
          return res.status(400).json({ 
            message: `Cannot approve fortnight - the following custom addresses have no matching job sheets: ${unmatchedCustomAddresses.join(', ')}. Please create job sheets that closely match these addresses first.`,
            requiresJobSheets: true,
            unmatchedAddresses: unmatchedCustomAddresses
          });
        }
      }

      await storage.updateFortnightApproval(staffId, fortnightStart, fortnightEnd, approved);
      
      const action = approved ? "approved" : "unapproved";
      res.status(200).json({ 
        message: `Fortnight timesheet ${action} successfully`,
        staffId,
        fortnightStart,
        fortnightEnd,
        approved
      });
    } catch (error) {
      console.error("Error updating fortnight approval:", error);
      res.status(500).json({ message: "Failed to update fortnight approval" });
    }
  });

  app.delete("/api/admin/timesheet/clear-fortnight", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { staffId, fortnightStart, fortnightEnd } = req.body;
      
      if (!staffId || !fortnightStart || !fortnightEnd) {
        return res.status(400).json({ message: "staffId, fortnightStart, and fortnightEnd are required" });
      }

      await storage.clearFortnightTimesheet(staffId, fortnightStart, fortnightEnd);
      
      res.status(200).json({ 
        message: "Fortnight timesheet cleared successfully",
        staffId,
        fortnightStart,
        fortnightEnd
      });
    } catch (error) {
      console.error("Error clearing fortnight timesheet:", error);
      res.status(500).json({ message: "Failed to clear fortnight timesheet" });
    }
  });

  app.delete("/api/admin/timesheet/entry/:entryId", isAuthenticated, async (req: any, res) => {
    try {
      console.log('DELETE /api/admin/timesheet/entry/:entryId called');
      const userId = req.user.claims.sub;
      console.log('User ID:', userId);
      const user = await storage.getUser(userId);
      console.log('User:', user);
      
      if (user?.role !== 'admin') {
        console.log('User is not admin, role:', user?.role);
        return res.status(403).json({ message: "Admin access required" });
      }

      const entryId = req.params.entryId;
      console.log('Entry ID to clear:', entryId);
      
      if (!entryId) {
        return res.status(400).json({ message: "Entry ID is required" });
      }

      await storage.clearTimesheetEntry(entryId);
      console.log('Entry cleared successfully');
      
      res.status(200).json({ 
        message: "Timesheet entry cleared successfully",
        entryId
      });
    } catch (error) {
      console.error("Error clearing timesheet entry:", error);
      res.status(500).json({ message: "Failed to clear timesheet entry", error: (error as Error).message });
    }
  });

  // Edit custom address for timesheet entry
  app.patch("/api/admin/timesheet/:entryId/custom-address", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const entryId = req.params.entryId;
      const { address } = req.body;
      
      if (!entryId) {
        return res.status(400).json({ message: "Entry ID is required" });
      }

      if (!address || !address.trim()) {
        return res.status(400).json({ message: "Address is required" });
      }

      // Get the existing entry to verify it's a custom address
      const entry = await storage.getTimesheetEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Timesheet entry not found" });
      }

      if (!entry.description || !entry.description.startsWith('CUSTOM_ADDRESS:')) {
        return res.status(400).json({ message: "This entry is not a custom address" });
      }

      if (entry.approved) {
        return res.status(400).json({ message: "Cannot edit approved timesheet entries" });
      }

      // Update the custom address
      const updatedDescription = `CUSTOM_ADDRESS: ${address.trim()}`;
      await storage.updateTimesheetEntry(entryId, { description: updatedDescription });
      
      res.status(200).json({ 
        message: "Custom address updated successfully",
        entryId,
        address: address.trim()
      });
    } catch (error) {
      console.error("Error updating custom address:", error);
      res.status(500).json({ message: "Failed to update custom address", error: (error as Error).message });
    }
  });

  app.post("/api/admin/timesheet", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertTimesheetEntrySchema.parse(req.body);
      
      console.log("Admin creating timesheet entry for staffId:", validatedData.staffId);
      console.log("Admin user ID:", userId);
      
      // Check if staffId is a valid user, if not, create a user record for the employee
      const existingUser = await storage.getUser(validatedData.staffId);
      if (!existingUser) {
        // Try to get employee data to create a user record
        const employee = await storage.getEmployee(validatedData.staffId);
        if (employee) {
          console.log("Creating user record for employee:", employee.name);
          // Create a user record for this employee
          await storage.upsertUser({
            id: employee.id,
            email: `${employee.name.toLowerCase().replace(/\s+/g, '.')}@company.local`,
            firstName: employee.name.split(' ')[0],
            lastName: employee.name.split(' ').slice(1).join(' ') || '',
            role: 'staff'
          });
        } else {
          return res.status(400).json({ message: "Invalid staff member selected" });
        }
      } else {
        console.log("Using existing user:", existingUser.firstName || existingUser.email);
      }

      const entry = await storage.createAdminTimesheetEntry(validatedData);
      console.log("Created timesheet entry with staffId:", entry.staffId);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating admin timesheet entry:", error);
      res.status(500).json({ message: "Failed to create timesheet entry" });
    }
  });

  // Get staff users for admin timesheet creation
  app.get("/api/staff-users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const staffForTimesheets = await storage.getStaffForTimesheets();
      res.json(staffForTimesheets);
    } catch (error) {
      console.error("Error fetching staff for timesheets:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post("/api/timesheet", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get the authenticated user to check for corresponding employee record
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if the date is a weekend (Saturday = 6, Sunday = 0)
      const entryDate = new Date(req.body.date);
      const dayOfWeek = entryDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (isWeekend && !req.body.weekendConfirmed) {
        const dayName = dayOfWeek === 0 ? 'Sunday' : 'Saturday';
        console.log(`🚫 WEEKEND ENTRY BLOCKED: User ${user.email} attempted to create entry on ${dayName} ${req.body.date} without confirmation`);
        return res.status(400).json({ 
          message: `Weekend entries require confirmation. Click "Yes, I worked this weekend" to proceed.`,
          isWeekend: true,
          dayName,
          requiresConfirmation: true
        });
      }
      
      if (isWeekend && req.body.weekendConfirmed) {
        const dayName = dayOfWeek === 0 ? 'Sunday' : 'Saturday';
        console.log(`✅ WEEKEND ENTRY CONFIRMED: User ${user.email} confirmed weekend work on ${dayName} ${req.body.date}`);
      }
      
      // The staff_id in timesheet_entries must reference a user ID (not employee ID)
      // This is because of the foreign key constraint: timesheet_entries.staff_id -> users.id
      const staffId = userId; // Always use the authenticated user's ID
      
      // Optional: Log which employee this corresponds to for debugging
      const employees = await storage.getEmployees();
      const userEmployee = employees.find((emp: any) => {
        const userName = (user.firstName + ' ' + (user.lastName || '')).trim();
        return emp.name.toLowerCase() === userName.toLowerCase();
      });
      
      if (userEmployee) {
        console.log(`Creating timesheet entry for staff: ${staffId} (user: ${user.email}) corresponding to employee ${userEmployee.name} (${userEmployee.id})`);
      } else {
        console.log(`Creating timesheet entry for staff: ${staffId} (user: ${user.email}) - no corresponding employee found`);
      }
      
      // Validate and clean numeric fields
      if (req.body.hours !== undefined) {
        const hoursStr = String(req.body.hours).trim();
        if (hoursStr === '' || hoursStr === null) {
          req.body.hours = '0';
        } else {
          const hoursNum = parseFloat(hoursStr);
          if (isNaN(hoursNum)) {
            return res.status(400).json({ error: "Invalid hours value" });
          }
          // Ensure hours are within valid range for database (precision 5, scale 2 = max 999.99)
          if (hoursNum < 0 || hoursNum > 999.99) {
            return res.status(400).json({ error: "Hours must be between 0 and 999.99" });
          }
          req.body.hours = hoursNum.toString();
        }
      }
      
      // Handle special leave types and Tafe by storing them in materials field and setting jobId to null
      const { jobId, materials, description, ...otherData } = req.body;
      const leaveTypes = ['sick-leave', 'personal-leave', 'annual-leave', 'rdo', 'leave-without-pay', 'tafe'];
      let finalJobId = jobId;
      let finalMaterials = materials || '';
      let finalDescription = description || null;
      let needsJobSheetMatch = false;
      
      if (leaveTypes.includes(jobId)) {
        finalJobId = null;
        finalMaterials = jobId; // Store leave type or tafe in materials field
      } else if (jobId === 'no-job') {
        finalJobId = null;
      } else if (jobId === 'custom-address') {
        // Handle custom address case - set jobId to null and process description
        finalJobId = null;
        if (description && description.startsWith('CUSTOM_ADDRESS:')) {
          // Check for job sheet match for custom addresses
          const customAddress = description.replace('CUSTOM_ADDRESS: ', '');
          const jobMatch = await findBestJobMatch(customAddress, 80);
          
          if (jobMatch) {
            console.log(`✅ Found matching job sheet for custom address "${customAddress}": ${jobMatch.job.jobAddress} (${jobMatch.score}% match)`);
            finalJobId = jobMatch.job.id;
            finalDescription = null; // Clear custom address description since we have a real job
          } else {
            console.log(`⚠️  No job sheet found for custom address "${customAddress}" - entry will need manual approval`);
            finalDescription = description;
            needsJobSheetMatch = true;
          }
        }
      } else if (description && description.startsWith('CUSTOM_ADDRESS:')) {
        // This is a custom address entry - check for job sheet match
        const customAddress = description.replace('CUSTOM_ADDRESS: ', '');
        const jobMatch = await findBestJobMatch(customAddress, 80);
        
        if (jobMatch) {
          console.log(`✅ Found matching job sheet for custom address "${customAddress}": ${jobMatch.job.jobAddress} (${jobMatch.score}% match)`);
          // Use the matched job ID instead of null
          finalJobId = jobMatch.job.id;
          finalDescription = null; // Clear custom address description since we have a real job
        } else {
          console.log(`⚠️  No job sheet found for custom address "${customAddress}" - entry will need manual approval`);
          finalJobId = null;
          finalDescription = description;
          needsJobSheetMatch = true;
        }
      }
      
      const validatedData = insertTimesheetEntrySchema.parse({
        ...otherData,
        staffId: staffId,
        jobId: finalJobId,
        materials: finalMaterials,
        description: finalDescription,
        // Mark as needing approval if no job sheet match found
        approved: needsJobSheetMatch ? false : otherData.approved,
      });
      const entry = await storage.upsertTimesheetEntry(validatedData);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating timesheet entry:", error);
      res.status(500).json({ message: "Failed to create timesheet entry" });
    }
  });

  app.post("/api/timesheet/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fortnightStart, fortnightEnd } = req.body;
      
      // Get the authenticated user to find corresponding employee
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Find the employee record for this user
      let staffId = userId;
      let userEmployee = null;
      const employees = await storage.getEmployees();
      
      // Check if user is directly assigned to an employee
      if (user && user.employeeId && user.isAssigned) {
        // User has been assigned to a specific employee
        const assignedEmployee = employees.find(emp => emp.id === user.employeeId);
        if (assignedEmployee) {
          staffId = assignedEmployee.id;
          userEmployee = assignedEmployee;
        }
      } else {
        // Fallback: find by matching patterns for unassigned users
        userEmployee = employees.find((emp: any) => {
          // First try to match by user ID (for users created from employees)
          if (emp.id === userId) {
            return true;
          }
          // Fallback: match by name patterns for backwards compatibility
          if (user) {
            const userName = (user.firstName + ' ' + (user.lastName || '')).trim();
            return emp.name.toLowerCase() === userName.toLowerCase();
          }
          return false;
        });
        
        if (userEmployee) {
          staffId = userEmployee.id;
        }
      }
      
      // Get timesheet entries for the fortnight using the correct user ID (not employee ID)
      const entries = await storage.getTimesheetEntriesByPeriod(userId, fortnightStart, fortnightEnd);
      
      console.log(`PDF Generation - Fetching entries for userId: ${userId}, period: ${fortnightStart} to ${fortnightEnd}`);
      console.log(`PDF Generation - Found ${entries.length} entries for PDF generation`);
      
      // Mark all entries as submitted when confirming timesheet
      await storage.markTimesheetEntriesAsSubmitted(userId, fortnightStart, fortnightEnd);
      
      let driveLink = null;
      let googleDriveConnected = false;
      
      // Only generate PDF to Google Drive when admin approves hours
      // For staff submissions, just confirm the timesheet without PDF generation
      const isAdmin = user && user.role === 'admin';
      
      if (isAdmin) {
        // Generate and save PDF to Google Drive if admin has connected their account
        try {
          if (!userEmployee) {
            throw new Error('Employee not found');
          }
          
          const pdfGenerator = new TimesheetPDFGenerator();
          
          const employeeData = {
            id: userEmployee.id,
            name: userEmployee.name,
            hourlyRate: parseFloat(userEmployee.defaultHourlyRate) || 50
          };
          
          const pdfBuffer = pdfGenerator.generateTimesheetPDF(
            employeeData,
            entries,
            fortnightStart,
            fortnightEnd
          );
          
          // Try to upload to Google Drive if admin has connected their account
          if (user.googleDriveTokens) {
            try {
              const googleDriveService = new GoogleDriveService();
              const tokens = JSON.parse(user.googleDriveTokens);
              googleDriveService.setUserTokens(tokens);
              
              const fileName = `timesheet-${userEmployee.name}-${fortnightStart}-${fortnightEnd}.pdf`;
              
              // Create main BuildFlow Pro folder first
              const mainFolderId = await googleDriveService.findOrCreateFolder('BuildFlow Pro');
              
              // Create or find Timesheets folder inside BuildFlow Pro
              const buildFlowFolderId = await googleDriveService.findOrCreateFolder('Timesheets', mainFolderId);
              
              // Upload PDF to Google Drive
              driveLink = await googleDriveService.uploadPDF(fileName, pdfBuffer, buildFlowFolderId || undefined);
              googleDriveConnected = true;
              
              if (driveLink) {
                console.log(`PDF saved to Google Drive: ${driveLink}`);
              }
            } catch (driveError) {
              console.error('Google Drive upload failed:', driveError);
              // Don't fail the whole request if Google Drive upload fails
            }
          }
        } catch (pdfError) {
          console.error('Error generating PDF:', pdfError);
          // Don't fail the whole request if PDF generation fails
        }
      }
      
      // Mark all timesheet entries for this period as confirmed/approved
      await storage.markTimesheetEntriesConfirmed(userId, fortnightStart, fortnightEnd);
      console.log(`Marked timesheet entries as confirmed for user ${userId} from ${fortnightStart} to ${fortnightEnd}`);
      
      // Process rewards for timesheet submission (if not admin confirming for someone else)
      let rewardsResult = null;
      if (!isAdmin) {
        try {
          // Process rewards for each day in the submission period
          const startDate = new Date(fortnightStart);
          const endDate = new Date(fortnightEnd);
          const submittedDates = entries.map(entry => entry.date).filter(Boolean);
          
          // Award points for each unique submission date
          const uniqueDates = [...new Set(submittedDates)];
          let totalPointsEarned = 0;
          let newAchievements: any[] = [];
          let currentStreak = 0;
          
          for (const submissionDate of uniqueDates) {
            const result = await rewardsService.processTimesheetSubmission(userId, submissionDate);
            totalPointsEarned += result.pointsEarned;
            newAchievements.push(...result.achievements);
            currentStreak = result.newStreak; // Use the latest streak
          }
          
          rewardsResult = {
            totalPointsEarned,
            newAchievements,
            currentStreak,
            daysProcessed: uniqueDates.length
          };
          
          console.log(`Rewards processed for ${uniqueDates.length} days: +${totalPointsEarned} points, streak: ${currentStreak}`);
        } catch (rewardsError) {
          console.error("Error processing rewards:", rewardsError);
          // Don't fail the whole timesheet submission if rewards fail
        }
      }
      
      res.json({ 
        message: isAdmin 
          ? (googleDriveConnected && driveLink 
              ? "Timesheet approved successfully. PDF generated and saved to your Google Drive in 'BuildFlow Pro/Timesheets' folder."
              : googleDriveConnected 
                ? "Timesheet approved successfully. PDF generated but Google Drive upload failed."
                : "Timesheet approved successfully. Connect Google Drive to automatically save PDFs.")
          : "Timesheet submitted successfully.",
        fortnightStart,
        fortnightEnd,
        confirmedAt: new Date().toISOString(),
        driveLink: driveLink || null,
        googleDriveConnected,
        rewards: rewardsResult
      });
    } catch (error) {
      console.error("Error confirming timesheet:", error);
      res.status(500).json({ message: "Failed to confirm timesheet" });
    }
  });

  // Job Updates Email endpoint
  app.post("/api/job-updates/email", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { updates, emailSubject, additionalNotes, recipientEmails } = req.body;
      
      console.log('Job update request body:', { 
        hasUpdates: !!updates, 
        updatesCount: updates?.length, 
        hasSubject: !!emailSubject,
        hasRecipientEmails: !!recipientEmails,
        recipientEmailsValue: recipientEmails
      });
      
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: "No job updates provided" });
      }

      if (!recipientEmails || !recipientEmails.trim()) {
        return res.status(400).json({ message: "At least one recipient email is required" });
      }

      // Parse and validate email addresses
      const emailList = recipientEmails
        .split(',')
        .map((email: string) => email.trim())
        .filter((email: string) => email.length > 0);

      if (emailList.length === 0) {
        return res.status(400).json({ message: "No valid email addresses found" });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emailList.filter((email: string) => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        return res.status(400).json({ 
          message: `Invalid email addresses: ${invalidEmails.join(', ')}` 
        });
      }

      // Check if email is configured
      const { isEmailConfigured } = await import('./services/emailService');
      if (!isEmailConfigured()) {
        return res.status(500).json({ 
          message: "Email service not configured. Please set up SMTP credentials." 
        });
      }

      // Get job details for the updates
      const jobIds = updates.map((update: any) => update.jobId);
      const jobs = await storage.getJobsByIds(jobIds);
      
      // Create job updates map
      const updatesMap = updates.reduce((acc: any, update: any) => {
        acc[update.jobId] = update.update;
        return acc;
      }, {});

      // Generate email content
      let emailContent = `Job Updates Report - ${new Date().toLocaleDateString()}\n\n`;
      
      for (const job of jobs) {
        const update = updatesMap[job.id];
        if (update) {
          emailContent += `${job.jobAddress}\n`;
          emailContent += `Client: ${job.clientName} | PM: ${job.projectName}\n`;
          emailContent += `Status: ${job.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}\n`;
          emailContent += `Update: ${update}\n\n`;
          emailContent += "─".repeat(50) + "\n\n";
        }
      }

      if (additionalNotes && additionalNotes.trim()) {
        emailContent += `Additional Notes:\n${additionalNotes}\n\n`;
      }

      emailContent += `Generated on ${new Date().toLocaleString()}\nBuildFlow Pro - Construction Management System`;

      // Send emails to all recipients
      const { sendEmail } = await import('./services/emailService');
      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@yourdomain.com';
      
      let successCount = 0;
      let failedEmails: string[] = [];
      
      // Send email to each recipient
      for (const email of emailList) {
        try {
          const emailSent = await sendEmail({
            to: email,
            from: fromEmail,
            subject: emailSubject,
            text: emailContent,
            html: emailContent.replace(/\n/g, '<br>').replace(/─/g, '&mdash;')
          });
          
          if (emailSent) {
            successCount++;
          } else {
            failedEmails.push(email);
          }
        } catch (error) {
          console.error(`Failed to send email to ${email}:`, error);
          failedEmails.push(email);
        }
      }

      if (successCount > 0) {
        const responseMessage = failedEmails.length > 0 
          ? `Job updates sent to ${successCount} recipients. Failed to send to: ${failedEmails.join(', ')}`
          : `Job updates sent successfully to all ${successCount} recipients`;
          
        res.json({ 
          message: responseMessage,
          subject: emailSubject,
          updatesCount: updates.length,
          jobsUpdated: jobs.length,
          successCount,
          failedCount: failedEmails.length,
          sentTo: emailList.filter((email: string) => !failedEmails.includes(email)),
          failedEmails
        });
      } else {
        res.status(500).json({ 
          message: "Failed to send emails to any recipients",
          failedEmails
        });
      }

    } catch (error) {
      console.error("Error sending job updates email:", error);
      res.status(500).json({ message: "Failed to send job updates email" });
    }
  });

  // Admin endpoint to delete pending staff user
  // Timesheet search endpoint for admins
  app.get("/api/timesheet-search", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const filters = {
        query: req.query.q as string,
        employeeName: req.query.employeeName as string,
        jobAddress: req.query.jobAddress as string,
        client: req.query.client as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        approvalStatus: req.query.approvalStatus as string,
        minHours: req.query.minHours as string,
        maxHours: req.query.maxHours as string
      };

      // Remove empty filters
      Object.keys(filters).forEach(key => {
        if (!filters[key as keyof typeof filters]) {
          delete filters[key as keyof typeof filters];
        }
      });

      const results = await storage.searchTimesheetEntries(filters);
      
      res.json({ 
        results,
        totalCount: results.length,
        searchCriteria: filters
      });
    } catch (error) {
      console.error("Error searching timesheet entries:", error);
      res.status(500).json({ message: "Failed to search timesheet entries" });
    }
  });

  app.delete("/api/users/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Check if user exists and get their details
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deletion of admin users (safety check)
      if (user.role === 'admin') {
        return res.status(403).json({ message: "Cannot delete admin users" });
      }

      // Check if user has any timesheet entries
      const timesheetCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(timesheetEntries)
        .where(eq(timesheetEntries.staffId, userId));

      if (timesheetCount[0]?.count > 0) {
        return res.status(400).json({ 
          message: "Cannot delete user with existing timesheet entries. Please clear entries first." 
        });
      }

      // Delete the user
      await db
        .delete(users)
        .where(eq(users.id, userId));

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin endpoint to reset user assignment (unlink from employee)
  app.patch("/api/users/:userId/reset-assignment", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Reset the user assignment
      await db
        .update(users)
        .set({ 
          employeeId: null,
          isAssigned: false,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      res.json({ message: "User assignment reset successfully" });
    } catch (error) {
      console.error("Error resetting user assignment:", error);
      res.status(500).json({ message: "Failed to reset user assignment" });
    }
  });

  // Admin endpoint to assign user to employee
  app.patch("/api/users/:userId/assign-employee", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { employeeId } = req.body;

      if (!userId || !employeeId) {
        return res.status(400).json({ message: "User ID and Employee ID are required" });
      }

      // Verify the employee exists
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Update the user with employee assignment
      await db
        .update(users)
        .set({ 
          employeeId: employeeId,
          isAssigned: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      res.json({ message: "User assigned to employee successfully" });
    } catch (error) {
      console.error("Error assigning user to employee:", error);
      res.status(500).json({ message: "Failed to assign user to employee" });
    }
  });

  // Removed database reset endpoint for production safety

  // Edit individual timesheet entry
  app.patch("/api/timesheet/:id", isAuthenticated, async (req: any, res) => {
    try {
      const entryId = req.params.id;
      const updates = req.body;
      
      // Validate and clean numeric fields
      if (updates.hours !== undefined) {
        const hoursStr = String(updates.hours).trim();
        if (hoursStr === '' || hoursStr === null) {
          updates.hours = '0';
        } else {
          const hoursNum = parseFloat(hoursStr);
          if (isNaN(hoursNum)) {
            return res.status(400).json({ error: "Invalid hours value" });
          }
          // Ensure hours are within valid range for database (precision 5, scale 2 = max 999.99)
          if (hoursNum < 0 || hoursNum > 999.99) {
            return res.status(400).json({ error: "Hours must be between 0 and 999.99" });
          }
          updates.hours = hoursNum.toString();
        }
      }
      
      // Handle special leave types and Tafe by storing them in materials field and setting jobId to null
      const { jobId, materials, ...otherData } = updates;
      const leaveTypes = ['sick-leave', 'personal-leave', 'annual-leave', 'rdo', 'tafe'];
      let finalJobId = jobId;
      let finalMaterials = materials || '';
      
      if (leaveTypes.includes(jobId)) {
        finalJobId = null;
        finalMaterials = jobId; // Store leave type or tafe in materials field
      } else if (jobId === 'no-job') {
        finalJobId = null;
      }
      
      const updateData = {
        ...otherData,
        jobId: finalJobId,
        materials: finalMaterials,
      };
      
      const updatedEntry = await storage.updateTimesheetEntry(entryId, updateData);
      res.json(updatedEntry);
    } catch (error) {
      console.error("Error updating timesheet entry:", error);
      res.status(500).json({ error: "Failed to update timesheet entry" });
    }
  });

  app.delete("/api/timesheet/:id", isAuthenticated, async (req: any, res) => {
    try {
      const entryId = req.params.id;
      console.log(`Attempting to delete timesheet entry: ${entryId}`);
      
      await storage.deleteTimesheetEntry(entryId);
      console.log(`Successfully deleted timesheet entry: ${entryId}`);
      
      res.json({ message: "Timesheet entry deleted successfully" });
    } catch (error) {
      console.error("Error deleting timesheet entry:", error);
      res.status(500).json({ error: "Failed to delete timesheet entry" });
    }
  });

  // Admin endpoint to approve timesheet entry with job sheet matching check
  app.patch("/api/timesheet/:id/approve", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { approved, hours } = req.body;
      
      // Get the timesheet entry first
      const entry = await storage.getTimesheetEntry(id);
      if (!entry) {
        return res.status(404).json({ message: "Timesheet entry not found" });
      }
      
      // Check if this entry has a custom address without job sheet match
      if (approved && entry.description && entry.description.startsWith('CUSTOM_ADDRESS:')) {
        const customAddress = entry.description.replace('CUSTOM_ADDRESS: ', '');
        const jobMatch = await findBestJobMatch(customAddress, 80);
        
        if (!jobMatch) {
          return res.status(400).json({ 
            message: `Cannot approve timesheet entry for "${customAddress}" - no matching job sheet found. Please create a job sheet that closely matches this address first.`,
            requiresJobSheet: true,
            customAddress: customAddress
          });
        } else {
          console.log(`✅ Job sheet match found during approval for "${customAddress}": ${jobMatch.job.jobAddress} (${jobMatch.score}% match)`);
          // Update the entry to use the matched job ID
          await storage.updateTimesheetEntry(id, { 
            approved, 
            hours, 
            jobId: jobMatch.job.id, 
            description: null 
          });
          
          // Update labor hours in the matched job
          if (entry.jobId) {
            await storage.updateLaborHoursFromTimesheet(entry.staffId, jobMatch.job.id);
            console.log(`Updated labor hours for matched job ${jobMatch.job.id} with ${hours} hours from timesheet entry ${id}`);
          }
          
          return res.json({ 
            success: true, 
            matchedJob: jobMatch.job,
            matchScore: jobMatch.score 
          });
        }
      }
      
      // Normal approval process for entries with existing job IDs
      await storage.updateTimesheetEntry(id, { approved, hours });
      
      if (approved && entry.jobId) {
        // Update labor hours in the corresponding job
        await storage.updateLaborHoursFromTimesheet(entry.staffId, entry.jobId);
        console.log(`Updated labor hours for job ${entry.jobId} with ${hours} hours from timesheet entry ${id}`);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error approving timesheet entry:", error);
      res.status(500).json({ message: "Failed to approve timesheet entry" });
    }
  });

  // Test endpoint for fuzzy job matching (admin only)
  app.post("/api/admin/test-job-match", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { customAddress } = req.body;
      if (!customAddress) {
        return res.status(400).json({ message: "Custom address is required" });
      }
      
      const jobMatch = await findBestJobMatch(customAddress, 80);
      
      if (jobMatch) {
        res.json({
          match: true,
          job: jobMatch.job,
          score: jobMatch.score,
          message: `Found matching job: ${jobMatch.job.jobName} at ${jobMatch.job.address} (${jobMatch.score}% match)`
        });
      } else {
        res.json({
          match: false,
          message: `No job sheet found matching "${customAddress}" with 80% or higher similarity`
        });
      }
    } catch (error) {
      console.error("Error testing job match:", error);
      res.status(500).json({ message: "Failed to test job match" });
    }
  });

  app.get("/api/jobs-for-staff", isAuthenticated, async (req: any, res) => {
    try {
      const jobs = await storage.getJobsForStaff();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs for staff:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });


  // Get timesheet entries for a specific period and staff member
  app.get("/api/timesheet-entries/:staffId/:startDate/:endDate", isAuthenticated, async (req: any, res) => {
    try {
      const { staffId, startDate, endDate } = req.params;
      const entries = await storage.getTimesheetEntriesByPeriod(staffId, startDate, endDate);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching timesheet entries:", error);
      res.status(500).json({ message: "Failed to fetch timesheet entries" });
    }
  });

  // Create timesheet entry
  app.post("/api/timesheet-entries", isAuthenticated, async (req: any, res) => {
    try {
      const entry = await storage.createTimesheetEntry(req.body);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating timesheet entry:", error);
      res.status(500).json({ message: "Failed to create timesheet entry" });
    }
  });

  // Update timesheet entry
  app.patch("/api/timesheet-entries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.updateTimesheetEntry(id, req.body);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating timesheet entry:", error);
      res.status(500).json({ message: "Failed to update timesheet entry" });
    }
  });

  // Admin endpoint to clear all timesheet entries for a specific employee
  app.delete("/api/admin/employee/:employeeId/timesheets", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { employeeId } = req.params;
      
      // Verify the employee exists
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Get all timesheet entries for this employee
      const entries = await db
        .select()
        .from(timesheetEntries)
        .where(eq(timesheetEntries.staffId, employeeId));
      
      if (entries.length === 0) {
        return res.json({ 
          message: `No timesheet entries found for ${employee.name}`,
          deletedCount: 0 
        });
      }
      
      // Delete all timesheet entries for this employee
      await db
        .delete(timesheetEntries)
        .where(eq(timesheetEntries.staffId, employeeId));
      
      // Also update labor hours for all jobs this employee worked on
      const jobIds = [...new Set(entries.map(entry => entry.jobId).filter(Boolean))];
      for (const jobId of jobIds) {
        if (jobId) {
          await storage.updateLaborHoursFromTimesheet(employeeId, jobId);
        }
      }
      
      console.log(`🗑️ Admin cleared ${entries.length} timesheet entries for employee ${employeeId}`);
      
      res.json({ 
        message: `Successfully cleared ${entries.length} timesheet entries for ${employee.name}`,
        deletedCount: entries.length,
        employeeName: `${employee.name}`
      });
    } catch (error) {
      console.error("Error clearing employee timesheets:", error);
      res.status(500).json({ message: "Failed to clear employee timesheets" });
    }
  });

  // Job file routes
  // Get upload URL for job files
  app.post("/api/job-files/upload-url", isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Save job file metadata after upload
  app.post("/api/job-files", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertJobFileSchema.parse({
        ...req.body,
        uploadedById: userId,
      });

      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(req.body.objectPath);
      
      // Get job details for Google Drive upload
      const job = await storage.getJob(validatedData.jobId);
      let googleDriveLink = null;

      if (job) {
        try {
          // Get Google Drive service with user tokens
          const user = await storage.getUser(userId);
          if (user?.googleDriveTokens) {
            const googleDriveService = new GoogleDriveService();
            googleDriveService.setUserTokens(JSON.parse(user.googleDriveTokens));

            // Download file from object storage
            const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
            const chunks: Buffer[] = [];
            
            const stream = objectFile.createReadStream();
            for await (const chunk of stream) {
              chunks.push(Buffer.from(chunk));
            }
            const fileBuffer = Buffer.concat(chunks);

            // Upload to Google Drive in job folder
            const driveResult = await googleDriveService.uploadJobAttachment(
              validatedData.originalName,
              fileBuffer,
              validatedData.mimeType,
              job.jobAddress
            );

            if (driveResult) {
              googleDriveLink = driveResult.webViewLink;
              console.log(`✅ Job attachment uploaded to Google Drive: ${validatedData.originalName}`);
            }
          } else {
            console.log('⚠️ No Google Drive tokens available - file saved to object storage only');
          }
        } catch (driveError) {
          console.error('Error uploading to Google Drive (file saved to object storage):', driveError);
        }
      }
      
      const jobFile = await storage.createJobFile({
        ...validatedData,
        objectPath: normalizedPath,
        googleDriveLink,
      });

      res.status(201).json(jobFile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating job file:", error);
      res.status(500).json({ message: "Failed to create job file" });
    }
  });

  // Get job files for a specific job
  app.get("/api/jobs/:jobId/files", isAuthenticated, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const files = await storage.getJobFiles(jobId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching job files:", error);
      res.status(500).json({ message: "Failed to fetch job files" });
    }
  });

  // Download job file
  app.get("/api/job-files/:fileId/download", isAuthenticated, async (req: any, res) => {
    try {
      const { fileId } = req.params;
      const file = await storage.getJobFile(fileId);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Handle Google Drive files vs object storage files
      if (file.googleDriveLink) {
        // For Google Drive files, redirect to the Google Drive link
        return res.redirect(file.googleDriveLink);
      }

      if (!file.objectPath) {
        return res.status(404).json({ message: "File not found - no storage path available" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
      
      // Set filename header for download
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Delete job file
  app.delete("/api/job-files/:fileId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { fileId } = req.params;
      
      // Get file info before deleting for logging
      const file = await storage.getJobFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      console.log(`[FILE_DELETE] Deleting file: ${file.fileName} (ID: ${fileId})`);
      
      await storage.deleteJobFile(fileId);
      
      console.log(`[FILE_DELETE] Successfully deleted file: ${file.fileName}`);
      res.json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting job file:", error);
      res.status(500).json({ message: "Failed to delete job file" });
    }
  });

  // Notification routes
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const notifications = await storage.getNotificationsForUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const notifications = await storage.getActiveNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching active notifications:", error);
      res.status(500).json({ error: "Failed to fetch active notifications" });
    }
  });

  app.post("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const result = insertNotificationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid notification data", details: result.error.errors });
      }

      const notification = await storage.createNotification(result.data);
      res.status(201).json(notification);
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = req.params.id;
      await storage.markNotificationAsRead(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = req.params.id;
      await storage.dismissNotification(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing notification:", error);
      res.status(500).json({ error: "Failed to dismiss notification" });
    }
  });

  // Update user notification preferences
  app.put('/api/user/notification-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const { preferences } = req.body;
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Validate preferences structure
      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({ message: 'Invalid preferences format' });
      }
      
      // Update user preferences
      await storage.updateUserNotificationPreferences(userId, JSON.stringify(preferences));
      
      res.json({ message: 'Notification preferences updated successfully' });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Document upload endpoints for expense processing
  
  // Endpoint to get upload URL for expense documents (legacy object storage)
  app.post("/api/documents/upload", isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting document upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Endpoint to upload documents directly to Google Drive
  app.post("/api/documents/upload-to-drive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.googleDriveTokens) {
        return res.status(400).json({ 
          error: "Google Drive not connected. Please connect your Google Drive account first." 
        });
      }

      const { documentURL, fileName, mimeType, fileSize, jobId } = req.body;
      
      if (!documentURL || !fileName || !jobId) {
        return res.status(400).json({ error: "Document URL, file name, and job ID are required" });
      }

      // Verify job exists
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Download the file from object storage
      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(documentURL);
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      
      // Stream the file content to a buffer
      const stream = objectFile.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      // Upload to Google Drive
      const googleDriveService = new GoogleDriveService();
      const tokens = JSON.parse(user.googleDriveTokens);
      googleDriveService.setUserTokens(tokens);

      // Create main BuildFlow Pro folder first
      const mainFolderId = await googleDriveService.findOrCreateFolder('BuildFlow Pro');
      
      // Create/find job folder inside BuildFlow Pro folder
      const jobFolderId = await googleDriveService.findOrCreateFolder(`Job - ${job.jobAddress}`, mainFolderId);
      
      // Upload file to Google Drive
      const uploadResult = await googleDriveService.uploadFile(fileName, fileBuffer, mimeType || 'application/octet-stream', jobFolderId || undefined);
      
      if (!uploadResult) {
        return res.status(500).json({ error: "Failed to upload to Google Drive" });
      }

      // Find existing file record and update it with Google Drive info
      const existingFile = await storage.findExistingJobFile(jobId, fileName, documentURL);
      
      let fileRecord;
      if (existingFile) {
        // Update existing file record with Google Drive info
        fileRecord = await storage.updateJobFile(existingFile.id, {
          googleDriveLink: uploadResult.webViewLink,
          googleDriveFileId: uploadResult.fileId
        });
        console.log(`✅ Updated existing file record ${existingFile.id} with Google Drive link`);
      } else {
        // Create new file record if none exists (fallback case)
        fileRecord = await storage.createJobFile({
          jobId: jobId,
          fileName: fileName,
          originalName: fileName,
          fileSize: fileSize || fileBuffer.length,
          mimeType: mimeType || 'application/octet-stream',
          objectPath: documentURL, // Keep the object storage path
          googleDriveLink: uploadResult.webViewLink,
          googleDriveFileId: uploadResult.fileId,
          uploadedById: userId
        });
        console.log(`✅ Created new file record with Google Drive link`);
      }

      res.json({
        success: true,
        fileId: fileRecord.id,
        googleDriveLink: uploadResult.webViewLink,
        message: "Document uploaded to Google Drive successfully"
      });

    } catch (error) {
      console.error("Error uploading to Google Drive:", error);
      res.status(500).json({ error: "Failed to upload document to Google Drive" });
    }
  });

  // Endpoint to convert PDF to image for embedding in job sheet PDFs
  app.post("/api/documents/convert-pdf-to-image", isAuthenticated, async (req: any, res) => {
    try {
      const { objectPath } = req.body;
      
      if (!objectPath) {
        return res.status(400).json({ error: "Object path is required" });
      }

      const documentProcessor = new DocumentProcessor();
      
      // Use the existing PDF-to-image conversion method
      const base64Image = await documentProcessor.convertPdfToImage(objectPath);
      
      res.json({ 
        success: true,
        base64Image: base64Image
      });
      
    } catch (error) {
      console.error("Error converting PDF to image:", error);
      res.status(500).json({ error: "Failed to convert PDF to image" });
    }
  });

  // Endpoint to process uploaded document and extract expense data
  app.post("/api/documents/process", isAuthenticated, async (req: any, res) => {
    try {
      const { documentURL, jobId } = req.body;
      
      if (!documentURL) {
        return res.status(400).json({ error: "Document URL is required" });
      }
      
      if (!jobId) {
        return res.status(400).json({ error: "Job ID is required" });
      }

      // Verify job exists and user has access
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const objectStorageService = new ObjectStorageService();
      const documentProcessor = new DocumentProcessor();
      
      // Get the document file metadata to determine content type
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(documentURL);
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      const [metadata] = await objectFile.getMetadata();
      
      // Process document with AI (now handles PDF conversion internally)
      const expenseData = await documentProcessor.analyzeExpenseDocument(
        documentURL,
        metadata.contentType || 'application/pdf'
      );
      
      // Return extracted data for user review (no longer auto-adds to job sheet)
      res.json({
        success: true,
        expenseData,
        message: `Document processed successfully with ${Math.round(expenseData.confidence * 100)}% confidence. Review the information before adding to job sheet.`
      });
      
    } catch (error) {
      console.error("Error processing document:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.status(500).json({ 
        error: "Failed to process document", 
        details: (error as Error).message 
      });
    }
  });

  // Endpoint to process complete job cost sheets and create new jobs
  app.post("/api/documents/create-job", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { documentURL, jobAddress: manualJobAddress, clientName: manualClientName, projectManager } = req.body;
      
      if (!documentURL) {
        return res.status(400).json({ error: "Document URL is required" });
      }
      
      if (!manualJobAddress || !manualClientName) {
        return res.status(400).json({ error: "Job address and client name are required" });
      }

      const objectStorageService = new ObjectStorageService();
      const documentProcessor = new DocumentProcessor();
      
      // Get the document file metadata to determine content type
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(documentURL);
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      const [metadata] = await objectFile.getMetadata();
      
      // Process complete job sheet with AI
      const jobData = await documentProcessor.analyzeCompleteJobSheet(
        documentURL,
        metadata.contentType || 'application/pdf'
      );
      
      console.log('🔵 Extracted job data:', JSON.stringify(jobData, null, 2));
      console.log('🔵 SubTrades extracted:', jobData.subTrades?.length || 0, jobData.subTrades);
      console.log('🔵 Original AI extracted address:', JSON.stringify(jobData.jobAddress));
      console.log('🔵 Document URL for filename extraction:', documentURL);
      
      // Use manual inputs provided by user instead of AI extraction
      const jobAddress = manualJobAddress.trim();
      let clientName = manualClientName.trim();
      const projectName = jobAddress; // Use job address as project name
      
      // Use provided project manager or default to null (not job address)
      const finalProjectManager = projectManager?.trim() || null;
      
      // Try fuzzy matching for client name (80% threshold)
      const clientMatch = await findBestClientMatch(clientName, 80);
      if (clientMatch) {
        clientName = clientMatch.client;
        console.log(`🔵 Using fuzzy matched client name: "${manualClientName}" -> "${clientName}" (${clientMatch.score}% match)`);
      } else {
        console.log(`🔵 Using new client name: "${clientName}"`);
      }
      
      console.log('🔵 Using manual inputs - Job Address:', jobAddress, 'Client Name:', clientName);
      
      const newJob = await storage.createJobFromPDF({
        jobAddress: jobAddress,
        clientName: clientName,
        projectName: projectName,
        projectManager: finalProjectManager,
        status: "job_in_progress",
        builderMargin: "0.00", // Always 0% margin for PDF uploads
        defaultHourlyRate: "64.00"
      });

      console.log('🔵 Created job:', newJob);

      // Add labor entries with fuzzy employee matching and auto-creation
      let laborEntriesCreated = 0;
      for (const laborEntry of jobData.laborEntries) {
        if (laborEntry.hours > 0) {
          let employeeId: string | undefined;
          
          // Try accurate employee matching (70% threshold)  
          const fuzzyMatch = await findBestEmployeeMatch(laborEntry.employeeName, 70);
          if (fuzzyMatch) {
            employeeId = fuzzyMatch.employee.id;
            console.log(`🔵 Fuzzy matched "${laborEntry.employeeName}" to existing employee "${fuzzyMatch.employee.name}" (${fuzzyMatch.score}% match)`);
          } else {
            // If no fuzzy match, create new employee for this job only
            console.log(`🔵 Creating new employee for this job only: ${laborEntry.employeeName}`);
            const newEmployee = await storage.createEmployeeForJob({
              name: laborEntry.employeeName
            }, newJob.id, parseFloat(laborEntry.rate) || parseFloat(defaultHourlyRate));
            employeeId = newEmployee.id;
          }
          
          if (employeeId) {
            await storage.createLaborEntry({
              jobId: newJob.id,
              staffId: employeeId,
              hoursLogged: laborEntry.hours.toString(),
              hourlyRate: (laborEntry.rate || laborEntry.hourlyRate || 64).toString()
            });
          }
          laborEntriesCreated++;
        }
      }

      // Add materials (only individual supply items)
      let materialsCreated = 0;
      for (const material of jobData.materials) {
        // Use the quantity as the amount if rate is null (AI sometimes puts cost in quantity field)
        const materialAmount = material.rate ? (material.quantity * material.rate) : material.quantity;
        if (materialAmount > 0) {
          await storage.createMaterial({
            jobId: newJob.id,
            description: material.description,
            supplier: material.vendor || 'Unknown Supplier',
            amount: materialAmount.toString(),
            invoiceDate: material.date
          });
          materialsCreated++;
        }
      }

      // Add subtrades (trade services)
      let subTradesCreated = 0;
      if (jobData.subTrades) {
        for (const subTrade of jobData.subTrades) {
          if (subTrade.cost > 0) {
            await storage.createSubTrade({
              jobId: newJob.id,
              trade: subTrade.description,
              contractor: subTrade.vendor || "Trade Service",
              amount: subTrade.cost.toString()
            });
            subTradesCreated++;
          }
        }
      }

      // Add tip fees if any
      if (jobData.tipFees) {
        for (const tipFee of jobData.tipFees) {
          if (tipFee.cost > 0) {
            await storage.createTipFee({
              jobId: newJob.id,
              description: tipFee.description,
              amount: tipFee.cost.toString()
            });
          }
        }
      }

      // Add other costs if any (only if amount > 0)
      if (jobData.otherCosts) {
        for (const otherCost of jobData.otherCosts) {
          if (otherCost.cost > 0) {
            await storage.createOtherCost({
              jobId: newJob.id,
              description: otherCost.description,
              amount: otherCost.cost.toString()
            });
          }
        }
      }

      // Calculate material totals (no auto-consumables since AI already extracts them)
      const materialTotal = jobData.materials.reduce((sum: number, mat: any) => {
        const amount = mat.rate ? (mat.quantity * mat.rate) : mat.quantity;
        return sum + amount;
      }, 0);

      // Handle file record creation and Google Drive upload (avoid duplicates)
      let googleDriveResult = null;
      try {
        // Generate filename from document URL
        let fileName = 'job-sheet.pdf';
        try {
          const urlParts = documentURL.split('/');
          const lastPart = urlParts[urlParts.length - 1];
          if (lastPart && lastPart.includes('.')) {
            fileName = decodeURIComponent(lastPart);
          }
        } catch (e) {
          console.log('Could not extract filename from URL, using default');
        }
        
        // Check if a file record already exists to avoid duplicates (by object path or filename)
        const existingFile = await storage.findExistingJobFile(newJob.id, fileName, normalizedPath);
        
        if (existingFile) {
          console.log('🔵 File record already exists, updating with job ID:', existingFile.id);
          // File already exists, just update the Google Drive info if needed
          const currentUser = await storage.getUser(req.user.claims.sub);
          if (currentUser?.googleDriveTokens && !existingFile.googleDriveLink) {
            // Need to upload to Google Drive and update the existing record
            const stream = objectFile.createReadStream();
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            const googleDriveService = new GoogleDriveService();
            const tokens = JSON.parse(currentUser.googleDriveTokens);
            googleDriveService.setUserTokens(tokens);

            // Create main BuildFlow Pro folder first
            const mainFolderId = await googleDriveService.findOrCreateFolder('BuildFlow Pro');
            
            const jobFolderId = await googleDriveService.findOrCreateFolder(`Job - ${jobAddress}`, mainFolderId);
            
            const uploadResult = await googleDriveService.uploadFile(
              fileName, 
              fileBuffer, 
              metadata.contentType || 'application/pdf', 
              jobFolderId || undefined
            );
            
            if (uploadResult) {
              console.log(`✅ Job sheet uploaded to Google Drive: ${uploadResult.webViewLink}`);
              // Update existing file record with Google Drive info
              await storage.updateJobFile(existingFile.id, {
                googleDriveLink: uploadResult.webViewLink,
                googleDriveFileId: uploadResult.fileId
              });
              
              googleDriveResult = {
                link: uploadResult.webViewLink,
                fileId: uploadResult.fileId
              };
            }
          } else if (existingFile.googleDriveLink) {
            // File already has Google Drive link
            googleDriveResult = {
              link: existingFile.googleDriveLink,
              fileId: existingFile.googleDriveFileId
            };
          }
        } else {
          console.log('🔵 No existing file record found, creating new one');
          // No existing file record, create a new one
          const currentUser = await storage.getUser(req.user.claims.sub);
          
          // Get file metadata first
          const [fileMetadata] = await objectFile.getMetadata();
          
          if (currentUser?.googleDriveTokens) {
            console.log('🔵 Google Drive connected, uploading job sheet PDF...');
            
            const stream = objectFile.createReadStream();
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            const googleDriveService = new GoogleDriveService();
            const tokens = JSON.parse(currentUser.googleDriveTokens);
            googleDriveService.setUserTokens(tokens);

            // Create main BuildFlow Pro folder first
            const mainFolderId = await googleDriveService.findOrCreateFolder('BuildFlow Pro');
            
            const jobFolderId = await googleDriveService.findOrCreateFolder(`Job - ${jobAddress}`, mainFolderId);
            
            const uploadResult = await googleDriveService.uploadFile(
              fileName, 
              fileBuffer, 
              metadata.contentType || 'application/pdf', 
              jobFolderId || undefined
            );
            
            if (uploadResult) {
              console.log(`✅ Job sheet uploaded to Google Drive: ${uploadResult.webViewLink}`);
              
              // Create single file record with both object storage and Google Drive info
              const createdFile = await storage.createJobFile({
                jobId: newJob.id,
                fileName: fileName,
                originalName: fileName,
                fileSize: fileBuffer.length,
                mimeType: metadata.contentType || 'application/pdf',
                objectPath: normalizedPath,
                googleDriveLink: uploadResult.webViewLink,
                googleDriveFileId: uploadResult.fileId,
                uploadedById: req.user.claims.sub
              });
              console.log(`🔵 Created single file record with ID: ${createdFile.id}`);
              
              googleDriveResult = {
                link: uploadResult.webViewLink,
                fileId: uploadResult.fileId
              };
            } else {
              // Google Drive upload failed, create object storage only record
              const createdFile = await storage.createJobFile({
                jobId: newJob.id,
                fileName: fileName,
                originalName: fileName,
                fileSize: parseInt(fileMetadata.size || '0'),
                mimeType: metadata.contentType || 'application/pdf',
                objectPath: normalizedPath,
                googleDriveLink: null,
                googleDriveFileId: null,
                uploadedById: req.user.claims.sub
              });
              console.log(`🔵 Created object storage only file record with ID: ${createdFile.id}`);
            }
          } else {
            console.log('🔵 Google Drive not connected, creating file record for object storage only');
            
            const createdFile = await storage.createJobFile({
              jobId: newJob.id,
              fileName: fileName,
              originalName: fileName,
              fileSize: parseInt(fileMetadata.size || '0'),
              mimeType: metadata.contentType || 'application/pdf',
              objectPath: normalizedPath,
              googleDriveLink: null,
              googleDriveFileId: null,
              uploadedById: req.user.claims.sub
            });
            console.log(`🔵 Created object storage file record with ID: ${createdFile.id}`);
          }
        }
      } catch (error) {
        console.error('Error processing job sheet file:', error);
        // Don't fail the entire process if file processing fails
      }

      res.json({
        success: true,
        job: newJob,
        googleDriveResult,
        summary: {
          laborEntries: laborEntriesCreated,
          materials: materialsCreated,
          subTrades: subTradesCreated,
          tipFees: jobData.tipFees?.length || 0,
          otherCosts: jobData.otherCosts?.length || 0,
          totalLaborHours: jobData.laborEntries.reduce((sum: number, entry: any) => sum + entry.hours, 0),
          materialTotal
        },
        confidence: jobData.confidence,
        message: `Complete job created successfully from cost sheet with ${Math.round(jobData.confidence * 100)}% confidence`
      });
      
    } catch (error) {
      console.error("Error creating job from document:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.status(500).json({ 
        error: "Failed to create job from document", 
        details: (error as Error).message 
      });
    }
  });

  // Endpoint to serve uploaded documents
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving document:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Email inbox endpoints for automatic document processing
  
  // Get unique email address for document submission
  app.get("/api/email-inbox/address", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Generate a unique email address for this user
      // Use the actual email address that's configured
      const emailAddress = process.env.EMAIL_USER || "documents@mjrbuilders.com.au";
      
      res.json({ 
        emailAddress,
        instructions: "Send invoices, bills, and expense documents to this email address for automatic processing. Include the job name in the email subject for auto-assignment.",
        features: [
          "Automatic expense extraction using AI",
          "Smart categorization (materials, sub-trades, other costs)",
          "Direct addition to specified job sheets",
          "PDF and image support",
          "Email confirmation when processed"
        ]
      });
    } catch (error) {
      console.error("Error generating email address:", error);
      res.status(500).json({ error: "Failed to generate email address" });
    }
  });

  // Manual email processing trigger
  app.post("/api/email-inbox/process", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { EmailInboxService } = await import('./services/emailInboxService');
      const emailService = new EmailInboxService();
      const result = await emailService.processInbox(userId);
      
      res.json({
        message: "Email processing completed",
        ...result
      });
    } catch (error) {
      console.error("Error processing emails:", error);
      res.status(500).json({ error: "Failed to process emails" });
    }
  });

  // Email job sheet PDF endpoint
  app.post("/api/jobs/:id/email-pdf", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const jobId = req.params.id;
      const { to, subject, message, pdfData } = req.body;

      if (!to || !to.trim()) {
        return res.status(400).json({ message: "Recipient email is required" });
      }

      // Get job details
      const jobDetails = await storage.getJob(jobId);
      if (!jobDetails) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get all job data for PDF generation
      const [laborEntries, materials, subTrades, otherCosts, tipFees, jobFiles, timesheets] = await Promise.all([
        storage.getLaborEntriesForJob(jobId),
        storage.getMaterialsForJob(jobId),
        storage.getSubTradesForJob(jobId),
        storage.getOtherCostsForJob(jobId),
        storage.getTipFeesForJob(jobId),
        storage.getJobFiles(jobId),
        storage.getJobTimesheets(jobId)
      ]);

      const jobWithDetails = {
        ...jobDetails,
        laborEntries,
        materials,
        subTrades,
        otherCosts,
        tipFees,
        timesheets
      };

      // PDF generation will be handled on the client side
      // We'll receive the PDF data in the request body
      if (!pdfData) {
        return res.status(400).json({ message: "PDF data is required" });
      }

      // Convert base64 PDF data to buffer
      const pdfBuffer = Buffer.from(pdfData, 'base64');
      
      // Upload PDF to Google Drive for public access (optional)
      let googleDrivePdfLink = null;
      try {
        const user = await storage.getUser(req.user.claims.sub);
        if (user?.googleDriveTokens) {
          const googleDriveService = new GoogleDriveService();
          googleDriveService.setUserTokens(JSON.parse(user.googleDriveTokens));

          // Upload PDF to Google Drive job folder
          const pdfFileName = `JobSheet_${jobDetails.jobAddress.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
          const driveResult = await googleDriveService.uploadJobAttachment(
            pdfFileName,
            pdfBuffer,
            'application/pdf',
            jobDetails.jobAddress
          );

          if (driveResult) {
            googleDrivePdfLink = driveResult.webViewLink;
            console.log(`✅ Job sheet PDF uploaded to Google Drive: ${pdfFileName}`);
          }
        }
      } catch (driveError) {
        console.log('⚠️ Failed to upload PDF to Google Drive (email will still be sent):', driveError);
      }
      
      // Send email with PDF attachment and optional Google Drive link
      const { sendEmail } = await import('./services/emailService');
      
      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "jobs@mjrbuilders.com.au";
      
      // Enhanced email content with Google Drive link if available
      let emailText = message || `Please find attached the job sheet for ${jobDetails.jobAddress}.`;
      let emailHtml = `<p>${(message || `Please find attached the job sheet for ${jobDetails.jobAddress}.`).replace(/\n/g, '<br>')}</p>`;
      
      if (googleDrivePdfLink) {
        emailText += `\n\nYou can also view the PDF online: ${googleDrivePdfLink}`;
        emailHtml += `<br><br><p><strong>View PDF online:</strong> <a href="${googleDrivePdfLink}">Click here to open in Google Drive</a></p>`;
      }
      
      const emailSuccess = await sendEmail({
        from: fromEmail,
        to: to.trim(),
        subject: subject || `Job Sheet - ${jobDetails.jobAddress}`,
        text: emailText,
        html: emailHtml,
        attachments: [{
          filename: `JobSheet_${jobDetails.jobAddress.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });

      if (emailSuccess) {
        res.json({ message: "Job sheet PDF sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send email" });
      }
    } catch (error) {
      console.error("Error emailing job sheet PDF:", error);
      res.status(500).json({ message: "Failed to send job sheet PDF" });
    }
  });

  // Get email processing status and recent activity
  app.get("/api/email-inbox/status", isAuthenticated, async (req: any, res) => {
    try {
      // Get recent email processing activity
      const recentActivity = await storage.getRecentEmailProcessingActivity(5);
      const allLogs = await storage.getEmailProcessingLogs();
      
      // Calculate total processed count
      const totalProcessed = allLogs.filter(log => log.status === "completed").length;
      const lastChecked = allLogs.length > 0 ? allLogs[allLogs.length - 1].createdAt : new Date();
      
      // Use the actual email address from environment or default
      const emailAddress = process.env.EMAIL_USER || "documents@mjrbuilders.com.au";
      
      res.json({
        status: "active",
        emailAddress,
        lastChecked: new Date(lastChecked).toISOString(),
        recentProcessed: recentActivity,
        totalProcessed
      });
    } catch (error) {
      console.error("Error getting email status:", error);
      res.status(500).json({ error: "Failed to get email status" });
    }
  });

  // Helper function to extract job ID from email subject
  async function extractJobFromEmailSubject(emailSubject: string | undefined, storage: any): Promise<string | null> {
    if (!emailSubject) return null;
    
    try {
      const allJobs = await storage.getJobs();
      
      // Look for job address patterns in the email subject
      for (const job of allJobs) {
        // Check if job address is mentioned in subject
        if (job.jobAddress && emailSubject.toLowerCase().includes(job.jobAddress.toLowerCase())) {
          return job.id;
        }
        
        // Check if client name is mentioned in subject
        if (job.clientName && emailSubject.toLowerCase().includes(job.clientName.toLowerCase())) {
          return job.id;
        }
        
        // Check if project manager is mentioned in subject
        if (job.projectManager && emailSubject.toLowerCase().includes(job.projectManager.toLowerCase())) {
          return job.id;
        }
      }
      
      // Look for address patterns - handle both full and partial addresses
      const subject = emailSubject.toLowerCase();
      
      // Find jobs with address matching
      for (const job of allJobs) {
        if (job.jobAddress) {
          const jobAddr = job.jobAddress.toLowerCase().trim();
          
          // Extract street number and name from job address (must have street type)
          const jobMatch = jobAddr.match(/(\d+)\s+([A-Za-z\s]+?)\s+(st|street|rd|road|ave|avenue|dr|drive|pl|place|ct|court)/i);
          
          if (jobMatch) {
            const jobNumber = jobMatch[1];
            const jobStreet = jobMatch[2].toLowerCase().trim();
            
            // Try full address match first
            const subjectFullMatch = subject.match(/(\d+)\s+([A-Za-z\s]+?)\s+(st|street|rd|road|ave|avenue|dr|drive|pl|place|ct|court)/i);
            
            if (subjectFullMatch) {
              const subjectNumber = subjectFullMatch[1];
              const subjectStreet = subjectFullMatch[2].toLowerCase().trim();
              
              if (subjectNumber === jobNumber && 
                  (subjectStreet === jobStreet || 
                   fuzz.ratio(subjectStreet, jobStreet) >= 90)) {
                console.log(`✅ Backend FULL address match: "${emailSubject}" -> "${job.jobAddress}"`);
                return job.id;
              }
            } else {
              // Try partial address match (number + street name without type)
              const subjectPartialMatch = subject.match(/(\d+)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i);
              
              if (subjectPartialMatch) {
                const subjectNumber = subjectPartialMatch[1];
                const subjectStreet = subjectPartialMatch[2].toLowerCase().trim();
                
                if (subjectNumber === jobNumber && 
                    (subjectStreet === jobStreet || 
                     fuzz.ratio(subjectStreet, jobStreet) >= 90)) {
                  console.log(`✅ Backend PARTIAL address match: "${emailSubject}" -> "${job.jobAddress}"`);
                  return job.id;
                }
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error extracting job from email subject:', error);
    }
    
    return null;
  }

  // Email processing review endpoints
  app.get('/api/email-processing/pending', isAuthenticated, async (req: any, res) => {
    try {
      const documents = await storage.getEmailProcessedDocumentsPending();
      // Ensure email_subject field is properly mapped for frontend
      const mappedDocuments = documents.map(doc => ({
        ...doc,
        email_subject: doc.emailSubject // Explicitly map the field
      }));
      console.log('📧 Sending to frontend:', mappedDocuments.map(d => ({ id: d.id.slice(0,8), email_subject: d.email_subject })));
      res.json(mappedDocuments);
    } catch (error) {
      console.error('Error getting pending documents:', error);
      res.status(500).json({ error: 'Failed to get pending documents' });
    }
  });

  app.post('/api/email-processing/approve/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { jobId, categoryOverride } = req.body;
      
      // Get the document data before approving
      const documents = await storage.getEmailProcessedDocumentsPending();
      const document = documents.find(doc => doc.id === id);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Parse the extracted data
      const extractedData = JSON.parse(document.extractedData);
      
      // Use category override if provided
      const finalCategory = categoryOverride || extractedData.category;
      
      // If no specific job provided, try to extract from email subject or use default
      let targetJobId = jobId;
      if (!targetJobId) {
        // Try to extract job information from email subject
        targetJobId = await extractJobFromEmailSubject(document.emailSubject, storage);
        
        // If still no job, use the first active job as default
        if (!targetJobId) {
          const allJobs = await storage.getJobs();
          const activeJobs = allJobs.filter(job => job.status !== 'ready_for_billing');
          if (activeJobs.length > 0) {
            targetJobId = activeJobs[0].id;
          } else {
            return res.status(400).json({ 
              error: 'No active jobs available. Please select a job to add this expense to.' 
            });
          }
        }
      }

      console.log(`💰 Adding expense to job ${targetJobId} with category: ${finalCategory}`);
      console.log(`📄 Expense data:`, extractedData);
      
      // Add expense to the specified job based on final category
      let addedExpense;
      switch (finalCategory) {
        case 'materials':
          console.log(`📦 Creating material for job ${targetJobId}`);
          addedExpense = await storage.createMaterial({
            jobId: targetJobId,
            description: extractedData.description || document.filename,
            supplier: extractedData.vendor || 'Unknown Vendor',
            amount: extractedData.amount?.toString() || '0',
            invoiceDate: extractedData.date || new Date().toISOString().split('T')[0]
          });
          console.log(`✅ Material created:`, addedExpense?.id);
          break;
          
        case 'subtrades':
          console.log(`🔧 Creating sub-trade for job ${targetJobId}`);
          addedExpense = await storage.createSubTrade({
            jobId: targetJobId,
            trade: extractedData.vendor || 'Unknown Trade',
            contractor: extractedData.vendor || 'Unknown Contractor',
            amount: extractedData.amount?.toString() || '0',
            invoiceDate: extractedData.date || new Date().toISOString().split('T')[0]
          });
          console.log(`✅ Sub-trade created:`, addedExpense?.id);
          break;
          
        case 'tip_fees':
          console.log(`🚛 Creating tip fee for job ${targetJobId}`);
          addedExpense = await storage.createTipFee({
            jobId: targetJobId,
            description: extractedData.description || document.filename,
            amount: extractedData.amount?.toString() || '0'
          });
          console.log(`✅ Tip fee created:`, addedExpense?.id);
          break;
          
        case 'other_costs':
        default:
          console.log(`📋 Creating other cost for job ${targetJobId}`);
          addedExpense = await storage.createOtherCost({
            jobId: targetJobId,
            description: extractedData.description || document.filename,
            amount: extractedData.amount?.toString() || '0'
          });
          console.log(`✅ Other cost created:`, addedExpense?.id);
          break;
      }

      // Save file attachment to job and upload to Google Drive (if connected)
      let fileRecord = null;
      let googleDriveResult = null;
      
      try {
        // Get the original document file from email processing attachments
        const fileName = document.filename;
        const mimeType = document.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
        
        // For email attachments, we need to find the original attachment file
        // The document filename should correspond to an email attachment file
        console.log(`📎 Attempting to save email attachment: ${fileName}`);
        
        // First, try to save as job file attachment from object storage
        try {
          // Create a job file record for the email attachment
          fileRecord = await storage.createJobFile({
            jobId: targetJobId,
            fileName: fileName,
            originalName: fileName,
            fileSize: document.attachmentContent ? Buffer.from(document.attachmentContent, 'base64').length : 0,
            mimeType: document.mimeType || mimeType,
            objectPath: null, // Email attachments are not in object storage initially
            googleDriveLink: null,
            googleDriveFileId: null,
            uploadedById: req.user.claims.sub
          });
          console.log(`📎 Job file record created: ${fileRecord.id}`);
        } catch (fileError) {
          console.log(`⚠️ Could not create job file record: ${fileError.message}`);
        }

        // Try to upload to Google Drive if user has it connected
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        
        if (user && user.googleDriveTokens) {
          try {
            console.log(`☁️ Uploading to Google Drive: ${fileName}`);
            
            // Get job for folder naming
            const job = await storage.getJob(targetJobId);
            
            // Get the actual attachment content from the stored base64 data
            let fileBuffer;
            if (document.attachmentContent) {
              fileBuffer = Buffer.from(document.attachmentContent, 'base64');
              console.log(`📎 Using stored attachment content (${fileBuffer.length} bytes)`);
            } else {
              // Fallback - create a small text file with document info
              const fallbackContent = `Email Document: ${fileName}\nFrom: ${document.emailFrom || 'unknown'}\nSubject: ${document.emailSubject || 'unknown'}\nVendor: ${document.vendor}\nAmount: $${document.amount}\nCategory: ${finalCategory}`;
              fileBuffer = Buffer.from(fallbackContent, 'utf8');
              console.log(`⚠️ No attachment content stored, using fallback text file`);
            }
            
            const googleDriveService = new GoogleDriveService();
            const tokens = JSON.parse(user.googleDriveTokens);
            googleDriveService.setUserTokens(tokens);
            
            // Create main BuildFlow Pro folder first
            const mainFolderId = await googleDriveService.findOrCreateFolder('BuildFlow Pro');
            
            // Create/find job folder
            const jobFolderId = await googleDriveService.findOrCreateFolder(`Job - ${job.jobAddress}`, mainFolderId);
            
            // Upload file to Google Drive
            const uploadResult = await googleDriveService.uploadFile(
              fileName, 
              fileBuffer, 
              document.mimeType || mimeType, 
              jobFolderId || undefined
            );
            
            if (uploadResult && fileRecord) {
              // Update the file record with Google Drive info
              await storage.updateJobFile(fileRecord.id, {
                googleDriveLink: uploadResult.webViewLink,
                googleDriveFileId: uploadResult.fileId
              });
              googleDriveResult = uploadResult;
              console.log(`☁️ File uploaded to Google Drive: ${uploadResult.webViewLink}`);
            }
          } catch (driveError) {
            console.log(`⚠️ Google Drive upload failed: ${driveError.message}`);
          }
        } else {
          console.log(`ℹ️ Google Drive not connected for user ${userId}`);
        }
      } catch (attachmentError) {
        console.log(`⚠️ File attachment processing failed: ${attachmentError.message}`);
      }

      // Now approve the document with the job ID
      await storage.approveEmailProcessedDocument(id, targetJobId);
      
      res.json({ 
        success: true, 
        addedExpense,
        jobId: targetJobId,
        category: finalCategory,
        fileAttached: !!fileRecord,
        googleDriveUploaded: !!googleDriveResult,
        googleDriveLink: googleDriveResult?.webViewLink,
        message: `Expense added to job as ${finalCategory}${fileRecord ? ' with file attachment' : ''}${googleDriveResult ? ' and uploaded to Google Drive' : ''}`
      });
    } catch (error) {
      console.error('Error approving document:', error);
      res.status(500).json({ error: 'Failed to approve document' });
    }
  });

  app.post('/api/email-processing/reject/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      await storage.rejectEmailProcessedDocument(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error rejecting document:', error);
      res.status(500).json({ error: 'Failed to reject document' });
    }
  });

  // Endpoint to add approved expense data to job sheet
  app.post("/api/documents/add-to-job", isAuthenticated, async (req: any, res) => {
    try {
      const { expenseData, jobId } = req.body;
      
      if (!expenseData || !jobId) {
        return res.status(400).json({ error: "Expense data and job ID are required" });
      }

      // Verify job exists and user has access
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Add expense to appropriate job category based on approved category
      let addedExpense;
      switch (expenseData.category) {
        case 'materials':
          addedExpense = await storage.createMaterial({
            jobId,
            description: expenseData.description,
            supplier: expenseData.vendor,
            amount: expenseData.amount.toString(),
            invoiceDate: expenseData.date
          });
          break;
          
        case 'subtrades':
          addedExpense = await storage.createSubTrade({
            jobId,
            trade: expenseData.vendor,
            contractor: expenseData.vendor,
            amount: expenseData.amount.toString(),
            invoiceDate: expenseData.date
          });
          break;
          
        case 'tip_fees':
          addedExpense = await storage.createTipFee({
            jobId,
            description: expenseData.description,
            amount: expenseData.amount.toString()
          });
          break;
          
        case 'other_costs':
        default:
          addedExpense = await storage.createOtherCost({
            jobId,
            description: expenseData.description,
            amount: expenseData.amount.toString()
          });
          break;
      }
      
      res.json({
        success: true,
        addedExpense,
        category: expenseData.category,
        message: `Expense added to ${expenseData.category} successfully`
      });
      
    } catch (error) {
      console.error("Error adding expense to job:", error);
      res.status(500).json({ 
        error: "Failed to add expense to job", 
        details: (error as Error).message 
      });
    }
  });

  // =============================================================================
  // STAFF NOTES API ROUTES
  // =============================================================================

  // Get all staff members with their notes
  app.get("/api/staff-notes", isAuthenticated, async (req: any, res) => {
    try {
      const staffMembersWithNotes = await storage.getStaffMembersWithNotes();
      res.json(staffMembersWithNotes);
    } catch (error) {
      console.error("Error fetching staff members:", error);
      res.status(500).json({ error: "Failed to fetch staff members" });
    }
  });

  // Create a new staff member
  app.post("/api/staff-notes/members", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertStaffMemberSchema.parse(req.body);
      const newMember = await storage.createStaffMember(validatedData);
      res.json(newMember);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: fromZodError(error).message 
        });
      }
      console.error("Error creating staff member:", error);
      res.status(500).json({ error: "Failed to create staff member" });
    }
  });

  // Update a staff member
  app.put("/api/staff-notes/members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertStaffMemberSchema.partial().parse(req.body);
      const updatedMember = await storage.updateStaffMember(id, validatedData);
      res.json(updatedMember);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: fromZodError(error).message 
        });
      }
      console.error("Error updating staff member:", error);
      res.status(500).json({ error: "Failed to update staff member" });
    }
  });

  // Delete a staff member
  app.delete("/api/staff-notes/members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteStaffMember(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting staff member:", error);
      res.status(500).json({ error: "Failed to delete staff member" });
    }
  });

  // Create a note for a staff member
  app.post("/api/staff-notes/members/:memberId/notes", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const validatedData = insertStaffNoteEntrySchema.parse({
        ...req.body,
        staffMemberId: memberId,
      });
      const newNote = await storage.createStaffNoteEntry(validatedData);
      res.json(newNote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: fromZodError(error).message 
        });
      }
      console.error("Error creating staff note:", error);
      res.status(500).json({ error: "Failed to create staff note" });
    }
  });

  // Update a staff note
  app.put("/api/staff-notes/notes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertStaffNoteEntrySchema.partial().parse(req.body);
      const updatedNote = await storage.updateStaffNoteEntry(id, validatedData);
      res.json(updatedNote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: fromZodError(error).message 
        });
      }
      console.error("Error updating staff note:", error);
      res.status(500).json({ error: "Failed to update staff note" });
    }
  });

  // Delete a staff note
  app.delete("/api/staff-notes/notes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteStaffNoteEntry(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting staff note:", error);
      res.status(500).json({ error: "Failed to delete staff note" });
    }
  });

  // =============================================================================
  // REWARDS SYSTEM API ENDPOINTS
  // =============================================================================

  // Get user's reward dashboard (points, transactions, achievements, leaderboard)
  app.get("/api/rewards/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dashboard = await rewardsService.getUserDashboard(userId);
      res.json(dashboard);
    } catch (error) {
      console.error("Error fetching rewards dashboard:", error);
      res.status(500).json({ message: "Failed to fetch rewards dashboard" });
    }
  });

  // Get user's reward points
  app.get("/api/rewards/points", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const points = await rewardsService.getUserRewardPoints(userId);
      if (!points) {
        // Initialize if not exists
        const newPoints = await rewardsService.initializeUserRewards(userId);
        return res.json(newPoints);
      }
      res.json(points);
    } catch (error) {
      console.error("Error fetching reward points:", error);
      res.status(500).json({ message: "Failed to fetch reward points" });
    }
  });

  // Get user's transaction history
  app.get("/api/rewards/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 20;
      const transactions = await rewardsService.getUserTransactions(userId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching reward transactions:", error);
      res.status(500).json({ message: "Failed to fetch reward transactions" });
    }
  });

  // Get user's achievements
  app.get("/api/rewards/achievements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const achievements = await rewardsService.getUserAchievements(userId);
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Get leaderboard
  app.get("/api/rewards/leaderboard", isAuthenticated, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await rewardsService.getLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Process timesheet submission for rewards (called automatically when timesheet is submitted)
  app.post("/api/rewards/process-submission", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { submissionDate } = req.body;
      
      if (!submissionDate) {
        return res.status(400).json({ message: "Submission date is required" });
      }

      const result = await rewardsService.processTimesheetSubmission(userId, submissionDate);
      
      console.log(`Rewards processed for user ${userId}: +${result.pointsEarned} points, streak: ${result.newStreak}`);
      
      res.json({
        success: true,
        pointsEarned: result.pointsEarned,
        newStreak: result.newStreak,
        achievements: result.achievements,
        description: result.description
      });
    } catch (error) {
      console.error("Error processing timesheet submission rewards:", error);
      res.status(500).json({ message: "Failed to process rewards" });
    }
  });

  // Admin endpoint to view all user rewards (for debugging and management)
  app.get("/api/admin/rewards/all-users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const leaderboard = await rewardsService.getLeaderboard(50); // Get top 50 for admin view
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching all user rewards:", error);
      res.status(500).json({ message: "Failed to fetch all user rewards" });
    }
  });

  // Admin rewards dashboard endpoint
  app.get("/api/admin/rewards/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      // Use the persistent reward settings
      const settings = rewardSettings;

      // Get analytics data with error handling for missing tables
      let totalPointsAwarded = 0;
      let totalRedemptions = 0;
      let activeUsers = 0;
      let topPerformers: any[] = [];

      try {
        const pointsResult = await db.execute(sql`
          SELECT COALESCE(SUM(points), 0) as total 
          FROM reward_transactions 
          WHERE type IN ('earned', 'bonus')
        `);
        totalPointsAwarded = Number(pointsResult[0]?.total || 0);
      } catch (e) {
        console.log("reward_transactions table not found, using default value");
      }

      try {
        const activeUsersResult = await db.execute(sql`
          SELECT COUNT(DISTINCT user_id) as total 
          FROM reward_transactions
        `);
        activeUsers = Number(activeUsersResult[0]?.total || 0);
      } catch (e) {
        console.log("reward_transactions table not found for active users, using default value");
      }

      try {
        const topPerformersResult = await db.execute(sql`
          SELECT 
            u.id as user_id,
            u.first_name,
            u.last_name,
            COALESCE(rp.total_points, 0) as total_points,
            COALESCE(rp.current_streak, 0) as current_streak
          FROM users u
          LEFT JOIN reward_points rp ON u.id = rp.user_id
          WHERE u.role = 'staff'
          ORDER BY rp.total_points DESC
          LIMIT 10
        `);
        topPerformers = topPerformersResult.map((p: any) => ({
          userId: p.user_id,
          firstName: p.first_name || 'Unknown',
          lastName: p.last_name || '',
          totalPoints: Number(p.total_points || 0),
          currentStreak: Number(p.current_streak || 0)
        }));
      } catch (e) {
        console.log("reward_points table not found, using empty top performers");
        // Fallback to just getting staff users without rewards data
        try {
          const staffResult = await db.execute(sql`
            SELECT 
              id as user_id,
              first_name,
              last_name
            FROM users
            WHERE role = 'staff'
            LIMIT 10
          `);
          topPerformers = staffResult.map((p: any) => ({
            userId: p.user_id,
            firstName: p.first_name || 'Unknown',
            lastName: p.last_name || '',
            totalPoints: 0,
            currentStreak: 0
          }));
        } catch (e2) {
          console.log("Users table access error, using empty array");
        }
      }

      // Get prizes from database
      let prizes: any[] = [];
      try {
        const prizesResult = await db.select().from(rewardCatalog).where(eq(rewardCatalog.isActive, true));
        prizes = prizesResult.map(prize => ({
          id: prize.id,
          title: prize.name,
          description: prize.description,
          pointsCost: prize.pointsCost,
          category: prize.category,
          stockQuantity: prize.maxRedemptionsPerMonth,
          isActive: prize.isActive,
          createdAt: prize.createdAt
        }));
      } catch (e) {
        console.log("reward_catalog table not found, using empty prizes array");
      }

      res.json({
        settings,
        prizes,
        totalPointsAwarded,
        totalRedemptions,
        activeUsers,
        topPerformers
      });
    } catch (error) {
      console.error("Error fetching admin rewards dashboard:", error);
      res.status(500).json({ message: "Failed to fetch admin dashboard data" });
    }
  });

  // Get reward settings for rules page
  app.get("/api/rewards/settings", isAuthenticated, async (req: any, res) => {
    try {
      // Return the current reward settings
      res.json(rewardSettings);
    } catch (error) {
      console.error("Error fetching reward settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Update reward settings (currently in-memory, could be moved to database)
  app.put("/api/admin/rewards/settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const settings = req.body;
      
      // Validate settings
      if (typeof settings.dailySubmissionPoints !== 'number' || 
          typeof settings.weeklyBonusPoints !== 'number' ||
          typeof settings.fortnightlyBonusPoints !== 'number' ||
          typeof settings.monthlyBonusPoints !== 'number') {
        return res.status(400).json({ message: "Invalid settings format" });
      }

      // Update the in-memory settings
      rewardSettings = {
        ...rewardSettings,
        ...settings
      };
      
      console.log("Reward settings updated successfully:", rewardSettings);
      
      res.json({ 
        success: true, 
        message: "Settings updated successfully",
        settings: rewardSettings
      });
    } catch (error) {
      console.error("Error updating reward settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Add new prize to catalog
  app.post("/api/admin/rewards/prizes", isAuthenticated, async (req: any, res) => {
    try {
      const { title, description, pointsCost, category, stockQuantity } = req.body;
      
      if (!title || !description || !pointsCost) {
        return res.status(400).json({ message: "Title, description, and points cost are required" });
      }

      // Save to database using the rewardCatalog table
      const [newPrize] = await db.insert(rewardCatalog).values({
        rewardType: category || 'other',
        name: title,
        description,
        pointsCost: parseInt(pointsCost),
        category: category || 'other',
        maxRedemptionsPerMonth: stockQuantity ? parseInt(stockQuantity) : null,
        isActive: true
      }).returning();

      console.log("New prize saved to database:", newPrize);
      
      res.json({ 
        success: true, 
        message: "Prize added successfully",
        prize: {
          id: newPrize.id,
          title: newPrize.name,
          description: newPrize.description,
          pointsCost: newPrize.pointsCost,
          category: newPrize.category,
          stockQuantity: newPrize.maxRedemptionsPerMonth,
          isActive: newPrize.isActive,
          createdAt: newPrize.createdAt
        }
      });
    } catch (error) {
      console.error("Error adding prize:", error);
      res.status(500).json({ message: "Failed to add prize" });
    }
  });

  // Data export endpoint - exports all live business data
  app.get("/api/export-data", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log("🔄 Starting data export...");

      // Export all business data from database
      const jobsData = await db.select().from(jobs);
      const employeesData = await db.select().from(employees); 
      const usersData = await db.select().from(users);
      const timesheetEntriesData = await db.select().from(timesheetEntries);
      const laborEntriesData = await db.select().from(laborEntries);
      const materialsData = await db.select().from(materials);
      const subTradesData = await db.select().from(subTrades);
      const otherCostsData = await db.select().from(otherCosts);
      const tipFeesData = await db.select().from(tipFees);
      const jobFilesData = await db.select().from(jobFiles);

      // Get reward data if tables exist
      let rewardData = null;
      try {
        // Note: Reward tables may not exist yet
        console.log("Skipping reward data - tables not implemented yet");
        rewardData = { rewardCatalog: [], rewardTransactions: [], achievements: [] };
      } catch (e) {
        console.log("Reward tables not found, skipping reward data export");
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        businessData: {
          jobs: jobsData.length,
          employees: employeesData.length,
          users: usersData.length,
          timesheetEntries: timesheetEntriesData.length,
          laborEntries: laborEntriesData.length,
          materials: materialsData.length,
          subTrades: subTradesData.length,
          otherCosts: otherCostsData.length,
          tipFees: tipFeesData.length,
          jobFiles: jobFilesData.length
        },
        data: {
          jobs: jobsData,
          employees: employeesData,
          users: usersData.map((u: any) => ({ // Remove sensitive data
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role,
            employeeId: u.employeeId,
            isAssigned: u.isAssigned,
            createdAt: u.createdAt
          })),
          timesheetEntries: timesheetEntriesData,
          laborEntries: laborEntriesData,
          materials: materialsData,
          subTrades: subTradesData,
          otherCosts: otherCostsData,
          tipFees: tipFeesData,
          jobFiles: jobFilesData,
          rewards: rewardData
        }
      };

      console.log(`✅ Data export completed: ${jobsData.length} jobs, ${employeesData.length} employees, ${timesheetEntriesData.length} timesheet entries`);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="buildflow-data-export-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(exportData);

    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: "Failed to export data", error: error.message });
    }
  });

  // Auto-backup data to Google Drive
  app.post("/api/export-data-to-drive", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log("🔄 Starting Google Drive data backup...");

      // Get all business data (same as regular export)
      const jobsData = await db.select().from(jobs);
      const employeesData = await db.select().from(employees); 
      const usersData = await db.select().from(users);
      const timesheetEntriesData = await db.select().from(timesheetEntries);
      const laborEntriesData = await db.select().from(laborEntries);
      const materialsData = await db.select().from(materials);
      const subTradesData = await db.select().from(subTrades);
      const otherCostsData = await db.select().from(otherCosts);
      const tipFeesData = await db.select().from(tipFees);
      const jobFilesData = await db.select().from(jobFiles);

      // Get reward data if tables exist  
      let rewardData = null;
      try {
        // Note: Reward tables may not exist yet
        console.log("Skipping reward data - tables not implemented yet");
        rewardData = { rewardCatalog: [], rewardTransactions: [], achievements: [] };
      } catch (e) {
        console.log("Reward tables not found, skipping reward data export");
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        businessData: {
          jobs: jobsData.length,
          employees: employeesData.length,
          users: usersData.length,
          timesheetEntries: timesheetEntriesData.length,
          laborEntries: laborEntriesData.length,
          materials: materialsData.length,
          subTrades: subTradesData.length,
          otherCosts: otherCostsData.length,
          tipFees: tipFeesData.length,
          jobFiles: jobFilesData.length
        },
        data: {
          jobs: jobsData,
          employees: employeesData,
          users: usersData.map((u: any) => ({
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role,
            employeeId: u.employeeId,
            isAssigned: u.isAssigned,
            createdAt: u.createdAt
          })),
          timesheetEntries: timesheetEntriesData,
          laborEntries: laborEntriesData,
          materials: materialsData,
          subTrades: subTradesData,
          otherCosts: otherCostsData,
          tipFees: tipFeesData,
          jobFiles: jobFilesData,
          rewards: rewardData
        }
      };

      // Convert to JSON string
      const jsonContent = JSON.stringify(exportData, null, 2);
      const fileName = `buildflow-data-export-${new Date().toISOString().split('T')[0]}.json`;
      
      // Upload to Google Drive
      try {
        const { google } = require('googleapis');
        const { GoogleAuth } = require('google-auth-library');

        // Set up Google Drive authentication
        const auth = new GoogleAuth({
          credentials: {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: req.session.googleTokens?.refresh_token,
            access_token: req.session.googleTokens?.access_token,
            token_type: "Bearer"
          },
          scopes: ['https://www.googleapis.com/auth/drive.file']
        });

        const drive = google.drive({ version: 'v3', auth });

        // Create a buffer from the JSON content
        const buffer = Buffer.from(jsonContent, 'utf8');

        // Upload to Google Drive
        const fileMetadata = {
          name: fileName,
          parents: ['1xOaFJtLYeOCzQxkqV_QQUUvFKGXb4VHg'] // BuildFlow Backups folder ID
        };

        const media = {
          mimeType: 'application/json',
          body: require('stream').Readable.from(buffer)
        };

        const driveResponse = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id,name,webViewLink'
        });

        console.log(`✅ Data backup uploaded to Google Drive: ${driveResponse.data.name}`);

        res.json({
          success: true,
          message: "Data successfully backed up to Google Drive",
          fileId: driveResponse.data.id,
          fileName: driveResponse.data.name,
          link: driveResponse.data.webViewLink,
          recordCount: {
            jobs: jobsData.length,
            employees: employeesData.length,
            timesheetEntries: timesheetEntriesData.length
          }
        });

      } catch (driveError: any) {
        console.error("Google Drive upload error:", driveError);
        res.status(500).json({ 
          success: false,
          message: "Failed to upload to Google Drive", 
          error: driveError.message,
          suggestion: "Try reconnecting Google Drive in Settings"
        });
      }

    } catch (error: any) {
      console.error("Error creating Google Drive backup:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create backup", 
        error: error.message 
      });
    }
  });

  // Import data from JSON backup
  app.post("/api/import-data", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log("🔄 Starting data import...");

      const { data, overwriteExisting = false } = req.body;

      if (!data || !data.data) {
        return res.status(400).json({ message: "Invalid backup data format" });
      }

      const importData = data.data;
      let importResults = {
        jobs: 0,
        employees: 0,
        timesheetEntries: 0,
        laborEntries: 0,
        materials: 0,
        subTrades: 0,
        otherCosts: 0,
        tipFees: 0,
        jobFiles: 0,
        errors: [] as string[]
      };

      // Import employees first (since jobs reference them)
      if (importData.employees && importData.employees.length > 0) {
        try {
          for (const employee of importData.employees) {
            try {
              if (overwriteExisting) {
                await db.insert(employees).values({
                  id: employee.id,
                  name: employee.name,
                  defaultHourlyRate: employee.defaultHourlyRate,
                  createdAt: employee.createdAt
                }).onConflictDoUpdate({
                  target: employees.id,
                  set: {
                    name: employee.name,
                    defaultHourlyRate: employee.defaultHourlyRate
                  }
                });
              } else {
                await db.insert(employees).values({
                  id: employee.id,
                  name: employee.name,
                  defaultHourlyRate: employee.defaultHourlyRate,
                  createdAt: employee.createdAt
                }).onConflictDoNothing();
              }
              importResults.employees++;
            } catch (e: any) {
              importResults.errors.push(`Employee ${employee.name}: ${e.message}`);
            }
          }
        } catch (e: any) {
          importResults.errors.push(`Employees import error: ${e.message}`);
        }
      }

      // Import jobs
      if (importData.jobs && importData.jobs.length > 0) {
        try {
          for (const job of importData.jobs) {
            try {
              if (overwriteExisting) {
                await db.insert(jobs).values({
                  id: job.id,
                  jobAddress: job.jobAddress,
                  clientName: job.clientName,
                  projectName: job.projectName,
                  projectManager: job.projectManager,
                  status: job.status || 'new_job',
                  builderMargin: job.builderMargin || '0',
                  defaultHourlyRate: job.defaultHourlyRate || '50',
                  isDeleted: job.isDeleted || false,
                  deletedAt: job.deletedAt,
                  createdAt: job.createdAt,
                  updatedAt: job.updatedAt
                }).onConflictDoUpdate({
                  target: jobs.id,
                  set: {
                    jobAddress: job.jobAddress,
                    clientName: job.clientName,
                    projectName: job.projectName,
                    projectManager: job.projectManager,
                    status: job.status || 'new_job',
                    builderMargin: job.builderMargin || '0',
                    defaultHourlyRate: job.defaultHourlyRate || '50'
                  }
                });
              } else {
                await db.insert(jobs).values({
                  id: job.id,
                  jobAddress: job.jobAddress,
                  clientName: job.clientName,
                  projectName: job.projectName,
                  projectManager: job.projectManager,
                  status: job.status || 'new_job',
                  builderMargin: job.builderMargin || '0',
                  defaultHourlyRate: job.defaultHourlyRate || '50',
                  isDeleted: job.isDeleted || false,
                  deletedAt: job.deletedAt,
                  createdAt: job.createdAt,
                  updatedAt: job.updatedAt
                }).onConflictDoNothing();
              }
              importResults.jobs++;
            } catch (e: any) {
              importResults.errors.push(`Job ${job.projectName}: ${e.message}`);
            }
          }
        } catch (e: any) {
          importResults.errors.push(`Jobs import error: ${e.message}`);
        }
      }

      // Import timesheet entries
      if (importData.timesheetEntries && importData.timesheetEntries.length > 0) {
        try {
          for (const entry of importData.timesheetEntries) {
            try {
              if (overwriteExisting) {
                await db.insert(timesheetEntries).values(entry).onConflictDoUpdate({
                  target: timesheetEntries.id,
                  set: {
                    staffId: entry.staffId,
                    jobId: entry.jobId,
                    date: entry.date,
                    hours: entry.hours,
                    hourlyRate: entry.hourlyRate,
                    notes: entry.notes,
                    status: entry.status,
                    customAddress: entry.customAddress,
                    leaveType: entry.leaveType
                  }
                });
              } else {
                await db.insert(timesheetEntries).values(entry).onConflictDoNothing();
              }
              importResults.timesheetEntries++;
            } catch (e: any) {
              importResults.errors.push(`Timesheet entry: ${e.message}`);
            }
          }
        } catch (e: any) {
          importResults.errors.push(`Timesheet entries import error: ${e.message}`);
        }
      }

      // Import other data types with similar pattern
      const dataTypes = [
        { data: importData.laborEntries, table: laborEntries, name: 'laborEntries' },
        { data: importData.materials, table: materials, name: 'materials' },
        { data: importData.subTrades, table: subTrades, name: 'subTrades' },
        { data: importData.otherCosts, table: otherCosts, name: 'otherCosts' },
        { data: importData.tipFees, table: tipFees, name: 'tipFees' },
        { data: importData.jobFiles, table: jobFiles, name: 'jobFiles' }
      ];

      for (const { data: tableData, table, name } of dataTypes) {
        if (tableData && tableData.length > 0) {
          try {
            for (const item of tableData) {
              try {
                if (overwriteExisting) {
                  await db.insert(table).values(item).onConflictDoUpdate({
                    target: (table as any).id,
                    set: item
                  });
                } else {
                  await db.insert(table).values(item).onConflictDoNothing();
                }
                (importResults as any)[name]++;
              } catch (e: any) {
                importResults.errors.push(`${name}: ${e.message}`);
              }
            }
          } catch (e: any) {
            importResults.errors.push(`${name} import error: ${e.message}`);
          }
        }
      }

      console.log(`✅ Data import completed:`, importResults);

      res.json({
        success: true,
        message: "Data import completed",
        results: importResults,
        totalRecordsImported: importResults.jobs + importResults.employees + importResults.timesheetEntries + 
                             importResults.laborEntries + importResults.materials + importResults.subTrades +
                             importResults.otherCosts + importResults.tipFees + importResults.jobFiles
      });

    } catch (error: any) {
      console.error("Error importing data:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to import data", 
        error: error.message 
      });
    }
  });

  // Download migration guide
  app.get("/api/download/migration-guide", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const guidePath = path.join(process.cwd(), 'PLATFORM_MIGRATION_GUIDE.md');
      
      if (!fs.existsSync(guidePath)) {
        return res.status(404).json({ message: "Migration guide not found" });
      }

      const guideContent = fs.readFileSync(guidePath, 'utf8');
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="Platform_Migration_Guide.txt"');
      res.send(guideContent);
    } catch (error) {
      console.error("Error downloading migration guide:", error);
      res.status(500).json({ message: "Failed to download migration guide" });
    }
  });

  // Delete prize from catalog
  app.delete("/api/admin/rewards/prizes/:prizeId", isAuthenticated, async (req: any, res) => {
    try {
      const { prizeId } = req.params;
      
      // Delete from database
      await db.delete(rewardCatalog).where(eq(rewardCatalog.id, prizeId));
      
      console.log("Prize deleted from database:", prizeId);
      
      res.json({ 
        success: true, 
        message: "Prize deleted successfully" 
      });
    } catch (error) {
      console.error("Error deleting prize:", error);
      res.status(500).json({ message: "Failed to delete prize" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
