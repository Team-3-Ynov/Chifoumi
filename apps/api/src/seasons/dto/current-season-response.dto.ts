import { ApiProperty } from "@nestjs/swagger";

export class CurrentSeasonDto {
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

  @ApiProperty({ enum: ["upcoming", "active", "closed"], example: "active" })
  status!: "upcoming" | "active" | "closed";
}

export class CurrentSeasonLeagueDto {
  @ApiProperty({ type: String, example: "Silver" })
  name!: string;

  @ApiProperty({ type: Number, example: 2 })
  tier!: number;
}

export class CurrentSeasonMeDto {
  @ApiProperty({ type: Number, example: 1150 })
  rating!: number;

  @ApiProperty({ type: () => CurrentSeasonLeagueDto })
  league!: CurrentSeasonLeagueDto;

  @ApiProperty({
    type: Number,
    description: "1-indexed rank in the active season ELO ranking",
    example: 7,
  })
  rank!: number;

  @ApiProperty({
    type: Number,
    description: "Progress toward the next league, in the [0..1] range",
    example: 0.5,
  })
  progressToNextLeague!: number;
}

export class CurrentSeasonResponseDto {
  @ApiProperty({ type: () => CurrentSeasonDto })
  season!: CurrentSeasonDto;

  @ApiProperty({ type: () => CurrentSeasonMeDto })
  me!: CurrentSeasonMeDto;
}
