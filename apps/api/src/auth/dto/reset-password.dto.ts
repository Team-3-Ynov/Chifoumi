import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, Length } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({
    description: "Opaque password reset token received by email",
    example: "5a7a7a8e-6c4a-4b1a-9f24-9b6f7c2a4e8c",
  })
  @IsString()
  @IsUUID(4)
  token!: string;

  @ApiProperty({ minLength: 10, maxLength: 128, example: "newPassword1234" })
  @IsString()
  @Length(10, 128)
  newPassword!: string;
}
