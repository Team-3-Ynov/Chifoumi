import { ApiProperty } from "@nestjs/swagger";
import { TokensDto } from "./tokens.dto.js";

export class SafeUserDto {
  @ApiProperty({ type: String, format: "uuid", example: "7b6b95f2-39d9-4f2d-8a58-fb8580d2f7a1" })
  id!: string;

  @ApiProperty({ type: String, format: "email", example: "player@example.com" })
  email!: string;

  @ApiProperty({ type: String, example: "player1" })
  displayName!: string;

  @ApiProperty({ enum: ["player", "admin"], example: "player" })
  role!: "player" | "admin";
}

export class AuthResponseDto {
  @ApiProperty({ type: () => SafeUserDto })
  user!: SafeUserDto;

  @ApiProperty({ type: () => TokensDto })
  tokens!: TokensDto;
}
