import { ApiProperty } from "@nestjs/swagger";

export class LeaderboardEntryDto {
  @ApiProperty()
  rank!: number;

  @ApiProperty({ format: "uuid" })
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  rating!: number;

  @ApiProperty()
  gamesPlayed!: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  items!: LeaderboardEntryDto[];
}
