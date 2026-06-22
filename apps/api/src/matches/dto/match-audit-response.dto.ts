import { ApiProperty } from "@nestjs/swagger";

export class RoundHashCheckDto {
  @ApiProperty({ enum: ["match", "mismatch"], example: "match" })
  a!: "match" | "mismatch";

  @ApiProperty({ enum: ["match", "mismatch"], example: "match" })
  b!: "match" | "mismatch";
}

export class MatchAuditRoundDto {
  @ApiProperty({ example: 1 })
  roundNumber!: number;

  @ApiProperty({ nullable: true, example: "a1b2c3..." })
  commitA!: string | null;

  @ApiProperty({ nullable: true, example: "d4e5f6..." })
  commitB!: string | null;

  @ApiProperty({ enum: ["rock", "paper", "scissors"], nullable: true, example: "rock" })
  moveA!: string | null;

  @ApiProperty({ enum: ["rock", "paper", "scissors"], nullable: true, example: "paper" })
  moveB!: string | null;

  @ApiProperty({ nullable: true, example: "deadbeef..." })
  nonceA!: string | null;

  @ApiProperty({ nullable: true, example: "cafebabe..." })
  nonceB!: string | null;

  @ApiProperty({ type: RoundHashCheckDto })
  hashCheck!: RoundHashCheckDto;
}

export class MatchAuditFinalScoreDto {
  @ApiProperty({ example: 2 })
  a!: number;

  @ApiProperty({ example: 1 })
  b!: number;
}

export class MatchAuditResponseDto {
  @ApiProperty({ format: "uuid" })
  matchId!: string;

  @ApiProperty({
    type: [String],
    description: "Player A and player B user ids",
    example: ["7b6b95f2-39d9-4f2d-8a58-fb8580d2f7a1", "8c7c06g3-40ea-5g3e-9b69-gc9691e3g8b2"],
  })
  players!: [string, string];

  @ApiProperty({ type: [MatchAuditRoundDto] })
  rounds!: MatchAuditRoundDto[];

  @ApiProperty({ type: MatchAuditFinalScoreDto })
  finalScore!: MatchAuditFinalScoreDto;

  @ApiProperty({ format: "uuid", nullable: true })
  winner!: string | null;
}
