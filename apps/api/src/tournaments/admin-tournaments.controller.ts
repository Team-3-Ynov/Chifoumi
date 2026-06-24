import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Tournament } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import { CreateTournamentDto } from "./dto/create-tournament.dto.js";
import { TournamentResponseDto } from "./dto/tournament-response.dto.js";
import { TournamentsService } from "./tournaments.service.js";

@ApiTags("admin-tournaments")
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("admin/tournaments")
export class AdminTournamentsController {
  constructor(
    @Inject(TournamentsService) private readonly tournamentsService: TournamentsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a tournament (admin only)",
    description: "Creates a new tournament in the `upcoming` state.",
  })
  @ApiCreatedResponse({ description: "Tournament created", type: TournamentResponseDto })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  @ApiForbiddenResponse({
    description: "Authenticated user is not an administrator",
    schema: { example: { error: "FORBIDDEN" } },
  })
  async createTournament(@Body() dto: CreateTournamentDto): Promise<TournamentResponseDto> {
    const tournament = await this.tournamentsService.createTournament({
      name: dto.name,
      format: dto.format,
      bracketSize: dto.bracketSize,
      registrationOpensAt: dto.registrationOpensAt,
      startsAt: dto.startsAt,
    });
    return this.toResponse(tournament);
  }

  @Patch(":id/open")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Open tournament registration (admin only)",
    description: "Transitions the tournament from `upcoming` to `registration_open`.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Tournament id" })
  @ApiOkResponse({ description: "Registration opened", type: TournamentResponseDto })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  @ApiForbiddenResponse({
    description: "Authenticated user is not an administrator",
    schema: { example: { error: "FORBIDDEN" } },
  })
  @ApiNotFoundResponse({
    description: "TOURNAMENT_NOT_FOUND",
    schema: { example: { error: "TOURNAMENT_NOT_FOUND" } },
  })
  @ApiConflictResponse({
    description: "Tournament is not in the upcoming state",
    schema: { example: { error: "TOURNAMENT_NOT_UPCOMING" } },
  })
  async openRegistration(
    @Param("id", new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentResponseDto> {
    const tournament = await this.tournamentsService.openRegistration(tournamentId);
    return this.toResponse(tournament);
  }

  @Patch(":id/start")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Start a tournament (admin only)",
    description:
      "Requires at least two registered players. Transitions `registration_open → in_progress` and enqueues a `generate-bracket` job on the tournaments queue.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Tournament id" })
  @ApiOkResponse({
    description: "Tournament started and bracket generation enqueued",
    type: TournamentResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  @ApiForbiddenResponse({
    description: "Authenticated user is not an administrator",
    schema: { example: { error: "FORBIDDEN" } },
  })
  @ApiNotFoundResponse({
    description: "TOURNAMENT_NOT_FOUND",
    schema: { example: { error: "TOURNAMENT_NOT_FOUND" } },
  })
  @ApiConflictResponse({
    description:
      "Tournament already started/completed, not open for registration, or fewer than two players registered",
    schema: {
      oneOf: [
        { example: { error: "TOURNAMENT_ALREADY_STARTED" } },
        { example: { error: "NOT_ENOUGH_PLAYERS" } },
      ],
    },
  })
  async startTournament(
    @Param("id", new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentResponseDto> {
    const tournament = await this.tournamentsService.startTournament(tournamentId);
    return this.toResponse(tournament);
  }

  private toResponse(tournament: Tournament): TournamentResponseDto {
    return {
      id: tournament.id,
      name: tournament.name,
      format: tournament.format,
      bracketSize: tournament.bracketSize,
      registrationOpensAt: tournament.registrationOpensAt,
      startsAt: tournament.startsAt,
      status: tournament.status,
      createdAt: tournament.createdAt,
      updatedAt: tournament.updatedAt,
    };
  }
}
