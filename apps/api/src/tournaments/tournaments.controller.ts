import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { TournamentStatus } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import { TournamentListQueryDto } from "./dto/tournament-query.dto.js";
import {
  TournamentDetailDto,
  TournamentListResponseDto,
} from "./dto/tournament-read-response.dto.js";
import { TournamentsService } from "./tournaments.service.js";

@ApiTags("tournaments")
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard)
@Controller("tournaments")
export class TournamentsController {
  constructor(
    @Inject(TournamentsService) private readonly tournamentsService: TournamentsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List tournaments",
    description:
      "Returns a paginated list of tournaments sorted by start date, optionally filtered by status.",
  })
  @ApiQuery({ name: "status", required: false, enum: TournamentStatus })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1, minimum: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20, minimum: 1, maximum: 100 })
  @ApiOkResponse({ description: "Tournament page", type: TournamentListResponseDto })
  @ApiBadRequestResponse({
    description: "Invalid query parameters",
    schema: {
      example: {
        statusCode: 400,
        message: [
          "status must be one of the following values: upcoming, registration_open, in_progress, completed",
        ],
        error: "Bad Request",
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  listTournaments(@Query() query: TournamentListQueryDto): Promise<TournamentListResponseDto> {
    return this.tournamentsService.listTournaments(query);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get tournament detail and bracket",
    description:
      "Returns tournament details, registered players and tournament matches grouped by bracket round.",
  })
  @ApiOkResponse({ description: "Tournament detail", type: TournamentDetailDto })
  @ApiBadRequestResponse({
    description: "Invalid tournament id",
    schema: { example: { statusCode: 400, message: "Validation failed (uuid is expected)" } },
  })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  @ApiNotFoundResponse({
    description: "TOURNAMENT_NOT_FOUND",
    schema: { example: { error: "TOURNAMENT_NOT_FOUND" } },
  })
  getTournamentDetail(
    @Param("id", new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentDetailDto> {
    return this.tournamentsService.getTournamentDetail(tournamentId);
  }
}
