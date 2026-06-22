import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({ format: "email", example: "player@example.com" })
  @IsEmail()
  email!: string;
}
