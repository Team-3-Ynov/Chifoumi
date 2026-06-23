import { ApiProperty } from "@nestjs/swagger";
import { LeagueSummaryDto } from "../../leagues/dto/league-summary.dto.js";

export class MeProfileDto {
  @ApiProperty({ type: String, format: "uuid", example: "7b6b95f2-39d9-4f2d-8a58-fb8580d2f7a1" })
  id!: string;

  @ApiProperty({ type: String, format: "email", example: "player@example.com" })
  email!: string;

  @ApiProperty({ type: String, example: "player1" })
  displayName!: string;

  @ApiProperty({ enum: ["player", "admin"], example: "player" })
  role!: "player" | "admin";

  @ApiProperty({ type: Number, example: 1000 })
  rating!: number;

  @ApiProperty({ type: Number, example: 0 })
  gamesPlayed!: number;

  @ApiProperty({ type: () => LeagueSummaryDto })
  league!: LeagueSummaryDto;

  @ApiProperty({ type: Date, format: "date-time", example: "2026-06-08T12:00:00.000Z" })
  createdAt!: Date;
}
