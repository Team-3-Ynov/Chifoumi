import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
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
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Get global top players by rating" })
  @ApiOkResponse({ description: "Leaderboard page", type: LeaderboardResponseDto })
  @ApiBadRequestResponse({ description: "Invalid query parameters" })
  async getLeaderboard(
    @Query() query: LeaderboardQueryDto,
    @Res({ passthrough: true }) res: { setHeader(name: string, value: string): void },
  ): Promise<LeaderboardResponseDto> {
    const { data, cache } = await this.leaderboardService.get(query.limit);
    res.setHeader("X-Cache", cache);
    return data;
  }
}
