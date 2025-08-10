import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService } from "./objectStorage";
import { TimesheetPDFGenerator } from "./pdfGenerator";
import { GoogleDriveService } from "./googleDriveService";
import { GoogleDriveAuth } from "./googleAuth";
import {
  insertJobSchema,
  insertEmployeeSchema,
  insertLaborEntrySchema,
  insertMaterialSchema,
  insertSubTradeSchema,
  insertOtherCostSchema,
  insertTimesheetEntrySchema,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

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
      const googleDriveService = new GoogleDriveService();
      const authUrl = googleDriveService.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Google Drive auth URL:", error);
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get('/api/google-drive/callback', isAuthenticated, async (req: any, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ message: "Authorization code required" });
      }

      const googleAuth = new GoogleDriveAuth();
      const tokens = await googleAuth.getTokens(code as string);
      
      // Store tokens in user's database record using the authenticated user ID
      const userId = req.user.claims.sub;
      await storage.updateUserGoogleDriveTokens(userId, JSON.stringify(tokens));
      
      console.log(`Google Drive tokens saved for user ${userId}`);
      
      // Redirect back to the admin dashboard settings tab
      res.redirect('/?tab=settings&google_drive_connected=true');
    } catch (error) {
      console.error("Error handling Google Drive callback:", error);
      res.redirect('/?tab=settings&google_drive_error=true');
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
      const employee = await storage.createEmployee(validatedData);
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
      const [laborEntries, materials, subTrades, otherCosts] = await Promise.all([
        storage.getLaborEntriesForJob(job.id),
        storage.getMaterialsForJob(job.id),
        storage.getSubTradesForJob(job.id),
        storage.getOtherCostsForJob(job.id),
      ]);

      res.json({
        ...job,
        laborEntries,
        materials,
        subTrades,
        otherCosts,
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
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.softDeleteJob(req.params.id);
      res.json({ message: "Job moved to deleted folder" });
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({ message: "Failed to delete job" });
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
      
      // Find the employee record for this user
      let staffId = userId;
      const employees = await storage.getEmployees();
      
      // Check if user is directly assigned to an employee
      if (user && user.employeeId && user.isAssigned) {
        // User has been assigned to a specific employee
        const assignedEmployee = employees.find(emp => emp.id === user.employeeId);
        if (assignedEmployee) {
          staffId = assignedEmployee.id;
        }
      } else {
        // Fallback: find by matching patterns for unassigned users
        const userEmployee = employees.find((emp: any) => {
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
      
      const entries = await storage.getTimesheetEntries(staffId);
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
      
      // Find the employee record for this user
      // For now, we'll use a simple mapping - in the future this could be more sophisticated
      let staffId = userId;
      
      // Check if this user corresponds to a specific employee
      // Match user to employee by finding an employee with the same ID as the user
      const employees = await storage.getEmployees();
      const userEmployee = employees.find((emp: any) => {
        // First try to match by user ID (for users created from employees)
        if (emp.id === userId) {
          return true;
        }
        // Fallback: match by name patterns for backwards compatibility
        const userName = (user.firstName + ' ' + (user.lastName || '')).trim();
        return emp.name.toLowerCase() === userName.toLowerCase();
      });
      
      if (userEmployee) {
        staffId = userEmployee.id;
        console.log(`Mapping user ${user.email} to employee ${userEmployee.name} (${userEmployee.id})`);
      } else {
        console.log(`No employee mapping found for user ${user.email}, using user ID as staff ID`);
      }
      
      // Handle special leave types by storing them in materials field and setting jobId to null
      const { jobId, materials, ...otherData } = req.body;
      const leaveTypes = ['sick-leave', 'personal-leave', 'annual-leave', 'rdo'];
      let finalJobId = jobId;
      let finalMaterials = materials || '';
      
      if (leaveTypes.includes(jobId)) {
        finalJobId = null;
        finalMaterials = jobId; // Store leave type in materials field
      } else if (jobId === 'no-job') {
        finalJobId = null;
      }
      
      const validatedData = insertTimesheetEntrySchema.parse({
        ...otherData,
        staffId: staffId,
        jobId: finalJobId,
        materials: finalMaterials,
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
      const employees = await storage.getEmployees();
      
      // Check if user is directly assigned to an employee
      if (user && user.employeeId && user.isAssigned) {
        // User has been assigned to a specific employee
        const assignedEmployee = employees.find(emp => emp.id === user.employeeId);
        if (assignedEmployee) {
          staffId = assignedEmployee.id;
        }
      } else {
        // Fallback: find by matching patterns for unassigned users
        const userEmployee = employees.find((emp: any) => {
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
      
      // Get timesheet entries for the fortnight
      const entries = await storage.getTimesheetEntriesByPeriod(staffId, fortnightStart, fortnightEnd);
      
      let driveLink = null;
      let googleDriveConnected = false;
      
      // Generate and save PDF to Google Drive if user has connected their account
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
        
        // Try to upload to Google Drive if user has connected their account
        if (user.googleDriveTokens) {
          try {
            const googleDriveService = new GoogleDriveService();
            const tokens = JSON.parse(user.googleDriveTokens);
            googleDriveService.setUserTokens(tokens);
            
            const fileName = `timesheet-${userEmployee.name}-${fortnightStart}-${fortnightEnd}.pdf`;
            
            // Create or find BuildFlow Pro folder in Google Drive
            const buildFlowFolderId = await googleDriveService.findOrCreateFolder('BuildFlow Pro Timesheets');
            
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
      
      res.json({ 
        message: googleDriveConnected && driveLink 
          ? "Timesheet confirmed successfully. PDF generated and saved to your Google Drive in 'BuildFlow Pro Timesheets' folder."
          : googleDriveConnected 
            ? "Timesheet confirmed successfully. PDF generated but Google Drive upload failed."
            : "Timesheet confirmed successfully. PDF generated. Connect Google Drive to automatically save PDFs.",
        fortnightStart,
        fortnightEnd,
        confirmedAt: new Date().toISOString(),
        driveLink: driveLink || null,
        googleDriveConnected
      });
    } catch (error) {
      console.error("Error confirming timesheet:", error);
      res.status(500).json({ message: "Failed to confirm timesheet" });
    }
  });

  // Edit individual timesheet entry
  app.patch("/api/timesheet/:id", isAuthenticated, async (req: any, res) => {
    try {
      const entryId = req.params.id;
      const updates = req.body;
      
      // Handle special leave types by storing them in materials field and setting jobId to null
      const { jobId, materials, ...otherData } = updates;
      const leaveTypes = ['sick-leave', 'personal-leave', 'annual-leave', 'rdo'];
      let finalJobId = jobId;
      let finalMaterials = materials || '';
      
      if (leaveTypes.includes(jobId)) {
        finalJobId = null;
        finalMaterials = jobId; // Store leave type in materials field
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

  const httpServer = createServer(app);
  return httpServer;
}
