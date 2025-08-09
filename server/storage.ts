import {
  users,
  jobs,
  laborEntries,
  materials,
  subTrades,
  timesheetEntries,
  type User,
  type UpsertUser,
  type Job,
  type InsertJob,
  type LaborEntry,
  type InsertLaborEntry,
  type Material,
  type InsertMaterial,
  type SubTrade,
  type InsertSubTrade,
  type TimesheetEntry,
  type InsertTimesheetEntry,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sum } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Job operations
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job>;
  deleteJob(id: string): Promise<void>;
  
  // Labor entry operations
  getLaborEntriesForJob(jobId: string): Promise<LaborEntry[]>;
  createLaborEntry(entry: InsertLaborEntry): Promise<LaborEntry>;
  updateLaborEntry(id: string, entry: Partial<InsertLaborEntry>): Promise<LaborEntry>;
  deleteLaborEntry(id: string): Promise<void>;
  updateLaborHoursFromTimesheet(staffId: string, jobId: string): Promise<void>;
  
  // Material operations
  getMaterialsForJob(jobId: string): Promise<Material[]>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterial(id: string, material: Partial<InsertMaterial>): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;
  
  // Sub trade operations
  getSubTradesForJob(jobId: string): Promise<SubTrade[]>;
  createSubTrade(subTrade: InsertSubTrade): Promise<SubTrade>;
  updateSubTrade(id: string, subTrade: Partial<InsertSubTrade>): Promise<SubTrade>;
  deleteSubTrade(id: string): Promise<void>;
  
  // Timesheet operations
  getTimesheetEntries(staffId: string): Promise<TimesheetEntry[]>;
  createTimesheetEntry(entry: InsertTimesheetEntry): Promise<TimesheetEntry>;
  deleteTimesheetEntry(id: string): Promise<void>;
  getJobsForStaff(): Promise<Job[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Job operations
  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [createdJob] = await db.insert(jobs).values(job).returning();
    return createdJob;
  }

  async updateJob(id: string, job: Partial<InsertJob>): Promise<Job> {
    const [updatedJob] = await db
      .update(jobs)
      .set({ ...job, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return updatedJob;
  }

  async deleteJob(id: string): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  // Labor entry operations
  async getLaborEntriesForJob(jobId: string): Promise<LaborEntry[]> {
    return await db
      .select()
      .from(laborEntries)
      .where(eq(laborEntries.jobId, jobId));
  }

  async createLaborEntry(entry: InsertLaborEntry): Promise<LaborEntry> {
    const [createdEntry] = await db
      .insert(laborEntries)
      .values(entry)
      .returning();
    return createdEntry;
  }

  async updateLaborEntry(id: string, entry: Partial<InsertLaborEntry>): Promise<LaborEntry> {
    const [updatedEntry] = await db
      .update(laborEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(eq(laborEntries.id, id))
      .returning();
    return updatedEntry;
  }

  async deleteLaborEntry(id: string): Promise<void> {
    await db.delete(laborEntries).where(eq(laborEntries.id, id));
  }

  async updateLaborHoursFromTimesheet(staffId: string, jobId: string): Promise<void> {
    // Get total hours from timesheet for this staff and job
    const result = await db
      .select({ totalHours: sum(timesheetEntries.hours) })
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, staffId),
          eq(timesheetEntries.jobId, jobId)
        )
      );

    const totalHours = result[0]?.totalHours || "0";

    // Update labor entry hours
    await db
      .update(laborEntries)
      .set({ hoursLogged: totalHours, updatedAt: new Date() })
      .where(
        and(
          eq(laborEntries.staffId, staffId),
          eq(laborEntries.jobId, jobId)
        )
      );
  }

  // Material operations
  async getMaterialsForJob(jobId: string): Promise<Material[]> {
    return await db
      .select()
      .from(materials)
      .where(eq(materials.jobId, jobId));
  }

  async createMaterial(material: InsertMaterial): Promise<Material> {
    const [createdMaterial] = await db
      .insert(materials)
      .values(material)
      .returning();
    return createdMaterial;
  }

  async updateMaterial(id: string, material: Partial<InsertMaterial>): Promise<Material> {
    const [updatedMaterial] = await db
      .update(materials)
      .set(material)
      .where(eq(materials.id, id))
      .returning();
    return updatedMaterial;
  }

  async deleteMaterial(id: string): Promise<void> {
    await db.delete(materials).where(eq(materials.id, id));
  }

  // Sub trade operations
  async getSubTradesForJob(jobId: string): Promise<SubTrade[]> {
    return await db
      .select()
      .from(subTrades)
      .where(eq(subTrades.jobId, jobId));
  }

  async createSubTrade(subTrade: InsertSubTrade): Promise<SubTrade> {
    const [createdSubTrade] = await db
      .insert(subTrades)
      .values(subTrade)
      .returning();
    return createdSubTrade;
  }

  async updateSubTrade(id: string, subTrade: Partial<InsertSubTrade>): Promise<SubTrade> {
    const [updatedSubTrade] = await db
      .update(subTrades)
      .set(subTrade)
      .where(eq(subTrades.id, id))
      .returning();
    return updatedSubTrade;
  }

  async deleteSubTrade(id: string): Promise<void> {
    await db.delete(subTrades).where(eq(subTrades.id, id));
  }

  // Timesheet operations
  async getTimesheetEntries(staffId: string): Promise<TimesheetEntry[]> {
    return await db
      .select()
      .from(timesheetEntries)
      .where(eq(timesheetEntries.staffId, staffId))
      .orderBy(desc(timesheetEntries.date));
  }

  async createTimesheetEntry(entry: InsertTimesheetEntry): Promise<TimesheetEntry> {
    const [createdEntry] = await db
      .insert(timesheetEntries)
      .values(entry)
      .returning();

    // Update labor hours for this staff/job combination
    await this.updateLaborHoursFromTimesheet(entry.staffId, entry.jobId);

    return createdEntry;
  }

  async deleteTimesheetEntry(id: string): Promise<void> {
    // Get the entry to know which staff/job to update
    const [entry] = await db
      .select()
      .from(timesheetEntries)
      .where(eq(timesheetEntries.id, id));

    await db.delete(timesheetEntries).where(eq(timesheetEntries.id, id));

    // Update labor hours after deletion
    if (entry) {
      await this.updateLaborHoursFromTimesheet(entry.staffId, entry.jobId);
    }
  }

  async getJobsForStaff(): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "job_in_progress"))
      .orderBy(jobs.jobAddress);
  }
}

export const storage = new DatabaseStorage();
