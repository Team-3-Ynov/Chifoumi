import { ApiProperty } from "@nestjs/swagger";

export class HashCheckDto {
  @ApiProperty({ enum: ["match", "mismatch"], example: "match" })
  a!: "match" | "mismatch";

  @ApiProperty({ enum: ["match", "mismatch"], example: "match" })
  b!: "match" | "mismatch";
}

export class AuditRoundDto {
  @ApiProperty({ type: Number, example: 1 })
  roundNumber!: number;

  @ApiProperty({ type: String, nullable: true, example: "a1b2c3..." })
  commitA!: string | null;

  @ApiProperty({ type: String, nullable: true, example: "d4e5f6..." })
  commitB!: string | null;

  @ApiProperty({ enum: ["rock", "paper", "scissors"], nullable: true, example: "rock" })
  moveA!: string | null;

  @ApiProperty({ enum: ["rock", "paper", "scissors"], nullable: true, example: "paper" })
  moveB!: string | null;

  @ApiProperty({ type: String, nullable: true, example: "deadbeef..." })
  nonceA!: string | null;

  @ApiProperty({ type: String, nullable: true, example: "cafebabe..." })
  nonceB!: string | null;

  @ApiProperty({ type: () => HashCheckDto })
  hashCheck!: HashCheckDto;
}

export class MatchPlayerDto {
  @ApiProperty({
    type: String,
    description: "Player ID (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id!: string;

  @ApiProperty({ type: String, description: "Player display name", example: "johndoe" })
  displayName!: string;
}

export class MatchAuditResponseDto {
  @ApiProperty({
    type: String,
    description: "Match ID (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  matchId!: string;

  @ApiProperty({
    description: "Players involved in the match (player A and player B)",
    type: () => MatchPlayerDto,
    isArray: true,
    example: [
      { id: "550e8400-e29b-41d4-a716-446655440000", displayName: "alice" },
      { id: "660e8400-e29b-41d4-a716-446655440001", displayName: "bob" },
    ],
  })
  players!: MatchPlayerDto[];

  @ApiProperty({
    description: "All rounds of the match with cryptographic details",
    type: () => AuditRoundDto,
    isArray: true,
  })
  rounds!: AuditRoundDto[];

  @ApiProperty({
    description: "Final match score: [playerA score, playerB score]",
    type: Number,
    isArray: true,
    example: [2, 1],
  })
  finalScore!: [number, number];

  @ApiProperty({
    type: String,
    description: "Winner player ID or null if draw",
    example: "550e8400-e29b-41d4-a716-446655440000",
    nullable: true,
  })
  winner!: string | null;

  @ApiProperty({
    type: String,
    description: "Match end time (ISO 8601)",
    example: "2026-06-22T10:30:45.123Z",
  })
  endedAt!: string;
}
