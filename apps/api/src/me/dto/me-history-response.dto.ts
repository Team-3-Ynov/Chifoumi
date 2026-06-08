import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MeHistoryOpponentDto {
  @ApiProperty()
  displayName!: string;

  @ApiProperty({ description: "Opponent rating at match time" })
  ratingAtMatch!: number;
}

export class MeHistoryItemDto {
  @ApiProperty({ format: "uuid" })
  matchId!: string;

  @ApiProperty({ type: MeHistoryOpponentDto })
  opponent!: MeHistoryOpponentDto;

  @ApiProperty()
  scoreA!: number;

  @ApiProperty()
  scoreB!: number;

  @ApiProperty()
  isWinner!: boolean;

  @ApiProperty()
  eloDelta!: number;

  @ApiProperty({ format: "date-time" })
  endedAt!: Date;
}

export class MeHistoryResponseDto {
  @ApiProperty({ type: [MeHistoryItemDto] })
  items!: MeHistoryItemDto[];

  @ApiPropertyOptional({
    description: "Cursor for the next page; omitted on the last page",
    nullable: true,
  })
  nextCursor!: string | null;
}
