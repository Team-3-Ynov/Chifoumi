import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
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
import type { SafeUser } from "../users/users.service.js";
import { CurrentSeasonResponseDto } from "./dto/current-season-response.dto.js";
import { SeasonsService } from "./seasons.service.js";

type AuthenticatedRequest = { user: SafeUser };

@ApiTags("seasons")
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard)
@Controller("seasons")
export class SeasonsController {
  constructor(@Inject(SeasonsService) private readonly seasonsService: SeasonsService) {}

  @Get("current")
  @ApiOperation({
    summary: "Get the active season and the player's standing",
    description:
      "Returns the active season together with the authenticated player's rating, league, 1-indexed ELO rank and progress toward the next league.",
  })
  @ApiOkResponse({
    description: "Active season and player standing",
    type: CurrentSeasonResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  @ApiNotFoundResponse({
    description: "No active season",
    schema: { example: { code: "NO_ACTIVE_SEASON" } },
  })
  getCurrent(@Req() req: AuthenticatedRequest): Promise<CurrentSeasonResponseDto> {
    return this.seasonsService.getCurrent(req.user.id);
  }
}
