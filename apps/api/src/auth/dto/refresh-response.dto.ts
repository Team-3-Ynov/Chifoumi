import { ApiProperty } from "@nestjs/swagger";
import { TokensDto } from "./tokens.dto.js";

export class RefreshResponseDto {
  @ApiProperty({ type: () => TokensDto })
  tokens!: TokensDto;
}
