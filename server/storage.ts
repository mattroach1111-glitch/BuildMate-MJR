import {
  users,
  jobs,
  employees,
  laborEntries,
  materials,
  subTrades,
  otherCosts,
  tipFees,
  timesheetEntries,
  jobFiles,
  jobNotes,
  notifications,
  emailProcessingLogs,
  emailProcessedDocuments,
  staffMembers,
  staffNotesEntries,
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
  type TipFee,
  type InsertTipFee,
  type TimesheetEntry,
  type InsertTimesheetEntry,
  type JobFile,
  type InsertJobFile,
  type JobNote,
  type InsertJobNote,
  type Notification,
  type InsertNotification,
  type EmailProcessingLog,
  type InsertEmailProcessingLog,
  type EmailProcessedDocument,
  type InsertEmailProcessedDocument,
  type StaffMember,
  type InsertStaffMember,
  type StaffNoteEntry,
  type InsertStaffNoteEntry,
  jobUpdateNotes,
  type JobUpdateNote,
  type InsertJobUpdateNote,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sum, ne, gte, lte, lt, sql, isNull, or, ilike, inArray } from "drizzle-orm";

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
  createEmployeeForJob(employee: InsertEmployee, jobId: string, hourlyRate: number): Promise<Employee>;
  createEmployeeWithAllJobs(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;
  
  // Job operations
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job>;
  updateJobStatus(id: string, status: "new_job" | "job_in_progress" | "job_complete" | "ready_for_billing"): Promise<Job>;
  deleteJob(id: string): Promise<void>;
  getTotalActiveCosts(): Promise<{
    totalCosts: number;
    jobCount: number;
    costBreakdown: {
      materials: number;
      labor: number;
      subTrades: number;
      otherCosts: number;
      tipFees: number;
    };
  }>;
  
  // Labor entry operations
  getLaborEntriesForJob(jobId: string): Promise<LaborEntry[]>;
  createLaborEntry(entry: InsertLaborEntry): Promise<LaborEntry>;
  updateLaborEntry(id: string, entry: Partial<InsertLaborEntry>): Promise<LaborEntry>;
  deleteLaborEntry(id: string): Promise<void>;
  updateLaborHoursFromTimesheet(staffId: string, jobId: string): Promise<void>;
  updateAllLaborRatesForJob(jobId: string, newHourlyRate: string): Promise<void>;
  
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

  // Tip fees operations
  getTipFeesForJob(jobId: string): Promise<TipFee[]>;
  createTipFee(tipFee: InsertTipFee): Promise<TipFee>;
  updateTipFee(id: string, tipFee: Partial<InsertTipFee>): Promise<TipFee>;
  deleteTipFee(id: string): Promise<void>;
  
  // Timesheet operations
  getTimesheetEntries(staffId: string): Promise<TimesheetEntry[]>;
  createTimesheetEntry(entry: InsertTimesheetEntry): Promise<TimesheetEntry>;
  upsertTimesheetEntry(entry: InsertTimesheetEntry): Promise<TimesheetEntry>;
  deleteTimesheetEntry(id: string): Promise<void>;
  getJobsForStaff(): Promise<Job[]>;
  searchTimesheetEntries(filters: any): Promise<any[]>;
  getJobTimesheets(jobId: string): Promise<any[]>;
  
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
  updateJobFile(id: string, updates: Partial<InsertJobFile>): Promise<JobFile>;
  deleteJobFile(id: string): Promise<void>;
  
  // Soft delete operations  
  getDeletedJobs(): Promise<Job[]>;
  softDeleteJob(id: string): Promise<void>;
  restoreJob(id: string): Promise<void>;
  
  // PDF job creation (without auto-adding all employees)
  createJobFromPDF(job: InsertJob): Promise<Job>;
  
  // Notification operations
  getNotificationsForUser(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  dismissNotification(id: string): Promise<void>;

  // Email processing operations
  getEmailProcessingLogs(): Promise<EmailProcessingLog[]>;
  createEmailProcessingLog(log: InsertEmailProcessingLog): Promise<EmailProcessingLog>;
  updateEmailProcessingLogStatus(id: string, status: "processing" | "completed" | "failed", errorMessage?: string): Promise<void>;
  getRecentEmailProcessingActivity(limit?: number): Promise<EmailProcessingLog[]>;
  getActiveNotifications(userId: string): Promise<Notification[]>;

  // Email processed documents for review
  createEmailProcessedDocument(data: InsertEmailProcessedDocument): Promise<EmailProcessedDocument>;
  getEmailProcessedDocumentsPending(): Promise<EmailProcessedDocument[]>;
  approveEmailProcessedDocument(id: string, jobId?: string): Promise<void>;
  rejectEmailProcessedDocument(id: string): Promise<void>;
  deleteOldRejectedEmailDocuments(cutoffTime: Date): Promise<void>;
  
  // Staff Notes System operations
  getStaffMembers(): Promise<StaffMember[]>;
  getStaffMember(id: string): Promise<StaffMember | undefined>;
  createStaffMember(member: InsertStaffMember): Promise<StaffMember>;
  updateStaffMember(id: string, member: Partial<InsertStaffMember>): Promise<StaffMember>;
  deleteStaffMember(id: string): Promise<void>;
  getStaffNoteEntriesForMember(staffMemberId: string): Promise<StaffNoteEntry[]>;
  createStaffNoteEntry(entry: InsertStaffNoteEntry): Promise<StaffNoteEntry>;
  updateStaffNoteEntry(id: string, entry: Partial<InsertStaffNoteEntry>): Promise<StaffNoteEntry>;
  deleteStaffNoteEntry(id: string): Promise<void>;
  getStaffMembersWithNotes(): Promise<(StaffMember & { notes: StaffNoteEntry[] })[]>;

  // Job Notes operations
  getJobNotes(jobId: string): Promise<(JobNote & { user: User & { employee?: Employee } })[]>;
  createJobNote(note: InsertJobNote): Promise<JobNote>;
  updateJobNote(id: string, note: Partial<InsertJobNote>): Promise<JobNote>;
  deleteJobNote(id: string): Promise<void>;

  // Job Update Notes operations
  getJobUpdateNotes(): Promise<JobUpdateNote[]>;
  saveJobUpdateNote(note: InsertJobUpdateNote): Promise<JobUpdateNote>;
  deleteJobUpdateNote(jobId: string): Promise<void>;
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

  async updateUserNotificationPreferences(userId: string, preferences: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        emailNotificationPreferences: preferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
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
    
    // NOTE: Removed automatic addition to all jobs - employees should only be added to specific jobs when needed
    
    return createdEmployee;
  }

  // Create employee and add to specific job only (for PDF auto-creation)
  async createEmployeeForJob(employee: InsertEmployee, jobId: string, hourlyRate: number): Promise<Employee> {
    const [createdEmployee] = await db.insert(employees).values(employee).returning();
    
    // Add this employee only to the specified job
    await this.createLaborEntry({
      jobId: jobId,
      staffId: createdEmployee.id,
      hourlyRate: hourlyRate.toString(),
      hoursLogged: "0",
    });
    
    return createdEmployee;
  }

  // Create employee and add to all existing jobs (for manual creation)
  async createEmployeeWithAllJobs(employee: InsertEmployee): Promise<Employee> {
    const [createdEmployee] = await db.insert(employees).values(employee).returning();
    
    // Add this employee to all existing jobs with each job's default hourly rate
    const jobs = await this.getJobs();
    for (const job of jobs) {
      await this.createLaborEntry({
        jobId: job.id,
        staffId: createdEmployee.id,
        hourlyRate: job.defaultHourlyRate,
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

  async getJobsByIds(jobIds: string[]): Promise<Job[]> {
    if (jobIds.length === 0) return [];
    return await db.select().from(jobs).where(
      and(
        or(eq(jobs.isDeleted, false), isNull(jobs.isDeleted)),
        inArray(jobs.id, jobIds)
      )
    ).orderBy(jobs.jobAddress);
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
    
    // Automatically create a "Consumables" material entry at 6% of materials (initially $0)
    await this.createMaterial({
      jobId: createdJob.id,
      description: "Consumables",
      supplier: "General",
      amount: "0.00",
      invoiceDate: new Date().toISOString().split('T')[0], // Today's date
    });
    
    return createdJob;
  }

  async createJobFromPDF(job: InsertJob): Promise<Job> {
    // Create job without auto-adding all employees (for PDF import)
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
    console.log(`[STORAGE] Soft deleting job: ${id}`);
    try {
      const result = await db
        .update(jobs)
        .set({ 
          isDeleted: true, 
          deletedAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(jobs.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error(`No job found with ID: ${id}`);
      }
      
      console.log(`[STORAGE] Successfully soft deleted job: ${id}`);
    } catch (error) {
      console.error(`[STORAGE] Error soft deleting job ${id}:`, error);
      throw error;
    }
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

  async permanentlyDeleteJob(id: string): Promise<void> {
    // Delete all related data first
    await db.delete(laborEntries).where(eq(laborEntries.jobId, id));
    await db.delete(materials).where(eq(materials.jobId, id));
    await db.delete(subTrades).where(eq(subTrades.jobId, id));
    await db.delete(otherCosts).where(eq(otherCosts.jobId, id));
    await db.delete(timesheetEntries).where(eq(timesheetEntries.jobId, id));
    await db.delete(jobFiles).where(eq(jobFiles.jobId, id));
    
    // Finally delete the job itself
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async getTotalActiveCosts(): Promise<{
    totalCosts: number;
    jobCount: number;
    costBreakdown: {
      materials: number;
      labor: number;
      subTrades: number;
      otherCosts: number;
      tipFees: number;
    };
  }> {
    // Get all active jobs (not deleted)
    const activeJobs = await db.select({ id: jobs.id })
      .from(jobs)
      .where(or(eq(jobs.isDeleted, false), isNull(jobs.isDeleted)));

    const jobIds = activeJobs.map(job => job.id);

    if (jobIds.length === 0) {
      return {
        totalCosts: 0,
        jobCount: 0,
        costBreakdown: {
          materials: 0,
          labor: 0,
          subTrades: 0,
          otherCosts: 0,
          tipFees: 0,
        },
      };
    }

    // Calculate costs for each category
    const [materialsResult, laborResult, subTradesResult, otherCostsResult, tipFeesResult] = await Promise.all([
      // Materials costs
      db.select({ total: sum(materials.amount) })
        .from(materials)
        .where(inArray(materials.jobId, jobIds)),
      
      // Labor costs (hourlyRate * hoursLogged)
      db.select({ 
        total: sql<string>`SUM(${laborEntries.hourlyRate} * ${laborEntries.hoursLogged})` 
      })
        .from(laborEntries)
        .where(inArray(laborEntries.jobId, jobIds)),
      
      // Sub-trades costs
      db.select({ total: sum(subTrades.amount) })
        .from(subTrades)
        .where(inArray(subTrades.jobId, jobIds)),
      
      // Other costs
      db.select({ total: sum(otherCosts.amount) })
        .from(otherCosts)
        .where(inArray(otherCosts.jobId, jobIds)),
      
      // Tip fees (use totalAmount which includes cartage)
      db.select({ total: sum(tipFees.totalAmount) })
        .from(tipFees)
        .where(inArray(tipFees.jobId, jobIds)),
    ]);

    const materialsTotal = Number(materialsResult[0]?.total || 0);
    const laborTotal = Number(laborResult[0]?.total || 0);
    const subTradesTotal = Number(subTradesResult[0]?.total || 0);
    const otherCostsTotal = Number(otherCostsResult[0]?.total || 0);
    const tipFeesTotal = Number(tipFeesResult[0]?.total || 0);

    // Calculate total including GST
    const totalIncludingGST = materialsTotal + laborTotal + subTradesTotal + otherCostsTotal + tipFeesTotal;
    
    // Convert to excluding GST (divide by 1.1 for Australian GST)
    const totalCosts = totalIncludingGST / 1.1;

    return {
      totalCosts,
      jobCount: jobIds.length,
      costBreakdown: {
        materials: materialsTotal / 1.1,
        labor: laborTotal / 1.1,
        subTrades: subTradesTotal / 1.1,
        otherCosts: otherCostsTotal / 1.1,
        tipFees: tipFeesTotal / 1.1,
      },
    };
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

  async findExistingJobFile(jobId: string, fileName: string, objectPath?: string): Promise<JobFile | undefined> {
    // First try to find by exact object path if provided
    if (objectPath) {
      const [fileByPath] = await db
        .select()
        .from(jobFiles)
        .where(and(eq(jobFiles.jobId, jobId), eq(jobFiles.objectPath, objectPath)));
      if (fileByPath) return fileByPath;
    }
    
    // Then try to find by filename (to catch duplicates with different object paths)
    const [fileByName] = await db
      .select()
      .from(jobFiles)
      .where(and(eq(jobFiles.jobId, jobId), eq(jobFiles.originalName, fileName)));
    return fileByName;
  }

  async createJobFile(jobFile: InsertJobFile): Promise<JobFile> {
    const [createdFile] = await db
      .insert(jobFiles)
      .values(jobFile)
      .returning();
    return createdFile;
  }

  async updateJobFile(id: string, updates: Partial<InsertJobFile>): Promise<JobFile> {
    const [updatedFile] = await db
      .update(jobFiles)
      .set(updates)
      .where(eq(jobFiles.id, id))
      .returning();
    return updatedFile;
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

  async updateAllLaborRatesForJob(jobId: string, newHourlyRate: string): Promise<void> {
    console.log(`[LABOR_RATE_UPDATE] Updating all labor rates for job ${jobId} to ${newHourlyRate}`);
    
    // Update all labor entries for this job with the new hourly rate
    await db
      .update(laborEntries)
      .set({ 
        hourlyRate: newHourlyRate, 
        updatedAt: new Date() 
      })
      .where(eq(laborEntries.jobId, jobId));
    
    console.log(`[LABOR_RATE_UPDATE] Updated all labor rates for job ${jobId}`);
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
    
    // Update consumables calculation (only if this is not the consumables entry itself)
    if (material.description.toLowerCase() !== "consumables") {
      await this.updateConsumablesForJob(material.jobId);
    }
    
    return createdMaterial;
  }

  async updateMaterial(id: string, material: Partial<InsertMaterial>): Promise<Material> {
    // Get the original material to check if it's consumables and get jobId
    const [originalMaterial] = await db.select().from(materials).where(eq(materials.id, id));
    
    const [updatedMaterial] = await db
      .update(materials)
      .set(material)
      .where(eq(materials.id, id))
      .returning();
    
    // Update consumables calculation (only if this is not the consumables entry itself)
    if (originalMaterial && originalMaterial.description.toLowerCase() !== "consumables") {
      await this.updateConsumablesForJob(originalMaterial.jobId);
    }
    
    return updatedMaterial;
  }

  async deleteMaterial(id: string): Promise<void> {
    // Get the material info before deletion to check if it's consumables and get jobId
    const [materialToDelete] = await db.select().from(materials).where(eq(materials.id, id));
    
    await db.delete(materials).where(eq(materials.id, id));
    
    // Update consumables calculation (only if this is not the consumables entry itself)
    if (materialToDelete && materialToDelete.description.toLowerCase() !== "consumables") {
      await this.updateConsumablesForJob(materialToDelete.jobId);
    }
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

  // Tip fees operations
  async getTipFeesForJob(jobId: string): Promise<TipFee[]> {
    return await db
      .select()
      .from(tipFees)
      .where(eq(tipFees.jobId, jobId));
  }

  async createTipFee(tipFee: InsertTipFee): Promise<TipFee> {
    const amount = parseFloat(tipFee.amount);
    const cartageAmount = amount * 0.20; // 20% cartage fee
    const totalAmount = amount + cartageAmount;

    const [createdTipFee] = await db
      .insert(tipFees)
      .values({
        ...tipFee,
        cartageAmount: cartageAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
      })
      .returning();
    return createdTipFee;
  }

  async updateTipFee(id: string, tipFee: Partial<InsertTipFee>): Promise<TipFee> {
    let updateData: any = { ...tipFee };

    // If amount is being updated, recalculate cartage and total
    if (tipFee.amount) {
      const amount = parseFloat(tipFee.amount);
      const cartageAmount = amount * 0.20;
      const totalAmount = amount + cartageAmount;
      
      updateData = {
        ...updateData,
        cartageAmount: cartageAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
      };
    }

    const [updatedTipFee] = await db
      .update(tipFees)
      .set(updateData)
      .where(eq(tipFees.id, id))
      .returning();
    return updatedTipFee;
  }

  async deleteTipFee(id: string): Promise<void> {
    await db.delete(tipFees).where(eq(tipFees.id, id));
  }

  // Helper function to calculate and update consumables
  async updateConsumablesForJob(jobId: string): Promise<void> {
    try {
      // Get all materials for this job
      const allMaterials = await this.getMaterialsForJob(jobId);
      
      // Find the consumables entry
      const consumablesEntry = allMaterials.find(material => 
        material.description.toLowerCase() === "consumables"
      );
      
      if (!consumablesEntry) {
        // If no consumables entry exists, create one
        // Use a recursive flag to prevent infinite loop
        const newConsumables = await db
          .insert(materials)
          .values({
            jobId,
            description: "Consumables",
            supplier: "General",
            amount: "0.00",
            invoiceDate: new Date().toISOString().split('T')[0],
          })
          .returning();
        
        // Calculate initial amount for the newly created consumables
        const otherMaterials = allMaterials.filter(material => 
          material.description.toLowerCase() !== "consumables"
        );
        
        const totalOtherMaterials = otherMaterials.reduce((sum, material) => {
          return sum + parseFloat(material.amount || "0");
        }, 0);
        
        const consumablesAmount = (totalOtherMaterials * 0.06).toFixed(2);
        
        // Update without triggering recursive call
        await db
          .update(materials)
          .set({ amount: consumablesAmount })
          .where(eq(materials.id, newConsumables[0].id));
        
        return;
      }
      
      // Calculate 6% of all other materials (excluding consumables itself)
      const otherMaterials = allMaterials.filter(material => 
        material.description.toLowerCase() !== "consumables"
      );
      
      const totalOtherMaterials = otherMaterials.reduce((sum, material) => {
        return sum + parseFloat(material.amount || "0");
      }, 0);
      
      const consumablesAmount = (totalOtherMaterials * 0.06).toFixed(2);
      
      // Update the consumables entry directly to avoid recursive calls
      await db
        .update(materials)
        .set({ amount: consumablesAmount })
        .where(eq(materials.id, consumablesEntry.id));
    } catch (error) {
      console.error("Error updating consumables:", error);
      // Don't throw - this is a background calculation
    }
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

  async getJobTimesheets(jobId: string): Promise<any[]> {
    return await db
      .select({
        id: timesheetEntries.id,
        staffId: timesheetEntries.staffId,
        jobId: timesheetEntries.jobId,
        date: timesheetEntries.date,
        hours: timesheetEntries.hours,
        materials: timesheetEntries.materials,
        description: timesheetEntries.description,
        approved: timesheetEntries.approved,
        submitted: timesheetEntries.submitted,
        createdAt: timesheetEntries.createdAt,
        updatedAt: timesheetEntries.updatedAt,
        staffName: sql`COALESCE(${users.firstName}, ${employees.name}, CASE WHEN ${users.email} IS NOT NULL THEN SPLIT_PART(${users.email}, '@', 1) ELSE 'Unknown Staff' END, 'Unknown Staff')`.as('staffName'),
        staffEmail: users.email,
      })
      .from(timesheetEntries)
      .leftJoin(users, eq(timesheetEntries.staffId, users.id))
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .where(eq(timesheetEntries.jobId, jobId))
      .orderBy(desc(timesheetEntries.date));
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
        description: timesheetEntries.description,
        approved: timesheetEntries.approved,
        submitted: timesheetEntries.submitted,
        createdAt: timesheetEntries.createdAt,
        updatedAt: timesheetEntries.updatedAt,
        staffName: sql`COALESCE(${users.firstName}, ${employees.name}, CASE WHEN ${users.email} IS NOT NULL THEN SPLIT_PART(${users.email}, '@', 1) ELSE 'Unknown Staff' END, 'Unknown Staff')`.as('staffName'),
        staffEmail: users.email,
        // Enhanced job address to handle custom addresses and leave types
        jobAddress: sql`
          CASE 
            WHEN ${timesheetEntries.description} IS NOT NULL AND ${timesheetEntries.description} LIKE 'CUSTOM_ADDRESS:%' 
            THEN REPLACE(${timesheetEntries.description}, 'CUSTOM_ADDRESS: ', '')
            WHEN ${timesheetEntries.materials} IN ('sick-leave', 'personal-leave', 'annual-leave', 'rdo', 'leave-without-pay')
            THEN CASE 
              WHEN ${timesheetEntries.materials} = 'sick-leave' THEN 'Sick Leave'
              WHEN ${timesheetEntries.materials} = 'personal-leave' THEN 'Personal Leave'
              WHEN ${timesheetEntries.materials} = 'annual-leave' THEN 'Annual Leave'
              WHEN ${timesheetEntries.materials} = 'rdo' THEN 'RDO (Rostered Day Off)'
              WHEN ${timesheetEntries.materials} = 'leave-without-pay' THEN 'Leave Without Pay'
            END
            WHEN ${jobs.jobAddress} IS NOT NULL THEN ${jobs.jobAddress}
            ELSE 'Unknown Job'
          END
        `.as('jobAddress'),
        clientName: jobs.clientName,
        projectName: jobs.projectName,
      })
      .from(timesheetEntries)
      .leftJoin(users, eq(timesheetEntries.staffId, users.id))
      .leftJoin(employees, eq(users.employeeId, employees.id))  // Join through users.employeeId instead of direct join
      .leftJoin(jobs, eq(timesheetEntries.jobId, jobs.id))
      .where(eq(timesheetEntries.submitted, true))  // Only show submitted entries in admin dashboard
      .orderBy(desc(timesheetEntries.date));
  }

  async updateTimesheetApproval(id: string, approved: boolean): Promise<void> {
    await db
      .update(timesheetEntries)
      .set({ approved })
      .where(eq(timesheetEntries.id, id));
  }

  async markTimesheetEntriesAsSubmitted(userId: string, fortnightStart: string, fortnightEnd: string): Promise<void> {
    await db
      .update(timesheetEntries)
      .set({ submitted: true, updatedAt: new Date() })
      .where(
        and(
          eq(timesheetEntries.staffId, userId),
          gte(timesheetEntries.date, fortnightStart),
          lte(timesheetEntries.date, fortnightEnd)
        )
      );
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

  async searchTimesheetEntries(filters: {
    query?: string;
    employeeName?: string;
    jobAddress?: string;
    client?: string;
    dateFrom?: string;
    dateTo?: string;
    approvalStatus?: string;
    minHours?: string;
    maxHours?: string;
  }): Promise<any[]> {
    let query = db
      .select({
        id: timesheetEntries.id,
        staffId: timesheetEntries.staffId,
        employeeName: sql`COALESCE(${users.firstName}, ${employees.name}, CASE WHEN ${users.email} IS NOT NULL THEN SPLIT_PART(${users.email}, '@', 1) ELSE 'Unknown Staff' END, 'Unknown Staff')`.as('employeeName'),
        date: timesheetEntries.date,
        hours: timesheetEntries.hours,
        jobId: timesheetEntries.jobId,
        jobAddress: jobs.jobAddress,
        jobClient: jobs.clientName,
        materials: timesheetEntries.materials,
        approved: timesheetEntries.approved,
        createdAt: timesheetEntries.createdAt
      })
      .from(timesheetEntries)
      .leftJoin(users, eq(timesheetEntries.staffId, users.id))
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .leftJoin(jobs, eq(timesheetEntries.jobId, jobs.id));

    // Apply filters
    const conditions: any[] = [];

    if (filters.query) {
      conditions.push(
        or(
          ilike(users.firstName, `%${filters.query}%`),
          ilike(employees.name, `%${filters.query}%`),
          ilike(users.email, `%${filters.query}%`),
          ilike(jobs.jobAddress, `%${filters.query}%`),
          ilike(jobs.clientName, `%${filters.query}%`),
          ilike(timesheetEntries.materials, `%${filters.query}%`)
        )
      );
    }

    if (filters.employeeName) {
      conditions.push(
        or(
          ilike(users.firstName, `%${filters.employeeName}%`),
          ilike(employees.name, `%${filters.employeeName}%`),
          ilike(users.email, `%${filters.employeeName}%`)
        )
      );
    }

    if (filters.jobAddress) {
      conditions.push(ilike(jobs.jobAddress, `%${filters.jobAddress}%`));
    }

    if (filters.client) {
      conditions.push(ilike(jobs.clientName, `%${filters.client}%`));
    }

    if (filters.dateFrom) {
      conditions.push(gte(timesheetEntries.date, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(timesheetEntries.date, filters.dateTo));
    }

    if (filters.approvalStatus === 'approved') {
      conditions.push(eq(timesheetEntries.approved, true));
    } else if (filters.approvalStatus === 'pending') {
      conditions.push(eq(timesheetEntries.approved, false));
    }

    if (filters.minHours) {
      conditions.push(gte(sql`CAST(${timesheetEntries.hours} AS DECIMAL)`, parseFloat(filters.minHours)));
    }

    if (filters.maxHours) {
      conditions.push(lte(sql`CAST(${timesheetEntries.hours} AS DECIMAL)`, parseFloat(filters.maxHours)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query
      .orderBy(desc(timesheetEntries.date), desc(timesheetEntries.createdAt))
      .limit(500); // Limit results for performance

    return results;
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
        submitted: timesheetEntries.submitted,
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

  // Get single timesheet entry
  async getTimesheetEntry(id: string): Promise<any> {
    const result = await db
      .select()
      .from(timesheetEntries)
      .where(eq(timesheetEntries.id, id))
      .limit(1);
    
    return result[0] || null;
  }

  // Update timesheet entry
  async updateTimesheetEntry(id: string, data: any): Promise<void> {
    await db
      .update(timesheetEntries)
      .set({
        hours: data.hours,
        jobId: data.jobId,
        materials: data.materials,
        description: data.description,
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

  // Notification operations
  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.scheduledFor));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }

  async dismissNotification(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ dismissedAt: new Date() })
      .where(eq(notifications.id, id));
  }

  async getActiveNotifications(userId: string): Promise<Notification[]> {
    const now = new Date();
    return await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          lte(notifications.scheduledFor, now),
          eq(notifications.read, false),
          isNull(notifications.dismissedAt)
        )
      )
      .orderBy(desc(notifications.scheduledFor));
  }

  // Email processing operations implementation
  async getEmailProcessingLogs(): Promise<EmailProcessingLog[]> {
    return await db
      .select()
      .from(emailProcessingLogs)
      .orderBy(desc(emailProcessingLogs.createdAt));
  }

  async createEmailProcessingLog(log: InsertEmailProcessingLog): Promise<EmailProcessingLog> {
    const [created] = await db
      .insert(emailProcessingLogs)
      .values(log)
      .returning();
    return created;
  }

  async updateEmailProcessingLogStatus(
    id: string, 
    status: "processing" | "completed" | "failed", 
    errorMessage?: string
  ): Promise<void> {
    await db
      .update(emailProcessingLogs)
      .set({ 
        status,
        errorMessage: errorMessage || null
      })
      .where(eq(emailProcessingLogs.id, id));
  }

  async getRecentEmailProcessingActivity(limit: number = 10): Promise<EmailProcessingLog[]> {
    return await db
      .select()
      .from(emailProcessingLogs)
      .orderBy(desc(emailProcessingLogs.createdAt))
      .limit(limit);
  }

  // Email processed documents for review workflow
  async createEmailProcessedDocument(data: InsertEmailProcessedDocument): Promise<EmailProcessedDocument> {
    const [result] = await db.insert(emailProcessedDocuments).values(data).returning();
    return result;
  }

  async getEmailProcessedDocumentsPending(): Promise<EmailProcessedDocument[]> {
    const results = await db.select()
      .from(emailProcessedDocuments)
      .where(eq(emailProcessedDocuments.status, 'pending'))
      .orderBy(desc(emailProcessedDocuments.createdAt));
    console.log('📧 Pending documents with subjects:', results.map(r => ({ id: r.id.slice(0,8), filename: r.filename, email_subject: r.emailSubject })));
    return results;
  }

  async getEmailProcessedDocuments(): Promise<any[]> {
    console.log('📧 Getting all email processed documents');
    const results = await db.select().from(emailProcessedDocuments);
    console.log(`📧 Found ${results.length} email processed documents`);
    return results;
  }

  async approveEmailProcessedDocument(id: string, jobId?: string): Promise<void> {
    console.log(`📋 Approving document ${id} for job ${jobId}`);
    await db.update(emailProcessedDocuments)
      .set({ 
        status: 'approved',
        jobId,
        processedAt: new Date()
      })
      .where(eq(emailProcessedDocuments.id, id));
    console.log(`✅ Document ${id} approved and assigned to job ${jobId}`);
  }

  async rejectEmailProcessedDocument(id: string): Promise<void> {
    console.log(`❌ Rejecting document ${id}`);
    await db.update(emailProcessedDocuments)
      .set({ 
        status: 'rejected',
        processedAt: new Date()
      })
      .where(eq(emailProcessedDocuments.id, id));
    console.log(`✅ Document ${id} rejected`);
  }

  // Delete old rejected email processed documents  
  async deleteOldRejectedEmailDocuments(cutoffTime: Date): Promise<void> {
    console.log(`🧹 Cleaning up rejected documents older than ${cutoffTime}`);
    const result = await db.delete(emailProcessedDocuments)
      .where(and(
        eq(emailProcessedDocuments.status, 'rejected'),
        lt(emailProcessedDocuments.processedAt, cutoffTime)
      ));
    console.log(`✅ Cleaned up old rejected documents`);
  }

  // Staff Notes System operations
  async getStaffMembers(): Promise<StaffMember[]> {
    return await db.select().from(staffMembers).orderBy(staffMembers.name);
  }

  async getStaffMember(id: string): Promise<StaffMember | undefined> {
    const [member] = await db.select().from(staffMembers).where(eq(staffMembers.id, id));
    return member;
  }

  async createStaffMember(member: InsertStaffMember): Promise<StaffMember> {
    const [createdMember] = await db.insert(staffMembers).values(member).returning();
    return createdMember;
  }

  async updateStaffMember(id: string, member: Partial<InsertStaffMember>): Promise<StaffMember> {
    const [updatedMember] = await db
      .update(staffMembers)
      .set({ ...member, updatedAt: new Date() })
      .where(eq(staffMembers.id, id))
      .returning();
    return updatedMember;
  }

  async deleteStaffMember(id: string): Promise<void> {
    // Delete all associated notes first
    await db.delete(staffNotesEntries).where(eq(staffNotesEntries.staffMemberId, id));
    // Delete the staff member
    await db.delete(staffMembers).where(eq(staffMembers.id, id));
  }

  async getStaffNoteEntriesForMember(staffMemberId: string): Promise<StaffNoteEntry[]> {
    return await db.select().from(staffNotesEntries)
      .where(eq(staffNotesEntries.staffMemberId, staffMemberId))
      .orderBy(staffNotesEntries.date);
  }

  async createStaffNoteEntry(entry: InsertStaffNoteEntry): Promise<StaffNoteEntry> {
    const [createdEntry] = await db.insert(staffNotesEntries).values(entry).returning();
    
    // Update the staff member's totals based on the note type
    const member = await this.getStaffMember(entry.staffMemberId);
    if (member && entry.amount !== undefined) {
      const amount = parseFloat(entry.amount);
      const updates: Partial<InsertStaffMember> = {};
      
      if (entry.type === 'banked_hours') {
        updates.bankedHours = (parseFloat(member.bankedHours) + amount).toString();
      } else if (entry.type === 'rdo_hours') {
        updates.rdoHours = (parseFloat(member.rdoHours) + amount).toString();
      } else if (entry.type === 'tool_cost') {
        updates.toolCostOwed = (parseFloat(member.toolCostOwed) + amount).toString();
      }
      
      if (Object.keys(updates).length > 0) {
        await this.updateStaffMember(entry.staffMemberId, updates);
      }
    }
    
    return createdEntry;
  }

  async updateStaffNoteEntry(id: string, entry: Partial<InsertStaffNoteEntry>): Promise<StaffNoteEntry> {
    // Get the original entry to calculate the difference
    const [originalEntry] = await db.select().from(staffNotesEntries).where(eq(staffNotesEntries.id, id));
    
    const [updatedEntry] = await db
      .update(staffNotesEntries)
      .set(entry)
      .where(eq(staffNotesEntries.id, id))
      .returning();
    
    // Update the staff member's totals if amount changed
    if (originalEntry && entry.amount) {
      const member = await this.getStaffMember(originalEntry.staffMemberId);
      if (member) {
        const oldAmount = parseFloat(originalEntry.amount);
        const newAmount = parseFloat(entry.amount);
        const amountDiff = newAmount - oldAmount;
        const updates: Partial<InsertStaffMember> = {};
        
        if (originalEntry.type === 'banked_hours') {
          updates.bankedHours = (parseFloat(member.bankedHours) + amountDiff).toString();
        } else if (originalEntry.type === 'rdo_hours') {
          updates.rdoHours = (parseFloat(member.rdoHours) + amountDiff).toString();
        } else if (originalEntry.type === 'tool_cost') {
          updates.toolCostOwed = (parseFloat(member.toolCostOwed) + amountDiff).toString();
        }
        
        if (Object.keys(updates).length > 0) {
          await this.updateStaffMember(originalEntry.staffMemberId, updates);
        }
      }
    }
    
    return updatedEntry;
  }

  async deleteStaffNoteEntry(id: string): Promise<void> {
    // Get the entry to update totals before deletion
    const [entryToDelete] = await db.select().from(staffNotesEntries).where(eq(staffNotesEntries.id, id));
    
    if (entryToDelete) {
      const member = await this.getStaffMember(entryToDelete.staffMemberId);
      if (member) {
        const amount = parseFloat(entryToDelete.amount);
        const updates: Partial<InsertStaffMember> = {};
        
        if (entryToDelete.type === 'banked_hours') {
          updates.bankedHours = (parseFloat(member.bankedHours) - amount).toString();
        } else if (entryToDelete.type === 'rdo_hours') {
          updates.rdoHours = (parseFloat(member.rdoHours) - amount).toString();
        } else if (entryToDelete.type === 'tool_cost') {
          updates.toolCostOwed = (parseFloat(member.toolCostOwed) - amount).toString();
        }
        
        if (Object.keys(updates).length > 0) {
          await this.updateStaffMember(entryToDelete.staffMemberId, updates);
        }
      }
    }
    
    await db.delete(staffNotesEntries).where(eq(staffNotesEntries.id, id));
  }

  async getStaffMembersWithNotes(): Promise<(StaffMember & { notes: StaffNoteEntry[] })[]> {
    const members = await this.getStaffMembers();
    const membersWithNotes = await Promise.all(
      members.map(async (member) => {
        const notes = await this.getStaffNoteEntriesForMember(member.id);
        return { ...member, notes };
      })
    );
    return membersWithNotes;
  }

  // Job Notes operations
  async getJobNotes(jobId: string): Promise<(JobNote & { user: User & { employee?: Employee } })[]> {
    const result = await db
      .select({
        id: jobNotes.id,
        jobId: jobNotes.jobId,
        userId: jobNotes.userId,
        noteText: jobNotes.noteText,
        createdAt: jobNotes.createdAt,
        updatedAt: jobNotes.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          googleDriveTokens: users.googleDriveTokens,
          employeeId: users.employeeId,
          isAssigned: users.isAssigned,
          emailNotificationPreferences: users.emailNotificationPreferences,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        employee: {
          id: employees.id,
          name: employees.name,
          defaultHourlyRate: employees.defaultHourlyRate,
          createdAt: employees.createdAt,
        },
      })
      .from(jobNotes)
      .innerJoin(users, eq(jobNotes.userId, users.id))
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .where(eq(jobNotes.jobId, jobId))
      .orderBy(desc(jobNotes.createdAt));

    // Transform the result to include employee data in user object
    return result.map(row => ({
      id: row.id,
      jobId: row.jobId,
      userId: row.userId,
      noteText: row.noteText,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        ...row.user,
        employee: row.employee,
      },
    }));
  }

  async createJobNote(note: InsertJobNote): Promise<JobNote> {
    const [newNote] = await db.insert(jobNotes).values(note).returning();
    return newNote;
  }

  async updateJobNote(id: string, noteUpdate: Partial<InsertJobNote>): Promise<JobNote> {
    const [updatedNote] = await db
      .update(jobNotes)
      .set({
        ...noteUpdate,
        updatedAt: new Date(),
      })
      .where(eq(jobNotes.id, id))
      .returning();
    return updatedNote;
  }

  async deleteJobNote(id: string): Promise<void> {
    await db.delete(jobNotes).where(eq(jobNotes.id, id));
  }

  // Job Update Notes operations
  async getJobUpdateNotes(): Promise<JobUpdateNote[]> {
    return await db.select().from(jobUpdateNotes).orderBy(desc(jobUpdateNotes.updatedAt));
  }

  async saveJobUpdateNote(note: InsertJobUpdateNote): Promise<JobUpdateNote> {
    // First try to update existing note
    const existing = await db.select().from(jobUpdateNotes).where(eq(jobUpdateNotes.jobId, note.jobId));
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(jobUpdateNotes)
        .set({ 
          note: note.note,
          updatedAt: new Date()
        })
        .where(eq(jobUpdateNotes.jobId, note.jobId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(jobUpdateNotes)
        .values(note)
        .returning();
      return created;
    }
  }

  async deleteJobUpdateNote(jobId: string): Promise<void> {
    await db.delete(jobUpdateNotes).where(eq(jobUpdateNotes.jobId, jobId));
  }
}

export const storage = new DatabaseStorage();
