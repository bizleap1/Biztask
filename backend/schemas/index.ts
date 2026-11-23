import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const requestResetSchema = z.object({
  email: z.string().email('Invalid email address')
});

export const executeResetSchema = z.object({
  email: z.string().email('Invalid email address'),
  newPassword: z.string().min(10, 'Password must be at least 10 characters')
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(10, 'New password must be at least 10 characters')
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable(),
  assignedToId: z.number().int().positive('Assigned user ID must be a positive integer'),
  priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
  dueDate: z.string().optional().nullable()
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  assignedToId: z.number().int().positive().optional(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
  status: z.enum(['Pending', 'InProgress', 'Completed', 'Overdue']).optional(),
  dueDate: z.string().optional().nullable()
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['Pending', 'InProgress', 'Completed', 'Overdue'])
});

export const createReportSchema = z.object({
  tasksCompleted: z.string().min(1, 'Tasks completed is required'),
  plansTomorrow: z.string().optional().nullable(),
  challenges: z.string().optional().nullable(),
  hoursWorked: z.number().min(0).max(24).optional().nullable()
});

export const reviewReportSchema = z.object({
  status: z.enum(['Approved', 'NeedsRevision', 'Rejected']),
  feedback: z.string().optional().nullable()
});

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
  role: z.enum(['SuperAdmin', 'Admin', 'Manager', 'Employee', 'HR']),
  departmentId: z.number().int().positive().optional().nullable(),
  designation: z.string().optional().nullable()
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  departmentId: z.number().int().positive().optional().nullable(),
  designation: z.string().optional().nullable(),
  isActive: z.boolean().optional()
});

export const changeRoleSchema = z.object({
  role: z.enum(['SuperAdmin', 'Admin', 'Manager', 'Employee', 'HR'])
});
