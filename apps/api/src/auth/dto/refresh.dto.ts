import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class RefreshDto {
  @ApiProperty({
    description: "Opaque refresh token issued at login or a prior refresh",
    minLength: 20,
    example: "dGhpcyBpcyBhbiBvcGFxdWUgcmVmcmVzaCB0b2tlbg",
  })
  @IsString()
  @Length(20, 512)
  refreshToken!: string;
}
