import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// System settings table for app-wide configurations
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: varchar("setting_key").notNull().unique(),
  settingValue: text("setting_value"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: ["admin", "staff"] }).notNull().default("staff"),
  googleDriveTokens: text("google_drive_tokens"), // Store encrypted tokens as JSON
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "set null" }), // Link to existing employee
  isAssigned: boolean("is_assigned").notNull().default(false), // Whether user has been assigned to an employee
  emailNotificationPreferences: text("email_notification_preferences").default('{"documentProcessing":true,"jobUpdates":true,"timesheetReminders":true}'), // JSON string of notification preferences
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  defaultHourlyRate: decimal("default_hourly_rate", { precision: 10, scale: 2 }).notNull().default("50"),
  isActive: boolean("is_active").notNull().default(true), // Toggle for including in job sheets
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobAddress: varchar("job_address").notNull(),
  clientName: varchar("client_name").notNull(),
  projectName: varchar("project_name").notNull(),
  projectManager: varchar("project_manager"),
  status: varchar("status", { enum: ["new_job", "job_in_progress", "job_on_hold", "job_complete", "ready_for_billing"] }).notNull().default("new_job"),
  builderMargin: decimal("builder_margin", { precision: 5, scale: 2 }).notNull().default("0"),
  defaultHourlyRate: decimal("default_hourly_rate", { precision: 10, scale: 2 }).notNull().default("50"),
  excludeFromTotal: boolean("exclude_from_total").notNull().default(false),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobNotes = pgTable("job_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  noteText: text("note_text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const otherCosts = pgTable("other_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  description: varchar("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tipFees = pgTable("tip_fees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  description: varchar("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  cartageAmount: decimal("cartage_amount", { precision: 10, scale: 2 }).notNull(), // Automatic 20% of amount
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(), // amount + cartageAmount
  createdAt: timestamp("created_at").defaultNow(),
});

export const laborEntries = pgTable("labor_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => employees.id),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  hoursLogged: decimal("hours_logged", { precision: 10, scale: 2 }).notNull().default("0"),
  manualHours: decimal("manual_hours", { precision: 10, scale: 2 }).notNull().default("0"),
  timesheetHours: decimal("timesheet_hours", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const materials = pgTable("materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  supplier: varchar("supplier").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  invoiceDate: varchar("invoice_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subTrades = pgTable("sub_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  trade: varchar("trade").notNull(),
  contractor: varchar("contractor").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  invoiceDate: varchar("invoice_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timesheetEntries = pgTable("timesheet_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => users.id),
  jobId: varchar("job_id").references(() => jobs.id),
  date: date("date").notNull(),
  hours: decimal("hours", { precision: 5, scale: 2 }).notNull(),
  description: text("description"),
  materials: text("materials"),
  approved: boolean("approved").notNull().default(false),
  submitted: boolean("submitted").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const manualHourEntries = pgTable("manual_hour_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  laborEntryId: varchar("labor_entry_id").notNull().references(() => laborEntries.id, { onDelete: "cascade" }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => employees.id), // Staff who the hours are for
  enteredById: varchar("entered_by_id").notNull().references(() => users.id), // Admin who entered the hours
  hours: decimal("hours", { precision: 5, scale: 2 }).notNull(),
  description: text("description").notNull().default("Manually entered hours"),
  entryType: varchar("entry_type", { enum: ["direct_edit", "extra_hours"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobFiles = pgTable("job_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  fileName: varchar("file_name").notNull(),
  originalName: varchar("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  objectPath: varchar("object_path"), // Path in object storage (optional for Google Drive files)
  googleDriveLink: varchar("google_drive_link"), // Link to file on Google Drive
  googleDriveFileId: varchar("google_drive_file_id"), // Google Drive file ID
  needsDriveSync: boolean("needs_drive_sync").default(false), // Flag for files needing Google Drive upload
  uploadedById: varchar("uploaded_by_id").notNull().references(() => users.id),
  // Expense tracking fields
  expenseAmount: decimal("expense_amount", { precision: 10, scale: 2 }),
  expenseAddress: varchar("expense_address"),
  expenseDescription: varchar("expense_description"),
  expenseCategory: varchar("expense_category", { enum: ["materials", "equipment", "services", "transport", "other"] }),
  isExpense: boolean("is_expense").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(), // 'job_update_reminder', 'timesheet_reminder', etc.
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  scheduledFor: timestamp("scheduled_for").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  dismissedAt: timestamp("dismissed_at"),
});

// Staff Notes System Tables - simplified to avoid conflicts
export const staffMembers = pgTable("staff_members", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  bankedHours: varchar("banked_hours").notNull().default("0"),
  rdoHours: varchar("rdo_hours").notNull().default("0"),
  hourlyRate: varchar("hourly_rate").notNull().default("0"),
  toolCostOwed: varchar("tool_cost_owed").notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const staffNotesEntries = pgTable("staff_notes_entries", {
  id: varchar("id").primaryKey(),
  staffMemberId: varchar("staff_member_id").notNull().references(() => staffMembers.id, { onDelete: "cascade" }),
  type: varchar("type", { enum: ["banked_hours", "tool_cost", "rdo_hours", "general"] }).notNull(),
  description: text("description").notNull(),
  amount: varchar("amount").notNull().default("0"),
  date: varchar("date").notNull(), // ISO date string
  createdAt: timestamp("created_at").defaultNow(),
});

// Legacy staff notes table (keeping for existing data)
export const staffNotes = pgTable("staff_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  noteType: varchar("note_type", { enum: ["banked_hours", "tool_bills", "general"] }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }), // For tracking monetary amounts
  hours: decimal("hours", { precision: 5, scale: 2 }), // For tracking hours
  dueDate: date("due_date"), // For bills or time-sensitive notes
  status: varchar("status", { enum: ["active", "resolved", "overdue"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  laborEntries: many(laborEntries),
  timesheetEntries: many(timesheetEntries),
  notifications: many(notifications),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  laborEntries: many(laborEntries),
  staffNotes: many(staffNotes),
}));

export const jobsRelations = relations(jobs, ({ many }) => ({
  laborEntries: many(laborEntries),
  materials: many(materials),
  subTrades: many(subTrades),
  otherCosts: many(otherCosts),
  tipFees: many(tipFees),
  timesheetEntries: many(timesheetEntries),
  jobFiles: many(jobFiles),
  jobNotes: many(jobNotes),
}));

export const laborEntriesRelations = relations(laborEntries, ({ one }) => ({
  job: one(jobs, {
    fields: [laborEntries.jobId],
    references: [jobs.id],
  }),
  staff: one(employees, {
    fields: [laborEntries.staffId],
    references: [employees.id],
  }),
}));

export const materialsRelations = relations(materials, ({ one }) => ({
  job: one(jobs, {
    fields: [materials.jobId],
    references: [jobs.id],
  }),
}));

export const subTradesRelations = relations(subTrades, ({ one }) => ({
  job: one(jobs, {
    fields: [subTrades.jobId],
    references: [jobs.id],
  }),
}));

export const otherCostsRelations = relations(otherCosts, ({ one }) => ({
  job: one(jobs, {
    fields: [otherCosts.jobId],
    references: [jobs.id],
  }),
}));

export const tipFeesRelations = relations(tipFees, ({ one }) => ({
  job: one(jobs, {
    fields: [tipFees.jobId],
    references: [jobs.id],
  }),
}));

export const timesheetEntriesRelations = relations(timesheetEntries, ({ one }) => ({
  staff: one(users, {
    fields: [timesheetEntries.staffId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [timesheetEntries.jobId],
    references: [jobs.id],
  }),
}));

export const jobFilesRelations = relations(jobFiles, ({ one }) => ({
  job: one(jobs, {
    fields: [jobFiles.jobId],
    references: [jobs.id],
  }),
  uploadedBy: one(users, {
    fields: [jobFiles.uploadedById],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const jobNotesRelations = relations(jobNotes, ({ one }) => ({
  job: one(jobs, {
    fields: [jobNotes.jobId],
    references: [jobs.id],
  }),
  user: one(users, {
    fields: [jobNotes.userId],
    references: [users.id],
  }),
}));

// Staff Member Relations
export const staffMembersRelations = relations(staffMembers, ({ many }) => ({
  notes: many(staffNotesEntries),
}));

export const staffNotesEntriesRelations = relations(staffNotesEntries, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [staffNotesEntries.staffMemberId],
    references: [staffMembers.id],
  }),
}));

// Legacy relations
export const staffNotesRelations = relations(staffNotes, ({ one }) => ({
  employee: one(employees, {
    fields: [staffNotes.employeeId],
    references: [employees.id],
  }),
  createdBy: one(users, {
    fields: [staffNotes.createdById],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  builderMargin: z.string().or(z.number()).transform(val => String(val)),
  defaultHourlyRate: z.string().or(z.number()).transform(val => String(val)),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  defaultHourlyRate: true,
  isActive: true, // Handle activation separately
});

export const insertOtherCostSchema = createInsertSchema(otherCosts).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.string().or(z.number()).transform(val => String(val)),
});

export const insertLaborEntrySchema = createInsertSchema(laborEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  hourlyRate: z.string().or(z.number()).transform(val => String(val)),
  hoursLogged: z.string().or(z.number()).transform(val => String(val)),
});

export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.string().or(z.number()).transform(val => String(val)),
});

export const insertSubTradeSchema = createInsertSchema(subTrades).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.string().or(z.number()).transform(val => String(val)),
});

export const insertTipFeeSchema = createInsertSchema(tipFees).omit({
  id: true,
  createdAt: true,
  cartageAmount: true, // Auto-calculated
  totalAmount: true,   // Auto-calculated
}).extend({
  amount: z.string().or(z.number()).transform(val => String(val)),
});

export const insertTimesheetEntrySchema = createInsertSchema(timesheetEntries).omit({
  id: true,
  createdAt: true,
}).extend({
  hours: z.string().or(z.number()).transform(val => String(val)),
  jobId: z.string().optional().nullable(), // Make jobId optional for RDO entries
});

export const insertManualHourEntrySchema = createInsertSchema(manualHourEntries).omit({
  id: true,
  createdAt: true,
}).extend({
  hours: z.string().or(z.number()).transform(val => String(val)),
});

export const insertJobFileSchema = createInsertSchema(jobFiles).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertJobNoteSchema = createInsertSchema(jobNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Staff Members insert schemas
export const insertStaffMemberSchema = createInsertSchema(staffMembers).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertStaffNoteEntrySchema = createInsertSchema(staffNotesEntries).omit({
  createdAt: true,
});

// Legacy staff notes insert schema
export const insertStaffNoteSchema = createInsertSchema(staffNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Email processing tracking table
export const emailProcessingLogs = pgTable("email_processing_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull(),
  fromEmail: varchar("from_email").notNull(),
  toEmail: varchar("to_email").notNull(),
  subject: varchar("subject").notNull(),
  attachmentCount: integer("attachment_count").notNull().default(0),
  processedCount: integer("processed_count").notNull().default(0),
  status: varchar("status", { enum: ["processing", "completed", "failed"] }).notNull().default("processing"),
  jobMatched: varchar("job_matched"), // ID of matched job
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailProcessingLogSchema = createInsertSchema(emailProcessingLogs).omit({
  id: true,
  createdAt: true,
});

// Email processed documents for review workflow
export const emailProcessedDocuments = pgTable("email_processed_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: varchar("filename").notNull(),
  vendor: varchar("vendor").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: varchar("category").notNull(),
  gstOption: varchar("gst_option", { enum: ["include", "exclude"] }).notNull().default("include"), // GST include/exclude option
  status: varchar("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  emailSubject: varchar("email_subject"),
  emailFrom: varchar("email_from"),
  extractedData: text("extracted_data"), // JSON string of full extracted data
  attachmentContent: text("attachment_content"), // Base64 encoded attachment content for later processing
  mimeType: varchar("mime_type"), // MIME type of the attachment
  userId: varchar("user_id").notNull().references(() => users.id),
  jobId: varchar("job_id").references(() => jobs.id),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  googleDriveUploaded: boolean("google_drive_uploaded").default(false),
});

export const insertEmailProcessedDocumentSchema = createInsertSchema(emailProcessedDocuments).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type LaborEntry = typeof laborEntries.$inferSelect;
export type InsertLaborEntry = z.infer<typeof insertLaborEntrySchema>;
export type Material = typeof materials.$inferSelect;
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type SubTrade = typeof subTrades.$inferSelect;
export type InsertSubTrade = z.infer<typeof insertSubTradeSchema>;
export type OtherCost = typeof otherCosts.$inferSelect;
export type InsertOtherCost = z.infer<typeof insertOtherCostSchema>;
export type TipFee = typeof tipFees.$inferSelect;
export type InsertTipFee = z.infer<typeof insertTipFeeSchema>;
export type TimesheetEntry = typeof timesheetEntries.$inferSelect;
export type InsertTimesheetEntry = z.infer<typeof insertTimesheetEntrySchema>;
export type ManualHourEntry = typeof manualHourEntries.$inferSelect;
export type InsertManualHourEntry = z.infer<typeof insertManualHourEntrySchema>;
export type JobFile = typeof jobFiles.$inferSelect;
export type InsertJobFile = z.infer<typeof insertJobFileSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type JobNote = typeof jobNotes.$inferSelect;
export type InsertJobNote = z.infer<typeof insertJobNoteSchema>;
export type EmailProcessingLog = typeof emailProcessingLogs.$inferSelect;
export type InsertEmailProcessingLog = z.infer<typeof insertEmailProcessingLogSchema>;
export type EmailProcessedDocument = typeof emailProcessedDocuments.$inferSelect;
export type InsertEmailProcessedDocument = z.infer<typeof insertEmailProcessedDocumentSchema>;
export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;
export type StaffNoteEntry = typeof staffNotesEntries.$inferSelect;
export type InsertStaffNoteEntry = z.infer<typeof insertStaffNoteEntrySchema>;
export type StaffNote = typeof staffNotes.$inferSelect;
export type InsertStaffNote = z.infer<typeof insertStaffNoteSchema>;

// =============================================================================
// WEEKLY ORGANISER SYSTEM
// =============================================================================

export const weeklyOrganiser = pgTable("weekly_organiser", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekStartDate: date("week_start_date").notNull(), // Monday of the week
  staffId: varchar("staff_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  assignedJobs: text("assigned_jobs").notNull().default(""), // Job assignments for the week
  notes: text("notes").default(""), // Optional notes for the staff member's week
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const weeklyOrganiserRelations = relations(weeklyOrganiser, ({ one }) => ({
  staff: one(employees, {
    fields: [weeklyOrganiser.staffId],
    references: [employees.id],
  }),
}));

export const insertWeeklyOrganiserSchema = createInsertSchema(weeklyOrganiser).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WeeklyOrganiser = typeof weeklyOrganiser.$inferSelect;
export type InsertWeeklyOrganiser = z.infer<typeof insertWeeklyOrganiserSchema>;

// =============================================================================
// REWARDS SYSTEM TABLES
// =============================================================================

// Core points tracking for each user
export const rewardPoints = pgTable("reward_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  totalPoints: integer("total_points").notNull().default(0),
  spentPoints: integer("spent_points").notNull().default(0),
  availablePoints: integer("available_points").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0), // Current consecutive days
  longestStreak: integer("longest_streak").notNull().default(0), // All-time best streak
  lastSubmissionDate: date("last_submission_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// All point transactions (earned and spent)
export const rewardTransactions = pgTable("reward_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { enum: ["earned", "spent", "bonus", "penalty"] }).notNull(),
  points: integer("points").notNull(),
  reason: varchar("reason").notNull(), // "daily_submission", "weekly_bonus", "monthly_achievement", etc.
  description: text("description"),
  relatedDate: date("related_date"), // The date this transaction relates to (e.g., timesheet date)
  metadata: jsonb("metadata"), // Store additional data like streak length, achievements, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Achievement badges and milestones
export const rewardAchievements = pgTable("reward_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementType: varchar("achievement_type").notNull(), // "streak_5", "streak_10", "perfect_month", etc.
  achievementName: varchar("achievement_name").notNull(),
  description: text("description"),
  pointsAwarded: integer("points_awarded").notNull().default(0),
  badgeIcon: varchar("badge_icon"), // Icon name or emoji for the achievement
  achievedAt: timestamp("achieved_at").defaultNow(),
});

// Reward redemptions and approval workflow
export const rewardRedemptions = pgTable("reward_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rewardType: varchar("reward_type").notNull(), // "extra_break", "early_finish", "coffee_voucher", etc.
  rewardName: varchar("reward_name").notNull(),
  pointsCost: integer("points_cost").notNull(),
  description: text("description"),
  status: varchar("status", { enum: ["pending", "approved", "redeemed", "expired"] }).notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  redeemedAt: timestamp("redeemed_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  notes: text("notes"), // Admin notes for approval/redemption
});

// Available rewards catalog that admins can configure
export const rewardCatalog = pgTable("reward_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rewardType: varchar("reward_type").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  pointsCost: integer("points_cost").notNull(),
  icon: varchar("icon"), // Icon for the reward
  category: varchar("category").notNull(), // "time_off", "perks", "vouchers", etc.
  isActive: boolean("is_active").notNull().default(true),
  maxRedemptionsPerMonth: integer("max_redemptions_per_month"), // null = unlimited
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reward system settings (admin configurable)
export const rewardSettings = pgTable("reward_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: varchar("setting_key").notNull().unique(),
  settingValue: integer("setting_value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Job update notes for persistent storage
export const jobUpdateNotes = pgTable("job_update_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =============================================================================
// REWARDS SYSTEM RELATIONS
// =============================================================================

export const rewardPointsRelations = relations(rewardPoints, ({ one, many }) => ({
  user: one(users, {
    fields: [rewardPoints.userId],
    references: [users.id],
  }),
  transactions: many(rewardTransactions),
}));

export const rewardTransactionsRelations = relations(rewardTransactions, ({ one }) => ({
  user: one(users, {
    fields: [rewardTransactions.userId],
    references: [users.id],
  }),
  rewardPoints: one(rewardPoints, {
    fields: [rewardTransactions.userId],
    references: [rewardPoints.userId],
  }),
}));

export const rewardAchievementsRelations = relations(rewardAchievements, ({ one }) => ({
  user: one(users, {
    fields: [rewardAchievements.userId],
    references: [users.id],
  }),
}));

export const rewardRedemptionsRelations = relations(rewardRedemptions, ({ one }) => ({
  user: one(users, {
    fields: [rewardRedemptions.userId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [rewardRedemptions.approvedBy],
    references: [users.id],
  }),
}));

// =============================================================================
// REWARDS SYSTEM INSERT SCHEMAS
// =============================================================================

export const insertRewardPointsSchema = createInsertSchema(rewardPoints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRewardTransactionSchema = createInsertSchema(rewardTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertRewardAchievementSchema = createInsertSchema(rewardAchievements).omit({
  id: true,
  achievedAt: true,
});

export const insertRewardRedemptionSchema = createInsertSchema(rewardRedemptions).omit({
  id: true,
  requestedAt: true,
  approvedAt: true,
  redeemedAt: true,
});

export const insertRewardCatalogSchema = createInsertSchema(rewardCatalog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRewardSettingsSchema = createInsertSchema(rewardSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertJobUpdateNoteSchema = createInsertSchema(jobUpdateNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// =============================================================================
// REWARDS SYSTEM TYPES
// =============================================================================

export type RewardPoints = typeof rewardPoints.$inferSelect;
export type InsertRewardPoints = z.infer<typeof insertRewardPointsSchema>;
export type RewardTransaction = typeof rewardTransactions.$inferSelect;
export type InsertRewardTransaction = z.infer<typeof insertRewardTransactionSchema>;
export type RewardAchievement = typeof rewardAchievements.$inferSelect;
export type InsertRewardAchievement = z.infer<typeof insertRewardAchievementSchema>;
export type RewardRedemption = typeof rewardRedemptions.$inferSelect;
export type InsertRewardRedemption = z.infer<typeof insertRewardRedemptionSchema>;
export type RewardCatalogItem = typeof rewardCatalog.$inferSelect;
export type InsertRewardCatalogItem = z.infer<typeof insertRewardCatalogSchema>;
export type RewardSettings = typeof rewardSettings.$inferSelect;
export type InsertRewardSettings = z.infer<typeof insertRewardSettingsSchema>;
export type JobUpdateNote = typeof jobUpdateNotes.$inferSelect;
export type InsertJobUpdateNote = z.infer<typeof insertJobUpdateNoteSchema>;

// =============================================================================
// MANUAL WEEKLY ORGANISER SYSTEM (Independent of Employee System)
// =============================================================================

// Manual staff entries for the organiser (completely independent)
export const organiserStaff = pgTable("organiser_staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0), // For maintaining display order
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Weekly assignments for each staff member
export const organiserAssignments = pgTable("organiser_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => organiserStaff.id, { onDelete: "cascade" }),
  weekStartDate: date("week_start_date").notNull(), // Monday of the week
  monday: text("monday").default(""),
  tuesday: text("tuesday").default(""),
  wednesday: text("wednesday").default(""),
  thursday: text("thursday").default(""),
  friday: text("friday").default(""),
  saturday: text("saturday").default(""),
  sunday: text("sunday").default(""),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for manual organiser system
export const organiserStaffRelations = relations(organiserStaff, ({ many }) => ({
  assignments: many(organiserAssignments),
}));

export const organiserAssignmentsRelations = relations(organiserAssignments, ({ one }) => ({
  staff: one(organiserStaff, {
    fields: [organiserAssignments.staffId],
    references: [organiserStaff.id],
  }),
}));

// Insert schemas for manual organiser system
export const insertOrganiserStaffSchema = createInsertSchema(organiserStaff).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganiserAssignmentSchema = createInsertSchema(organiserAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for manual organiser system
export type OrganiserStaff = typeof organiserStaff.$inferSelect;
export type InsertOrganiserStaff = z.infer<typeof insertOrganiserStaffSchema>;
export type OrganiserAssignment = typeof organiserAssignments.$inferSelect;
export type InsertOrganiserAssignment = z.infer<typeof insertOrganiserAssignmentSchema>;

// =============================================================================
// SWMS (SAFE WORK METHOD STATEMENT) SYSTEM
// =============================================================================

// SWMS templates - stores the template documents
export const swmsTemplates = pgTable("swms_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  fileName: varchar("file_name").notNull(),
  originalName: varchar("original_name").notNull(),
  objectPath: varchar("object_path").notNull(), // Path in object storage
  mimeType: varchar("mime_type").notNull().default("application/pdf"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SWMS signatures - tracks who has signed which SWMS for which job
export const swmsSignatures = pgTable("swms_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => swmsTemplates.id, { onDelete: "cascade" }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  signerName: varchar("signer_name").notNull(), // Name as entered by the signer
  occupation: varchar("occupation").notNull(), // Occupation as entered by the signer
  signatureData: text("signature_data"), // Optional: base64 encoded signature image
  signedAt: timestamp("signed_at").defaultNow(),
});

// Relations for SWMS system
export const swmsTemplatesRelations = relations(swmsTemplates, ({ many }) => ({
  signatures: many(swmsSignatures),
}));

export const swmsSignaturesRelations = relations(swmsSignatures, ({ one }) => ({
  template: one(swmsTemplates, {
    fields: [swmsSignatures.templateId],
    references: [swmsTemplates.id],
  }),
  job: one(jobs, {
    fields: [swmsSignatures.jobId],
    references: [jobs.id],
  }),
  user: one(users, {
    fields: [swmsSignatures.userId],
    references: [users.id],
  }),
}));

// Insert schemas for SWMS system
export const insertSwmsTemplateSchema = createInsertSchema(swmsTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSwmsSignatureSchema = createInsertSchema(swmsSignatures).omit({
  id: true,
  signedAt: true,
});

// Types for SWMS system
export type SwmsTemplate = typeof swmsTemplates.$inferSelect;
export type InsertSwmsTemplate = z.infer<typeof insertSwmsTemplateSchema>;
export type SwmsSignature = typeof swmsSignatures.$inferSelect;
export type InsertSwmsSignature = z.infer<typeof insertSwmsSignatureSchema>;

// =============================================================================
// QUOTING SYSTEM
// =============================================================================

// Main quotes table
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: varchar("quote_number").notNull().unique(), // e.g., "Q-2024-001"
  clientName: varchar("client_name").notNull(),
  clientEmail: varchar("client_email"),
  clientPhone: varchar("client_phone"),
  clientAddress: varchar("client_address"),
  projectDescription: text("project_description").notNull(),
  projectAddress: varchar("project_address"),
  status: varchar("status", { 
    enum: ["draft", "sent", "viewed", "accepted", "declined", "expired", "converted"] 
  }).notNull().default("draft"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  gstAmount: decimal("gst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  builderMargin: decimal("builder_margin", { precision: 5, scale: 2 }).notNull().default("0"),
  validUntil: date("valid_until"),
  termsAndConditions: text("terms_and_conditions"),
  notes: text("notes"),
  convertedToJobId: varchar("converted_to_job_id").references(() => jobs.id, { onDelete: "set null" }),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quote line items
export const quoteItems = pgTable("quote_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  itemType: varchar("item_type", { 
    enum: ["labor", "materials", "sub_trade", "other", "tip_fee"] 
  }).notNull(),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  // Optional reference to historical job data used for pricing
  sourceJobId: varchar("source_job_id").references(() => jobs.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Quote signatures for client acceptance
export const quoteSignatures = pgTable("quote_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  signerName: varchar("signer_name").notNull(),
  signerEmail: varchar("signer_email").notNull(),
  signerTitle: varchar("signer_title"), // e.g., "Director", "Project Manager"
  signatureData: text("signature_data"), // Base64 encoded signature image
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  signedAt: timestamp("signed_at").defaultNow(),
});

// Access tokens for client quote viewing/signing
export const quoteAccessTokens = pgTable("quote_access_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for quoting system
export const quotesRelations = relations(quotes, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [quotes.createdById],
    references: [users.id],
  }),
  convertedToJob: one(jobs, {
    fields: [quotes.convertedToJobId],
    references: [jobs.id],
  }),
  items: many(quoteItems),
  signatures: many(quoteSignatures),
  accessTokens: many(quoteAccessTokens),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteItems.quoteId],
    references: [quotes.id],
  }),
  sourceJob: one(jobs, {
    fields: [quoteItems.sourceJobId],
    references: [jobs.id],
  }),
}));

export const quoteSignaturesRelations = relations(quoteSignatures, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteSignatures.quoteId],
    references: [quotes.id],
  }),
}));

export const quoteAccessTokensRelations = relations(quoteAccessTokens, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteAccessTokens.quoteId],
    references: [quotes.id],
  }),
}));

// Insert schemas for quoting system
export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  viewedAt: true,
  acceptedAt: true,
  declinedAt: true,
});

export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({
  id: true,
  createdAt: true,
});

export const insertQuoteSignatureSchema = createInsertSchema(quoteSignatures).omit({
  id: true,
  signedAt: true,
});

export const insertQuoteAccessTokenSchema = createInsertSchema(quoteAccessTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

// Types for quoting system
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
export type QuoteSignature = typeof quoteSignatures.$inferSelect;
export type InsertQuoteSignature = z.infer<typeof insertQuoteSignatureSchema>;
export type QuoteAccessToken = typeof quoteAccessTokens.$inferSelect;
export type InsertQuoteAccessToken = z.infer<typeof insertQuoteAccessTokenSchema>;
