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
  // Automatic hours configuration
  autoHoursEnabled: boolean("auto_hours_enabled").notNull().default(false),
  baseAutoHours: decimal("base_auto_hours", { precision: 10, scale: 2 }).default("0"), // Base hours added to every job
  bonusHoursPerThreshold: decimal("bonus_hours_per_threshold", { precision: 10, scale: 2 }).default("0"), // Additional hours per threshold amount
  bonusThreshold: decimal("bonus_threshold", { precision: 10, scale: 2 }).default("3000"), // Dollar threshold for bonus hours
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobAddress: varchar("job_address").notNull(),
  clientName: varchar("client_name").notNull(),
  projectName: varchar("project_name").notNull(),
  projectManager: varchar("project_manager"),
  status: varchar("status", { enum: ["new_job", "job_in_progress", "job_complete", "ready_for_billing"] }).notNull().default("new_job"),
  builderMargin: decimal("builder_margin", { precision: 5, scale: 2 }).notNull().default("0"),
  defaultHourlyRate: decimal("default_hourly_rate", { precision: 10, scale: 2 }).notNull().default("50"),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
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
  hoursSource: varchar("hours_source", { length: 20 }).notNull().default("manual"), // 'manual' or 'timesheet'
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
  uploadedById: varchar("uploaded_by_id").notNull().references(() => users.id),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  laborEntries: many(laborEntries),
  timesheetEntries: many(timesheetEntries),
  notifications: many(notifications),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  laborEntries: many(laborEntries),
}));

export const jobsRelations = relations(jobs, ({ many }) => ({
  laborEntries: many(laborEntries),
  materials: many(materials),
  subTrades: many(subTrades),
  otherCosts: many(otherCosts),
  tipFees: many(tipFees),
  timesheetEntries: many(timesheetEntries),
  jobFiles: many(jobFiles),
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
}).extend({
  defaultHourlyRate: z.string().or(z.number()).transform(val => String(val)),
  baseAutoHours: z.string().or(z.number()).transform(val => String(val)).optional(),
  bonusHoursPerThreshold: z.string().or(z.number()).transform(val => String(val)).optional(),
  bonusThreshold: z.string().or(z.number()).transform(val => String(val)).optional(),
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
});

export const insertJobFileSchema = createInsertSchema(jobFiles).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
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
  status: varchar("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  emailSubject: varchar("email_subject"),
  emailFrom: varchar("email_from"),
  extractedData: text("extracted_data"), // JSON string of full extracted data
  attachmentContent: text("attachment_content"), // Base64 encoded attachment content for later processing
  mimeType: varchar("mime_type"), // MIME type of the attachment
  userId: varchar("user_id").notNull().references(() => users.id),
  jobId: varchar("job_id").references(() => jobs.id),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at")
});

export const insertEmailProcessedDocumentSchema = createInsertSchema(emailProcessedDocuments).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
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
export type JobFile = typeof jobFiles.$inferSelect;
export type InsertJobFile = z.infer<typeof insertJobFileSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type EmailProcessingLog = typeof emailProcessingLogs.$inferSelect;
export type InsertEmailProcessingLog = z.infer<typeof insertEmailProcessingLogSchema>;
export type EmailProcessedDocument = typeof emailProcessedDocuments.$inferSelect;
export type InsertEmailProcessedDocument = z.infer<typeof insertEmailProcessedDocumentSchema>;
