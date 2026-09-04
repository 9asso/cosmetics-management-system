import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const moneySchema = z.coerce.number().finite().min(0).max(999_999_999);
export const quantitySchema = z.coerce.number().int().min(0).max(999_999_999);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  details?: unknown;
}
