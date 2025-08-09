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

  // Labor entry routes
  app.patch("/api/labor-entries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { updateEmployeeRate, ...laborData } = req.body;
      const validatedData = insertLaborEntrySchema.partial().parse(laborData);
      
      const laborEntry = await storage.updateLaborEntry(req.params.id, validatedData);
      
      // If updateEmployeeRate is true, also update the employee's default rate
      if (updateEmployeeRate && validatedData.hourlyRate && laborEntry) {
        await storage.updateEmployee(laborEntry.staffId, { 
          defaultHourlyRate: validatedData.hourlyRate 
        });
      }
      
      res.json(laborEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating labor entry:", error);
      res.status(500).json({ message: "Failed to update labor entry" });
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

  app.post("/api/timesheet", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertTimesheetEntrySchema.parse({
        ...req.body,
        staffId: userId,
      });
      const entry = await storage.createTimesheetEntry(validatedData);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating timesheet entry:", error);
      res.status(500).json({ message: "Failed to create timesheet entry" });
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

  const httpServer = createServer(app);
  return httpServer;
}
