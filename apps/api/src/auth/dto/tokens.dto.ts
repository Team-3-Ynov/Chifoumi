import { ApiProperty } from "@nestjs/swagger";

export class TokensDto {
  @ApiProperty({ description: "RS256 JWT access token (15 min TTL)" })
  access!: string;

  @ApiProperty({ description: "Opaque refresh token (7 day TTL)" })
  refresh!: string;
}
