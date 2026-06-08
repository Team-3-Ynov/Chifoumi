import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import { PublicProfileDto } from "./dto/public-profile.dto.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":id/profile")
  @ApiOperation({ summary: "Get another player's public profile" })
  @ApiOkResponse({ description: "Public profile", type: PublicProfileDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @ApiNotFoundResponse({ description: "USER_NOT_FOUND" })
  getPublicProfile(@Param("id", new ParseUUIDPipe()) userId: string): Promise<PublicProfileDto> {
    return this.usersService.getPublicProfile(userId);
  }
}
