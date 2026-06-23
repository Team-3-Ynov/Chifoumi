import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import { AdminUsersResponseDto } from "./dto/admin-users-response.dto.js";
import { ListUsersQueryDto } from "./dto/list-users-query.dto.js";
import { PublicProfileDto } from "./dto/public-profile.dto.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({
    summary: "List all users (admin only)",
    description:
      "Returns a paginated list of every user with private fields (email, role) for moderation. Restricted to administrators.",
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1, minimum: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20, minimum: 1, maximum: 100 })
  @ApiOkResponse({ description: "Paginated user list", type: AdminUsersResponseDto })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  @ApiForbiddenResponse({
    description: "Authenticated user is not an administrator",
    schema: { example: { error: "FORBIDDEN" } },
  })
  listUsers(@Query() query: ListUsersQueryDto): Promise<AdminUsersResponseDto> {
    return this.usersService.listUsers(query.page, query.limit);
  }

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
