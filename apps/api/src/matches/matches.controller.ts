import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator.js";
import { AuditService } from "./audit.service.js";
import { MatchAuditResponseDto } from "./dto/match-audit-response.dto.js";

@ApiTags("Matches")
@Controller("matches")
export class MatchesController {
  constructor(private readonly auditService: AuditService) {}

  @Get(":id/audit")
  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: "Get audit trail for a completed match",
    description:
      "Retrieve the cryptographic details of a completed match (commits, reveals, nonces) to verify no player cheated. Rate limited to 10 requests per minute per IP.",
  })
  @ApiParam({
    name: "id",
    description: "Match ID (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({
    status: 200,
    description: "Match audit trail with hash verification results",
    type: MatchAuditResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: "Match is still in progress (MATCH_NOT_ENDED)",
    schema: {
      example: {
        error: "MATCH_NOT_ENDED",
        message: "Cannot view audit trail for matches that are still in progress",
        statusCode: 403,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Match not found",
    schema: {
      example: {
        error: "Not Found",
        message: "Match with id xxx not found",
        statusCode: 404,
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests (10 per minute per IP)",
  })
  async getAudit(@Param("id") id: string): Promise<MatchAuditResponseDto> {
    return this.auditService.buildAudit(id);
  }
}
