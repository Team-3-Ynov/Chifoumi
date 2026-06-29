import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import type { SafeUser } from "../user-service/user.service.js";
import { ClosedSeasonsResponseDto } from "./dto/closed-seasons-response.dto.js";
import { CurrentSeasonResponseDto } from "./dto/current-season-response.dto.js";
import { SeasonStandingsQueryDto } from "./dto/season-standings-query.dto.js";
import { SeasonStandingsResponseDto } from "./dto/season-standings-response.dto.js";
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

  @Public()
  @Get("closed")
  @ApiOperation({
    summary: "List closed seasons",
    description: "Returns recent closed seasons so public clients can link to archived standings.",
  })
  @ApiOkResponse({
    description: "Recent closed seasons",
    type: ClosedSeasonsResponseDto,
  })
  listClosed(): Promise<ClosedSeasonsResponseDto> {
    return this.seasonsService.listClosed();
  }

  @Public()
  @Get(":id/standings")
  @ApiOperation({
    summary: "Get archived standings for a season",
    description:
      "Returns the public archived final standings for a closed season, ordered by final rank, paginated and optionally filtered by final league.",
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1, minimum: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 50, minimum: 1, maximum: 100 })
  @ApiQuery({ name: "league", required: false, type: String, example: "gold" })
  @ApiOkResponse({
    description: "Archived season standings",
    type: SeasonStandingsResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid season id, query parameters or league filter",
    schema: {
      example: {
        statusCode: 400,
        message: ["page must not be less than 1"],
        error: "Bad Request",
      },
    },
  })
  @ApiConflictResponse({
    description: "Season is not closed yet",
    schema: { example: { error: "SEASON_NOT_CLOSED" } },
  })
  @ApiNotFoundResponse({
    description: "Season not found",
    schema: { example: { error: "SEASON_NOT_FOUND" } },
  })
  getStandings(
    @Param("id", ParseUUIDPipe) seasonId: string,
    @Query() query: SeasonStandingsQueryDto,
  ): Promise<SeasonStandingsResponseDto> {
    return this.seasonsService.getStandings(seasonId, query);
  }
}
