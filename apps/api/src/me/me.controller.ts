import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import type { SafeUser } from "../user-service/user.service.js";
import { MeHistoryQueryDto } from "./dto/me-history-query.dto.js";
import { MeHistoryResponseDto } from "./dto/me-history-response.dto.js";
import { MeProfileDto } from "./dto/me-profile.dto.js";
import { type MeProfile, MeService } from "./me.service.js";
import { MeHistoryService } from "./me-history.service.js";

type AuthenticatedRequest = { user: SafeUser };

@ApiTags("me")
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@Controller("me")
export class MeController {
  constructor(
    @Inject(MeService) private readonly meService: MeService,
    @Inject(MeHistoryService) private readonly meHistoryService: MeHistoryService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: "Get authenticated user profile",
    description:
      "Returns private profile data for the current player, including email and ELO stats.",
  })
  @ApiOkResponse({ description: "Current user", type: MeProfileDto })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked JWT",
    schema: {
      example: {
        statusCode: 401,
        message: "Unauthorized",
      },
    },
  })
  getMe(@Req() req: AuthenticatedRequest): Promise<MeProfile> {
    return this.meService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("history")
  @ApiOperation({
    summary: "Paginated match history for the authenticated user",
    description: "Returns ended matches sorted by `endedAt DESC` using an opaque cursor.",
  })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20, minimum: 1, maximum: 100 })
  @ApiQuery({
    name: "cursor",
    required: false,
    type: String,
    description: "Opaque cursor returned by a previous page",
  })
  @ApiOkResponse({ description: "Match history page", type: MeHistoryResponseDto })
  @ApiBadRequestResponse({
    description: "Invalid query parameters",
    schema: {
      example: {
        statusCode: 400,
        message: ["limit must be ≤ 100"],
        error: "Bad Request",
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked JWT",
    schema: {
      example: {
        statusCode: 401,
        message: "Unauthorized",
      },
    },
  })
  getHistory(
    @Req() req: AuthenticatedRequest,
    @Query() query: MeHistoryQueryDto,
  ): Promise<MeHistoryResponseDto> {
    return this.meHistoryService.getHistory(req.user.id, query.limit, query.cursor);
  }
}
