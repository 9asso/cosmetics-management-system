import type { UserRole } from '@cosmetics/contracts';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface TokenPayload extends AuthenticatedUser {
  exp: number;
}
