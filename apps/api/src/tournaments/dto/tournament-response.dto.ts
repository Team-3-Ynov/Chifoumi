import { ApiProperty } from "@nestjs/swagger";
import { TournamentFormat, TournamentStatus } from "@prisma/client";

export class TournamentResponseDto {
  @ApiProperty({ type: String, format: "uuid", example: "9b6f7c2a-4e8c-4b1a-9f24-5a7a7a8e6c4a" })
  id!: string;

  @ApiProperty({ type: String, example: "Spring Cup 2026" })
  name!: string;

  @ApiProperty({ enum: TournamentFormat, example: TournamentFormat.single_elim })
  format!: TournamentFormat;

  @ApiProperty({ type: Number, example: 16 })
  bracketSize!: number;

  @ApiProperty({ type: String, format: "date-time", example: "2026-07-01T00:00:00.000Z" })
  registrationOpensAt!: Date;

  @ApiProperty({ type: String, format: "date-time", example: "2026-07-15T18:00:00.000Z" })
  startsAt!: Date;

  @ApiProperty({ enum: TournamentStatus, example: TournamentStatus.upcoming })
  status!: TournamentStatus;

  @ApiProperty({ type: String, format: "date-time", example: "2026-06-23T12:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ type: String, format: "date-time", example: "2026-06-23T12:00:00.000Z" })
  updatedAt!: Date;
}
