import { ApiProperty } from "@nestjs/swagger";
import { TournamentFormat } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDate, IsEnum, IsIn, IsInt, IsString, Length } from "class-validator";

const ALLOWED_BRACKET_SIZES = [8, 16, 32, 64, 128, 256, 512, 1024] as const;

export class CreateTournamentDto {
  @ApiProperty({ type: String, minLength: 3, maxLength: 80, example: "Spring Cup 2026" })
  @IsString()
  @Length(3, 80)
  name!: string;

  @ApiProperty({ enum: TournamentFormat, example: TournamentFormat.single_elim })
  @IsEnum(TournamentFormat)
  format!: TournamentFormat;

  @ApiProperty({
    type: Number,
    enum: ALLOWED_BRACKET_SIZES,
    description: "Bracket size — must be a power of 2",
    example: 16,
  })
  @IsInt()
  @IsIn(ALLOWED_BRACKET_SIZES)
  bracketSize!: number;

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "When player registration opens",
    example: "2026-07-01T00:00:00.000Z",
  })
  @Type(() => Date)
  @IsDate()
  registrationOpensAt!: Date;

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "When the tournament is scheduled to start",
    example: "2026-07-15T18:00:00.000Z",
  })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;
}
