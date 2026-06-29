import { ApiProperty } from "@nestjs/swagger";

export class TokensDto {
  @ApiProperty({
    type: String,
    description: "RS256 JWT access token (15 min TTL)",
    example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  access!: string;

  @ApiProperty({
    type: String,
    description: "Opaque refresh token (7 day TTL)",
    example: "vJ6E3j6bU5Wc3cS8mQf9Rk5H2q3T4p1N",
  })
  refresh!: string;
}
