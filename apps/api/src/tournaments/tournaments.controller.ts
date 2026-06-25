import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import type { SafeUser } from "../users/users.service.js";
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
