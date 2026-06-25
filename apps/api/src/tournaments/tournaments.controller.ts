import { TournamentStatus } from "@chifoumi/db";
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import type { SafeUser } from "../users/users.service.js";
import { TournamentListQueryDto } from "./dto/tournament-query.dto.js";
import {
  TournamentDetailDto,
  TournamentListResponseDto,
} from "./dto/tournament-read-response.dto.js";
import { TournamentsService } from "./tournaments.service.js";

type AuthenticatedRequest = { user: SafeUser };

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

  @Post(":id/register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Register for a tournament",
    description:
      "Registers the authenticated player for a tournament. Only possible while registration is open and the bracket is not full.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Tournament id" })
  @ApiCreatedResponse({ description: "Player successfully registered" })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  @ApiNotFoundResponse({
    description: "Tournament not found",
    schema: { example: { error: "TOURNAMENT_NOT_FOUND" } },
  })
  @ApiConflictResponse({
    description: "Registration is closed, tournament is full, or player is already registered",
    schema: {
      oneOf: [
        { example: { error: "REGISTRATION_CLOSED" } },
        { example: { error: "TOURNAMENT_FULL" } },
        { example: { error: "ALREADY_REGISTERED" } },
      ],
    },
  })
  async register(
    @Param("id", new ParseUUIDPipe()) tournamentId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.tournamentsService.registerPlayer(tournamentId, req.user.id);
  }

  @Delete(":id/register")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Unregister from a tournament",
    description:
      "Removes the authenticated player's registration from a tournament. Only possible while registration is open.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Tournament id" })
  @ApiNoContentResponse({ description: "Player successfully unregistered" })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  @ApiNotFoundResponse({
    description: "Tournament not found",
    schema: { example: { error: "TOURNAMENT_NOT_FOUND" } },
  })
  @ApiConflictResponse({
    description: "Registration is closed",
    schema: { example: { error: "REGISTRATION_CLOSED" } },
  })
  async unregister(
    @Param("id", new ParseUUIDPipe()) tournamentId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.tournamentsService.unregisterPlayer(tournamentId, req.user.id);
  }
}
