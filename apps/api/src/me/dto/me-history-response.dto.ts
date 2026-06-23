import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MeHistoryOpponentDto {
  @ApiProperty({ type: String, example: "opponent42" })
  displayName!: string;

  @ApiProperty({ type: Number, description: "Opponent rating at match time", example: 1040 })
  ratingAtMatch!: number;
}

export class MeHistoryItemDto {
  @ApiProperty({ type: String, format: "uuid", example: "499abac5-30b8-4a28-bf95-4ef0b3df6098" })
  matchId!: string;

  @ApiProperty({ type: () => MeHistoryOpponentDto })
  opponent!: MeHistoryOpponentDto;

  @ApiProperty({ type: Number, example: 2 })
  scoreA!: number;

  @ApiProperty({ type: Number, example: 1 })
  scoreB!: number;

  @ApiProperty({ type: Boolean, example: true })
  isWinner!: boolean;

  @ApiProperty({ type: Number, example: 16 })
  eloDelta!: number;

  @ApiProperty({ type: Date, format: "date-time", example: "2026-06-08T12:00:00.000Z" })
  endedAt!: Date;
}

export class MeHistoryResponseDto {
  @ApiProperty({ type: () => MeHistoryItemDto, isArray: true })
  items!: MeHistoryItemDto[];

  @ApiPropertyOptional({
    type: String,
    description: "Cursor for the next page; omitted on the last page",
    nullable: true,
  })
  nextCursor!: string | null;
}
