import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import type { SafeUser } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";
import { AuthResponseDto } from "./dto/auth-response.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";

type AuthenticatedRequest = {
  user: SafeUser & {
    tokenJti: string;
    tokenExpiresAt: Date;
  };
};

@ApiTags("auth")
@Throttle({ auth: { limit: 5, ttl: 60_000 } })
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new player account" })
  @ApiCreatedResponse({ description: "Account created", type: AuthResponseDto })
  @ApiBadRequestResponse({ description: "Validation error" })
  @ApiConflictResponse({ description: "Unable to complete registration" })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with email and password" })
  @ApiOkResponse({ description: "Authenticated", type: AuthResponseDto })
  @ApiBadRequestResponse({ description: "Validation error" })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: "Logout and revoke the current access token" })
  @ApiNoContentResponse({ description: "Access token blacklisted and refresh tokens revoked" })
  @ApiUnauthorizedResponse({ description: "Missing, invalid, expired or revoked access token" })
  async logout(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.authService.logout({
      userId: req.user.id,
      jti: req.user.tokenJti,
      expiresAt: req.user.tokenExpiresAt,
    });
  }
}
