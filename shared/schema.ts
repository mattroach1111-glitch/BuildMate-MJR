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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  defaultHourlyRate: decimal("default_hourly_rate", { precision: 10, scale: 2 }).notNull().default("50"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobAddress: varchar("job_address").notNull(),
  clientName: varchar("client_name").notNull(),
  projectName: varchar("project_name").notNull(),
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

export const laborEntries = pgTable("labor_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => employees.id),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  hoursLogged: decimal("hours_logged", { precision: 10, scale: 2 }).notNull().default("0"),
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
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  laborEntries: many(laborEntries),
  timesheetEntries: many(timesheetEntries),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  laborEntries: many(laborEntries),
}));

export const jobsRelations = relations(jobs, ({ many }) => ({
  laborEntries: many(laborEntries),
  materials: many(materials),
  subTrades: many(subTrades),
  otherCosts: many(otherCosts),
  timesheetEntries: many(timesheetEntries),
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

export const insertTimesheetEntrySchema = createInsertSchema(timesheetEntries).omit({
  id: true,
  createdAt: true,
}).extend({
  hours: z.string().or(z.number()).transform(val => String(val)),
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
export type TimesheetEntry = typeof timesheetEntries.$inferSelect;
export type InsertTimesheetEntry = z.infer<typeof insertTimesheetEntrySchema>;
