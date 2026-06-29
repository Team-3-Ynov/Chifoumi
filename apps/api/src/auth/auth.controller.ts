import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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
import { Public } from "./decorators/public.decorator.js";
import { AuthResponseDto } from "./dto/auth-response.dto.js";
import { ForgotPasswordDto } from "./dto/forgot-password.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshDto } from "./dto/refresh.dto.js";
import { RefreshResponseDto } from "./dto/refresh-response.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { ResetPasswordDto } from "./dto/reset-password.dto.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";

type AuthenticatedRequest = {
  user: SafeUser & {
    tokenJti: string;
    tokenExpiresAt: Date;
  };
};

const IS_TEST_ENV = process.env.NODE_ENV === "test";
const AUTH_THROTTLE_LIMIT = IS_TEST_ENV ? 1_000_000 : 5;
const FORGOT_PASSWORD_THROTTLE_LIMIT = IS_TEST_ENV ? 1_000_000 : 3;

@ApiTags("auth")
@Throttle({ auth: { limit: AUTH_THROTTLE_LIMIT, ttl: 60_000 } })
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register")
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Register a new player account",
    description: "Creates a player account, initializes its default ELO rating and returns tokens.",
  })
  @ApiBody({
    type: RegisterDto,
    examples: {
      player: {
        summary: "New player",
        value: { email: "player@example.com", password: "password1234", displayName: "player1" },
      },
    },
  })
  @ApiCreatedResponse({
    description: "Account created",
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Validation error",
    schema: {
      example: {
        statusCode: 400,
        message: ["email must be an email"],
        error: "Bad Request",
      },
    },
  })
  @ApiConflictResponse({
    description: "Unable to complete registration",
    schema: {
      example: {
        statusCode: 409,
        message: "Unable to complete registration",
        error: "Conflict",
      },
    },
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Login with email and password",
    description:
      "Authenticates an existing player and returns a JWT access token plus refresh token.",
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      player: {
        summary: "Player credentials",
        value: { email: "player@example.com", password: "password1234" },
      },
    },
  })
  @ApiOkResponse({ description: "Authenticated", type: AuthResponseDto })
  @ApiBadRequestResponse({
    description: "Validation error",
    schema: {
      example: {
        statusCode: 400,
        message: ["email must be an email"],
        error: "Bad Request",
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Invalid credentials",
    schema: {
      example: {
        statusCode: 401,
        message: "Unauthorized",
      },
    },
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rotate refresh token and issue a new access token",
    description:
      "Exchanges a valid opaque refresh token for a new access/refresh token pair and revokes the previous refresh token.",
  })
  @ApiBody({
    type: RefreshDto,
    examples: {
      refresh: {
        summary: "Refresh token rotation",
        value: { refreshToken: "dGhpcyBpcyBhbiBvcGFxdWUgcmVmcmVzaCB0b2tlbg" },
      },
    },
  })
  @ApiOkResponse({ description: "New token pair issued", type: RefreshResponseDto })
  @ApiBadRequestResponse({
    description: "Validation error",
    schema: {
      example: {
        statusCode: 400,
        message: ["refreshToken must be longer than or equal to 20 characters"],
        error: "Bad Request",
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Invalid, expired, revoked or unknown refresh token",
    schema: {
      example: {
        statusCode: 401,
        message: "Unauthorized",
      },
    },
  })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({
    summary: "Logout and revoke the current access token",
    description:
      "Adds the current JWT jti to the Redis blacklist until token expiry and revokes active refresh tokens for the user.",
  })
  @ApiNoContentResponse({ description: "Access token blacklisted and refresh tokens revoked" })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid, expired or revoked access token",
    schema: {
      example: {
        statusCode: 401,
        message: "Unauthorized",
      },
    },
  })
  async logout(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.authService.logout({
      userId: req.user.id,
      jti: req.user.tokenJti,
      expiresAt: req.user.tokenExpiresAt,
    });
  }

  @Post("forgot-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  // Override the shared "auth" throttler with a stricter limit for this route
  // only (the throttler key is per-handler), instead of a global throttler that
  // would rate-limit unrelated endpoints such as GET /me.
  @Throttle({ auth: { limit: FORGOT_PASSWORD_THROTTLE_LIMIT, ttl: 60_000 } })
  @ApiOperation({
    summary: "Request a password reset email",
    description:
      "Sends a password reset link to the provided email if an account exists. Always responds 200 to prevent account enumeration.",
  })
  @ApiBody({
    type: ForgotPasswordDto,
    examples: {
      player: {
        summary: "Forgot password request",
        value: { email: "player@example.com" },
      },
    },
  })
  @ApiOkResponse({ description: "Reset email requested (idempotent, anti-enumeration)" })
  @ApiBadRequestResponse({
    description: "Validation error",
    schema: {
      example: {
        statusCode: 400,
        message: ["email must be an email"],
        error: "Bad Request",
      },
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.requestPasswordReset(dto.email);
  }

  @Post("reset-password")
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Reset the account password using a reset token",
    description:
      "Validates the opaque reset token, updates the password (Argon2id) and revokes all active refresh tokens for the user. Existing access tokens are not blacklisted and stay valid until their short expiry.",
  })
  @ApiBody({
    type: ResetPasswordDto,
    examples: {
      player: {
        summary: "Reset password",
        value: {
          token: "5a7a7a8e-6c4a-4b1a-9f24-9b6f7c2a4e8c",
          newPassword: "newPassword1234",
        },
      },
    },
  })
  @ApiNoContentResponse({ description: "Password updated and refresh tokens revoked" })
  @ApiBadRequestResponse({
    description: "Validation error",
    schema: {
      example: {
        statusCode: 400,
        message: ["newPassword must be longer than or equal to 10 characters"],
        error: "Bad Request",
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Invalid, expired or already used reset token",
    schema: {
      example: {
        statusCode: 401,
        message: "Unauthorized",
      },
    },
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
