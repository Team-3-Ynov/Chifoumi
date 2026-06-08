import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service.js";
import { AuthResponseDto } from "./dto/auth-response.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";

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
}
