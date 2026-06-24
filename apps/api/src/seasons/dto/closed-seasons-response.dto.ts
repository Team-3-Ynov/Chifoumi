import { ApiProperty } from "@nestjs/swagger";

export class ClosedSeasonSummaryDto {
  @ApiProperty({ type: String, format: "uuid", example: "9b6f7c2a-4e8c-4b1a-9f24-5a7a7a8e6c4a" })
  id!: string;

  @ApiProperty({ type: String, example: "Saison 1" })
  name!: string;

  @ApiProperty({ type: String, format: "date-time", example: "2026-06-01T00:00:00.000Z" })
  startedAt!: Date;

  @ApiProperty({
    type: String,
    format: "date-time",
    nullable: true,
    example: "2026-07-01T00:00:00.000Z",
  })
  endsAt!: Date | null;

  @ApiProperty({ enum: ["closed"], example: "closed" })
  status!: "closed";
}

export class ClosedSeasonsResponseDto {
  @ApiProperty({ type: () => ClosedSeasonSummaryDto, isArray: true })
  items!: ClosedSeasonSummaryDto[];
}
