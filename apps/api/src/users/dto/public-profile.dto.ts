import { ApiProperty } from "@nestjs/swagger";

export class PublicProfileDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ example: 1000 })
  rating!: number;

  @ApiProperty({ example: 0 })
  gamesPlayed!: number;

  @ApiProperty({ example: 0, description: "Wins divided by games played, rounded to 2 decimals." })
  winRate!: number;

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;
}
