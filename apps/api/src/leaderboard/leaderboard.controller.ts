import { Controller, Get, Inject, Query, Res, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { LeaderboardQueryDto } from "./dto/leaderboard-query.dto.js";
import { LeaderboardResponseDto } from "./dto/leaderboard-response.dto.js";
import { LeaderboardService } from "./leaderboard.service.js";

@ApiTags("leaderboard")
@SkipThrottle({ auth: true })
@UseGuards(JwtAuthGuard)
@Controller("leaderboard")
export class LeaderboardController {
  constructor(
    @Inject(LeaderboardService) private readonly leaderboardService: LeaderboardService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: "Get global top players by rating",
    description:
      "Public leaderboard sorted by `rating DESC, gamesPlayed DESC`. Results are cached in Redis for 30 seconds.",
  })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 50, minimum: 1, maximum: 100 })
  @ApiOkResponse({
    description: "Leaderboard page",
    type: LeaderboardResponseDto,
    headers: {
      "X-Cache": {
        description:
          "Cache status returned by the API: HIT when Redis served the response, MISS otherwise.",
        schema: { type: "string", enum: ["HIT", "MISS"] },
      },
    },
  })
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
  async getLeaderboard(
    @Query() query: LeaderboardQueryDto,
    @Res({ passthrough: true }) res: { setHeader(name: string, value: string): void },
  ): Promise<LeaderboardResponseDto> {
    const { data, cache } = await this.leaderboardService.get(query.limit);
    res.setHeader("X-Cache", cache);
    return data;
  }
}
