import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length, Matches } from "class-validator";

export class RegisterDto {
  @ApiProperty({ type: String, format: "email", example: "player@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: String, minLength: 10, maxLength: 128, example: "password1234" })
  @IsString()
  @Length(10, 128)
  password!: string;

  @ApiProperty({
    type: String,
    minLength: 3,
    maxLength: 30,
    pattern: "^[a-zA-Z0-9_-]+$",
    example: "player1",
  })
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: "displayName must be alphanumeric (plus _ and -)",
  })
  displayName!: string;
}
