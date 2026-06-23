import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsString, Length } from "class-validator";

export class CreateSeasonDto {
  @ApiProperty({ type: String, minLength: 3, maxLength: 60, example: "Saison 3" })
  @IsString()
  @Length(3, 60)
  name!: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "When the season is scheduled to end",
    example: "2026-08-01T00:00:00.000Z",
  })
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;
}
