import { ApiProperty } from "@nestjs/swagger";

export class PublicProfileDto {
  @ApiProperty({ format: "uuid", example: "7b6b95f2-39d9-4f2d-8a58-fb8580d2f7a1" })
  id!: string;

  @ApiProperty({ example: "player1" })
  displayName!: string;

  @ApiProperty({ example: 1000 })
  rating!: number;

  @ApiProperty({ example: 0 })
  gamesPlayed!: number;

  @ApiProperty({ example: 0, description: "Wins divided by games played, rounded to 2 decimals." })
  winRate!: number;

  @ApiProperty({ format: "date-time", example: "2026-06-08T12:00:00.000Z" })
  createdAt!: Date;
}
