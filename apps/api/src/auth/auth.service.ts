import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  AuthUser,
  CreateUserInput,
  LoginInput,
  LoginResult,
  TeamUser,
  UpdateUserInput,
} from "@cosmetics/contracts";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { DatabaseError } from "pg";
import { DEFAULT_ORGANIZATION_ID } from "../constants.js";
import { DatabaseService } from "../database/database.service.js";
import type { TokenPayload } from "./auth.types.js";

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: AuthUser["role"];
  active?: boolean;
  createdAt?: string;
};

@Injectable()
export class AuthService {
  private readonly secret =
    process.env.AUTH_SECRET ?? "development-secret-change-me";
  private readonly expiresIn = 60 * 60 * 12;

  constructor(private readonly db: DatabaseService) {
    if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
      throw new Error("AUTH_SECRET is required in production");
    }
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, display_name AS "displayName", role
       FROM users
       WHERE organization_id = $1 AND lower(email) = lower($2) AND active = true
         AND password_hash = crypt($3, password_hash)
       LIMIT 1`,
      [DEFAULT_ORGANIZATION_ID, input.email, input.password],
    );
    const user = result.rows[0];
    if (!user)
      throw new UnauthorizedException("Email ou mot de passe incorrect.");
    return { accessToken: this.sign(user), expiresIn: this.expiresIn, user };
  }

  verify(token: string): TokenPayload {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature)
      throw new UnauthorizedException("Session invalide.");
    const expected = this.signature(encodedPayload);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Session invalide.");
    }
    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString(),
      ) as TokenPayload;
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new UnauthorizedException("Votre session a expiré.");
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Session invalide.");
    }
  }

  async authenticate(token: string): Promise<AuthUser> {
    const payload = this.verify(token);
    const result = await this.db.query<UserRow>(
      `SELECT id, email, display_name AS "displayName", role
       FROM users
       WHERE id = $1 AND organization_id = $2 AND active = true
       LIMIT 1`,
      [payload.id, DEFAULT_ORGANIZATION_ID],
    );
    const user = result.rows[0];
    if (!user)
      throw new UnauthorizedException("Ce compte est inactif ou introuvable.");
    return user;
  }

  async listUsers(): Promise<TeamUser[]> {
    const result = await this.db.query<
      UserRow & { active: boolean; createdAt: string }
    >(
      `SELECT id, email, display_name AS "displayName", role, active,
        created_at::text AS "createdAt"
       FROM users WHERE organization_id = $1 ORDER BY active DESC, display_name`,
      [DEFAULT_ORGANIZATION_ID],
    );
    return result.rows;
  }

  async createUser(input: CreateUserInput): Promise<TeamUser> {
    try {
      const result = await this.db.query<
        UserRow & { active: boolean; createdAt: string }
      >(
        `INSERT INTO users
          (organization_id, email, display_name, password_hash, role)
         VALUES ($1, lower($2), $3, crypt($4, gen_salt('bf', 12)), $5)
         RETURNING id, email, display_name AS "displayName", role, active,
           created_at::text AS "createdAt"`,
        [
          DEFAULT_ORGANIZATION_ID,
          input.email,
          input.displayName,
          input.password,
          input.role,
        ],
      );
      return result.rows[0]!;
    } catch (error) {
      if ((error as DatabaseError).code === "23505") {
        throw new ConflictException("Cet email est déjà utilisé.");
      }
      throw error;
    }
  }

  async updateUser(
    id: string,
    input: UpdateUserInput,
    actor: AuthUser,
  ): Promise<TeamUser> {
    if (actor.role !== "OWNER")
      throw new ForbiddenException("Accès administrateur requis.");
    return this.db.withTransaction(async (client) => {
      const target = await client.query<UserRow>(
        "SELECT id, role FROM users WHERE id = $2 AND organization_id = $1 FOR UPDATE",
        [DEFAULT_ORGANIZATION_ID, id],
      );
      const user = target.rows[0];
      if (!user) throw new NotFoundException("Utilisateur introuvable.");
      // Protect the whole peer-admin account: role/password changes must not bypass name protection.
      if (user.role === "OWNER" && user.id !== actor.id) {
        throw new ForbiddenException(
          "Vous ne pouvez pas modifier un autre administrateur.",
        );
      }
      if (
        id === actor.id &&
        (input.active === false || (input.role && input.role !== "OWNER"))
      ) {
        throw new ForbiddenException(
          "Vous ne pouvez pas désactiver ou rétrograder votre propre compte.",
        );
      }
      const result = await client.query<TeamUser>(
        `UPDATE users SET
        role = COALESCE($3, role),
        active = COALESCE($4, active),
        password_hash = CASE WHEN $5::text IS NULL THEN password_hash ELSE crypt($5, gen_salt('bf', 12)) END,
        display_name = COALESCE($6, display_name),
        updated_at = now()
       WHERE id = $2 AND organization_id = $1
       RETURNING id, email, display_name AS "displayName", role, active,
         created_at::text AS "createdAt"`,
        [
          DEFAULT_ORGANIZATION_ID,
          id,
          input.role ?? null,
          input.active ?? null,
          input.password ?? null,
          input.displayName ?? null,
        ],
      );
      return result.rows[0]!;
    });
  }

  private sign(user: UserRow) {
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + this.expiresIn,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encoded}.${this.signature(encoded)}`;
  }

  private signature(value: string) {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }
}
