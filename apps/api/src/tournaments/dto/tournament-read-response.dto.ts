import { ApiProperty } from "@nestjs/swagger";
import { TournamentFormat, TournamentStatus, WinnerSlot } from "@prisma/client";

export class TournamentListItemDto {
  @ApiProperty({ type: String, format: "uuid", example: "9b6f7c2a-4e8c-4b1a-9f24-5a7a7a8e6c4a" })
  id!: string;

  @ApiProperty({ type: String, example: "Spring Cup 2026" })
  name!: string;

  @ApiProperty({ enum: TournamentFormat, example: TournamentFormat.single_elim })
  format!: TournamentFormat;

  @ApiProperty({ type: Number, example: 16 })
  bracketSize!: number;

  @ApiProperty({ enum: TournamentStatus, example: TournamentStatus.registration_open })
  status!: TournamentStatus;

  @ApiProperty({ type: Number, example: 12 })
  registrationsCount!: number;

  @ApiProperty({ type: String, format: "date-time", example: "2026-07-15T18:00:00.000Z" })
  startsAt!: Date;
}

export class TournamentListResponseDto {
  @ApiProperty({ type: [TournamentListItemDto] })
  items!: TournamentListItemDto[];

  @ApiProperty({ type: Number, example: 1 })
  page!: number;

  @ApiProperty({ type: Number, example: 20 })
  limit!: number;

  @ApiProperty({ type: Number, example: 42 })
  total!: number;
}

export class TournamentRegistrationDto {
  @ApiProperty({ type: String, format: "uuid", example: "0d7b6f95-f0a3-49de-9f6d-3b0bfc7e4c1d" })
  userId!: string;

  @ApiProperty({ type: String, example: "Ada" })
  displayName!: string;

  @ApiProperty({ type: Number, example: 1, nullable: true })
  seed!: number | null;
}

export class BracketSlotDto {
  @ApiProperty({ type: String, format: "uuid", example: "0d7b6f95-f0a3-49de-9f6d-3b0bfc7e4c1d" })
  userId!: string;

  @ApiProperty({ type: String, example: "Ada" })
  displayName!: string;
}

export class BracketMatchDto {
  @ApiProperty({ type: String, format: "uuid", example: "d91fdde2-e4c2-4e89-a80e-328245385d2d" })
  id!: string;

  @ApiProperty({
    type: String,
    format: "uuid",
    nullable: true,
    example: "1f6f6a55-7c2c-4149-b9fe-b78da5cb6944",
  })
  matchId!: string | null;

  @ApiProperty({ type: BracketSlotDto, nullable: true })
  slotA!: BracketSlotDto | null;

  @ApiProperty({ type: BracketSlotDto, nullable: true })
  slotB!: BracketSlotDto | null;

  @ApiProperty({ type: Number, nullable: true, example: 2 })
  scoreA!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 1 })
  scoreB!: number | null;

  @ApiProperty({ enum: WinnerSlot, nullable: true, example: WinnerSlot.a })
  winnerSlot!: WinnerSlot | null;
}

export class BracketRoundDto {
  @ApiProperty({ type: Number, example: 1 })
  round!: number;

  @ApiProperty({ type: [BracketMatchDto] })
  matches!: BracketMatchDto[];
}

export class TournamentDetailDto extends TournamentListItemDto {
  @ApiProperty({ type: String, format: "date-time", example: "2026-07-01T00:00:00.000Z" })
  registrationOpensAt!: Date;

  @ApiProperty({ type: String, format: "date-time", nullable: true, example: null })
  endedAt!: Date | null;

  @ApiProperty({ type: [TournamentRegistrationDto] })
  registrations!: TournamentRegistrationDto[];

  @ApiProperty({ type: [BracketRoundDto] })
  bracket!: BracketRoundDto[];
}
