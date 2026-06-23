import { ApiProperty } from "@nestjs/swagger";

export class LeaderboardEntryDto {
  @ApiProperty({ type: Number, example: 1 })
  rank!: number;

  @ApiProperty({ type: String, format: "uuid", example: "7b6b95f2-39d9-4f2d-8a58-fb8580d2f7a1" })
  userId!: string;

  @ApiProperty({ type: String, example: "player1" })
  displayName!: string;

  @ApiProperty({ type: Number, example: 1600 })
  rating!: number;

  @ApiProperty({ type: Number, example: 42 })
  gamesPlayed!: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: () => LeaderboardEntryDto, isArray: true })
  items!: LeaderboardEntryDto[];
}
