import { z } from 'zod';
import { ROLES } from '../models/User.js';

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#)'
    ),
  role: z.enum(['lab_technician', 'reviewer', 'lab_admin', 'manufacturer', 'doca_officer', 'auditor', 'metrology_expert'], {
    errorMap: () => ({ message: 'Role must be lab_technician, reviewer, lab_admin, manufacturer, doca_officer, auditor, or metrology_expert' }),
  }),
  labId: z.string().trim().min(1).optional().nullable(),
  manufacturerRef: z.string().trim().min(1).optional().nullable(),
}).superRefine((data, ctx) => {
  if (['lab_technician', 'reviewer', 'lab_admin'].includes(data.role) && !data.labId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A laboratory assignment is required for this role', path: ['labId'] });
  }
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
      'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#)'
    ),
});