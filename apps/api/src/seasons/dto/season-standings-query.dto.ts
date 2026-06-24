import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class SeasonStandingsQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 50, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: "limit must be ≤ 100" })
  limit = 50;

  @ApiPropertyOptional({ type: String, example: "gold" })
  @IsOptional()
  @IsString()
  league?: string;
}
