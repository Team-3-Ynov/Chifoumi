import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class MeHistoryQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: "limit must be ≤ 100" })
  limit = 20;

  @ApiPropertyOptional({
    description: "Opaque cursor returned by the previous page",
    example: "eyJ0cyI6IjIwMjYtMDEtMDFUMDA6MDA6MzEuMDAwWiIsImlkIjoiIn0",
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
