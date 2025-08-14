import { z } from 'zod';

// Basic schema for the business management platform
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['admin', 'manager', 'staff']),
  createdAt: z.date().optional(),
});

export const JobSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['pending', 'active', 'completed', 'cancelled']),
  budget: z.number().positive().optional(),
  laborCost: z.number().positive().optional(),
  materialCost: z.number().positive().optional(),
  assignedTo: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const TimesheetEntrySchema = z.object({
  id: z.string(),
  jobId: z.string(),
  userId: z.string(),
  hours: z.number().positive(),
  date: z.date(),
  description: z.string().optional(),
  hourlyRate: z.number().positive().optional(),
});

// Insert schemas
export const insertUserSchema = UserSchema.omit({ id: true, createdAt: true });
export const insertJobSchema = JobSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimesheetEntrySchema = TimesheetEntrySchema.omit({ id: true });

// Types
export type User = z.infer<typeof UserSchema>;
export type Job = z.infer<typeof JobSchema>;
export type TimesheetEntry = z.infer<typeof TimesheetEntrySchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type InsertTimesheetEntry = z.infer<typeof insertTimesheetEntrySchema>;