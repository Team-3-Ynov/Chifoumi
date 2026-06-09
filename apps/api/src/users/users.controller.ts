import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
  @ApiOperation({
    summary: "Get another player's public profile",
    description:
      "Returns public player information only. Private fields such as email are intentionally omitted.",
  })
  @ApiParam({
    name: "id",
    format: "uuid",
    example: "7b6b95f2-39d9-4f2d-8a58-fb8580d2f7a1",
    description: "User id",
  })
  @ApiOkResponse({ description: "Public profile", type: PublicProfileDto })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: {
      example: {
        statusCode: 401,
        message: "Unauthorized",
      },
    },
  })
  @ApiNotFoundResponse({
    description: "USER_NOT_FOUND",
    schema: {
      example: {
        error: "USER_NOT_FOUND",
      },
    },
  })
  getPublicProfile(@Param("id", new ParseUUIDPipe()) userId: string): Promise<PublicProfileDto> {
    return this.usersService.getPublicProfile(userId);
  }
}
