import { ApiProperty } from "@nestjs/swagger";

export class HashCheckDto {
  @ApiProperty({
    description: "Result of hash verification for player A",
    enum: ["match", "mismatch"],
  })
  a!: "match" | "mismatch";

  @ApiProperty({
    description: "Result of hash verification for player B",
    enum: ["match", "mismatch"],
  })
  b!: "match" | "mismatch";
}

export class AuditRoundDto {
  @ApiProperty({
    description: "Round number (1-indexed)",
    example: 1,
  })
  roundNumber!: number;

  @ApiProperty({
    description: "Player A move commitment (SHA256)",
    example: "abc123def...",
  })
  commitA!: string;

  @ApiProperty({
    description: "Player B move commitment (SHA256)",
    example: "xyz789uvw...",
  })
  commitB!: string;

  @ApiProperty({
    description: "Player A revealed move",
    enum: ["rock", "paper", "scissors"],
    example: "rock",
  })
  moveA!: "rock" | "paper" | "scissors";

  @ApiProperty({
    description: "Player B revealed move",
    enum: ["rock", "paper", "scissors"],
    example: "paper",
  })
  moveB!: "rock" | "paper" | "scissors";

  @ApiProperty({
    description: "Nonce for player A (random string used in hash)",
    example: "nonce-a-xyz",
  })
  nonceA!: string;

  @ApiProperty({
    description: "Nonce for player B (random string used in hash)",
    example: "nonce-b-abc",
  })
  nonceB!: string;

  @ApiProperty({
    description:
      "Hash verification results: match = SHA256(move:nonce) == commit, mismatch = different",
    type: HashCheckDto,
  })
  hashCheck!: HashCheckDto;
}
