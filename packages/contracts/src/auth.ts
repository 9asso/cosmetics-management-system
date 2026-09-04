import { z } from 'zod';
import { uuidSchema } from './shared.js';

export const userRoles = ['OWNER', 'MANAGER', 'CASHIER', 'WAREHOUSE', 'ACCOUNTANT', 'STAFF'] as const;
export const userRoleSchema = z.enum(userRoles);

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export const createUserSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  role: userRoleSchema,
});

export const updateUserSchema = z.object({
  role: userRoleSchema.optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
});

export const updateUserParamsSchema = z.object({ id: uuidSchema });

export type UserRole = (typeof userRoles)[number];
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface TeamUser extends AuthUser {
  active: boolean;
  createdAt: string;
}
