import { IsEmail, IsString, Length, Matches } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(10, 128)
  password!: string;

  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: "displayName must be alphanumeric (plus _ and -)",
  })
  displayName!: string;
}
