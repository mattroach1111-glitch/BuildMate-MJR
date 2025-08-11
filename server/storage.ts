import {
  users,
  jobs,
  employees,
  laborEntries,
  materials,
  subTrades,
  otherCosts,
  timesheetEntries,
  jobFiles,
  type User,
  type UpsertUser,
  type Employee,
  type InsertEmployee,
  type Job,
  type InsertJob,
  type LaborEntry,
  type InsertLaborEntry,
  type Material,
  type InsertMaterial,
  type SubTrade,
  type InsertSubTrade,
  type OtherCost,
  type InsertOtherCost,
  type TimesheetEntry,
  type InsertTimesheetEntry,
  type JobFile,
  type InsertJobFile,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sum, ne, gte, lte, sql, isNull, or } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserGoogleDriveTokens(id: string, tokens: string | null): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: "admin" | "staff"): Promise<void>;
  assignUserToEmployee(userId: string, employeeId: string): Promise<void>;
  getUnassignedUsers(): Promise<User[]>;
  
  // Employee operations
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;
  
  // Job operations
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job>;
  updateJobStatus(id: string, status: "new_job" | "job_in_progress" | "job_complete" | "ready_for_billing"): Promise<Job>;
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
  
  // Other costs operations
  getOtherCostsForJob(jobId: string): Promise<OtherCost[]>;
  createOtherCost(otherCost: InsertOtherCost): Promise<OtherCost>;
  updateOtherCost(id: string, otherCost: Partial<InsertOtherCost>): Promise<OtherCost>;
  deleteOtherCost(id: string): Promise<void>;
  
  // Timesheet operations
  getTimesheetEntries(staffId: string): Promise<TimesheetEntry[]>;
  createTimesheetEntry(entry: InsertTimesheetEntry): Promise<TimesheetEntry>;
  upsertTimesheetEntry(entry: InsertTimesheetEntry): Promise<TimesheetEntry>;
  deleteTimesheetEntry(id: string): Promise<void>;
  getJobsForStaff(): Promise<Job[]>;
  
  // Admin timesheet operations
  getAllTimesheetEntries(): Promise<any[]>;
  updateTimesheetApproval(id: string, approved: boolean): Promise<void>;
  updateFortnightApproval(staffId: string, fortnightStart: string, fortnightEnd: string, approved: boolean): Promise<void>;
  clearFortnightTimesheet(staffId: string, fortnightStart: string, fortnightEnd: string): Promise<void>;
  clearTimesheetEntry(entryId: string): Promise<void>;
  getStaffUsers(): Promise<User[]>;
  getStaffForTimesheets(): Promise<Array<{ id: string; name: string; type: 'user' | 'employee' }>>;
  getTimesheetEntriesByPeriod(staffId: string, startDate: string, endDate: string): Promise<any[]>;
  createAdminTimesheetEntry(data: any): Promise<any>;
  updateTimesheetEntry(id: string, data: any): Promise<void>;
  addLaborEntry(entry: { jobId: string; employeeId: string; hours: number; hourlyRate: number; date: string }): Promise<void>;
  markTimesheetEntriesConfirmed(staffId: string, startDate: string, endDate: string): Promise<void>;
  
  // Sync operations
  syncEmployeesToJob(jobId: string): Promise<void>;
  
  // Job files operations
  getJobFiles(jobId: string): Promise<JobFile[]>;
  getJobFile(id: string): Promise<JobFile | undefined>;
  createJobFile(jobFile: InsertJobFile): Promise<JobFile>;
  deleteJobFile(id: string): Promise<void>;
  
  // Soft delete operations  
  getDeletedJobs(): Promise<Job[]>;
  softDeleteJob(id: string): Promise<void>;
  restoreJob(id: string): Promise<void>;
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
      .values({
        ...userData,
        isAssigned: false, // New users start unassigned
      })
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

  async updateUserGoogleDriveTokens(id: string, tokens: string | null): Promise<void> {
    await db
      .update(users)
      .set({ 
        googleDriveTokens: tokens,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(id: string, role: "admin" | "staff"): Promise<void> {
    await db
      .update(users)
      .set({ 
        role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async assignUserToEmployee(userId: string, employeeId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        employeeId,
        isAssigned: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getUnassignedUsers(): Promise<User[]> {
    // Only return users who have actually logged in (updatedAt != createdAt indicates login)
    // and are not assigned to employees yet
    return await db.select().from(users).where(
      and(
        eq(users.isAssigned, false),
        // Only include users who have actually logged in 
        // (updatedAt different from createdAt indicates authentication occurred)
        ne(users.updatedAt, users.createdAt)
      )
    ).orderBy(desc(users.updatedAt));
  }

  // Employee operations
  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees).orderBy(desc(employees.createdAt));
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [createdEmployee] = await db.insert(employees).values(employee).returning();
    
    // Add this employee to all existing jobs with each job's default hourly rate
    const jobs = await this.getJobs();
    for (const job of jobs) {
      await this.createLaborEntry({
        jobId: job.id,
        staffId: createdEmployee.id,
        hourlyRate: job.defaultHourlyRate, // Use job's default rate, not employee's rate
        hoursLogged: "0",
      });
    }
    
    return createdEmployee;
  }

  async updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee> {
    const [updatedEmployee] = await db
      .update(employees)
      .set(employee)
      .where(eq(employees.id, id))
      .returning();
    return updatedEmployee;
  }

  async deleteEmployee(id: string): Promise<void> {
    // First delete all labor entries for this employee
    await db.delete(laborEntries).where(eq(laborEntries.staffId, id));
    
    // Then delete all timesheet entries for this employee (they reference users.id, not employees.id)
    const employee = await this.getEmployee(id);
    if (employee) {
      // Find the user account for this employee by name matching
      const allUsers = await this.getAllUsers();
      const matchingUser = allUsers.find(user => 
        user.firstName?.toLowerCase() === employee.name.toLowerCase() ||
        user.email?.includes(employee.name.toLowerCase())
      );
      
      if (matchingUser) {
        await db.delete(timesheetEntries).where(eq(timesheetEntries.staffId, matchingUser.id));
        // Also delete the user account
        await db.delete(users).where(eq(users.id, matchingUser.id));
      }
    }
    
    // Finally delete the employee
    await db.delete(employees).where(eq(employees.id, id));
  }

  // Job operations
  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs)
      .where(or(eq(jobs.isDeleted, false), isNull(jobs.isDeleted)))
      .orderBy(desc(jobs.createdAt));
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [createdJob] = await db.insert(jobs).values(job).returning();
    
    // Automatically add all employees to the job with the job's default hourly rate
    const employees = await this.getEmployees();
    for (const employee of employees) {
      await this.createLaborEntry({
        jobId: createdJob.id,
        staffId: employee.id,
        hourlyRate: job.defaultHourlyRate || "50", // Use job's default rate, not employee's rate
        hoursLogged: "0",
      });
    }
    
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

  async updateJobStatus(id: string, status: "new_job" | "job_in_progress" | "job_complete" | "ready_for_billing"): Promise<Job> {
    const [updatedJob] = await db
      .update(jobs)
      .set({ status, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return updatedJob;
  }

  async deleteJob(id: string): Promise<void> {
    // Delete all related data first
    await db.delete(laborEntries).where(eq(laborEntries.jobId, id));
    await db.delete(materials).where(eq(materials.jobId, id));
    await db.delete(subTrades).where(eq(subTrades.jobId, id));
    await db.delete(otherCosts).where(eq(otherCosts.jobId, id));
    await db.delete(timesheetEntries).where(eq(timesheetEntries.jobId, id));
    await db.delete(jobFiles).where(eq(jobFiles.jobId, id));
    
    // Delete the job itself
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async softDeleteJob(id: string): Promise<void> {
    await db
      .update(jobs)
      .set({ 
        isDeleted: true, 
        deletedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(jobs.id, id));
  }

  async getDeletedJobs(): Promise<Job[]> {
    return await db.select().from(jobs)
      .where(eq(jobs.isDeleted, true))
      .orderBy(desc(jobs.deletedAt));
  }

  async restoreJob(id: string): Promise<void> {
    await db
      .update(jobs)
      .set({ 
        isDeleted: false, 
        deletedAt: null,
        updatedAt: new Date() 
      })
      .where(eq(jobs.id, id));
  }

  // Job files operations
  async getJobFiles(jobId: string): Promise<JobFile[]> {
    return await db
      .select()
      .from(jobFiles)
      .where(eq(jobFiles.jobId, jobId))
      .orderBy(desc(jobFiles.createdAt));
  }

  async getJobFile(id: string): Promise<JobFile | undefined> {
    const [file] = await db.select().from(jobFiles).where(eq(jobFiles.id, id));
    return file;
  }

  async createJobFile(jobFile: InsertJobFile): Promise<JobFile> {
    const [createdFile] = await db
      .insert(jobFiles)
      .values(jobFile)
      .returning();
    return createdFile;
  }

  async deleteJobFile(id: string): Promise<void> {
    await db.delete(jobFiles).where(eq(jobFiles.id, id));
  }

  // Labor entry operations
  async getLaborEntriesForJob(jobId: string): Promise<any[]> {
    return await db
      .select({
        id: laborEntries.id,
        jobId: laborEntries.jobId,
        staffId: laborEntries.staffId,
        hourlyRate: laborEntries.hourlyRate,
        hoursLogged: laborEntries.hoursLogged,
        createdAt: laborEntries.createdAt,
        updatedAt: laborEntries.updatedAt,
        staff: {
          id: employees.id,
          name: employees.name,
          defaultHourlyRate: employees.defaultHourlyRate,
        },
      })
      .from(laborEntries)
      .leftJoin(employees, eq(laborEntries.staffId, employees.id))
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
    // Get user info to find the corresponding employee ID
    const user = await db.select().from(users).where(eq(users.id, staffId)).limit(1);
    const employeeId = user[0]?.employeeId || staffId; // Use employeeId if available, otherwise use staffId directly
    
    console.log(`[LABOR_UPDATE] Starting: staffId=${staffId}, employeeId=${employeeId}, jobId=${jobId}`);

    // Get total hours from timesheet for this staff and job (only approved entries)
    const result = await db
      .select({ totalHours: sql`COALESCE(SUM(CAST(${timesheetEntries.hours} AS NUMERIC)), 0)`.as('totalHours') })
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, staffId),
          eq(timesheetEntries.jobId, jobId),
          eq(timesheetEntries.approved, true)  // Only count approved entries
        )
      );

    const totalHours = result[0]?.totalHours || 0;
    console.log(`[LABOR_UPDATE] Calculated hours from timesheet: ${totalHours}`);

    // Check if labor entry exists first
    const existingEntry = await db
      .select()
      .from(laborEntries)
      .where(
        and(
          eq(laborEntries.staffId, employeeId),
          eq(laborEntries.jobId, jobId)
        )
      )
      .limit(1);

    if (existingEntry.length === 0) {
      console.log(`[LABOR_UPDATE] No labor entry found for employeeId=${employeeId}, jobId=${jobId} - skipping update`);
      return;
    }

    console.log(`[LABOR_UPDATE] Existing entry hours: ${existingEntry[0].hoursLogged}, updating to: ${totalHours}`);

    // Update labor entry hours using the employee ID (not user ID)
    const updateResult = await db
      .update(laborEntries)
      .set({ hoursLogged: totalHours.toString(), updatedAt: new Date() })
      .where(
        and(
          eq(laborEntries.staffId, employeeId), // Use employee ID for labor entries
          eq(laborEntries.jobId, jobId)
        )
      );
    
    console.log(`[LABOR_UPDATE] Completed for employeeId=${employeeId}, jobId=${jobId}, hours=${totalHours}`);
  }

  async addExtraHoursToLaborEntry(laborEntryId: string, extraHours: string): Promise<LaborEntry> {
    // Get current labor entry
    const [currentEntry] = await db
      .select()
      .from(laborEntries)
      .where(eq(laborEntries.id, laborEntryId));

    if (!currentEntry) {
      throw new Error("Labor entry not found");
    }

    // Add extra hours to current hours
    const currentHours = parseFloat(currentEntry.hoursLogged) || 0;
    const additionalHours = parseFloat(extraHours);
    const newTotalHours = (currentHours + additionalHours).toString();

    // Update the labor entry with new total hours
    const [updatedEntry] = await db
      .update(laborEntries)
      .set({ 
        hoursLogged: newTotalHours, 
        updatedAt: new Date() 
      })
      .where(eq(laborEntries.id, laborEntryId))
      .returning();

    return updatedEntry;
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

  // Other costs operations
  async getOtherCostsForJob(jobId: string): Promise<OtherCost[]> {
    return await db
      .select()
      .from(otherCosts)
      .where(eq(otherCosts.jobId, jobId));
  }

  async createOtherCost(otherCost: InsertOtherCost): Promise<OtherCost> {
    const [createdOtherCost] = await db
      .insert(otherCosts)
      .values(otherCost)
      .returning();
    return createdOtherCost;
  }

  async updateOtherCost(id: string, otherCost: Partial<InsertOtherCost>): Promise<OtherCost> {
    const [updatedOtherCost] = await db
      .update(otherCosts)
      .set(otherCost)
      .where(eq(otherCosts.id, id))
      .returning();
    return updatedOtherCost;
  }

  async deleteOtherCost(id: string): Promise<void> {
    await db.delete(otherCosts).where(eq(otherCosts.id, id));
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
    if (entry.jobId) {
      await this.updateLaborHoursFromTimesheet(entry.staffId, entry.jobId);
    }

    return createdEntry;
  }

  async upsertTimesheetEntry(entry: InsertTimesheetEntry): Promise<TimesheetEntry> {
    // Check for exact duplicates only - same staff, date, job, hours, AND materials
    // This allows multiple different entries per day while preventing true duplicates
    const existingEntry = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, entry.staffId),
          eq(timesheetEntries.date, entry.date),
          eq(timesheetEntries.hours, entry.hours),
          entry.jobId ? eq(timesheetEntries.jobId, entry.jobId) : isNull(timesheetEntries.jobId),
          eq(timesheetEntries.materials, entry.materials || '')
        )
      )
      .limit(1);

    let result: TimesheetEntry;

    if (existingEntry.length > 0) {
      // This is a true duplicate - just return the existing entry without changes
      console.log('Found exact duplicate, returning existing entry:', existingEntry[0].id);
      result = existingEntry[0];
    } else {
      // Create new entry - this allows multiple different entries per day
      console.log('Creating new timesheet entry for staff:', entry.staffId, 'date:', entry.date);
      const [newEntry] = await db
        .insert(timesheetEntries)
        .values(entry)
        .returning();
      result = newEntry;
    }

    // NOTE: Labor hours will only be updated when admin approves the timesheet
    // No automatic labor hour updates on entry creation
    
    return result;
  }

  async deleteTimesheetEntry(id: string): Promise<void> {
    // Get the entry to know which staff/job to update
    const [entry] = await db
      .select()
      .from(timesheetEntries)
      .where(eq(timesheetEntries.id, id));

    await db.delete(timesheetEntries).where(eq(timesheetEntries.id, id));

    // Only update labor hours if the deleted entry was approved
    // This maintains consistency with the new approval workflow
    if (entry && entry.jobId && entry.approved) {
      await this.updateLaborHoursFromTimesheet(entry.staffId, entry.jobId);
    }
  }

  // Admin timesheet methods
  async getAllTimesheetEntries(): Promise<any[]> {
    return await db
      .select({
        id: timesheetEntries.id,
        staffId: timesheetEntries.staffId,
        jobId: timesheetEntries.jobId,
        date: timesheetEntries.date,
        hours: timesheetEntries.hours,
        materials: timesheetEntries.materials,
        approved: timesheetEntries.approved,
        createdAt: timesheetEntries.createdAt,
        updatedAt: timesheetEntries.updatedAt,
        staffName: sql`COALESCE(${users.firstName}, ${employees.name}, CASE WHEN ${users.email} IS NOT NULL THEN SPLIT_PART(${users.email}, '@', 1) ELSE 'Unknown Staff' END, 'Unknown Staff')`.as('staffName'),
        staffEmail: users.email,
        jobAddress: jobs.jobAddress,
        clientName: jobs.clientName,
        projectName: jobs.projectName,
      })
      .from(timesheetEntries)
      .leftJoin(users, eq(timesheetEntries.staffId, users.id))
      .leftJoin(employees, eq(users.employeeId, employees.id))  // Join through users.employeeId instead of direct join
      .leftJoin(jobs, eq(timesheetEntries.jobId, jobs.id))
      .orderBy(desc(timesheetEntries.date));
  }

  async updateTimesheetApproval(id: string, approved: boolean): Promise<void> {
    await db
      .update(timesheetEntries)
      .set({ approved })
      .where(eq(timesheetEntries.id, id));
  }

  async updateFortnightApproval(staffId: string, fortnightStart: string, fortnightEnd: string, approved: boolean): Promise<void> {
    // Get all affected entries before updating
    const affectedEntries = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, staffId),
          gte(timesheetEntries.date, fortnightStart),
          lte(timesheetEntries.date, fortnightEnd)
        )
      );

    // Update approval status
    await db
      .update(timesheetEntries)
      .set({ approved })
      .where(
        and(
          eq(timesheetEntries.staffId, staffId),
          gte(timesheetEntries.date, fortnightStart),
          lte(timesheetEntries.date, fortnightEnd)
        )
      );

    // Update labor hours only when approving (not when unapproving)
    if (approved) {
      const jobIds = affectedEntries.map(entry => entry.jobId).filter(Boolean) as string[];
      const uniqueJobIds = Array.from(new Set(jobIds));
      
      for (const jobId of uniqueJobIds) {
        await this.updateLaborHoursFromTimesheet(staffId, jobId);
      }
    } else {
      // When unapproving, recalculate labor hours based on remaining approved entries
      const jobIds = affectedEntries.map(entry => entry.jobId).filter(Boolean) as string[];
      const uniqueJobIds = Array.from(new Set(jobIds));
      
      for (const jobId of uniqueJobIds) {
        await this.updateLaborHoursFromTimesheet(staffId, jobId);
      }
    }
  }

  async clearFortnightTimesheet(staffId: string, fortnightStart: string, fortnightEnd: string): Promise<void> {
    // Get all entries to update affected jobs
    const entriesToDelete = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, staffId),
          gte(timesheetEntries.date, fortnightStart),
          lte(timesheetEntries.date, fortnightEnd),
          eq(timesheetEntries.approved, false) // Only delete unapproved entries
        )
      );

    // Delete the timesheet entries for this fortnight (only unapproved ones)
    await db
      .delete(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, staffId),
          gte(timesheetEntries.date, fortnightStart),
          lte(timesheetEntries.date, fortnightEnd),
          eq(timesheetEntries.approved, false) // Only delete unapproved entries
        )
      );

    // Update labor hours for affected jobs
    const jobIds = entriesToDelete.map(entry => entry.jobId).filter(Boolean) as string[];
    const uniqueJobIds = Array.from(new Set(jobIds));
    for (const jobId of uniqueJobIds) {
      await this.updateLaborHoursFromTimesheet(staffId, jobId);
    }
  }

  async clearTimesheetEntry(entryId: string): Promise<void> {
    // Get the entry to update affected job before deletion
    const [entry] = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.id, entryId),
          eq(timesheetEntries.approved, false) // Only delete unapproved entries
        )
      );

    if (!entry) {
      throw new Error("Entry not found or already approved");
    }

    // Delete the specific timesheet entry (only if unapproved)
    await db
      .delete(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.id, entryId),
          eq(timesheetEntries.approved, false) // Only delete unapproved entries
        )
      );

    // Update labor hours for affected job
    if (entry.jobId) {
      await this.updateLaborHoursFromTimesheet(entry.staffId, entry.jobId);
    }
  }

  async getStaffUsers(): Promise<User[]> {
    // Return all assigned users (both staff and admin who are assigned to employees)
    // This allows admins who work in the field to appear in staff lists
    return await db
      .select()
      .from(users)
      .where(eq(users.isAssigned, true))
      .orderBy(users.firstName);
  }

  // Get combined list of users and employees for timesheet assignment
  async getStaffForTimesheets(): Promise<Array<{ id: string; name: string; type: 'user' | 'employee' }>> {
    const [usersResult, employeesResult] = await Promise.all([
      db.select().from(users).where(eq(users.isAssigned, true)), // Include assigned users regardless of admin/staff role
      db.select().from(employees)
    ]);

    // Create a map to track unique IDs and prioritize users over employees
    const staffMap = new Map<string, { id: string; name: string; type: 'user' | 'employee' }>();

    // Add employees first
    employeesResult.forEach(employee => {
      staffMap.set(employee.id, {
        id: employee.id,
        name: employee.name,
        type: 'employee' as const
      });
    });

    // Add users - use employeeId if assigned, otherwise use user.id
    usersResult.forEach(user => {
      const idToUse = user.employeeId || user.id;
      staffMap.set(idToUse, {
        id: idToUse,
        name: user.firstName || user.email || 'Unknown',
        type: 'user' as const
      });
    });

    const result = Array.from(staffMap.values());
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getJobsForStaff(): Promise<Job[]> {
    // Return all active jobs for timesheet selection - staff can log hours against any active job
    return await db
      .select()
      .from(jobs)
      .where(or(eq(jobs.isDeleted, false), isNull(jobs.isDeleted)))
      .orderBy(jobs.jobAddress);
  }

  // Sync all employees to a specific job
  async syncEmployeesToJob(jobId: string): Promise<void> {
    const employees = await this.getEmployees();
    const existingLaborEntries = await this.getLaborEntriesForJob(jobId);
    const existingStaffIds = new Set(existingLaborEntries.map(entry => entry.staffId));
    
    // Get job's default rate for new employees
    const job = await this.getJob(jobId);
    const jobDefaultRate = job?.defaultHourlyRate || "50";
    
    for (const employee of employees) {
      if (!existingStaffIds.has(employee.id)) {
        await this.createLaborEntry({
          jobId,
          staffId: employee.id,
          hourlyRate: jobDefaultRate, // Use job's default rate, not employee's rate
          hoursLogged: "0",
        });
      }
    }
  }

  // Get timesheet entries for a specific period
  async getTimesheetEntriesByPeriod(staffId: string, startDate: string, endDate: string): Promise<any[]> {
    return await db
      .select({
        id: timesheetEntries.id,
        staffId: timesheetEntries.staffId,
        jobId: timesheetEntries.jobId,
        date: timesheetEntries.date,
        hours: timesheetEntries.hours,
        description: timesheetEntries.description,
        materials: timesheetEntries.materials,
        approved: timesheetEntries.approved,
        job: {
          id: jobs.id,
          jobAddress: jobs.jobAddress,
          clientName: jobs.clientName,
          projectName: jobs.projectName,
        }
      })
      .from(timesheetEntries)
      .leftJoin(jobs, eq(timesheetEntries.jobId, jobs.id))
      .where(
        and(
          eq(timesheetEntries.staffId, staffId),
          gte(timesheetEntries.date, startDate),
          lte(timesheetEntries.date, endDate)
        )
      )
      .orderBy(timesheetEntries.date);
  }

  // Admin method to create timesheet entry with flexible data
  async createAdminTimesheetEntry(data: any): Promise<any> {
    // Check if entry already exists for this date and staff
    const existing = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, data.staffId),
          eq(timesheetEntries.date, data.date)
        )
      );

    let result: any;

    if (existing.length > 0) {
      // Update existing entry
      const [updated] = await db
        .update(timesheetEntries)
        .set({
          hours: data.hours,
          description: data.description,
          materials: data.materials,
          approved: data.approved || false,
          updatedAt: new Date(),
        })
        .where(eq(timesheetEntries.id, existing[0].id))
        .returning();
      result = updated;
    } else {
      // Create new entry
      const [entry] = await db
        .insert(timesheetEntries)
        .values({
          staffId: data.staffId,
          jobId: data.jobId || null,
          date: data.date,
          hours: data.hours,
          description: data.description,
          materials: data.materials,
          approved: data.approved || false,
        })
        .returning();
      result = entry;
    }

    // Update labor hours for this staff/job combination
    if (data.jobId) {
      await this.updateLaborHoursFromTimesheet(data.staffId, data.jobId);
    }

    return result;
  }

  // Update timesheet entry
  async updateTimesheetEntry(id: string, data: any): Promise<void> {
    await db
      .update(timesheetEntries)
      .set({
        hours: data.hours,
        jobId: data.jobId,
        materials: data.materials,
        approved: data.approved,
        updatedAt: new Date(),
      })
      .where(eq(timesheetEntries.id, id));
  }

  // New methods for PDF generation
  async addLaborEntry(entry: { jobId: string; employeeId: string; hours: number; hourlyRate: number; date: string }): Promise<void> {
    await db.insert(laborEntries).values({
      jobId: entry.jobId,
      staffId: entry.employeeId,
      hoursLogged: entry.hours.toString(),
      hourlyRate: entry.hourlyRate.toString(),
    });
  }

  async markTimesheetEntriesConfirmed(staffId: string, startDate: string, endDate: string): Promise<void> {
    // Staff confirmation no longer auto-approves entries
    // Entries will remain unapproved until admin manually approves them
    // This allows admin review before hours are transferred to job sheets
    
    console.log(`Marked timesheet entries as confirmed for user ${staffId} from ${startDate} to ${endDate}`);
    
    // No approval status change - entries stay as approved=false until admin approval
    // No labor hour updates - these happen only when admin approves
  }
}

export const storage = new DatabaseStorage();
