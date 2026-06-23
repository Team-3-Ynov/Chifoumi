import { ApiProperty } from "@nestjs/swagger";

export class LeagueSummaryDto {
  @ApiProperty({ type: String, example: "Gold" })
  name!: string;

  @ApiProperty({ type: Number, example: 3 })
  tier!: number;
}
