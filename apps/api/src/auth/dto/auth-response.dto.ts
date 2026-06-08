import { ApiProperty } from "@nestjs/swagger";
import { TokensDto } from "./tokens.dto.js";

export class SafeUserDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: ["player", "admin"] })
  role!: "player" | "admin";
}

export class AuthResponseDto {
  @ApiProperty({ type: SafeUserDto })
  user!: SafeUserDto;

  @ApiProperty({ type: TokensDto })
  tokens!: TokensDto;
}
