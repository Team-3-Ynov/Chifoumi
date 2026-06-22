import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { AuditService } from "./audit.service.js";
import { MatchAuditResponseDto } from "./dto/match-audit-response.dto.js";

@ApiTags("matches")
@SkipThrottle({ auth: true })
@UseGuards(JwtAuthGuard)
@Controller("matches")
export class MatchesController {
  constructor(private readonly auditService: AuditService) {}

  @Public()
  @Throttle({ audit: { limit: 10, ttl: 60_000 } })
  @Get(":id/audit")
  @ApiOperation({
    summary: "Public commit-reveal audit trail for an ended match",
    description:
      "Returns commits, reveals, nonces and server-side hash verification so anyone can replay a finished match and detect cheating.",
  })
  @ApiParam({
    name: "id",
    format: "uuid",
    description: "Match id",
  })
  @ApiOkResponse({ description: "Audit trail", type: MatchAuditResponseDto })
  @ApiForbiddenResponse({
    description: "MATCH_NOT_ENDED",
    schema: {
      example: {
        error: "MATCH_NOT_ENDED",
      },
    },
  })
  @ApiNotFoundResponse({ description: "Match not found" })
  getAudit(@Param("id", new ParseUUIDPipe()) matchId: string): Promise<MatchAuditResponseDto> {
    return this.auditService.buildAudit(matchId);
  }
}
