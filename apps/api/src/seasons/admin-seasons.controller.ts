import type { Season } from "@chifoumi/db";
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
import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { SWAGGER_BEARER_AUTH } from "../swagger.js";
import { CreateSeasonDto } from "./dto/create-season.dto.js";
import { SeasonResponseDto } from "./dto/season-response.dto.js";
import { SeasonsService } from "./seasons.service.js";

@ApiTags("admin-seasons")
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("admin/seasons")
export class AdminSeasonsController {
  constructor(@Inject(SeasonsService) private readonly seasonsService: SeasonsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create an upcoming season (admin only)",
    description:
      "Creates a new season in the `upcoming` state. A season is never created active, preserving the single-active-season invariant until a later activation.",
  })
  @ApiCreatedResponse({ description: "Season created", type: SeasonResponseDto })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  @ApiForbiddenResponse({
    description: "Authenticated user is not an administrator",
    schema: { example: { error: "FORBIDDEN" } },
  })
  async createSeason(@Body() dto: CreateSeasonDto): Promise<SeasonResponseDto> {
    const season = await this.seasonsService.createSeason({ name: dto.name, endsAt: dto.endsAt });
    return this.toResponse(season);
  }

  @Patch(":id/close")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Close the active season (admin only)",
    description:
      "Transitions the active season to `closed` and enqueues a `season-reset` job on the seasons queue — the same processing the monthly cron triggers (archive standings, soft reset, reward mails).",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Season id" })
  @ApiOkResponse({ description: "Season closed and reset job enqueued", type: SeasonResponseDto })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid or revoked access token",
    schema: { example: { statusCode: 401, message: "Unauthorized" } },
  })
  @ApiForbiddenResponse({
    description: "Authenticated user is not an administrator",
    schema: { example: { error: "FORBIDDEN" } },
  })
  @ApiNotFoundResponse({
    description: "SEASON_NOT_FOUND",
    schema: { example: { error: "SEASON_NOT_FOUND" } },
  })
  @ApiConflictResponse({
    description: "Season is not active (already closed, or still upcoming)",
    schema: { example: { error: "SEASON_ALREADY_CLOSED" } },
  })
  async closeSeason(
    @Param("id", new ParseUUIDPipe()) seasonId: string,
  ): Promise<SeasonResponseDto> {
    const season = await this.seasonsService.closeSeason(seasonId);
    return this.toResponse(season);
  }

  private toResponse(season: Season): SeasonResponseDto {
    return {
      id: season.id,
      name: season.name,
      status: season.status,
      startedAt: season.startedAt,
      endsAt: season.endsAt,
      createdAt: season.createdAt,
      updatedAt: season.updatedAt,
    };
  }
}
