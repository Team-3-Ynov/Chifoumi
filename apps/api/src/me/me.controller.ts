import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import type { SafeUser } from "../users/users.service.js";
import { MeHistoryQueryDto } from "./dto/me-history-query.dto.js";
import { MeHistoryResponseDto } from "./dto/me-history-response.dto.js";
import { MeHistoryService } from "./me-history.service.js";

type AuthenticatedRequest = { user: SafeUser };

@ApiTags("me")
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@Controller("me")
export class MeController {
  constructor(private readonly meHistoryService: MeHistoryService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: "Get authenticated user profile" })
  @ApiOkResponse({ description: "Current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT" })
  getMe(@Req() req: AuthenticatedRequest): { user: SafeUser } {
    return { user: req.user };
  }

  @UseGuards(JwtAuthGuard)
  @Get("history")
  @ApiOperation({ summary: "Paginated match history for the authenticated user" })
  @ApiOkResponse({ description: "Match history page", type: MeHistoryResponseDto })
  @ApiBadRequestResponse({ description: "Invalid query parameters" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT" })
  getHistory(
    @Req() req: AuthenticatedRequest,
    @Query() query: MeHistoryQueryDto,
  ): Promise<MeHistoryResponseDto> {
    return this.meHistoryService.getHistory(req.user.id, query.limit, query.cursor);
  }
}
