import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length } from "class-validator";

export class LoginDto {
  @ApiProperty({ type: String, format: "email", example: "player@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: String, minLength: 1, maxLength: 128, example: "password1234" })
  @IsString()
  @Length(1, 128)
  password!: string;
}
