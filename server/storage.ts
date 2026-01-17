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
  manualHourEntries,
  jobFiles,
  jobNotes,
  notifications,
  emailProcessingLogs,
  emailProcessedDocuments,
  staffMembers,
  staffNotesEntries,
  systemSettings,
  type User,
  type UpsertUser,
  type SystemSetting,
  type InsertSystemSetting,
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
  type ManualHourEntry,
  type InsertManualHourEntry,
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
  weeklyOrganiser,
  type WeeklyOrganiser,
  type InsertWeeklyOrganiser,
  organiserStaff,
  organiserAssignments,
  type OrganiserStaff,
  type InsertOrganiserStaff,
  type OrganiserAssignment,
  type InsertOrganiserAssignment,
  swmsTemplates,
  swmsSignatures,
  type SwmsTemplate,
  type InsertSwmsTemplate,
  type SwmsSignature,
  type InsertSwmsSignature,
  quotes,
  quoteItems,
  quoteSignatures,
  quoteAccessTokens,
  type Quote,
  type InsertQuote,
  type QuoteItem,
  type InsertQuoteItem,
  type QuoteSignature,
  type InsertQuoteSignature,
  type QuoteAccessToken,
  type InsertQuoteAccessToken,
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
  
  // System settings operations
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  setSystemSetting(key: string, value: string | null, updatedBy?: string): Promise<void>;
  getSystemGoogleDriveTokens(): Promise<string | null>;
  setSystemGoogleDriveTokens(tokens: string | null, updatedBy?: string): Promise<void>;
  
  // Employee operations
  getEmployees(): Promise<Employee[]>;
  getAllEmployees(): Promise<Employee[]>; // Get all employees regardless of active status
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  createEmployeeForJob(employee: InsertEmployee, jobId: string, hourlyRate: number): Promise<Employee>;
  createEmployeeWithAllJobs(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee>;
  toggleEmployeeStatus(id: string, isActive: boolean): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;
  
  // Job operations
  getJobs(): Promise<(Job & { subtotalExGst?: number })[]>;
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
  addExtraHoursToLaborEntry(laborEntryId: string, extraHours: string, adminUserId: string): Promise<LaborEntry>;
  
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

  // Weekly Organiser operations
  getWeeklyOrganiserByWeek(weekStartDate: string): Promise<WeeklyOrganiser[]>;
  getWeeklyOrganiserForStaff(staffId: string, weekStartDate: string): Promise<WeeklyOrganiser | undefined>;
  createWeeklyOrganiserEntry(entry: InsertWeeklyOrganiser): Promise<WeeklyOrganiser>;
  updateWeeklyOrganiserEntry(id: string, entry: Partial<InsertWeeklyOrganiser>): Promise<WeeklyOrganiser>;
  deleteWeeklyOrganiserEntry(id: string): Promise<void>;
  upsertWeeklyOrganiserEntry(entry: InsertWeeklyOrganiser): Promise<WeeklyOrganiser>;

  // Manual Organiser operations
  getOrganiserStaff(): Promise<OrganiserStaff[]>;
  createOrganiserStaff(staff: InsertOrganiserStaff): Promise<OrganiserStaff>;
  updateOrganiserStaff(id: string, staff: Partial<InsertOrganiserStaff>): Promise<OrganiserStaff>;
  deleteOrganiserStaff(id: string): Promise<void>;
  getOrganiserAssignments(weekStartDate: string): Promise<(OrganiserAssignment & { staff: OrganiserStaff })[]>;
  upsertOrganiserAssignment(assignment: InsertOrganiserAssignment): Promise<OrganiserAssignment>;
  updateOrganiserAssignment(id: string, assignment: Partial<InsertOrganiserAssignment>): Promise<OrganiserAssignment>;
  getStaffOrganiserData(staffName: string, weekStartDate: string): Promise<{ id?: string; staffId: string; staffName: string; weekStartDate: string; assignments: { monday: string; tuesday: string; wednesday: string; thursday: string; friday: string; saturday: string; sunday: string; }; notes: string; } | null>;

  // SWMS (Safe Work Method Statement) operations
  getSwmsTemplates(): Promise<SwmsTemplate[]>;
  getAllSwmsTemplates(): Promise<SwmsTemplate[]>;
  getSwmsTemplate(id: string): Promise<SwmsTemplate | undefined>;
  createSwmsTemplate(template: InsertSwmsTemplate): Promise<SwmsTemplate>;
  updateSwmsTemplate(id: string, template: Partial<InsertSwmsTemplate>): Promise<SwmsTemplate>;
  deleteSwmsTemplate(id: string): Promise<void>;
  getSwmsSignatureCountByTemplate(templateId: string): Promise<number>;
  getSwmsSignaturesForJob(jobId: string): Promise<SwmsSignature[]>;
  getSwmsSignaturesForJobWithDetails(jobId: string): Promise<Array<SwmsSignature & { template: SwmsTemplate | null; user: User | null }>>;
  getSwmsSignaturesForUser(userId: string): Promise<SwmsSignature[]>;
  getSwmsSignature(templateId: string, jobId: string, userId: string): Promise<SwmsSignature | undefined>;
  createSwmsSignature(signature: InsertSwmsSignature): Promise<SwmsSignature>;
  getUnsignedSwmsTemplatesForJob(jobId: string, userId: string): Promise<SwmsTemplate[]>;
  hasUserSignedAllSwmsForJob(jobId: string, userId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error: any) {
      if (error.code === '57P01' || error.message?.includes('admin shutdown')) {
        console.log('💤 Database suspended during getUser, retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const [user] = await db.select().from(users).where(eq(users.id, id));
          console.log('🔐 getUser retry succeeded');
          return user;
        } catch (retryError: any) {
          console.log('🔐 getUser retry failed:', retryError.message);
          return undefined;
        }
      } else {
        console.error('🔐 getUser error:', error.message);
        throw error;
      }
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
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
    } catch (error: any) {
      if (error.code === '57P01' || error.message?.includes('admin shutdown')) {
        console.log('💤 Database suspended during upsertUser, retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const [user] = await db
          .insert(users)
          .values({
            ...userData,
            isAssigned: false,
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              ...userData,
              updatedAt: new Date(),
            },
          })
          .returning();
        console.log('🔐 upsertUser retry succeeded');
        return user;
      } else {
        console.error('🔐 upsertUser error:', error.message);
        throw error;
      }
    }
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

  // System settings operations
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, key))
      .limit(1);
    return setting;
  }

  async setSystemSetting(key: string, value: string | null, updatedBy?: string): Promise<void> {
    await db
      .insert(systemSettings)
      .values({
        settingKey: key,
        settingValue: value,
        updatedBy,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: {
          settingValue: value,
          updatedBy,
          updatedAt: new Date(),
        },
      });
  }

  async getSystemGoogleDriveTokens(): Promise<string | null> {
    const setting = await this.getSystemSetting('google_drive_tokens');
    return setting?.settingValue || null;
  }

  async setSystemGoogleDriveTokens(tokens: string | null, updatedBy?: string): Promise<void> {
    await this.setSystemSetting('google_drive_tokens', tokens, updatedBy);
  }

  // Employee operations
  async getEmployees(): Promise<Employee[]> {
    // Only return employees who are marked as active (for job assignments)
    return await db
      .select()
      .from(employees)
      .where(eq(employees.isActive, true))
      .orderBy(desc(employees.createdAt));
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

  async getAllEmployees(): Promise<Employee[]> {
    // Get all employees regardless of active status (for admin management)
    return await db.select().from(employees).orderBy(desc(employees.createdAt));
  }

  async updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee> {
    const [updatedEmployee] = await db
      .update(employees)
      .set(employee)
      .where(eq(employees.id, id))
      .returning();
    return updatedEmployee;
  }

  async toggleEmployeeStatus(id: string, isActive: boolean): Promise<Employee> {
    const [updatedEmployee] = await db
      .update(employees)
      .set({ isActive })
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

  // Helper function to calculate per-job totals (excluding GST)
  async calculateJobSubtotalExGst(jobId: string): Promise<number> {
    // Calculate labor total: SUM(hourlyRate * hoursLogged)
    const [laborResult] = await db.select({ 
      total: sql<string>`COALESCE(SUM(${laborEntries.hourlyRate} * ${laborEntries.hoursLogged}), 0)` 
    })
      .from(laborEntries)
      .where(eq(laborEntries.jobId, jobId));

    // Calculate materials total: SUM(amount)
    const [materialsResult] = await db.select({ 
      total: sql<string>`COALESCE(SUM(${materials.amount}), 0)` 
    })
      .from(materials)
      .where(eq(materials.jobId, jobId));

    // Calculate sub-trades total: SUM(amount)
    const [subTradesResult] = await db.select({ 
      total: sql<string>`COALESCE(SUM(${subTrades.amount}), 0)` 
    })
      .from(subTrades)
      .where(eq(subTrades.jobId, jobId));

    // Calculate other costs total: SUM(amount)
    const [otherCostsResult] = await db.select({ 
      total: sql<string>`COALESCE(SUM(${otherCosts.amount}), 0)` 
    })
      .from(otherCosts)
      .where(eq(otherCosts.jobId, jobId));

    // Calculate tip fees total: SUM(totalAmount) - includes cartage
    const [tipFeesResult] = await db.select({ 
      total: sql<string>`COALESCE(SUM(${tipFees.totalAmount}), 0)` 
    })
      .from(tipFees)
      .where(eq(tipFees.jobId, jobId));

    const laborTotal = Number(laborResult?.total || 0);
    const materialsTotal = Number(materialsResult?.total || 0);
    const subTradesTotal = Number(subTradesResult?.total || 0);
    const otherCostsTotal = Number(otherCostsResult?.total || 0);
    const tipFeesTotal = Number(tipFeesResult?.total || 0);

    // Calculate subtotal excluding GST (includes all cost categories)
    const subtotalExGst = laborTotal + materialsTotal + subTradesTotal + otherCostsTotal + tipFeesTotal;
    
    return subtotalExGst;
  }

  // Job operations
  async getJobs(): Promise<(Job & { subtotalExGst?: number })[]> {
    const jobsData = await db.select().from(jobs)
      .where(or(eq(jobs.isDeleted, false), isNull(jobs.isDeleted)))
      .orderBy(desc(jobs.createdAt));

    // Calculate subtotal for each job
    const jobsWithSubtotals = await Promise.all(
      jobsData.map(async (job: Job) => {
        const subtotalExGst = await this.calculateJobSubtotalExGst(job.id);
        return { ...job, subtotalExGst };
      })
    );

    return jobsWithSubtotals;
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

  async getJobWithCompleteDetails(id: string): Promise<any | undefined> {
    const job = await this.getJob(id);
    if (!job) return undefined;

    // Get all related data
    const [laborData, materialsData, subTradesData, otherCostsData] = await Promise.all([
      db.select({
        id: laborEntries.id,
        date: laborEntries.createdAt,
        hours: laborEntries.hoursLogged,
        hourlyRate: laborEntries.hourlyRate,
        employeeId: laborEntries.staffId,
        employeeName: employees.name
      })
      .from(laborEntries)
      .leftJoin(employees, eq(laborEntries.staffId, employees.id))
      .where(eq(laborEntries.jobId, id)),
      
      db.select().from(materials).where(eq(materials.jobId, id)),
      db.select().from(subTrades).where(eq(subTrades.jobId, id)),
      db.select().from(otherCosts).where(eq(otherCosts.jobId, id))
    ]);

    // Calculate total cost
    const laborTotal = laborData.reduce((sum, entry) => 
      sum + (parseFloat(entry.hours) * parseFloat(entry.hourlyRate)), 0);
    const materialsTotal = materialsData.reduce((sum, item) => 
      sum + parseFloat(item.amount), 0);
    const subTradesTotal = subTradesData.reduce((sum, item) => 
      sum + parseFloat(item.amount), 0);
    const otherTotal = otherCostsData.reduce((sum, item) => 
      sum + parseFloat(item.amount), 0);

    const totalCost = laborTotal + materialsTotal + subTradesTotal + otherTotal;

    return {
      id: job.id,
      jobAddress: job.jobAddress,
      clientName: job.clientName,
      projectName: job.projectName,
      projectManager: job.projectManager,
      status: job.status,
      totalCost,
      createdAt: job.createdAt?.toISOString() || new Date().toISOString(),
      laborEntries: laborData.map(entry => ({
        id: entry.id,
        date: entry.date?.toISOString() || new Date().toISOString(),
        hours: parseFloat(entry.hours),
        hourlyRate: parseFloat(entry.hourlyRate),
        employee: { name: entry.employeeName || 'Unknown Employee' }
      })),
      materials: materialsData.map(material => ({
        id: material.id,
        name: material.description,
        cost: parseFloat(material.amount),
        quantity: 1, // Default quantity since it's not stored separately
        supplier: material.supplier
      })),
      subTrades: subTradesData.map(subTrade => ({
        id: subTrade.id,
        name: subTrade.trade,
        cost: parseFloat(subTrade.amount),
        description: subTrade.contractor
      })),
      otherCosts: otherCostsData.map(otherCost => ({
        id: otherCost.id,
        name: otherCost.description,
        cost: parseFloat(otherCost.amount),
        description: ''
      }))
    };
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [createdJob] = await db.insert(jobs).values(job).returning();
    
    // Automatically add all active employees to the job with the job's default hourly rate
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
    // Get all active jobs (not deleted and not excluded from total)
    const activeJobs = await db.select({ id: jobs.id })
      .from(jobs)
      .where(and(
        or(eq(jobs.isDeleted, false), isNull(jobs.isDeleted)),
        or(eq(jobs.excludeFromTotal, false), isNull(jobs.excludeFromTotal))
      ));

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

    // Calculate total excluding GST (all amounts are already excluding GST)
    const totalCosts = materialsTotal + laborTotal + subTradesTotal + otherCostsTotal + tipFeesTotal;

    return {
      totalCosts,
      jobCount: jobIds.length,
      costBreakdown: {
        materials: materialsTotal,
        labor: laborTotal,
        subTrades: subTradesTotal,
        otherCosts: otherCostsTotal,
        tipFees: tipFeesTotal,
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
    // Ensure new labor entries initialize manual and timesheet hours properly
    const entryWithHours = {
      ...entry,
      manualHours: entry.hoursLogged || "0", // Initial hours are considered manual
      timesheetHours: "0", // Will be populated when timesheets are approved
    };
    
    const [createdEntry] = await db
      .insert(laborEntries)
      .values(entryWithHours)
      .returning();
    return createdEntry;
  }

  async updateLaborEntry(id: string, entry: Partial<InsertLaborEntry>, enteredByUserId?: string): Promise<LaborEntry> {
    // If hours are being updated, properly calculate manual hours adjustment
    if (entry.hoursLogged !== undefined) {
      const currentEntry = await db.select().from(laborEntries).where(eq(laborEntries.id, id)).limit(1);
      if (currentEntry.length > 0) {
        const current = currentEntry[0];
        let currentManualHours = parseFloat(current.manualHours?.toString() || '0');
        let currentTimesheetHours = parseFloat(current.timesheetHours?.toString() || '0');
        const currentTotalHours = parseFloat(current.hoursLogged?.toString() || '0');
        const newTotalHours = parseFloat(entry.hoursLogged.toString());
        
        // If both manual and timesheet hours are 0 but total hours exist, 
        // it means this is an old entry that needs migration
        if (currentManualHours === 0 && currentTimesheetHours === 0 && currentTotalHours > 0) {
          currentManualHours = currentTotalHours; // Treat existing hours as manual
        }
        
        // Calculate the difference in total hours and adjust manual hours accordingly
        const hoursDifference = newTotalHours - currentTotalHours;
        const newManualHours = currentManualHours + hoursDifference;
        
        // Update with adjusted manual hours, keeping timesheet hours unchanged
        const [updatedEntry] = await db
          .update(laborEntries)
          .set({ 
            hoursLogged: newTotalHours.toString(),
            manualHours: Math.max(0, newManualHours).toString(),
            timesheetHours: currentTimesheetHours.toString(),
            hourlyRate: entry.hourlyRate || current.hourlyRate,
            updatedAt: new Date() 
          })
          .where(eq(laborEntries.id, id))
          .returning();

        // Create manual hour entry record if hours changed and we have admin info
        if (hoursDifference !== 0 && enteredByUserId) {
          await db.insert(manualHourEntries).values({
            laborEntryId: id,
            jobId: current.jobId,
            staffId: current.staffId,
            enteredById: enteredByUserId,
            hours: Math.abs(hoursDifference).toString(), // Store absolute value of change
            description: hoursDifference > 0 
              ? `Admin added ${hoursDifference} hours manually`
              : `Admin reduced hours by ${Math.abs(hoursDifference)} manually`,
            entryType: "direct_edit"
          });
        }
        
        return updatedEntry;
      }
    }

    // For other updates (not hours), just update normally
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

    const timesheetHours = parseFloat(result[0]?.totalHours?.toString() || '0');
    console.log(`[LABOR_UPDATE] Calculated timesheet hours: ${timesheetHours}`);

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
      // No labor entry exists - create one automatically when approving timesheet hours
      if (timesheetHours > 0) {
        console.log(`[LABOR_UPDATE] No existing labor entry found for staffId ${employeeId} on job ${jobId}. Creating new entry with ${timesheetHours} timesheet hours.`);
        
        // Get the hourly rate from the job or use a default
        const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
        const hourlyRate = '0'; // Default rate, admin can update later
        
        // Create new labor entry with timesheet hours
        await db.insert(laborEntries).values({
          jobId: jobId,
          staffId: employeeId,
          hoursLogged: timesheetHours.toString(),
          manualHours: '0',
          timesheetHours: timesheetHours.toString(),
          hourlyRate: hourlyRate
        });
        
        console.log(`[LABOR_UPDATE] Created new labor entry for staffId ${employeeId} on job ${jobId} with ${timesheetHours} hours`);
      } else {
        console.log(`[LABOR_UPDATE] No labor entry exists for staffId ${employeeId} on job ${jobId}, and no approved hours to add`);
      }
      return;
    }

    const currentEntry = existingEntry[0];
    let manualHours = parseFloat(currentEntry.manualHours?.toString() || '0');
    const currentTimesheetHours = parseFloat(currentEntry.timesheetHours?.toString() || '0');
    const currentTotalHours = parseFloat(currentEntry.hoursLogged?.toString() || '0');
    
    // If both manual and timesheet hours are 0 but total hours exist,
    // migrate the existing hours to manual hours
    if (manualHours === 0 && currentTimesheetHours === 0 && currentTotalHours > 0) {
      manualHours = currentTotalHours;
    }
    
    const newTotalHours = manualHours + timesheetHours;

    // Update labor entry with separate timesheet hours and recalculated total
    const updateResult = await db
      .update(laborEntries)
      .set({ 
        manualHours: manualHours.toString(), // Update manual hours (including any migration)
        timesheetHours: timesheetHours.toString(),
        hoursLogged: newTotalHours.toString(),
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(laborEntries.staffId, employeeId), // Use employee ID for labor entries
          eq(laborEntries.jobId, jobId)
        )
      );
  }

  async addExtraHoursToLaborEntry(laborEntryId: string, extraHours: string, adminUserId: string): Promise<LaborEntry> {
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

    // Create a manual hour entry to track this addition
    await db.insert(manualHourEntries).values({
      laborEntryId: laborEntryId,
      staffId: currentEntry.staffId,
      jobId: currentEntry.jobId,
      hours: additionalHours.toString(),
      description: `Added ${additionalHours} extra hours to existing ${currentHours} hours (total: ${newTotalHours})`,
      enteredById: adminUserId,
      entryType: "extra_hours"
    });

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
    console.log(`🗃️ STORAGE: Querying timesheet entries for staffId: ${staffId}`);
    console.log(`🗃️ STORAGE: StaffId type: ${typeof staffId}, length: ${staffId.length}`);
    
    // First check if any entries exist for this exact staffId
    const exactMatch = await db
      .select({ count: sql`count(*)` })
      .from(timesheetEntries)
      .where(eq(timesheetEntries.staffId, staffId));
    
    console.log(`🗃️ STORAGE: Exact match count query result:`, exactMatch[0]);
    
    const results = await db
      .select()
      .from(timesheetEntries)
      .where(eq(timesheetEntries.staffId, staffId))
      .orderBy(desc(timesheetEntries.date));
    
    console.log(`🗃️ STORAGE RESULT: Found ${results.length} entries for staffId: ${staffId}`);
    
    if (results.length === 0) {
      // Check for similar staffIds (maybe whitespace or case issues)
      const similarEntries = await db
        .select({ staffId: timesheetEntries.staffId })
        .from(timesheetEntries)
        .where(sql`${timesheetEntries.staffId} ILIKE ${'%' + staffId + '%'}`);
      
      console.log(`🗃️ DEBUG: Similar staffIds found:`, similarEntries.map(r => r.staffId));
      
      // Also check what staffIds exist in the database for debugging
      const allStaffIds = await db
        .selectDistinct({ staffId: timesheetEntries.staffId })
        .from(timesheetEntries);
      console.log(`🗃️ DEBUG: All available staffIds:`, allStaffIds.map(r => r.staffId));
    }
    
    return results;
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
    // Get regular timesheet entries
    const timesheetEntriesQuery = db
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
        staffName: sql`COALESCE(${employees.name}, ${users.firstName}, CASE WHEN ${users.email} IS NOT NULL THEN SPLIT_PART(${users.email}, '@', 1) ELSE 'Unknown Staff' END, 'Unknown Staff')`.as('staffName'),
        staffEmail: users.email,
        entryType: sql`'timesheet'`.as('entryType'),
        enteredById: sql`NULL`.as('enteredById'),
        enteredByName: sql`NULL`.as('enteredByName'),
      })
      .from(timesheetEntries)
      .leftJoin(users, eq(timesheetEntries.staffId, users.id))
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .where(eq(timesheetEntries.jobId, jobId));

    // Get manual hour entries  
    const manualEntriesQuery = db
      .select({
        id: manualHourEntries.id,
        staffId: manualHourEntries.staffId,
        jobId: manualHourEntries.jobId,
        date: sql`DATE(${manualHourEntries.createdAt})`.as('date'),
        hours: manualHourEntries.hours,
        materials: sql`NULL`.as('materials'),
        description: manualHourEntries.description,
        approved: sql`true`.as('approved'), // Manual entries are always "approved"
        submitted: sql`true`.as('submitted'),
        createdAt: manualHourEntries.createdAt,
        updatedAt: manualHourEntries.createdAt,
        staffName: employees.name,
        staffEmail: sql`NULL`.as('staffEmail'),
        entryType: sql`'manual'`.as('entryType'),
        enteredById: manualHourEntries.enteredById,
        enteredByName: sql`COALESCE(${users.firstName}, 'Admin')`.as('enteredByName'),
      })
      .from(manualHourEntries)
      .leftJoin(employees, eq(manualHourEntries.staffId, employees.id))
      .leftJoin(users, eq(manualHourEntries.enteredById, users.id)) // Join to get admin name
      .where(eq(manualHourEntries.jobId, jobId));

    // Execute both queries and combine results
    const [timesheetResults, manualResults] = await Promise.all([
      timesheetEntriesQuery,
      manualEntriesQuery
    ]);

    // Combine and sort by date (most recent first)
    const allEntries = [...timesheetResults, ...manualResults];
    return allEntries.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
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
        staffName: sql`COALESCE(${employees.name}, ${users.firstName}, CASE WHEN ${users.email} IS NOT NULL THEN SPLIT_PART(${users.email}, '@', 1) ELSE 'Unknown Staff' END, 'Unknown Staff')`.as('staffName'),
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

    // Log entries found
    console.log(`📊 STORAGE: updateFortnightApproval called for ${staffId} from ${fortnightStart} to ${fortnightEnd}`);
    console.log(`📊 STORAGE: Found ${affectedEntries.length} total entries`);
    
    // Check for weekend entries
    const weekendEntries = affectedEntries.filter(e => {
      const date = new Date(e.date);
      const dayOfWeek = date.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    });
    console.log(`🌴 STORAGE: Found ${weekendEntries.length} weekend entries:`, weekendEntries.map(e => ({ 
      date: e.date, 
      hours: e.hours, 
      submitted: e.submitted, 
      approved: e.approved 
    })));
    
    // Check for submitted vs not submitted
    const submittedEntries = affectedEntries.filter(e => e.submitted);
    const notSubmittedEntries = affectedEntries.filter(e => !e.submitted);
    console.log(`✅ STORAGE: ${submittedEntries.length} submitted, ❌ ${notSubmittedEntries.length} not submitted`);

    // Update approval status
    const result = await db
      .update(timesheetEntries)
      .set({ approved })
      .where(
        and(
          eq(timesheetEntries.staffId, staffId),
          gte(timesheetEntries.date, fortnightStart),
          lte(timesheetEntries.date, fortnightEnd)
        )
      );
    
    console.log(`✏️ STORAGE: Update query executed, result:`, result);
    
    // Fetch entries again to verify the update worked
    const entriesAfterUpdate = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, staffId),
          gte(timesheetEntries.date, fortnightStart),
          lte(timesheetEntries.date, fortnightEnd)
        )
      );
    
    const weekendEntriesAfterUpdate = entriesAfterUpdate.filter(e => {
      const date = new Date(e.date);
      const dayOfWeek = date.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    });
    console.log(`🌴 STORAGE AFTER UPDATE: Found ${weekendEntriesAfterUpdate.length} weekend entries:`, weekendEntriesAfterUpdate.map(e => ({ 
      id: e.id,
      date: e.date, 
      hours: e.hours, 
      submitted: e.submitted, 
      approved: e.approved 
    })));

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
    // CRITICAL FIX: Get users with their linked employee data using a proper join
    // This ensures we show employee names (from staff management) but use user IDs for timesheet queries
    const usersWithEmployees = await db
      .select({
        userId: users.id,
        userFirstName: users.firstName,
        userEmail: users.email,
        isAssigned: users.isAssigned,
        employeeId: users.employeeId,
        employeeName: employees.name,
        isActive: employees.isActive,
      })
      .from(users)
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .where(eq(users.isAssigned, true));

    // Also get unlinked employees (employees without user accounts)
    const unlinkedEmployees = await db
      .select({
        employeeId: employees.id,
        employeeName: employees.name,
      })
      .from(employees)
      .leftJoin(users, eq(users.employeeId, employees.id))
      .where(and(
        isNull(users.id), // Only employees without linked users
        eq(employees.isActive, true) // Only active employees
      ));

    const staffList: Array<{ id: string; name: string; type: 'user' | 'employee' }> = [];

    // Add linked users (using employee names when available, but user IDs for queries)
    // Filter to only show users linked to active employees (or users without employees)
    usersWithEmployees.forEach(userWithEmployee => {
      // Only include if: no linked employee OR linked employee is active
      if (!userWithEmployee.employeeId || userWithEmployee.isActive) {
        staffList.push({
          id: userWithEmployee.userId, // CRITICAL: Always use user ID for timesheet queries
          name: userWithEmployee.employeeName || userWithEmployee.userFirstName || userWithEmployee.userEmail || 'Unknown',
          type: userWithEmployee.employeeId ? 'employee' : 'user' // Show as 'employee' if linked
        });
      }
    });

    // Add unlinked employees (these can't submit timesheets but may be used for admin entry creation)
    unlinkedEmployees.forEach(unlinked => {
      staffList.push({
        id: unlinked.employeeId,
        name: unlinked.employeeName,
        type: 'employee' as const
      });
    });

    return staffList.sort((a, b) => a.name.localeCompare(b.name));
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
    console.log('💾 createAdminTimesheetEntry called with:', JSON.stringify(data, null, 2));
    
    // FIXED: Always create new entries - don't check for existing unless it's an exact duplicate
    // Multiple entries per day are allowed and expected
    
    let result: any;
    
    // Only check for exact duplicates if we have an ID (for updates)
    if (data.id) {
      console.log('🔄 Updating existing entry with ID:', data.id);
      const [updated] = await db
        .update(timesheetEntries)
        .set({
          jobId: data.jobId || null, // Fix: Allow clearing jobId for RDO entries
          hours: data.hours,
          description: data.description,
          materials: data.materials,
          approved: data.approved || false,
          updatedAt: new Date(),
        })
        .where(eq(timesheetEntries.id, data.id))
        .returning();
      result = updated;
    } else {
      // Always create new entry - multiple entries per day are allowed
      console.log('➕ Creating new timesheet entry');
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
      console.log('✅ Created entry with ID:', result.id);
    }

    // Update labor hours for this staff/job combination (only for actual job entries, not RDO/leave)
    if (data.jobId && data.jobId !== null && data.jobId !== '') {
      try {
        await this.updateLaborHoursFromTimesheet(data.staffId, data.jobId);
      } catch (error) {
        console.warn(`Failed to update labor hours for staffId: ${data.staffId}, jobId: ${data.jobId}:`, error);
        // Don't fail the entire entry creation for labor hour update issues
      }
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
    try {
      const results = await db.select()
        .from(emailProcessedDocuments)
        .where(eq(emailProcessedDocuments.status, 'pending'))
        .orderBy(desc(emailProcessedDocuments.createdAt));
      
      // Handle missing gstOption field gracefully for production deployment
      const safeResults = results.map(doc => ({
        ...doc,
        gstOption: doc.gstOption || 'include' // Provide default value if field doesn't exist
      }));
      
      console.log('📧 Pending documents with subjects:', safeResults.map(r => ({ id: r.id.slice(0,8), filename: r.filename, email_subject: r.emailSubject, gstOption: r.gstOption })));
      return safeResults;
    } catch (error) {
      console.error('Database error in getEmailProcessedDocumentsPending:', error);
      // If database error (likely missing column), return empty array for now
      console.log('📧 Returning empty array due to database schema mismatch');
      return [];
    }
  }

  async getEmailProcessedDocuments(): Promise<any[]> {
    console.log('📧 Getting all email processed documents');
    const results = await db.select().from(emailProcessedDocuments);
    console.log(`📧 Found ${results.length} email processed documents`);
    return results;
  }

  async approveEmailProcessedDocument(id: string, jobId?: string): Promise<void> {
    console.log(`📋 Approving document ${id} for job ${jobId}`);
    try {
      const result = await db.update(emailProcessedDocuments)
        .set({ 
          status: 'approved',
          jobId,
          processedAt: new Date()
        })
        .where(eq(emailProcessedDocuments.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error(`No document found with id ${id}`);
      }
      
      console.log(`✅ Document ${id} approved and assigned to job ${jobId}. Updated status:`, result[0].status);
    } catch (error) {
      console.error(`❌ Failed to approve document ${id}:`, error);
      throw error;
    }
  }

  async rejectEmailProcessedDocument(id: string): Promise<void> {
    console.log(`❌ Rejecting document ${id}`);
    try {
      const result = await db.update(emailProcessedDocuments)
        .set({ 
          status: 'rejected',
          processedAt: new Date()
        })
        .where(eq(emailProcessedDocuments.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error(`No document found with id ${id}`);
      }
      
      console.log(`✅ Document ${id} rejected. Updated status:`, result[0].status);
    } catch (error) {
      console.error(`❌ Failed to reject document ${id}:`, error);
      throw error;
    }
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
          isActive: employees.isActive,
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
        employee: row.employee ? {
          ...row.employee,
          isActive: row.employee.isActive ?? true, // Default to true for backwards compatibility
        } : undefined,
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

  // Migration function to populate manual/timesheet hours for existing entries
  async migrateLaborEntryHours(): Promise<void> {
    console.log("🔄 Checking labor entry hour migration...");
    
    try {
      // Find entries where manualHours and timesheetHours are NULL or 0, but hoursLogged > 0
      const entriesToMigrate = await db
        .select()
        .from(laborEntries)
        .where(
          and(
            or(
              isNull(laborEntries.manualHours),
              eq(laborEntries.manualHours, "0")
            ),
            or(
              isNull(laborEntries.timesheetHours), 
              eq(laborEntries.timesheetHours, "0")
            ),
            sql`CAST(${laborEntries.hoursLogged} AS NUMERIC) > 0`
          )
        );

      if (entriesToMigrate.length === 0) {
        console.log("✅ No labor entries need migration");
        return;
      }

      console.log(`🔄 Found ${entriesToMigrate.length} labor entries to migrate`);

      for (const entry of entriesToMigrate) {
        // Set existing hoursLogged as manualHours (since they were manually entered before timesheet system)
        await db
          .update(laborEntries)
          .set({
            manualHours: entry.hoursLogged,
            timesheetHours: "0", // Will be recalculated by timesheet logic
            updatedAt: new Date()
          })
          .where(eq(laborEntries.id, entry.id));
        
        console.log(`✅ Migrated labor entry ${entry.id}: ${entry.hoursLogged} hours -> manual hours`);
      }

      console.log("✅ Labor entry migration completed successfully");
    } catch (error) {
      console.error("❌ Failed to migrate labor entry hours:", error);
    }
  }

  // Weekly Organiser operations
  async getWeeklyOrganiserByWeek(weekStartDate: string): Promise<WeeklyOrganiser[]> {
    try {
      const entries = await db
        .select({
          id: weeklyOrganiser.id,
          weekStartDate: weeklyOrganiser.weekStartDate,
          staffId: weeklyOrganiser.staffId,
          assignedJobs: weeklyOrganiser.assignedJobs,
          notes: weeklyOrganiser.notes,
          createdAt: weeklyOrganiser.createdAt,
          updatedAt: weeklyOrganiser.updatedAt,
          staffName: employees.name,
        })
        .from(weeklyOrganiser)
        .leftJoin(employees, eq(weeklyOrganiser.staffId, employees.id))
        .where(eq(weeklyOrganiser.weekStartDate, weekStartDate))
        .orderBy(employees.name);
      
      return entries.map(entry => ({
        id: entry.id,
        weekStartDate: entry.weekStartDate,
        staffId: entry.staffId,
        assignedJobs: entry.assignedJobs,
        notes: entry.notes,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }));
    } catch (error) {
      console.error("Error fetching weekly organiser entries:", error);
      throw error;
    }
  }

  async getWeeklyOrganiserForStaff(staffId: string, weekStartDate: string): Promise<WeeklyOrganiser | undefined> {
    try {
      const [entry] = await db
        .select()
        .from(weeklyOrganiser)
        .where(and(
          eq(weeklyOrganiser.staffId, staffId),
          eq(weeklyOrganiser.weekStartDate, weekStartDate)
        ));
      
      return entry;
    } catch (error) {
      console.error("Error fetching weekly organiser entry for staff:", error);
      throw error;
    }
  }

  async createWeeklyOrganiserEntry(entry: InsertWeeklyOrganiser): Promise<WeeklyOrganiser> {
    try {
      const [newEntry] = await db
        .insert(weeklyOrganiser)
        .values(entry)
        .returning();
      
      return newEntry;
    } catch (error) {
      console.error("Error creating weekly organiser entry:", error);
      throw error;
    }
  }

  async updateWeeklyOrganiserEntry(id: string, entry: Partial<InsertWeeklyOrganiser>): Promise<WeeklyOrganiser> {
    try {
      const [updatedEntry] = await db
        .update(weeklyOrganiser)
        .set({
          ...entry,
          updatedAt: new Date(),
        })
        .where(eq(weeklyOrganiser.id, id))
        .returning();
      
      if (!updatedEntry) {
        throw new Error("Weekly organiser entry not found");
      }
      
      return updatedEntry;
    } catch (error) {
      console.error("Error updating weekly organiser entry:", error);
      throw error;
    }
  }

  async deleteWeeklyOrganiserEntry(id: string): Promise<void> {
    try {
      await db
        .delete(weeklyOrganiser)
        .where(eq(weeklyOrganiser.id, id));
    } catch (error) {
      console.error("Error deleting weekly organiser entry:", error);
      throw error;
    }
  }

  async upsertWeeklyOrganiserEntry(entry: InsertWeeklyOrganiser): Promise<WeeklyOrganiser> {
    try {
      // Check if entry exists for this staff and week
      const existingEntry = await this.getWeeklyOrganiserForStaff(entry.staffId, entry.weekStartDate);
      
      if (existingEntry) {
        // Update existing entry
        return await this.updateWeeklyOrganiserEntry(existingEntry.id, entry);
      } else {
        // Create new entry
        return await this.createWeeklyOrganiserEntry(entry);
      }
    } catch (error) {
      console.error("Error upserting weekly organiser entry:", error);
      throw error;
    }
  }

  // Manual Organiser Staff operations
  async getOrganiserStaff(): Promise<OrganiserStaff[]> {
    try {
      const staff = await db
        .select()
        .from(organiserStaff)
        .where(eq(organiserStaff.isActive, true))
        .orderBy(organiserStaff.sortOrder, organiserStaff.name);
      return staff;
    } catch (error) {
      console.error("Error getting organiser staff:", error);
      throw error;
    }
  }

  async createOrganiserStaff(staff: InsertOrganiserStaff): Promise<OrganiserStaff> {
    try {
      const [newStaff] = await db
        .insert(organiserStaff)
        .values(staff)
        .returning();
      return newStaff;
    } catch (error) {
      console.error("Error creating organiser staff:", error);
      throw error;
    }
  }

  async updateOrganiserStaff(id: string, staff: Partial<InsertOrganiserStaff>): Promise<OrganiserStaff> {
    try {
      const [updatedStaff] = await db
        .update(organiserStaff)
        .set({
          ...staff,
          updatedAt: new Date(),
        })
        .where(eq(organiserStaff.id, id))
        .returning();
      
      if (!updatedStaff) {
        throw new Error("Organiser staff not found");
      }
      
      return updatedStaff;
    } catch (error) {
      console.error("Error updating organiser staff:", error);
      throw error;
    }
  }

  async deleteOrganiserStaff(id: string): Promise<void> {
    try {
      // Soft delete by setting isActive to false
      await db
        .update(organiserStaff)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(organiserStaff.id, id));
    } catch (error) {
      console.error("Error deleting organiser staff:", error);
      throw error;
    }
  }

  async getOrganiserAssignments(weekStartDate: string): Promise<(OrganiserAssignment & { staff: OrganiserStaff })[]> {
    try {
      const assignments = await db
        .select()
        .from(organiserAssignments)
        .leftJoin(organiserStaff, eq(organiserAssignments.staffId, organiserStaff.id))
        .where(
          and(
            eq(organiserAssignments.weekStartDate, weekStartDate),
            eq(organiserStaff.isActive, true)
          )
        )
        .orderBy(organiserStaff.sortOrder, organiserStaff.name);

      return assignments.map(row => ({
        ...row.organiser_assignments,
        staff: row.organiser_staff!,
      }));
    } catch (error) {
      console.error("Error getting organiser assignments:", error);
      throw error;
    }
  }

  async upsertOrganiserAssignment(assignment: InsertOrganiserAssignment): Promise<OrganiserAssignment> {
    try {
      // Check if assignment exists for this staff and week
      const [existingAssignment] = await db
        .select()
        .from(organiserAssignments)
        .where(
          and(
            eq(organiserAssignments.staffId, assignment.staffId),
            eq(organiserAssignments.weekStartDate, assignment.weekStartDate)
          )
        );
      
      if (existingAssignment) {
        // Update existing assignment
        return await this.updateOrganiserAssignment(existingAssignment.id, assignment);
      } else {
        // Create new assignment
        const [newAssignment] = await db
          .insert(organiserAssignments)
          .values(assignment)
          .returning();
        return newAssignment;
      }
    } catch (error) {
      console.error("Error upserting organiser assignment:", error);
      throw error;
    }
  }

  async updateOrganiserAssignment(id: string, assignment: Partial<InsertOrganiserAssignment>): Promise<OrganiserAssignment> {
    try {
      const [updatedAssignment] = await db
        .update(organiserAssignments)
        .set({
          ...assignment,
          updatedAt: new Date(),
        })
        .where(eq(organiserAssignments.id, id))
        .returning();
      
      if (!updatedAssignment) {
        throw new Error("Organiser assignment not found");
      }
      
      return updatedAssignment;
    } catch (error) {
      console.error("Error updating organiser assignment:", error);
      throw error;
    }
  }

  async getStaffOrganiserData(staffName: string, weekStartDate: string): Promise<{ id?: string; staffId: string; staffName: string; weekStartDate: string; assignments: { monday: string; tuesday: string; wednesday: string; thursday: string; friday: string; saturday: string; sunday: string; }; notes: string; } | null> {
    try {
      // Find the staff member by name
      const [staffMember] = await db
        .select()
        .from(organiserStaff)
        .where(
          and(
            eq(organiserStaff.name, staffName),
            eq(organiserStaff.isActive, true)
          )
        );

      if (!staffMember) {
        console.log(`🔍 No organiser staff found with name: ${staffName}`);
        return null;
      }

      // Get their assignment for the specific week
      const [assignment] = await db
        .select()
        .from(organiserAssignments)
        .where(
          and(
            eq(organiserAssignments.staffId, staffMember.id),
            eq(organiserAssignments.weekStartDate, weekStartDate)
          )
        );

      // Return the organiser data in the expected format
      return {
        id: assignment?.id,
        staffId: staffMember.id,
        staffName: staffMember.name,
        weekStartDate,
        assignments: {
          monday: assignment?.monday || "",
          tuesday: assignment?.tuesday || "",
          wednesday: assignment?.wednesday || "",
          thursday: assignment?.thursday || "",
          friday: assignment?.friday || "",
          saturday: assignment?.saturday || "",
          sunday: assignment?.sunday || ""
        },
        notes: assignment?.notes || ""
      };
    } catch (error) {
      console.error("Error getting staff organiser data:", error);
      throw error;
    }
  }

  // SWMS (Safe Work Method Statement) operations
  async getSwmsTemplates(): Promise<SwmsTemplate[]> {
    try {
      return await db
        .select()
        .from(swmsTemplates)
        .where(eq(swmsTemplates.isActive, true))
        .orderBy(swmsTemplates.sortOrder);
    } catch (error) {
      console.error("Error getting SWMS templates:", error);
      throw error;
    }
  }

  async getAllSwmsTemplates(): Promise<SwmsTemplate[]> {
    try {
      return await db
        .select()
        .from(swmsTemplates)
        .orderBy(swmsTemplates.sortOrder);
    } catch (error) {
      console.error("Error getting all SWMS templates:", error);
      throw error;
    }
  }

  async getSwmsTemplate(id: string): Promise<SwmsTemplate | undefined> {
    try {
      const [template] = await db
        .select()
        .from(swmsTemplates)
        .where(eq(swmsTemplates.id, id));
      return template;
    } catch (error) {
      console.error("Error getting SWMS template:", error);
      throw error;
    }
  }

  async createSwmsTemplate(template: InsertSwmsTemplate): Promise<SwmsTemplate> {
    try {
      const [newTemplate] = await db
        .insert(swmsTemplates)
        .values(template)
        .returning();
      return newTemplate;
    } catch (error) {
      console.error("Error creating SWMS template:", error);
      throw error;
    }
  }

  async updateSwmsTemplate(id: string, template: Partial<InsertSwmsTemplate>): Promise<SwmsTemplate> {
    try {
      const [updatedTemplate] = await db
        .update(swmsTemplates)
        .set({
          ...template,
          updatedAt: new Date(),
        })
        .where(eq(swmsTemplates.id, id))
        .returning();
      
      if (!updatedTemplate) {
        throw new Error("SWMS template not found");
      }
      
      return updatedTemplate;
    } catch (error) {
      console.error("Error updating SWMS template:", error);
      throw error;
    }
  }

  async deleteSwmsTemplate(id: string): Promise<void> {
    try {
      await db.delete(swmsTemplates).where(eq(swmsTemplates.id, id));
    } catch (error) {
      console.error("Error deleting SWMS template:", error);
      throw error;
    }
  }

  async getSwmsSignatureCountByTemplate(templateId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(swmsSignatures)
        .where(eq(swmsSignatures.templateId, templateId));
      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error("Error getting SWMS signature count:", error);
      throw error;
    }
  }

  async getSwmsSignaturesForJob(jobId: string): Promise<SwmsSignature[]> {
    try {
      return await db
        .select()
        .from(swmsSignatures)
        .where(eq(swmsSignatures.jobId, jobId));
    } catch (error) {
      console.error("Error getting SWMS signatures for job:", error);
      throw error;
    }
  }

  async getSwmsSignaturesForJobWithDetails(jobId: string): Promise<Array<SwmsSignature & { template: SwmsTemplate | null; user: User | null }>> {
    try {
      const signatures = await db
        .select()
        .from(swmsSignatures)
        .where(eq(swmsSignatures.jobId, jobId))
        .orderBy(swmsSignatures.signedAt);
      
      const result = await Promise.all(
        signatures.map(async (sig) => {
          const template = await this.getSwmsTemplate(sig.templateId);
          const user = await this.getUser(sig.userId);
          return { ...sig, template: template || null, user: user || null };
        })
      );
      
      return result;
    } catch (error) {
      console.error("Error getting SWMS signatures with details:", error);
      throw error;
    }
  }

  async getSwmsSignaturesForUser(userId: string): Promise<SwmsSignature[]> {
    try {
      return await db
        .select()
        .from(swmsSignatures)
        .where(eq(swmsSignatures.userId, userId));
    } catch (error) {
      console.error("Error getting SWMS signatures for user:", error);
      throw error;
    }
  }

  async getSwmsSignature(templateId: string, jobId: string, userId: string): Promise<SwmsSignature | undefined> {
    try {
      const [signature] = await db
        .select()
        .from(swmsSignatures)
        .where(
          and(
            eq(swmsSignatures.templateId, templateId),
            eq(swmsSignatures.jobId, jobId),
            eq(swmsSignatures.userId, userId)
          )
        );
      return signature;
    } catch (error) {
      console.error("Error getting SWMS signature:", error);
      throw error;
    }
  }

  async createSwmsSignature(signature: InsertSwmsSignature): Promise<SwmsSignature> {
    try {
      const [newSignature] = await db
        .insert(swmsSignatures)
        .values(signature)
        .returning();
      return newSignature;
    } catch (error) {
      console.error("Error creating SWMS signature:", error);
      throw error;
    }
  }

  async getUnsignedSwmsTemplatesForJob(jobId: string, userId: string): Promise<SwmsTemplate[]> {
    try {
      // Get all active templates
      const allTemplates = await this.getSwmsTemplates();
      
      // Get user's signatures for this job
      const userSignatures = await db
        .select()
        .from(swmsSignatures)
        .where(
          and(
            eq(swmsSignatures.jobId, jobId),
            eq(swmsSignatures.userId, userId)
          )
        );
      
      const signedTemplateIds = new Set(userSignatures.map(s => s.templateId));
      
      // Return templates that haven't been signed
      return allTemplates.filter(t => !signedTemplateIds.has(t.id));
    } catch (error) {
      console.error("Error getting unsigned SWMS templates:", error);
      throw error;
    }
  }

  async hasUserSignedAllSwmsForJob(jobId: string, userId: string): Promise<boolean> {
    try {
      const unsignedTemplates = await this.getUnsignedSwmsTemplatesForJob(jobId, userId);
      return unsignedTemplates.length === 0;
    } catch (error) {
      console.error("Error checking SWMS signing status:", error);
      throw error;
    }
  }

  // =============================================================================
  // QUOTING SYSTEM METHODS
  // =============================================================================

  async getQuotes(): Promise<Quote[]> {
    try {
      return await db
        .select()
        .from(quotes)
        .orderBy(desc(quotes.createdAt));
    } catch (error) {
      console.error("Error getting quotes:", error);
      throw error;
    }
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    try {
      const [quote] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.id, id));
      return quote;
    } catch (error) {
      console.error("Error getting quote:", error);
      throw error;
    }
  }

  async getQuoteByNumber(quoteNumber: string): Promise<Quote | undefined> {
    try {
      const [quote] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.quoteNumber, quoteNumber));
      return quote;
    } catch (error) {
      console.error("Error getting quote by number:", error);
      throw error;
    }
  }

  async getNextQuoteNumber(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const prefix = `Q-${year}-`;
      
      // Get the latest quote number for this year
      const [latestQuote] = await db
        .select({ quoteNumber: quotes.quoteNumber })
        .from(quotes)
        .where(ilike(quotes.quoteNumber, `${prefix}%`))
        .orderBy(desc(quotes.quoteNumber))
        .limit(1);
      
      if (latestQuote) {
        const lastNumber = parseInt(latestQuote.quoteNumber.replace(prefix, ''), 10);
        return `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
      }
      
      return `${prefix}001`;
    } catch (error) {
      console.error("Error getting next quote number:", error);
      throw error;
    }
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    try {
      const [newQuote] = await db
        .insert(quotes)
        .values(quote)
        .returning();
      return newQuote;
    } catch (error) {
      console.error("Error creating quote:", error);
      throw error;
    }
  }

  async updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote> {
    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({ ...quote, updatedAt: new Date() })
        .where(eq(quotes.id, id))
        .returning();
      return updatedQuote;
    } catch (error) {
      console.error("Error updating quote:", error);
      throw error;
    }
  }

  async deleteQuote(id: string): Promise<void> {
    try {
      await db.delete(quotes).where(eq(quotes.id, id));
    } catch (error) {
      console.error("Error deleting quote:", error);
      throw error;
    }
  }

  async updateQuoteTotals(quoteId: string): Promise<Quote> {
    try {
      // Get current quote for margin
      const quote = await this.getQuote(quoteId);
      const margin = quote ? parseFloat(quote.builderMargin || "0") : 0;
      
      // Calculate totals from items
      const items = await this.getQuoteItems(quoteId);
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
      const marginAmount = subtotal * (margin / 100);
      const subtotalWithMargin = subtotal + marginAmount;
      const gstAmount = subtotalWithMargin * 0.1; // 10% GST
      const totalAmount = subtotalWithMargin + gstAmount;

      return await this.updateQuote(quoteId, {
        subtotal: subtotal.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
      });
    } catch (error) {
      console.error("Error updating quote totals:", error);
      throw error;
    }
  }

  // Quote Items
  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    try {
      return await db
        .select()
        .from(quoteItems)
        .where(eq(quoteItems.quoteId, quoteId))
        .orderBy(quoteItems.sortOrder);
    } catch (error) {
      console.error("Error getting quote items:", error);
      throw error;
    }
  }

  async createQuoteItem(item: InsertQuoteItem): Promise<QuoteItem> {
    try {
      const [newItem] = await db
        .insert(quoteItems)
        .values(item)
        .returning();
      
      // Update quote totals
      await this.updateQuoteTotals(item.quoteId);
      
      return newItem;
    } catch (error) {
      console.error("Error creating quote item:", error);
      throw error;
    }
  }

  async updateQuoteItem(id: string, item: Partial<InsertQuoteItem>): Promise<QuoteItem> {
    try {
      const [updatedItem] = await db
        .update(quoteItems)
        .set(item)
        .where(eq(quoteItems.id, id))
        .returning();
      
      // Update quote totals
      await this.updateQuoteTotals(updatedItem.quoteId);
      
      return updatedItem;
    } catch (error) {
      console.error("Error updating quote item:", error);
      throw error;
    }
  }

  async deleteQuoteItem(id: string): Promise<void> {
    try {
      // Get the item first to know which quote to update
      const [item] = await db
        .select()
        .from(quoteItems)
        .where(eq(quoteItems.id, id));
      
      if (item) {
        await db.delete(quoteItems).where(eq(quoteItems.id, id));
        await this.updateQuoteTotals(item.quoteId);
      }
    } catch (error) {
      console.error("Error deleting quote item:", error);
      throw error;
    }
  }

  // Quote Signatures
  async getQuoteSignatures(quoteId: string): Promise<QuoteSignature[]> {
    try {
      return await db
        .select()
        .from(quoteSignatures)
        .where(eq(quoteSignatures.quoteId, quoteId));
    } catch (error) {
      console.error("Error getting quote signatures:", error);
      throw error;
    }
  }

  async createQuoteSignature(signature: InsertQuoteSignature): Promise<QuoteSignature> {
    try {
      const [newSignature] = await db
        .insert(quoteSignatures)
        .values(signature)
        .returning();
      
      // Update quote status to accepted
      await this.updateQuote(signature.quoteId, {
        status: "accepted",
      });
      await db.update(quotes)
        .set({ acceptedAt: new Date() })
        .where(eq(quotes.id, signature.quoteId));
      
      return newSignature;
    } catch (error) {
      console.error("Error creating quote signature:", error);
      throw error;
    }
  }

  // Quote Access Tokens
  async createQuoteAccessToken(token: InsertQuoteAccessToken): Promise<QuoteAccessToken> {
    try {
      const [newToken] = await db
        .insert(quoteAccessTokens)
        .values(token)
        .returning();
      return newToken;
    } catch (error) {
      console.error("Error creating quote access token:", error);
      throw error;
    }
  }

  async getQuoteByAccessToken(token: string): Promise<Quote | undefined> {
    try {
      const [accessToken] = await db
        .select()
        .from(quoteAccessTokens)
        .where(
          and(
            eq(quoteAccessTokens.token, token),
            gte(quoteAccessTokens.expiresAt, new Date())
          )
        );
      
      if (!accessToken) return undefined;
      
      // Mark token as used
      await db.update(quoteAccessTokens)
        .set({ usedAt: new Date() })
        .where(eq(quoteAccessTokens.id, accessToken.id));
      
      return await this.getQuote(accessToken.quoteId);
    } catch (error) {
      console.error("Error getting quote by access token:", error);
      throw error;
    }
  }

  // Historical cost data for quoting
  async getHistoricalCostData(): Promise<{
    averageLaborRate: number;
    materialsByDescription: Array<{ description: string; avgAmount: number; count: number }>;
    subTradesByTrade: Array<{ trade: string; avgAmount: number; count: number }>;
  }> {
    try {
      // Get average labor rate from completed jobs
      const laborRates = await db
        .select({ avgRate: sql<string>`AVG(${laborEntries.hourlyRate})` })
        .from(laborEntries);
      
      // Get material costs grouped by description pattern
      const materialCosts = await db
        .select({
          description: materials.description,
          avgAmount: sql<string>`AVG(${materials.amount})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(materials)
        .groupBy(materials.description)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(50);
      
      // Get sub-trade costs grouped by trade type
      const subTradeCosts = await db
        .select({
          trade: subTrades.trade,
          avgAmount: sql<string>`AVG(${subTrades.amount})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(subTrades)
        .groupBy(subTrades.trade)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(30);
      
      return {
        averageLaborRate: parseFloat(laborRates[0]?.avgRate || "50"),
        materialsByDescription: materialCosts.map(m => ({
          description: m.description,
          avgAmount: parseFloat(m.avgAmount || "0"),
          count: Number(m.count),
        })),
        subTradesByTrade: subTradeCosts.map(s => ({
          trade: s.trade,
          avgAmount: parseFloat(s.avgAmount || "0"),
          count: Number(s.count),
        })),
      };
    } catch (error) {
      console.error("Error getting historical cost data:", error);
      throw error;
    }
  }

  // Convert quote to job
  async convertQuoteToJob(quoteId: string, hourlyRate?: string): Promise<Job> {
    try {
      const quote = await this.getQuote(quoteId);
      if (!quote) throw new Error("Quote not found");
      
      // Create the job with quote reference
      const [newJob] = await db
        .insert(jobs)
        .values({
          jobAddress: quote.projectAddress || quote.clientAddress || "",
          clientName: quote.clientName,
          projectName: quote.projectDescription,
          projectManager: quote.projectManager || "",
          status: "new_job",
          builderMargin: quote.builderMargin,
          defaultHourlyRate: hourlyRate || "50",
          sourceQuoteId: quoteId,
        })
        .returning();
      
      // Update quote with job reference
      await this.updateQuote(quoteId, {
        status: "converted",
        convertedToJobId: newJob.id,
      });
      
      return newJob;
    } catch (error) {
      console.error("Error converting quote to job:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
