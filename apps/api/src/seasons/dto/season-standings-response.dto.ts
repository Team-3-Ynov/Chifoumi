import { ApiProperty } from "@nestjs/swagger";
import { LeagueSummaryDto } from "../../leagues/dto/league-summary.dto.js";

export class SeasonStandingsSeasonDto {
  @ApiProperty({ type: String, format: "uuid", example: "9b6f7c2a-4e8c-4b1a-9f24-5a7a7a8e6c4a" })
  id!: string;

  @ApiProperty({ type: String, example: "Saison 1" })
  name!: string;

  @ApiProperty({ enum: ["upcoming", "active", "closed"], example: "closed" })
  status!: "upcoming" | "active" | "closed";
}

export class SeasonStandingEntryDto {
  @ApiProperty({ type: Number, example: 1 })
  rank!: number;

  @ApiProperty({ type: String, format: "uuid", example: "7b6b95f2-39d9-4f2d-8a58-fb8580d2f7a1" })
  userId!: string;

  @ApiProperty({ type: String, example: "player1" })
  displayName!: string;

  @ApiProperty({ type: Number, example: 1600 })
  finalRating!: number;

  @ApiProperty({ type: () => LeagueSummaryDto })
  finalLeague!: LeagueSummaryDto;
}

export class SeasonStandingsResponseDto {
  @ApiProperty({ type: () => SeasonStandingsSeasonDto })
  season!: SeasonStandingsSeasonDto;

  @ApiProperty({ type: () => SeasonStandingEntryDto, isArray: true })
  items!: SeasonStandingEntryDto[];

  @ApiProperty({ type: Number, example: 42 })
  total!: number;

  @ApiProperty({ type: Number, example: 1 })
  page!: number;

  @ApiProperty({ type: Number, example: 50 })
  limit!: number;
}
