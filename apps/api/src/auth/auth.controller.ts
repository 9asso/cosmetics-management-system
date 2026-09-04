import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createUserSchema,
  loginSchema,
  updateUserParamsSchema,
  updateUserSchema,
  type CreateUserInput,
  type LoginInput,
  type UpdateUserInput,
} from "@cosmetics/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { CurrentUser, Public, Roles } from "./auth.decorators.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedUser } from "./auth.types.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body(new ZodValidationPipe(loginSchema)) input: LoginInput) {
    return this.auth.login(input);
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}

@Roles("OWNER")
@Controller("users")
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  list() {
    return this.auth.listUsers();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createUserSchema)) input: CreateUserInput,
  ) {
    return this.auth.createUser(input);
  }

  @Patch(":id")
  update(
    @Param(new ZodValidationPipe(updateUserParamsSchema))
    params: { id: string },
    @Body(new ZodValidationPipe(updateUserSchema)) input: UpdateUserInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.auth.updateUser(params.id, input, actor);
  }
}
