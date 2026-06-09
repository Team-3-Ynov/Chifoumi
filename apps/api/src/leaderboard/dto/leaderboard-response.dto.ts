import { ApiProperty } from "@nestjs/swagger";

export class LeaderboardEntryDto {
  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty({ format: "uuid", example: "7b6b95f2-39d9-4f2d-8a58-fb8580d2f7a1" })
  userId!: string;

  @ApiProperty({ example: "player1" })
  displayName!: string;

  @ApiProperty({ example: 1600 })
  rating!: number;

  @ApiProperty({ example: 42 })
  gamesPlayed!: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  items!: LeaderboardEntryDto[];
}
