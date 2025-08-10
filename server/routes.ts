import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
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

      await storage.deleteJob(req.params.id);
      res.json({ message: "Job deleted successfully" });
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({ message: "Failed to delete job" });
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
      const entries = await storage.getTimesheetEntries(userId);
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
      
      // Use the user ID directly for timesheet entries
      const staffId = userId;
      
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
      
      // In a real implementation, this would:
      // 1. Mark all timesheet entries in the fortnight as confirmed
      // 2. Upload the hours to the relevant job sheets
      // 3. Prevent further editing of confirmed entries
      
      // For now, we'll just return success
      res.json({ 
        message: "Timesheet confirmed successfully",
        fortnightStart,
        fortnightEnd,
        confirmedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error confirming timesheet:", error);
      res.status(500).json({ message: "Failed to confirm timesheet" });
    }
  });

  app.delete("/api/timesheet/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteTimesheetEntry(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting timesheet entry:", error);
      res.status(500).json({ message: "Failed to delete timesheet entry" });
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
